from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse, StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import os
import uuid
import io

from datetime import datetime
from .database import get_db, engine
from . import models, schemas, crud
from .auth import get_current_user, require_auth, require_admin, require_analyst, CurrentUser
from .storage import get_storage

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Forensic Media Analysis Platform", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {"status": "ok"}


# ============ DASHBOARD STATS ============

@app.get("/stats/dashboard")
def get_dashboard_stats(db: Session = Depends(get_db)):
    """Get aggregated statistics for the dashboard"""
    total_cases = db.query(models.Case).count()
    total_media = db.query(models.Media).count()
    total_faces = db.query(models.Face).count()
    media_with_gps = db.query(models.Media).filter(models.Media.gps_lat.isnot(None)).count()
    processing_media = db.query(models.Media).filter(models.Media.status == "processing").count()
    pending_media = db.query(models.Media).filter(models.Media.status == "pending").count()
    completed_media = db.query(models.Media).filter(models.Media.status == "completed").count()
    failed_media = db.query(models.Media).filter(models.Media.status == "failed").count()
    
    return {
        "total_cases": total_cases,
        "total_media": total_media,
        "total_faces": total_faces,
        "media_with_gps": media_with_gps,
        "processing_media": processing_media,
        "pending_media": pending_media,
        "completed_media": completed_media,
        "failed_media": failed_media,
    }


# ============ CASES ============

@app.post("/cases", response_model=schemas.Case)
def create_case(case: schemas.CaseCreate, db: Session = Depends(get_db)):
    db_case = crud.create_case(db, case)
    crud.create_timeline_event(db, db_case.id, schemas.TimelineEventCreate(
        event_type="case_created",
        title=f"Case Created: {db_case.name}",
        description=db_case.description,
        event_date=datetime.utcnow()
    ))
    return db_case


