from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
import numpy as np
import json
from . import models, schemas


# ============ CASES ============

def create_case(db: Session, case: schemas.CaseCreate) -> models.Case:
    db_case = models.Case(**case.model_dump())
    db.add(db_case)
    db.commit()
    db.refresh(db_case)
    return db_case


def get_cases(db: Session, skip: int = 0, limit: int = 100) -> List[models.Case]:
    return db.query(models.Case).offset(skip).limit(limit).all()


def get_case(db: Session, case_id: int) -> Optional[models.Case]:
    return db.query(models.Case).filter(models.Case.id == case_id).first()


def delete_case(db: Session, case_id: int):
    case = get_case(db, case_id)
    if case:
        media_ids = [m.id for m in case.media]
        if media_ids:
            db.query(models.ImageSignature).filter(models.ImageSignature.media_id.in_(media_ids)).delete(synchronize_session=False)
        db.delete(case)
        db.commit()


# ============ MEDIA ============

def create_media(db: Session, media: schemas.MediaCreate) -> models.Media:
    db_media = models.Media(**media.model_dump())
    db.add(db_media)
    db.commit()
    db.refresh(db_media)
    return db_media


def get_media(db: Session, media_id: int) -> Optional[models.Media]:
    return db.query(models.Media).filter(models.Media.id == media_id).first()


def get_media_by_case(db: Session, case_id: int) -> List[models.Media]:
    return db.query(models.Media).filter(models.Media.case_id == case_id).all()


def update_media_analysis(db: Session, media_id: int, **kwargs):
    db.query(models.Media).filter(models.Media.id == media_id).update(kwargs)
    db.commit()


# ============ FACES ============

def create_face(db: Session, media_id: int, top: int, right: int, bottom: int, left: int, 
                encoding: bytes, thumbnail_path: str = None) -> models.Face:
    face = models.Face(
        media_id=media_id,
        top=top, right=right, bottom=bottom, left=left,
        encoding=encoding,
        thumbnail_path=thumbnail_path
    )
    db.add(face)
    db.commit()
    db.refresh(face)
    return face


def get_faces_by_case(db: Session, case_id: int) -> List[models.Face]:
    return db.query(models.Face).join(models.Media).filter(
        models.Media.case_id == case_id
    ).all()


def get_face(db: Session, face_id: int) -> Optional[models.Face]:
    return db.query(models.Face).filter(models.Face.id == face_id).first()


def update_face_identity(db: Session, face_id: int, name: str) -> Optional[models.Face]:
    face = get_face(db, face_id)
    if face:
        face.identity = name
        db.commit()
        db.refresh(face)
    return face


def find_similar_faces(db: Session, face_id: int, threshold: float = 0.6) -> List[dict]:
    target_face = get_face(db, face_id)
    if not target_face or not target_face.encoding:
        return []
    
    target_encoding = np.frombuffer(target_face.encoding, dtype=np.float64)
    all_faces = db.query(models.Face).filter(
        models.Face.id != face_id,
        models.Face.encoding.isnot(None)
    ).all()
    
    matches = []
    for face in all_faces:
        encoding = np.frombuffer(face.encoding, dtype=np.float64)
        distance = np.linalg.norm(target_encoding - encoding)
        if distance < threshold:
            matches.append({
                "face_id": face.id,
                "media_id": face.media_id,
                "distance": float(distance),
                "identity": face.identity
            })
    
    return sorted(matches, key=lambda x: x["distance"])


# ============ SIMILARITY SEARCH ============

def find_similar_media(db: Session, media_id: int, threshold: int = 10) -> List[dict]:
    """Find similar images using perceptual hash hamming distance"""
    target = get_media(db, media_id)
    if not target or not target.phash:
        return []
    
    all_media = db.query(models.Media).filter(
        models.Media.id != media_id,
        models.Media.phash.isnot(None)
    ).all()
    
    target_hash = int(target.phash, 16)
    matches = []
    
    for media in all_media:
        media_hash = int(media.phash, 16)
        distance = bin(target_hash ^ media_hash).count('1')  # Hamming distance
        if distance <= threshold:
            matches.append({
                "media_id": media.id,
                "case_id": media.case_id,
                "distance": distance,
                "original_filename": media.original_filename
            })
    
    return sorted(matches, key=lambda x: x["distance"])


