import sys
import os
import time
import uuid
import random
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

def run_smoke_test():
    try:
        log("Starting comprehensive smoke test...")
        
        # 1. Create Case
        log("Creating Case...")
        case_in = schemas.CaseCreate(
            name=f"Operation Smoke {int(time.time())}",
            description="Automated comprehensive smoke test for UI verification."
        )
        case = crud.create_case(db, case_in)
        log(f"Case Created: ID {case.id} - {case.name}")

        # 2. Upload Media (Mock)
        log("Uploading Media (Image + Video)...")
        storage = get_storage()
        
        # Image
        img_filename = f"evidence_img_{uuid.uuid4()}.jpg"
        img_path = f"cases/{case.id}/{img_filename}"
        storage.upload_bytes(b"fake_image_data", img_path, "image/jpeg")
        
        media_img = crud.create_media(db, schemas.MediaCreate(
            case_id=case.id,
            original_filename="suspect_photo.jpg",
            stored_filename=img_filename,
            file_path=img_path,
            file_size=1024
        ))
        # Add Location
        media_img.gps_lat = 51.5074
        media_img.gps_lon = -0.1278
        db.commit()
        db.refresh(media_img)
        log(f"Image Media Created: ID {media_img.id} with GPS")

        # Video
        vid_filename = f"evidence_vid_{uuid.uuid4()}.mp4"
        vid_path = f"cases/{case.id}/{vid_filename}"
        storage.upload_bytes(b"fake_video_data", vid_path, "video/mp4")
        
        media_vid = crud.create_media(db, schemas.MediaCreate(
            case_id=case.id,
            original_filename="cctv_footage.mp4",
            stored_filename=vid_filename,
            file_path=vid_path,
            file_size=5000000
        ))
        log(f"Video Media Created: ID {media_vid.id}")

        # Trigger Processing
        celery.send_task("tasks.media.process_media", args=[media_img.id])
        celery.send_task("tasks.media.process_media", args=[media_vid.id])
        log("Processing tasks queued.")

        # 3. Create Notes
        log("Creating Notes...")
        note1 = crud.create_case_note(db, case.id, schemas.CaseNoteCreate(
            title="Initial Assessment",
            content="Evidence collected from site A. Preliminary analysis suggests multiple subjects.",
            is_pinned=True
        ))
        note2 = crud.create_case_note(db, case.id, schemas.CaseNoteCreate(
            title="Follow-up Required",
            content="Check surveillance logs for 14:00-15:00.",
            is_pinned=False
        ))
        log(f"Notes Created: {note1.title} (Pinned), {note2.title}")

        # 4. Create Tasks
        log("Creating Tasks...")
        task1 = crud.create_task(db, case.id, schemas.TaskCreate(
            title="Review CCTV",
            description="Analyze the video footage for suspect movement.",
            priority="high",
            due_date=datetime.utcnow() + timedelta(days=1)
        ))
        task2 = crud.create_task(db, case.id, schemas.TaskCreate(
            title="Interview Witnesses",
            priority="medium"
        ))
        log(f"Tasks Created: {task1.title} (High), {task2.title} (Medium)")

        # 5. Persons & Watchlists
        log("Creating Persons and Watchlist...")
        person = crud.create_person(db, schemas.PersonCreate(
            name="John Doe",
            aliases="The Ghost",
            description="Suspect in robbery.",
            threat_level="high",
            is_watchlist=True
        ))
        log(f"Person Created: {person.name}")

        watchlist = crud.create_watchlist(db, schemas.WatchlistCreate(
            name="High Priority Targets",
            description="Active suspects for Q1",
            alert_on_match=True
        ))
        log(f"Watchlist Created: {watchlist.name}")

        entry = crud.add_watchlist_entry(db, watchlist.id, schemas.WatchlistEntryCreate(
            person_id=person.id,
            name=person.name,
            notes="Match against all incoming media."
        ))
        log(f"Watchlist Entry Added: {entry.name}")

        # 6. Simulate Alert (Match)
        log("Simulating Alert...")
        # Manually create alert
        alert = models.Alert(
            case_id=case.id,
            media_id=media_img.id,
            watchlist_id=watchlist.id,
            watchlist_entry_id=entry.id,
            alert_type="face_match",
            title=f"Face Match: {person.name}",
            description="High confidence match detected in upload.",
            severity="high",
            match_confidence=0.98
        )
        db.add(alert)
        db.commit()
        log("Alert Created.")

        log("Smoke Test Complete. Data seeded successfully.")
        
    except Exception as e:
        log(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    run_smoke_test()
