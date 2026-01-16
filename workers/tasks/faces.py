import os
import io
import base64
from celery import shared_task
import numpy as np
from PIL import Image

from db import insert_face, get_or_create_category, add_media_category
from storage import get_storage

FACE_SERVICE_URL = os.environ.get("FACE_SERVICE_URL", "http://face-service:5000")


@shared_task(bind=True, name="tasks.faces.detect_and_store_faces")
def detect_and_store_faces(self, media_id: int, object_path: str):
    """Detect faces in an image stored in MinIO and store results."""
    import requests
    
    try:
        storage = get_storage()
        
        # Download image from MinIO
        file_data = storage.download_file(object_path)
        
        # Send to face service as base64
        image_b64 = base64.b64encode(file_data).decode()
        response = requests.post(
            f"{FACE_SERVICE_URL}/detect",
            json={"image_b64": image_b64},
            timeout=120
        )
        
        if response.status_code != 200:
            return {"status": "error", "message": "Face service error"}
        
        data = response.json()
        faces = data.get("faces", [])
        
        face_ids = []
        for face in faces:
            top = face["top"]
            right = face["right"]
            bottom = face["bottom"]
            left = face["left"]
            
            # Decode encoding from base64
            encoding = None
            if face.get("encoding"):
                encoding = base64.b64decode(face["encoding"])
            
            # Crop face and upload thumbnail to MinIO
            face_thumb_path = None
            try:
                img = Image.open(io.BytesIO(file_data))
                face_img = img.crop((left, top, right, bottom))
                
                # Save to bytes
                thumb_buffer = io.BytesIO()
                face_img.save(thumb_buffer, "JPEG")
                thumb_data = thumb_buffer.getvalue()
                
                # Upload to MinIO thumbnails bucket
                face_thumb_path = f"faces/{media_id}/{top}_{left}.jpg"
                storage.upload_thumbnail(thumb_data, face_thumb_path)
            except Exception as e:
                print(f"Face thumbnail creation error: {e}")
            
            face_id = insert_face(media_id, top, right, bottom, left, encoding, face_thumb_path)
            face_ids.append(face_id)
        
        if faces:
            cat_id = get_or_create_category("Person", "#ef4444", True)
            add_media_category(media_id, cat_id, "ai", 0.9)
        
        return {"status": "success", "face_count": len(faces), "face_ids": face_ids}
        
    except Exception as e:
        return {"status": "error", "message": str(e)}


@shared_task(name="tasks.faces.compare_faces")
def compare_faces(face_id_1: int, face_id_2: int):
    import requests
    from db import get_db
    from sqlalchemy import text
    
    with get_db() as db:
        face1 = db.execute(
            text("SELECT encoding FROM faces WHERE id = :id"),
            {"id": face_id_1}
        ).fetchone()
        face2 = db.execute(
            text("SELECT encoding FROM faces WHERE id = :id"),
            {"id": face_id_2}
        ).fetchone()
    
    if not face1 or not face2 or not face1[0] or not face2[0]:
        return {"status": "error", "message": "Face encodings not found"}
    
    enc1 = np.frombuffer(face1[0], dtype=np.float64)
    enc2 = np.frombuffer(face2[0], dtype=np.float64)
    distance = float(np.linalg.norm(enc1 - enc2))
    
    return {
        "status": "success",
        "distance": distance,
        "is_match": distance < 0.6,
        "confidence": max(0, 1 - distance)
    }


@shared_task(name="tasks.faces.find_similar_faces")
def find_similar_faces(face_id: int, threshold: float = 0.6):
    from db import get_db, get_all_faces_with_encoding
    from sqlalchemy import text
    
    with get_db() as db:
        target = db.execute(
            text("SELECT encoding FROM faces WHERE id = :id"),
            {"id": face_id}
        ).fetchone()
    
    if not target or not target[0]:
        return {"status": "error", "message": "Face encoding not found"}
    
    target_enc = np.frombuffer(target[0], dtype=np.float64)
    
    all_faces = get_all_faces_with_encoding()
    matches = []
    
    for fid, mid, encoding in all_faces:
        if fid == face_id or not encoding:
            continue
        enc = np.frombuffer(encoding, dtype=np.float64)
        distance = float(np.linalg.norm(target_enc - enc))
        if distance < threshold:
            matches.append({
                "face_id": fid,
                "media_id": mid,
                "distance": distance,
                "confidence": max(0, 1 - distance)
            })
    
    matches.sort(key=lambda x: x["distance"])
    return {"status": "success", "matches": matches[:50]}


@shared_task(name="tasks.faces.cluster_faces")
def cluster_faces(case_id: int = None):
    from db import get_db
    from sqlalchemy import text
    
    query = """
        SELECT f.id, f.encoding 
        FROM faces f
        JOIN media m ON f.media_id = m.id
        WHERE f.encoding IS NOT NULL
    """
    if case_id:
        query += " AND m.case_id = :case_id"
    
    with get_db() as db:
        if case_id:
            faces = db.execute(text(query), {"case_id": case_id}).fetchall()
        else:
            faces = db.execute(text(query)).fetchall()
    
    if len(faces) < 2:
        return {"status": "success", "clusters": [], "message": "Not enough faces"}
    
    encodings = []
    face_ids = []
    for fid, enc in faces:
        if enc:
            encodings.append(np.frombuffer(enc, dtype=np.float64))
            face_ids.append(fid)
    
    if len(encodings) < 2:
        return {"status": "success", "clusters": []}
    
    threshold = 0.5
    clusters = []
    used = set()
    
    for i, enc in enumerate(encodings):
        if face_ids[i] in used:
            continue
        cluster = [face_ids[i]]
        used.add(face_ids[i])
        
        for j, other_enc in enumerate(encodings):
            if face_ids[j] in used:
                continue
            dist = np.linalg.norm(enc - other_enc)
            if dist < threshold:
                cluster.append(face_ids[j])
                used.add(face_ids[j])
        
        if len(cluster) > 1:
            clusters.append(cluster)
    
    return {"status": "success", "clusters": clusters}