# ============ LOCATION SEARCH ============

def find_media_by_location(db: Session, lat: float, lon: float, radius_km: float) -> List[models.Media]:
    """Find media within radius of GPS coordinates (approximate)"""
    # Approximate: 1 degree ≈ 111km
    lat_range = radius_km / 111.0
    lon_range = radius_km / (111.0 * np.cos(np.radians(lat)))
    
    return db.query(models.Media).filter(
        models.Media.gps_lat.isnot(None),
        models.Media.gps_lat.between(lat - lat_range, lat + lat_range),
        models.Media.gps_lon.between(lon - lon_range, lon + lon_range)
    ).all()


def get_media_with_gps(db: Session, case_id: Optional[int] = None) -> List[dict]:
    """Get all media with GPS for map display"""
    query = db.query(models.Media).filter(models.Media.gps_lat.isnot(None))
    if case_id:
        query = query.filter(models.Media.case_id == case_id)
    
    return [
        {
            "media_id": m.id,
            "case_id": m.case_id,
            "lat": m.gps_lat,
            "lon": m.gps_lon,
            "thumbnail_path": m.thumbnail_path,
            "original_filename": m.original_filename,
            "capture_date": m.capture_date.isoformat() if m.capture_date else None
        }
        for m in query.all()
    ]


# ============ CATEGORY SEARCH ============

def find_media_by_category(db: Session, category: str) -> List[models.Media]:
    return db.query(models.Media).filter(
        models.Media.categories.contains(category)
    ).all()


def create_category(db: Session, category: schemas.CategoryCreate) -> models.Category:
    db_cat = models.Category(**category.model_dump())
    db.add(db_cat)
    db.commit()
    db.refresh(db_cat)
    return db_cat


def get_categories(db: Session) -> List[models.Category]:
    return db.query(models.Category).all()


def get_category(db: Session, category_id: int) -> Optional[models.Category]:
    return db.query(models.Category).filter(models.Category.id == category_id).first()


def add_media_category(
    db: Session, media_id: int, category_id: int, source: str = "user", confidence: float = None
) -> dict:
    existing = db.query(models.MediaCategory).filter(
        models.MediaCategory.media_id == media_id,
        models.MediaCategory.category_id == category_id
    ).first()
    
    if existing:
        return _format_media_category(db, existing)
    
    mc = models.MediaCategory(
        media_id=media_id,
        category_id=category_id,
        source=source,
        confidence=confidence
    )
    db.add(mc)
    db.commit()
    db.refresh(mc)
    return _format_media_category(db, mc)


def get_media_categories(db: Session, media_id: int) -> List[dict]:
    mcs = db.query(models.MediaCategory).filter(
        models.MediaCategory.media_id == media_id
    ).all()
    return [_format_media_category(db, mc) for mc in mcs]


def _format_media_category(db: Session, mc: models.MediaCategory) -> dict:
    cat = get_category(db, mc.category_id)
    return {
        "id": mc.id,
        "media_id": mc.media_id,
        "category": {
            "id": cat.id,
            "name": cat.name,
            "description": cat.description,
            "color": cat.color,
            "is_system": cat.is_system
        },
        "source": mc.source,
        "confidence": mc.confidence,
        "upvotes": mc.upvotes,
        "downvotes": mc.downvotes,
        "score": mc.upvotes - mc.downvotes
    }


def vote_on_media_category(db: Session, mc_id: int, user_id: str, vote: int) -> dict:
    existing_vote = db.query(models.Vote).filter(
        models.Vote.user_id == user_id,
        models.Vote.vote_type == "media_category",
        models.Vote.target_id == mc_id
    ).first()
    
    mc = db.query(models.MediaCategory).filter(models.MediaCategory.id == mc_id).first()
    if not mc:
        return {"error": "not found"}
    
    if existing_vote:
        if existing_vote.vote == vote:
            return {"status": "already voted"}
        if existing_vote.vote == 1:
            mc.upvotes -= 1
        else:
            mc.downvotes -= 1
        existing_vote.vote = vote
    else:
        new_vote = models.Vote(
            user_id=user_id,
            vote_type="media_category",
            target_id=mc_id,
            vote=vote
        )
        db.add(new_vote)
    
    if vote == 1:
        mc.upvotes += 1
    else:
        mc.downvotes += 1
    
    db.commit()
    return {"status": "voted", "upvotes": mc.upvotes, "downvotes": mc.downvotes}


