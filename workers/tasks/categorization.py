import os
import io
import base64
from celery import shared_task
import requests

from db import get_or_create_category, add_media_category
from storage import get_storage

AI_CATEGORIZER_URL = os.environ.get("AI_CATEGORIZER_URL", "http://ai-categorizer:5000")

CATEGORY_COLORS = {
    "weapons": "#dc2626",
    "narcotics": "#7c3aed",
    "extremism": "#b91c1c",
    "currency": "#ca8a04",
    "documents": "#2563eb",
    "violence": "#991b1b",
    "explicit": "#be123c",
    "safe": "#16a34a",
    "unknown": "#6b7280",
}


@shared_task(bind=True, name="tasks.categorization.categorize_media")
def categorize_media(self, media_id: int, object_path: str):
    """Categorize media using AI service. Downloads from MinIO and sends to categorizer."""
    try:
        storage = get_storage()
        
        # Download image from MinIO
        file_data = storage.download_file(object_path)
        
        # Send to AI categorizer as file upload
        files = {"file": ("image.jpg", io.BytesIO(file_data), "image/jpeg")}
        response = requests.post(
            f"{AI_CATEGORIZER_URL}/classify",
            files=files,
            timeout=120
        )
        
        if response.status_code != 200:
            return {"status": "error", "message": "Categorization service error"}
        
        data = response.json()
        category = data.get("category", "unknown")
        confidence = data.get("confidence", 0.5)
        flags = data.get("flags", [])
        
        color = CATEGORY_COLORS.get(category, "#6b7280")
        cat_id = get_or_create_category(category.title(), color, True)
        add_media_category(media_id, cat_id, "ai", confidence)
        
        if data.get("subcategory") and data["subcategory"] != "none":
            sub_color = CATEGORY_COLORS.get(category, "#6b7280")
            sub_cat_id = get_or_create_category(data["subcategory"].title(), sub_color, True)
            add_media_category(media_id, sub_cat_id, "ai", confidence * 0.9)
        
        return {
            "status": "success",
            "media_id": media_id,
            "category": category,
            "confidence": confidence,
            "flags": flags
        }
        
    except Exception as e:
        return {"status": "error", "message": str(e)}


@shared_task(name="tasks.categorization.batch_categorize")
def batch_categorize(media_ids: list):
    from db import get_db
    from sqlalchemy import text
    
    with get_db() as db:
        media_list = db.execute(
            text("SELECT id, file_path FROM media WHERE id = ANY(:ids)"),
            {"ids": media_ids}
        ).fetchall()
    
    for media_id, object_path in media_list:
        categorize_media.delay(media_id, object_path)
    
    return {"status": "queued", "count": len(media_list)}


@shared_task(name="tasks.categorization.recategorize_all")
def recategorize_all(case_id: int = None):
    from db import get_db
    from sqlalchemy import text
    
    query = "SELECT id, file_path FROM media WHERE mime_type LIKE 'image/%'"
    if case_id:
        query += " AND case_id = :case_id"
    
    with get_db() as db:
        if case_id:
            media_list = db.execute(text(query), {"case_id": case_id}).fetchall()
        else:
            media_list = db.execute(text(query)).fetchall()
    
    for media_id, object_path in media_list:
        categorize_media.delay(media_id, object_path)
    
    return {"status": "queued", "count": len(media_list)}
