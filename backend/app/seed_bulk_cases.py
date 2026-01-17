import sys
import os
import time
import uuid
import random
import httpx
import asyncio
from datetime import datetime

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

async def fetch_assets():
    """Fetch one image and one video"""
    print("Fetching fresh assets...")
    img_data = b"mock_image"
    vid_data = b"mock_video"
    img_name = "template.jpg"
    vid_name = "template.mp4"

    # Try Unsplash
    unsplash_key = os.environ.get("UNSPLASH_ACCESS_KEY")
    if unsplash_key:
        async with httpx.AsyncClient() as client:
            try:
                # Use different queries to get variety
                queries = ["person", "city", "technology", "nature", "security"]
                query = random.choice(queries)
                resp = await client.get(f"https://api.unsplash.com/photos/random?client_id={unsplash_key}&query={query}")
                if resp.status_code == 200:
                    data = resp.json()
                    img_url = data['urls']['small']
                    img_resp = await client.get(img_url)
                    img_data = img_resp.content
                    img_name = f"unsplash_{data['id']}.jpg"
            except Exception as e:
                print(f"Unsplash error: {e}")

    # Try Pexels
    pexels_key = os.environ.get("PEXELS_API_KEY")
    if pexels_key:
        async with httpx.AsyncClient() as client:
            try:
                headers = {"Authorization": pexels_key}
                queries = ["security", "people", "street", "traffic"]
                query = random.choice(queries)
                # Random page
                page = random.randint(1, 10)
                resp = await client.get(f"https://api.pexels.com/videos/search?query={query}&per_page=1&page={page}", headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    if data['videos']:
                        video = data['videos'][0]
                        target_file = next((f for f in video['video_files'] if f['quality'] == 'sd'), video['video_files'][0])
                        video_resp = await client.get(target_file['link'])
                        vid_data = video_resp.content
                        vid_name = f"pexels_{video['id']}.mp4"
            except Exception as e:
                print(f"Pexels error: {e}")
    
    return img_data, img_name, vid_data, vid_name

def seed_bulk():
    try:
        storage = get_storage()
        
        # Ensure categories exist
        categories = ["Evidence", "Suspect", "Location", "Vehicle", "Weapon"]
        cat_ids = []
        for cat_name in categories:
            cat = db.query(models.Category).filter_by(name=cat_name).first()
            if not cat:
                cat = models.Category(name=cat_name, color="#6366f1", is_system=True)
                db.add(cat)
                db.commit()
                db.refresh(cat)
            cat_ids.append(cat.id)

        print(f"Starting bulk creation of 10 diverse cases...")
        
        # Reduced to 10 to avoid rate limits but ensure variety
        for i in range(10):
            case_num = i + 1
            print(f"Creating Case {case_num}/10...")
            
            # Fetch fresh assets for EACH case
            img_data, img_name, vid_data, vid_name = asyncio.run(fetch_assets())
            
            # Create Case
            case = crud.create_case(db, schemas.CaseCreate(
                name=f"Case #{2000+case_num}: Operation Diverse {case_num}",
                description=f"Automated case with unique media."
            ))
            
            # Upload Image
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
            
            lat = 51.5074 + (random.random() - 0.5) * 0.5
            lon = -0.1278 + (random.random() - 0.5) * 0.5
            media_img.gps_lat = lat
            media_img.gps_lon = lon
            db.commit()
            
            crud.add_media_category(db, media_img.id, random.choice(cat_ids), "system")
            celery.send_task("tasks.media.process_media", args=[media_img.id])

            # Upload Video
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
            
            crud.add_media_category(db, media_vid.id, random.choice(cat_ids), "system")
            celery.send_task("tasks.media.process_media", args=[media_vid.id])
            
            crud.create_case_note(db, case.id, schemas.CaseNoteCreate(
                title="Evidence Log",
                content=f"Ingested {img_name} and {vid_name}.",
                is_pinned=False
            ))
            
            # Sleep to respect API rate limits
            time.sleep(2)

        print("Bulk seeding complete.")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    seed_bulk()