@app.get("/cases", response_model=List[schemas.Case])
def list_cases(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_cases(db, skip=skip, limit=limit)


@app.get("/cases/{case_id}", response_model=schemas.CaseDetail)
def get_case(case_id: int, db: Session = Depends(get_db)):
    case = crud.get_case(db, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return case


@app.put("/cases/{case_id}", response_model=schemas.Case)
def update_case(case_id: int, updates: schemas.CaseCreate, db: Session = Depends(get_db)):
    case = crud.update_case(db, case_id, updates)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return case


@app.delete("/cases/{case_id}")
def delete_case(case_id: int, db: Session = Depends(get_db)):
    crud.delete_case(db, case_id)
    return {"status": "deleted"}


# ============ MEDIA ============

@app.post("/cases/{case_id}/media", response_model=schemas.Media)
async def upload_media(
    case_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    case = crud.get_case(db, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    file_id = str(uuid.uuid4())
    ext = os.path.splitext(file.filename)[1]
    stored_filename = f"{file_id}{ext}"
    object_name = f"cases/{case_id}/{stored_filename}"
    
    # Read file content and upload to MinIO
    file_content = await file.read()
    storage = get_storage()
    storage_path = storage.upload_bytes(
        file_content,
        object_name,
        content_type=file.content_type or "application/octet-stream"
    )
    
    media = crud.create_media(db, schemas.MediaCreate(
        case_id=case_id,
        original_filename=file.filename,
        stored_filename=stored_filename,
        file_path=object_name,  # Store MinIO object path
        file_size=len(file_content),
    ))
    
    from celery import Celery
    celery_app = Celery(broker=os.environ.get("REDIS_URL", "redis://localhost:6379/0"))
    celery_app.send_task("tasks.media.process_media", args=[media.id], queue="media")
    
    crud.create_timeline_event(db, case_id, schemas.TimelineEventCreate(
        event_type="media_uploaded",
        title=f"Media Uploaded: {file.filename}",
        media_id=media.id,
        event_date=datetime.utcnow()
    ))
    
    return media


@app.get("/cases/{case_id}/media", response_model=List[schemas.Media])
def list_media(case_id: int, db: Session = Depends(get_db)):
    return crud.get_media_by_case(db, case_id)


@app.get("/media/{media_id}", response_model=schemas.MediaDetail)
def get_media(media_id: int, db: Session = Depends(get_db)):
    media = crud.get_media(db, media_id)
    if not media:
        raise HTTPException(status_code=404, detail="Media not found")
    return media


@app.get("/media/{media_id}/file")
def get_media_file(media_id: int, db: Session = Depends(get_db)):
    media = crud.get_media(db, media_id)
    if not media:
        raise HTTPException(status_code=404, detail="Media not found")
    
    storage = get_storage()
    file_data = storage.download_file(media.file_path)
    return Response(content=file_data, media_type=media.mime_type or "application/octet-stream")


@app.get("/media/{media_id}/thumbnail")
def get_media_thumbnail(media_id: int, db: Session = Depends(get_db)):
    media = crud.get_media(db, media_id)
    if not media or not media.thumbnail_path:
        raise HTTPException(status_code=404, detail="Thumbnail not found")
    
    storage = get_storage()
    file_data = storage.download_file(media.thumbnail_path, bucket="thumbnails")
    return Response(content=file_data, media_type="image/jpeg")


# ============ FACES ============

@app.get("/cases/{case_id}/faces", response_model=List[schemas.Face])
def list_faces(case_id: int, db: Session = Depends(get_db)):
    return crud.get_faces_by_case(db, case_id)


@app.post("/faces/{face_id}/identify", response_model=schemas.Face)
def identify_face(face_id: int, name: str, db: Session = Depends(get_db)):
    face = crud.update_face_identity(db, face_id, name)
    if not face:
        raise HTTPException(status_code=404, detail="Face not found")
    return face


@app.get("/faces/search")
def search_faces(face_id: int, threshold: float = 0.6, db: Session = Depends(get_db)):
    """Find similar faces across all cases"""
    return crud.find_similar_faces(db, face_id, threshold)


# ============ SEARCH ============

@app.get("/search/similar")
def search_similar(media_id: int, threshold: int = 10, db: Session = Depends(get_db)):
    """Find visually similar images by perceptual hash"""
    return crud.find_similar_media(db, media_id, threshold)


@app.post("/search/similar/upload")
async def search_similar_upload(
    file: UploadFile = File(...), threshold: int = 10, db: Session = Depends(get_db)
):
    """Find similar images by uploading a file"""
    content = await file.read()
    return crud.find_similar_media_by_file(db, content, threshold)


@app.get("/search/location")
def search_by_location(
    lat: float, lon: float, radius_km: float = 10,
    db: Session = Depends(get_db)
):
    """Find media within radius of GPS coordinates"""
    return crud.find_media_by_location(db, lat, lon, radius_km)


@app.get("/search/category")
def search_by_category(category: str, db: Session = Depends(get_db)):
    """Find media by detected category"""
    return crud.find_media_by_category(db, category)


@app.get("/search/autocomplete/persons", response_model=List[schemas.Person])
def autocomplete_persons(q: str, db: Session = Depends(get_db)):
    """Autocomplete search for persons"""
    return crud.search_persons(db, q)


@app.get("/search/autocomplete/cases", response_model=List[schemas.Case])
def autocomplete_cases(q: str, db: Session = Depends(get_db)):
    """Autocomplete search for cases"""
    return crud.search_cases(db, q)


# ============ MAP DATA ============

@app.get("/map/markers")
def get_map_markers(case_id: Optional[int] = None, db: Session = Depends(get_db)):
    """Get all media with GPS coordinates for map display"""
    return crud.get_media_with_gps(db, case_id)


# ============ REPORTS ============

@app.get("/cases/{case_id}/report")
def generate_report(case_id: int, db: Session = Depends(get_db)):
    """Generate case summary report"""
    case = crud.get_case(db, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    media_list = crud.get_media_by_case(db, case_id)
    faces = crud.get_faces_by_case(db, case_id)
    
    return {
        "case": case,
        "stats": {
            "total_media": len(media_list),
            "total_faces": len(faces),
            "identified_faces": len([f for f in faces if f.identity]),
            "media_with_gps": len([m for m in media_list if m.gps_lat]),
        },
        "media": media_list,
        "faces": faces,
    }


@app.post("/categories", response_model=schemas.Category)
def create_category(category: schemas.CategoryCreate, db: Session = Depends(get_db)):
    return crud.create_category(db, category)


@app.get("/categories", response_model=List[schemas.Category])
def list_categories(db: Session = Depends(get_db)):
    return crud.get_categories(db)


@app.post("/media/{media_id}/categories", response_model=schemas.MediaCategoryResponse)
def add_media_category(
    media_id: int,
    data: schemas.MediaCategoryCreate,
    db: Session = Depends(get_db)
):
    return crud.add_media_category(db, media_id, data.category_id, data.source, data.confidence)


@app.get("/media/{media_id}/categories", response_model=List[schemas.MediaCategoryResponse])
def get_media_categories(media_id: int, db: Session = Depends(get_db)):
    return crud.get_media_categories(db, media_id)


@app.post("/media-categories/{mc_id}/vote")
def vote_media_category(mc_id: int, vote: schemas.VoteRequest, db: Session = Depends(get_db)):
    return crud.vote_on_media_category(db, mc_id, vote.user_id, vote.vote)


@app.post("/cases/{case_id}/categories", response_model=schemas.CaseCategoryResponse)
def add_case_category(
    case_id: int,
    data: schemas.CaseCategoryCreate,
    db: Session = Depends(get_db)
):
    return crud.add_case_category(db, case_id, data.category_id, data.source)


@app.get("/cases/{case_id}/categories", response_model=List[schemas.CaseCategoryResponse])
def get_case_categories(case_id: int, db: Session = Depends(get_db)):
    return crud.get_case_categories(db, case_id)


@app.post("/case-categories/{cc_id}/vote")
def vote_case_category(cc_id: int, vote: schemas.VoteRequest, db: Session = Depends(get_db)):
    return crud.vote_on_case_category(db, cc_id, vote.user_id, vote.vote)


@app.get("/search/signature")
def search_by_signature(
    media_id: int,
    match_type: str = "combined",
    threshold: float = 0.7,
    db: Session = Depends(get_db)
):
    return crud.find_by_signature(db, media_id, match_type, threshold)


@app.post("/cases/{case_id}/notes", response_model=schemas.CaseNote)
def create_case_note(case_id: int, note: schemas.CaseNoteCreate, db: Session = Depends(get_db)):
    return crud.create_case_note(db, case_id, note)


@app.get("/cases/{case_id}/notes", response_model=List[schemas.CaseNote])
def list_case_notes(case_id: int, db: Session = Depends(get_db)):
    return crud.get_case_notes(db, case_id)


@app.get("/notes", response_model=List[schemas.CaseNote])
def list_global_notes(db: Session = Depends(get_db)):
    return crud.get_case_notes(db, case_id=None)


@app.put("/notes/{note_id}", response_model=schemas.CaseNote)
def update_note(note_id: int, note: schemas.CaseNoteCreate, db: Session = Depends(get_db)):
    result = crud.update_case_note(db, note_id, note.content, note.title, note.is_pinned)
    if not result:
        raise HTTPException(status_code=404, detail="Note not found")
    return result


@app.delete("/notes/{note_id}")
def delete_note(note_id: int, db: Session = Depends(get_db)):
    crud.delete_case_note(db, note_id)
    return {"status": "deleted"}


@app.post("/cases/{case_id}/timeline", response_model=schemas.TimelineEvent)
def create_timeline_event(case_id: int, event: schemas.TimelineEventCreate, db: Session = Depends(get_db)):
    return crud.create_timeline_event(db, case_id, event)


@app.get("/cases/{case_id}/timeline", response_model=List[schemas.TimelineEvent])
def list_timeline_events(case_id: int, db: Session = Depends(get_db)):
    return crud.get_timeline_events(db, case_id)


@app.get("/timeline", response_model=List[schemas.TimelineEvent])
def list_global_timeline_events(db: Session = Depends(get_db)):
    return crud.get_timeline_events(db, case_id=None)


@app.delete("/timeline/{event_id}")
def delete_timeline_event(event_id: int, db: Session = Depends(get_db)):
    crud.delete_timeline_event(db, event_id)
    return {"status": "deleted"}


@app.post("/cases/{case_id}/tasks", response_model=schemas.Task)
def create_task(case_id: int, task: schemas.TaskCreate, db: Session = Depends(get_db)):
    return crud.create_task(db, case_id, task)


@app.get("/cases/{case_id}/tasks", response_model=List[schemas.Task])
def list_tasks(case_id: int, status: Optional[str] = None, db: Session = Depends(get_db)):
    return crud.get_tasks(db, case_id, status)


@app.get("/tasks", response_model=List[schemas.Task])
def list_global_tasks(status: Optional[str] = None, db: Session = Depends(get_db)):
    return crud.get_tasks(db, case_id=None, status=status)


@app.put("/tasks/{task_id}", response_model=schemas.Task)
def update_task(task_id: int, updates: schemas.TaskUpdate, db: Session = Depends(get_db)):
    result = crud.update_task(db, task_id, updates)
    if not result:
        raise HTTPException(status_code=404, detail="Task not found")
    return result


@app.delete("/tasks/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db)):
    crud.delete_task(db, task_id)
    return {"status": "deleted"}


@app.post("/watchlists", response_model=schemas.Watchlist)
def create_watchlist(watchlist: schemas.WatchlistCreate, db: Session = Depends(get_db)):
    return crud.create_watchlist(db, watchlist)


@app.get("/watchlists", response_model=List[schemas.Watchlist])
def list_watchlists(active_only: bool = False, db: Session = Depends(get_db)):
    return crud.get_watchlists(db, active_only)


@app.get("/watchlists/{watchlist_id}", response_model=schemas.Watchlist)
def get_watchlist(watchlist_id: int, db: Session = Depends(get_db)):
    wl = crud.get_watchlist(db, watchlist_id)
    if not wl:
        raise HTTPException(status_code=404, detail="Watchlist not found")
    return wl


@app.post("/watchlists/{watchlist_id}/entries", response_model=schemas.WatchlistEntry)
def add_watchlist_entry(watchlist_id: int, entry: schemas.WatchlistEntryCreate, db: Session = Depends(get_db)):
    return crud.add_watchlist_entry(db, watchlist_id, entry)


@app.get("/watchlists/{watchlist_id}/entries", response_model=List[schemas.WatchlistEntry])
def list_watchlist_entries(watchlist_id: int, db: Session = Depends(get_db)):
    return crud.get_watchlist_entries(db, watchlist_id)


@app.put("/watchlists/{watchlist_id}", response_model=schemas.Watchlist)
def update_watchlist(watchlist_id: int, updates: schemas.WatchlistUpdate, db: Session = Depends(get_db)):
    wl = crud.get_watchlist(db, watchlist_id)
    if not wl:
        raise HTTPException(status_code=404, detail="Watchlist not found")
    for key, value in updates.model_dump(exclude_unset=True).items():
        setattr(wl, key, value)
    db.commit()
    db.refresh(wl)
    return wl


@app.delete("/watchlists/{watchlist_id}")
def delete_watchlist(watchlist_id: int, db: Session = Depends(get_db)):
    wl = crud.get_watchlist(db, watchlist_id)
    if not wl:
        raise HTTPException(status_code=404, detail="Watchlist not found")
    db.delete(wl)
    db.commit()
    return {"status": "deleted"}


@app.delete("/watchlists/{watchlist_id}/entries/{entry_id}")
def delete_watchlist_entry(watchlist_id: int, entry_id: int, db: Session = Depends(get_db)):
    entry = db.query(models.WatchlistEntry).filter(
        models.WatchlistEntry.id == entry_id,
        models.WatchlistEntry.watchlist_id == watchlist_id
    ).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    db.delete(entry)
    db.commit()
    return {"status": "deleted"}


@app.get("/alerts", response_model=List[schemas.Alert])
def list_alerts(case_id: Optional[int] = None, status: Optional[str] = None, db: Session = Depends(get_db)):
    return crud.get_alerts(db, case_id, status)


@app.put("/alerts/{alert_id}", response_model=schemas.Alert)
def update_alert(alert_id: int, updates: schemas.AlertUpdate, db: Session = Depends(get_db)):
    result = crud.update_alert(db, alert_id, updates)
    if not result:
        raise HTTPException(status_code=404, detail="Alert not found")
    return result


@app.post("/persons", response_model=schemas.Person)
def create_person(person: schemas.PersonCreate, db: Session = Depends(get_db)):
    return crud.create_person(db, person)


@app.get("/persons", response_model=List[schemas.Person])
def list_persons(watchlist_only: bool = False, db: Session = Depends(get_db)):
    return crud.get_persons(db, watchlist_only)


@app.get("/persons/{person_id}", response_model=schemas.Person)
def get_person(person_id: int, db: Session = Depends(get_db)):
    person = crud.get_person(db, person_id)
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    return person


@app.put("/persons/{person_id}", response_model=schemas.Person)
def update_person(person_id: int, updates: schemas.PersonUpdate, db: Session = Depends(get_db)):
    person = crud.get_person(db, person_id)
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    for key, value in updates.model_dump(exclude_unset=True).items():
        setattr(person, key, value)
    db.commit()
    db.refresh(person)
    return person


@app.delete("/persons/{person_id}")
def delete_person(person_id: int, db: Session = Depends(get_db)):
    person = crud.get_person(db, person_id)
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    db.delete(person)
    db.commit()
    return {"status": "deleted"}


@app.put("/media/{media_id}", response_model=schemas.Media)
def update_media(media_id: int, updates: schemas.MediaUpdate, db: Session = Depends(get_db)):
    media = crud.get_media(db, media_id)
    if not media:
        raise HTTPException(status_code=404, detail="Media not found")
    for key, value in updates.model_dump(exclude_unset=True).items():
        setattr(media, key, value)
    db.commit()
    db.refresh(media)
    return media


@app.get("/services/health")
def get_services_health():
    """Check health of all microservices."""
    import httpx
    services = {
        "face-service": os.getenv("FACE_SERVICE_URL", "http://face-service:5000"),
        "hash-service": os.getenv("HASH_SERVICE_URL", "http://hash-service:5000"),
        "ai-categorizer": os.getenv("AI_CATEGORIZER_URL", "http://ai-categorizer:5000"),
        "geocoder": os.getenv("GEOCODER_URL", "http://geocoder:5000"),
        "vsm-service": os.getenv("VSM_SERVICE_URL", "http://vsm-service:5000"),
    }
    results = {}
    for name, url in services.items():
        try:
            resp = httpx.get(f"{url}/health", timeout=2.0)
            results[name] = {"status": "healthy" if resp.status_code == 200 else "unhealthy", "code": resp.status_code}
        except Exception as e:
            results[name] = {"status": "unreachable", "error": str(e)}
    return results


@app.get("/audit-logs", response_model=List[schemas.AuditLog])
def list_audit_logs(
    resource_type: Optional[str] = None,
    resource_id: Optional[int] = None,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    return crud.get_audit_logs(db, resource_type, resource_id, limit)


@app.post("/tasks/process-media/{media_id}")
def trigger_process_media(media_id: int):
    from celery import Celery
    celery_app = Celery(broker=os.environ.get("REDIS_URL", "redis://localhost:6379/0"))
    celery_app.send_task("tasks.media.process_media", args=[media_id], queue="media")
    return {"status": "queued", "media_id": media_id, "queue": "media"}


@app.post("/tasks/batch-process")
def trigger_batch_process(media_ids: List[int]):
    from celery import Celery
    celery_app = Celery(broker=os.environ.get("REDIS_URL", "redis://localhost:6379/0"))
    for media_id in media_ids:
        celery_app.send_task("tasks.media.process_media", args=[media_id], queue="media")
    return {"status": "queued", "count": len(media_ids)}


@app.post("/tasks/recategorize-case/{case_id}")
def trigger_recategorize_case(case_id: int, db: Session = Depends(get_db)):
    media_list = crud.get_media_by_case(db, case_id)
    from celery import Celery
    celery_app = Celery(broker=os.environ.get("REDIS_URL", "redis://localhost:6379/0"))
    for media in media_list:
        celery_app.send_task("tasks.categorization.categorize_media", args=[media.id, media.file_path], queue="categorization")
    return {"status": "queued", "count": len(media_list), "queue": "categorization"}


@app.post("/tasks/scan-watchlist/{case_id}")
def trigger_scan_watchlist(case_id: int, db: Session = Depends(get_db)):
    media_list = crud.get_media_by_case(db, case_id)
    from celery import Celery
    celery_app = Celery(broker=os.environ.get("REDIS_URL", "redis://localhost:6379/0"))
    for media in media_list:
        celery_app.send_task("tasks.watchlist.check_against_watchlist", args=[media.id], queue="watchlist")
    return {"status": "queued", "count": len(media_list), "queue": "watchlist"}


@app.post("/tasks/find-similar/{media_id}")
def trigger_find_similar(media_id: int, match_type: str = "combined", threshold: float = 0.7):
    from celery import Celery
    celery_app = Celery(broker=os.environ.get("REDIS_URL", "redis://localhost:6379/0"))
    celery_app.send_task("tasks.signatures.find_similar_by_signature", args=[media_id, match_type, threshold], queue="signatures")
    return {"status": "queued", "media_id": media_id, "queue": "signatures"}


@app.post("/tasks/cluster-faces")
def trigger_cluster_faces(case_id: Optional[int] = None):
    from celery import Celery
    celery_app = Celery(broker=os.environ.get("REDIS_URL", "redis://localhost:6379/0"))
    celery_app.send_task("tasks.faces.cluster_faces", args=[case_id], queue="faces")
    return {"status": "queued", "case_id": case_id, "queue": "faces"}


@app.get("/tasks/queue-status")
def get_queue_status(db: Session = Depends(get_db)):
    from celery import Celery
    celery_app = Celery(broker=os.environ.get("REDIS_URL", "redis://localhost:6379/0"))
    inspect = celery_app.control.inspect()
    
    active = inspect.active() or {}
    reserved = inspect.reserved() or {}
    scheduled = inspect.scheduled() or {}
    
    # Get detailed task info
    active_list = []
    for worker, tasks in active.items():
        for task in tasks:
            active_list.append({
                "worker": worker.split("@")[0] if "@" in worker else worker,
                "task_name": task.get("name", "unknown"),
                "task_id": task.get("id"),
                "args": task.get("args", []),
                "started": task.get("time_start"),
            })
    
    reserved_list = []
    for worker, tasks in reserved.items():
        for task in tasks:
            reserved_list.append({
                "worker": worker.split("@")[0] if "@" in worker else worker,
                "task_name": task.get("name", "unknown"),
                "task_id": task.get("id"),
                "args": task.get("args", []),
            })
    
    # Get media processing stats from DB
    processing_count = db.query(models.Media).filter(models.Media.status == "processing").count()
    pending_count = db.query(models.Media).filter(models.Media.status == "pending").count()
    failed_count = db.query(models.Media).filter(models.Media.status == "failed").count()
    
    # Get recent completed tasks (last 10)
    recent_completed = db.query(models.Media).filter(
        models.Media.status == "completed"
    ).order_by(models.Media.created_at.desc()).limit(10).all()
    
    return {
        "summary": {
            "active_tasks": sum(len(tasks) for tasks in active.values()),
            "reserved_tasks": sum(len(tasks) for tasks in reserved.values()),
            "scheduled_tasks": sum(len(tasks) for tasks in scheduled.values()),
        },
        "media_status": {
            "processing": processing_count,
            "pending": pending_count,
            "failed": failed_count,
        },
        "active_tasks": active_list,
        "reserved_tasks": reserved_list,
        "recent_completed": [
            {
                "id": m.id,
                "filename": m.original_filename,
                "case_id": m.case_id,
            }
            for m in recent_completed
        ],
    }
