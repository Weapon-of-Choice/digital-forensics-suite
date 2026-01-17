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

async def fetch_pexels_video():
    api_key = os.environ.get("PEXELS_API_KEY")
    if not api_key:
        print("Error: PEXELS_API_KEY not set")
        return None

    print("Fetching random video from Pexels...")
    async with httpx.AsyncClient() as client:
        # Search for CCTV or security footage
        headers = {"Authorization": api_key}
        resp = await client.get(
            "https://api.pexels.com/videos/search?query=security+camera&per_page=1",
            headers=headers,
            timeout=10.0
        )
        if resp.status_code != 200:
            print(f"Error fetching from Pexels: {resp.status_code} {resp.text}")
            return None
        
        data = resp.json()
        if not data['videos']:
            print("No videos found.")
            return None
            
        video = data['videos'][0]
        # Get highest quality file? Or smallest for testing?
        # Let's get SD to be fast.
        video_files = video['video_files']
        # Find one with 'sd' quality or just pick first
        target_file = next((f for f in video_files if f['quality'] == 'sd'), video_files[0])
        
        video_url = target_file['link']
        print(f"Downloading video from {video_url}...")
        
        video_resp = await client.get(video_url, timeout=60.0)
        file_data = video_resp.content
        
        return file_data, f"pexels_{video['id']}.mp4"

def seed():
    try:
        # Run async fetch
        result = asyncio.run(fetch_pexels_video())
        if not result:
            print("Pexels fetch failed.")
            return
        
        file_data, filename = result
        print(f"Got video: {filename}, size: {len(file_data)} bytes")
        
        # Upload to MinIO
        storage = get_storage()
        
        case = db.query(Case).filter_by(name="Real Data Case").first()
        if not case:
            case = Case(name="Real Data Case", description="Real data from APIs")
            db.add(case)
            db.commit()
            db.refresh(case)
        else:
            print(f"Using Case: {case.id}")
        
        stored_filename = f"{uuid.uuid4()}.mp4"
        object_path = f"cases/{case.id}/{stored_filename}"
        
        print(f"Uploading to MinIO: {object_path}")
        storage.upload_bytes(file_data, object_path, "video/mp4")
        
        # Create Media
        media = Media(
            case_id=case.id,
            original_filename=filename,
            stored_filename=stored_filename,
            file_path=object_path,
            file_size=len(file_data),
            mime_type="video/mp4",
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