def add_case_category(db: Session, case_id: int, category_id: int, source: str = "user") -> dict:
    existing = db.query(models.CaseCategory).filter(
        models.CaseCategory.case_id == case_id,
        models.CaseCategory.category_id == category_id
    ).first()
    
    if existing:
        return _format_case_category(db, existing)
    
    cc = models.CaseCategory(case_id=case_id, category_id=category_id, source=source)
    db.add(cc)
    db.commit()
    db.refresh(cc)
    return _format_case_category(db, cc)


def get_case_categories(db: Session, case_id: int) -> List[dict]:
    ccs = db.query(models.CaseCategory).filter(
        models.CaseCategory.case_id == case_id
    ).all()
    return [_format_case_category(db, cc) for cc in ccs]


def _format_case_category(db: Session, cc: models.CaseCategory) -> dict:
    cat = get_category(db, cc.category_id)
    return {
        "id": cc.id,
        "case_id": cc.case_id,
        "category": {
            "id": cat.id,
            "name": cat.name,
            "description": cat.description,
            "color": cat.color,
            "is_system": cat.is_system
        },
        "source": cc.source,
        "upvotes": cc.upvotes,
        "downvotes": cc.downvotes,
        "score": cc.upvotes - cc.downvotes
    }


def vote_on_case_category(db: Session, cc_id: int, user_id: str, vote: int) -> dict:
    existing_vote = db.query(models.Vote).filter(
        models.Vote.user_id == user_id,
        models.Vote.vote_type == "case_category",
        models.Vote.target_id == cc_id
    ).first()
    
    cc = db.query(models.CaseCategory).filter(models.CaseCategory.id == cc_id).first()
    if not cc:
        return {"error": "not found"}
    
    if existing_vote:
        if existing_vote.vote == vote:
            return {"status": "already voted"}
        if existing_vote.vote == 1:
            cc.upvotes -= 1
        else:
            cc.downvotes -= 1
        existing_vote.vote = vote
    else:
        new_vote = models.Vote(
            user_id=user_id,
            vote_type="case_category",
            target_id=cc_id,
            vote=vote
        )
        db.add(new_vote)
    
    if vote == 1:
        cc.upvotes += 1
    else:
        cc.downvotes += 1
    
    db.commit()
    return {"status": "voted", "upvotes": cc.upvotes, "downvotes": cc.downvotes}


def save_image_signature(
    db: Session, media_id: int, orb_kp: bytes, orb_desc: bytes, color_hist: bytes
):
    existing = db.query(models.ImageSignature).filter(
        models.ImageSignature.media_id == media_id
    ).first()
    
    if existing:
        existing.orb_keypoints = orb_kp
        existing.orb_descriptors = orb_desc
        existing.color_histogram = color_hist
    else:
        sig = models.ImageSignature(
            media_id=media_id,
            orb_keypoints=orb_kp,
            orb_descriptors=orb_desc,
            color_histogram=color_hist
        )
        db.add(sig)
    db.commit()


