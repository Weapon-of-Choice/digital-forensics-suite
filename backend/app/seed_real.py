import sys
import os
import httpx
import asyncio
import io
import uuid
# Ensure app module is found
sys.path.append('/app') 

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import Case, Media
from app.storage import get_storage
from celery import Celery

DATABASE_URL = os.environ.get("DATABASE_URL")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

REDIS_URL = os.environ.get("REDIS_URL", "redis://redis:6379/0")
celery = Celery('forensics', broker=REDIS_URL)

async def fetch_unsplash():
    client_id = os.environ.get("UNSPLASH_ACCESS_KEY")
    if not client_id:
        print("Error: UNSPLASH_ACCESS_KEY not set")
        return None

    print("Fetching random photo from Unsplash...")
    async with httpx.AsyncClient() as client:
        # Get random photo
        resp = await client.get(
            f"https://api.unsplash.com/photos/random?client_id={client_id}&query=person",
            timeout=10.0
        )
        if resp.status_code != 200:
            print(f"Error fetching from Unsplash: {resp.status_code} {resp.text}")
            return None
        
        data = resp.json()
        img_url = data['urls']['regular']
        print(f"Downloading image from {img_url}...")
        
        img_resp = await client.get(img_url, timeout=30.0)
        file_data = img_resp.content
        
        return file_data, f"unsplash_{data['id']}.jpg"

def seed():
    try:
        # Run async fetch
        result = asyncio.run(fetch_unsplash())
        if not result:
            print("Unsplash fetch failed.")
            return
        
        file_data, filename = result
        print(f"Got image: {filename}, size: {len(file_data)} bytes")
        
        # Upload to MinIO
        storage = get_storage()
        
        case = db.query(Case).filter_by(name="Real Data Case").first()
        if not case:
            case = Case(name="Real Data Case", description="Real images from Unsplash")
            db.add(case)
            db.commit()
            db.refresh(case)
            print(f"Created Case: {case.id}")
        else:
            print(f"Using Case: {case.id}")
        
        stored_filename = f"{uuid.uuid4()}.jpg"
        object_path = f"cases/{case.id}/{stored_filename}"
        
        print(f"Uploading to MinIO: {object_path}")
        storage.upload_bytes(file_data, object_path, "image/jpeg")
        
        # Create Media
        media = Media(
            case_id=case.id,
            original_filename=filename,
            stored_filename=stored_filename,
            file_path=object_path,
            file_size=len(file_data),
            mime_type="image/jpeg",
            status="pending"
        )
        db.add(media)
        db.commit()
        db.refresh(media)
        
        print(f"Created Media: {media.id}. Triggering processing...")
        
        # Trigger Celery Task
        task = celery.send_task("tasks.media.process_media", args=[media.id])
        print(f"Task queued: {task.id}")
        
    except Exception as e:
        print(f"Error seeding: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed()
