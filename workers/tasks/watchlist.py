import os
from celery import shared_task
import numpy as np

from db import (
    get_db, get_media_by_id, get_all_faces_with_encoding, 
    get_watchlist_entries_active, create_alert
)


@shared_task(bind=True, name="tasks.watchlist.check_against_watchlist")
def check_against_watchlist(self, media_id: int):
    from sqlalchemy import text
    
    media = get_media_by_id(media_id)
    if not media:
        return {"status": "error", "message": "Media not found"}
    
    case_id = media[3]
    
    with get_db() as db:
        faces = db.execute(
            text("SELECT id, encoding FROM faces WHERE media_id = :id AND encoding IS NOT NULL"),
            {"id": media_id}
        ).fetchall()
    
    if not faces:
        return {"status": "success", "matches": [], "message": "No faces to check"}
    
    watchlist_entries = get_watchlist_entries_active()
    
    matches = []
    threshold = 0.5
    
    for face_id, face_encoding in faces:
        if not face_encoding:
            continue
        face_enc = np.frombuffer(face_encoding, dtype=np.float64)
        
        for entry_id, watchlist_id, name, wl_encoding, alert_on_match in watchlist_entries:
            if not wl_encoding:
                continue
            
            wl_enc = np.frombuffer(wl_encoding, dtype=np.float64)
            distance = float(np.linalg.norm(face_enc - wl_enc))
            
            if distance < threshold:
                confidence = max(0, 1 - distance)
                
                if alert_on_match:
                    create_alert(
                        case_id=case_id,
                        media_id=media_id,
                        watchlist_id=watchlist_id,
                        watchlist_entry_id=entry_id,
                        alert_type="watchlist_match",
                        title=f"Watchlist Match: {name or 'Unknown'}",
                        description=f"Face detected matching watchlist entry with {confidence:.0%} confidence",
                        severity="high" if confidence > 0.8 else "medium",
                        match_confidence=confidence
                    )
                
                matches.append({
                    "face_id": face_id,
                    "watchlist_entry_id": entry_id,
                    "watchlist_id": watchlist_id,
                    "name": name,
                    "distance": distance,
                    "confidence": confidence
                })
    
    return {"status": "success", "matches": matches}


@shared_task(name="tasks.watchlist.scan_case_for_watchlist")
def scan_case_for_watchlist(case_id: int):
    from sqlalchemy import text
    
    with get_db() as db:
        media_list = db.execute(
            text("SELECT id FROM media WHERE case_id = :case_id"),
            {"case_id": case_id}
        ).fetchall()
    
    for (media_id,) in media_list:
        check_against_watchlist.delay(media_id)
    
    return {"status": "queued", "count": len(media_list)}


@shared_task(name="tasks.watchlist.add_face_to_watchlist")
def add_face_to_watchlist(face_id: int, watchlist_id: int, name: str = None, notes: str = None):
    from sqlalchemy import text
    
    with get_db() as db:
        face = db.execute(
            text("SELECT encoding FROM faces WHERE id = :id"),
            {"id": face_id}
        ).fetchone()
        
        if not face or not face[0]:
            return {"status": "error", "message": "Face encoding not found"}
        
        db.execute(
            text("""
                INSERT INTO watchlist_entries (watchlist_id, face_encoding, name, notes)
                VALUES (:wl_id, :encoding, :name, :notes)
            """),
            {
                "wl_id": watchlist_id,
                "encoding": face[0],
                "name": name,
                "notes": notes
            }
        )
        db.commit()
    
    return {"status": "success", "face_id": face_id, "watchlist_id": watchlist_id}


@shared_task(name="tasks.watchlist.scan_all_for_new_entry")
def scan_all_for_new_entry(watchlist_entry_id: int):
    from sqlalchemy import text
    
    with get_db() as db:
        entry = db.execute(
            text("""
                SELECT we.face_encoding, we.name, w.id, w.alert_on_match
                FROM watchlist_entries we
                JOIN watchlists w ON we.watchlist_id = w.id
                WHERE we.id = :id
            """),
            {"id": watchlist_entry_id}
        ).fetchone()
        
        if not entry or not entry[0]:
            return {"status": "error", "message": "Watchlist entry not found"}
        
        wl_encoding, name, watchlist_id, alert_on_match = entry
        wl_enc = np.frombuffer(wl_encoding, dtype=np.float64)
        
        all_faces = db.execute(
            text("""
                SELECT f.id, f.media_id, f.encoding, m.case_id
                FROM faces f
                JOIN media m ON f.media_id = m.id
                WHERE f.encoding IS NOT NULL
            """)
        ).fetchall()
    
    threshold = 0.5
    matches = []
    
    for face_id, media_id, encoding, case_id in all_faces:
        face_enc = np.frombuffer(encoding, dtype=np.float64)
        distance = float(np.linalg.norm(face_enc - wl_enc))
        
        if distance < threshold:
            confidence = max(0, 1 - distance)
            
            if alert_on_match:
                create_alert(
                    case_id=case_id,
                    media_id=media_id,
                    watchlist_id=watchlist_id,
                    watchlist_entry_id=watchlist_entry_id,
                    alert_type="watchlist_match",
                    title=f"Watchlist Match: {name or 'Unknown'}",
                    description=f"Existing face matches new watchlist entry with {confidence:.0%} confidence",
                    severity="high" if confidence > 0.8 else "medium",
                    match_confidence=confidence
                )
            
            matches.append({
                "face_id": face_id,
                "media_id": media_id,
                "case_id": case_id,
                "distance": distance,
                "confidence": confidence
            })
    
    return {"status": "success", "matches": matches}