def find_by_signature(
    db: Session, media_id: int, match_type: str = "combined", threshold: float = 0.7
) -> List[dict]:
    target_sig = db.query(models.ImageSignature).filter(
        models.ImageSignature.media_id == media_id
    ).first()
    
    if not target_sig:
        return []
    
    all_sigs = db.query(models.ImageSignature).filter(
        models.ImageSignature.media_id != media_id
    ).all()
    
    matches = []
    target_hist = np.frombuffer(target_sig.color_histogram, dtype=np.float32) if target_sig.color_histogram else None
    target_desc = np.frombuffer(target_sig.orb_descriptors, dtype=np.uint8) if target_sig.orb_descriptors else None
    
    for sig in all_sigs:
        score = 0.0
        match_count = 0
        
        if match_type in ("color", "combined") and target_hist is not None and sig.color_histogram:
            sig_hist = np.frombuffer(sig.color_histogram, dtype=np.float32)
            if len(target_hist) == len(sig_hist):
                color_score = np.minimum(target_hist, sig_hist).sum()
                score += color_score
                match_count += 1
        
        if match_type in ("orb", "combined") and target_desc is not None and sig.orb_descriptors:
            sig_desc = np.frombuffer(sig.orb_descriptors, dtype=np.uint8)
            if len(target_desc) > 0 and len(sig_desc) > 0:
                try:
                    target_desc_2d = target_desc.reshape(-1, 32)
                    sig_desc_2d = sig_desc.reshape(-1, 32)
                    min_len = min(len(target_desc_2d), len(sig_desc_2d))
                    if min_len > 0:
                        distances = []
                        for i in range(min(50, min_len)):
                            d = np.unpackbits(target_desc_2d[i] ^ sig_desc_2d[i]).sum()
                            distances.append(d)
                        orb_score = 1.0 - (np.mean(distances) / 256.0)
                        score += orb_score
                        match_count += 1
                except:
                    pass
        
        if match_count > 0:
            final_score = score / match_count
            if final_score >= threshold:
                media = get_media(db, sig.media_id)
                matches.append({
                    "media_id": sig.media_id,
                    "case_id": media.case_id if media else None,
                    "original_filename": media.original_filename if media else None,
                    "match_score": float(final_score),
                    "match_type": match_type
                })
    
    return sorted(matches, key=lambda x: x["match_score"], reverse=True)


def create_case_note(db: Session, case_id: int, note: "schemas.CaseNoteCreate", user_id: int = None) -> models.CaseNote:
    db_note = models.CaseNote(case_id=case_id, user_id=user_id, **note.model_dump())
    db.add(db_note)
    db.commit()
    db.refresh(db_note)
    return db_note


def get_case_notes(db: Session, case_id: Optional[int] = None) -> List[models.CaseNote]:
    query = db.query(models.CaseNote)
    if case_id:
        query = query.filter(models.CaseNote.case_id == case_id)
    return query.order_by(models.CaseNote.is_pinned.desc(), models.CaseNote.created_at.desc()).all()


def update_case_note(db: Session, note_id: int, content: str, title: str = None, is_pinned: bool = None) -> Optional[models.CaseNote]:
    note = db.query(models.CaseNote).filter(models.CaseNote.id == note_id).first()
    if note:
        if content:
            note.content = content
        if title is not None:
            note.title = title
        if is_pinned is not None:
            note.is_pinned = is_pinned
        db.commit()
        db.refresh(note)
    return note


def delete_case_note(db: Session, note_id: int):
    note = db.query(models.CaseNote).filter(models.CaseNote.id == note_id).first()
    if note:
        db.delete(note)
        db.commit()


def create_timeline_event(db: Session, case_id: int, event: "schemas.TimelineEventCreate", user_id: int = None) -> models.TimelineEvent:
    db_event = models.TimelineEvent(case_id=case_id, created_by=user_id, **event.model_dump())
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    return db_event


def get_timeline_events(db: Session, case_id: Optional[int] = None) -> List[models.TimelineEvent]:
    query = db.query(models.TimelineEvent)
    if case_id:
        query = query.filter(models.TimelineEvent.case_id == case_id)
    return query.order_by(models.TimelineEvent.event_date.desc().nullslast()).all()


def delete_timeline_event(db: Session, event_id: int):
    event = db.query(models.TimelineEvent).filter(models.TimelineEvent.id == event_id).first()
    if event:
        db.delete(event)
        db.commit()


def create_task(db: Session, case_id: int, task: "schemas.TaskCreate", user_id: int = None) -> models.Task:
    db_task = models.Task(case_id=case_id, created_by=user_id, **task.model_dump())
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task


def get_tasks(db: Session, case_id: Optional[int] = None, status: str = None) -> List[models.Task]:
    query = db.query(models.Task)
    if case_id:
        query = query.filter(models.Task.case_id == case_id)
    if status:
        query = query.filter(models.Task.status == status)
    return query.order_by(models.Task.priority.desc(), models.Task.due_date.asc().nullslast()).all()


