import os
import io
from celery import shared_task
import numpy as np
import cv2

from db import insert_signature, get_db
from storage import get_storage


@shared_task(bind=True, name="tasks.signatures.extract_and_store_signature")
def extract_and_store_signature(self, media_id: int, object_path: str):
    """Extract image signatures from MinIO-stored image."""
    try:
        storage = get_storage()
        
        # Download image from MinIO
        file_data = storage.download_file(object_path)
        
        # Decode image from bytes
        nparr = np.frombuffer(file_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            return {"status": "error", "message": "Cannot read image"}
        
        # Compute ORB features
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        orb = cv2.ORB_create(nfeatures=500)
        keypoints, descriptors = orb.detectAndCompute(gray, None)
        
        kp_data = [(kp.pt, kp.size, kp.angle, kp.response, kp.octave) for kp in keypoints]
        kp_bytes = np.array(kp_data, dtype=np.float32).tobytes() if kp_data else None
        desc_bytes = descriptors.tobytes() if descriptors is not None else None
        
        # Compute color histogram
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        hist = cv2.calcHist([hsv], [0, 1], None, [50, 60], [0, 180, 0, 256])
        hist = cv2.normalize(hist, hist).flatten()
        hist_bytes = hist.astype(np.float32).tobytes()
        
        insert_signature(media_id, kp_bytes, desc_bytes, hist_bytes)
        
        return {
            "status": "success",
            "media_id": media_id,
            "keypoint_count": len(keypoints) if keypoints else 0
        }
        
    except Exception as e:
        return {"status": "error", "message": str(e)}


@shared_task(name="tasks.signatures.find_similar_by_signature")
def find_similar_by_signature(media_id: int, match_type: str = "combined", threshold: float = 0.7):
    from sqlalchemy import text
    
    with get_db() as db:
        target = db.execute(
            text("SELECT orb_descriptors, color_histogram FROM image_signatures WHERE media_id = :id"),
            {"id": media_id}
        ).fetchone()
        
        if not target:
            return {"status": "error", "message": "Signature not found"}
        
        all_sigs = db.execute(
            text("""
                SELECT is.media_id, is.orb_descriptors, is.color_histogram, m.case_id, m.original_filename
                FROM image_signatures is
                JOIN media m ON is.media_id = m.id
                WHERE is.media_id != :id
            """),
            {"id": media_id}
        ).fetchall()
    
    target_desc = np.frombuffer(target[0], dtype=np.uint8) if target[0] else None
    target_hist = np.frombuffer(target[1], dtype=np.float32) if target[1] else None
    
    matches = []
    
    for sig_media_id, sig_desc, sig_hist, case_id, filename in all_sigs:
        score = 0.0
        match_count = 0
        
        if match_type in ("color", "combined") and target_hist is not None and sig_hist:
            sig_hist_arr = np.frombuffer(sig_hist, dtype=np.float32)
            if len(target_hist) == len(sig_hist_arr):
                color_score = float(np.minimum(target_hist, sig_hist_arr).sum())
                score += color_score
                match_count += 1
        
        if match_type in ("orb", "combined") and target_desc is not None and sig_desc:
            sig_desc_arr = np.frombuffer(sig_desc, dtype=np.uint8)
            if len(target_desc) > 0 and len(sig_desc_arr) > 0:
                try:
                    target_2d = target_desc.reshape(-1, 32)
                    sig_2d = sig_desc_arr.reshape(-1, 32)
                    min_len = min(len(target_2d), len(sig_2d))
                    if min_len > 0:
                        distances = []
                        for i in range(min(50, min_len)):
                            d = np.unpackbits(target_2d[i] ^ sig_2d[i]).sum()
                            distances.append(d)
                        orb_score = 1.0 - (np.mean(distances) / 256.0)
                        score += orb_score
                        match_count += 1
                except Exception:
                    pass
        
        if match_count > 0:
            final_score = score / match_count
            if final_score >= threshold:
                matches.append({
                    "media_id": sig_media_id,
                    "case_id": case_id,
                    "filename": filename,
                    "score": final_score,
                    "match_type": match_type
                })
    
    matches.sort(key=lambda x: x["score"], reverse=True)
    return {"status": "success", "matches": matches[:50]}


@shared_task(name="tasks.signatures.batch_extract_signatures")
def batch_extract_signatures(media_ids: list):
    from db import get_db
    from sqlalchemy import text
    
    with get_db() as db:
        media_list = db.execute(
            text("SELECT id, file_path FROM media WHERE id = ANY(:ids)"),
            {"ids": media_ids}
        ).fetchall()
    
    for media_id, object_path in media_list:
        extract_and_store_signature.delay(media_id, object_path)
    
    return {"status": "queued", "count": len(media_list)}
