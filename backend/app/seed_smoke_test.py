import sys
import os
import time
import uuid
import random
import httpx
import asyncio
from datetime import datetime, timedelta

# Ensure app module is found
sys.path.append('/app') 

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app import models, schemas, crud
from app.storage import get_storage
from celery import Celery

DATABASE_URL = os.environ.get("DATABASE_URL")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

REDIS_URL = os.environ.get("REDIS_URL", "redis://redis:6379/0")
celery = Celery('forensics', broker=REDIS_URL)

def log(msg):
    print(f"[SMOKE TEST] {msg}")

async def fetch_unsplash():
    client_id = os.environ.get("UNSPLASH_ACCESS_KEY")
    if not client_id:
        log("UNSPLASH_ACCESS_KEY not set")
        return None
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"https://api.unsplash.com/photos/random?client_id={client_id}&query=portrait")
        if resp.status_code != 200: return None
        img_url = resp.json()['urls']['regular']
        img_resp = await client.get(img_url)
        return img_resp.content, "unsplash_portrait.jpg"

async def fetch_pexels_video():
    api_key = os.environ.get("PEXELS_API_KEY")
    if not api_key:
        log("PEXELS_API_KEY not set")
        return None
    async with httpx.AsyncClient() as client:
        headers = {"Authorization": api_key}
        resp = await client.get("https://api.pexels.com/videos/search?query=security+camera&per_page=1", headers=headers)
        if resp.status_code != 200: return None
        data = resp.json()
        if not data['videos']: return None
        video = data['videos'][0]
        target_file = next((f for f in video['video_files'] if f['quality'] == 'sd'), video['video_files'][0])
        video_resp = await client.get(target_file['link'])
        return video_resp.content, "pexels_cctv.mp4"

def run_smoke_test():
    try:
        log("Starting comprehensive smoke test (REAL DATA)...")
        
        # 1. Create Case
        log("Creating Case...")
        case_in = schemas.CaseCreate(
            name=f"Operation Real Smoke {int(time.time())}",
            description="Automated comprehensive smoke test with REAL media."
        )
        case = crud.create_case(db, case_in)
        log(f"Case Created: ID {case.id} - {case.name}")

        # 2. Upload Media (Real)
        log("Fetching Real Media...")
        img_data, img_name = asyncio.run(fetch_unsplash()) or (b"fake", "fake.jpg")
        vid_data, vid_name = asyncio.run(fetch_pexels_video()) or (b"fake", "fake.mp4")
        
        storage = get_storage()
        
        # Image
        img_filename = f"{uuid.uuid4()}.jpg"
        img_path = f"cases/{case.id}/{img_filename}"
        storage.upload_bytes(img_data, img_path, "image/jpeg")
        
        media_img = crud.create_media(db, schemas.MediaCreate(
            case_id=case.id,
            original_filename=img_name,
            stored_filename=img_filename,
            file_path=img_path,
            file_size=len(img_data)
        ))
        # Manual Update
        media_img.gps_lat = 51.5074
        media_img.gps_lon = -0.1278
        db.commit()
        db.refresh(media_img)
        log(f"Image Media Created: ID {media_img.id}")

        # Video
        vid_filename = f"{uuid.uuid4()}.mp4"
        vid_path = f"cases/{case.id}/{vid_filename}"
        storage.upload_bytes(vid_data, vid_path, "video/mp4")
        
        media_vid = crud.create_media(db, schemas.MediaCreate(
            case_id=case.id,
            original_filename=vid_name,
            stored_filename=vid_filename,
            file_path=vid_path,
            file_size=len(vid_data)
        ))
        log(f"Video Media Created: ID {media_vid.id}")

        # Trigger Processing
        celery.send_task("tasks.media.process_media", args=[media_img.id])
        celery.send_task("tasks.media.process_media", args=[media_vid.id])
        log("Processing tasks queued.")

        # 3. Create Notes
        log("Creating Notes...")
        note1 = crud.create_case_note(db, case.id, schemas.CaseNoteCreate(
            title="Analysis Started",
            content="Media ingested from surveillance feeds.",
            is_pinned=True
        ))
        
        # 4. Create Tasks
        log("Creating Tasks...")
        task1 = crud.create_task(db, case.id, schemas.TaskCreate(
            title="Verify Identity",
            priority="high",
            due_date=datetime.utcnow() + timedelta(days=1)
        ))

        # 5. Persons & Watchlists
        log("Creating Persons and Watchlist...")
        person = crud.create_person(db, schemas.PersonCreate(
            name="Unknown Suspect 1",
            description="Detected in CCTV",
            threat_level="medium",
            is_watchlist=True
        ))
        
        watchlist = crud.create_watchlist(db, schemas.WatchlistCreate(
            name="Active Investigation Targets",
            description="Suspects linked to Operation Smoke",
            alert_on_match=True
        ))
        
        entry = crud.add_watchlist_entry(db, watchlist.id, schemas.WatchlistEntryCreate(
            person_id=person.id,
            name=person.name
        ))
        log(f"Watchlist '{watchlist.name}' created with entry '{entry.name}'")

        log("Smoke Test Complete.")
        
    except Exception as e:
        log(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    run_smoke_test()