def update_task(db: Session, task_id: int, updates: "schemas.TaskUpdate") -> Optional[models.Task]:
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if task:
        for key, value in updates.model_dump(exclude_unset=True).items():
            setattr(task, key, value)
        if updates.status == "completed":
            from datetime import datetime
            task.completed_at = datetime.utcnow()
        db.commit()
        db.refresh(task)
    return task


def delete_task(db: Session, task_id: int):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if task:
        db.delete(task)
        db.commit()


def create_watchlist(db: Session, watchlist: "schemas.WatchlistCreate", user_id: int = None) -> models.Watchlist:
    db_wl = models.Watchlist(created_by=user_id, **watchlist.model_dump())
    db.add(db_wl)
    db.commit()
    db.refresh(db_wl)
    return db_wl


def get_watchlists(db: Session, active_only: bool = False) -> List[models.Watchlist]:
    query = db.query(models.Watchlist)
    if active_only:
        query = query.filter(models.Watchlist.is_active == True)
    return query.all()


def get_watchlist(db: Session, watchlist_id: int) -> Optional[models.Watchlist]:
    return db.query(models.Watchlist).filter(models.Watchlist.id == watchlist_id).first()


def add_watchlist_entry(db: Session, watchlist_id: int, entry: "schemas.WatchlistEntryCreate", user_id: int = None) -> models.WatchlistEntry:
    db_entry = models.WatchlistEntry(watchlist_id=watchlist_id, added_by=user_id, **entry.model_dump())
    db.add(db_entry)
    db.commit()
    db.refresh(db_entry)
    return db_entry


def get_watchlist_entries(db: Session, watchlist_id: int) -> List[models.WatchlistEntry]:
    return db.query(models.WatchlistEntry).filter(
        models.WatchlistEntry.watchlist_id == watchlist_id
    ).all()


def get_alerts(db: Session, case_id: int = None, status: str = None) -> List[models.Alert]:
    query = db.query(models.Alert)
    if case_id:
        query = query.filter(models.Alert.case_id == case_id)
    if status:
        query = query.filter(models.Alert.status == status)
    return query.order_by(models.Alert.created_at.desc()).all()


def update_alert(db: Session, alert_id: int, updates: "schemas.AlertUpdate") -> Optional[models.Alert]:
    alert = db.query(models.Alert).filter(models.Alert.id == alert_id).first()
    if alert:
        alert.status = updates.status
        if updates.reviewed_by:
            alert.reviewed_by = updates.reviewed_by
            from datetime import datetime
            alert.reviewed_at = datetime.utcnow()
        db.commit()
        db.refresh(alert)
    return alert


def create_person(db: Session, person: "schemas.PersonCreate", user_id: int = None) -> models.Person:
    db_person = models.Person(created_by=user_id, **person.model_dump())
    db.add(db_person)
    db.commit()
    db.refresh(db_person)
    return db_person


def get_persons(db: Session, watchlist_only: bool = False) -> List[models.Person]:
    query = db.query(models.Person)
    if watchlist_only:
        query = query.filter(models.Person.is_watchlist == True)
    return query.all()


def get_person(db: Session, person_id: int) -> Optional[models.Person]:
    return db.query(models.Person).filter(models.Person.id == person_id).first()


def get_audit_logs(db: Session, resource_type: str = None, resource_id: int = None, limit: int = 100) -> List[models.AuditLog]:
    query = db.query(models.AuditLog)
    if resource_type:
        query = query.filter(models.AuditLog.resource_type == resource_type)
    if resource_id:
        query = query.filter(models.AuditLog.resource_id == resource_id)
    return query.order_by(models.AuditLog.timestamp.desc()).limit(limit).all()


def create_audit_log(db: Session, action: str, resource_type: str = None, resource_id: int = None, 
                     user_id: int = None, details: str = None, ip_address: str = None):
    log = models.AuditLog(
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details,
        ip_address=ip_address
    )
    db.add(log)
    db.commit()


def search_persons(db: Session, query: str, limit: int = 10) -> List[models.Person]:
    return db.query(models.Person).filter(
        models.Person.name.ilike(f"%{query}%")
    ).limit(limit).all()


def search_cases(db: Session, query: str, limit: int = 10) -> List[models.Case]:
    return db.query(models.Case).filter(
        models.Case.name.ilike(f"%{query}%")
    ).limit(limit).all()
