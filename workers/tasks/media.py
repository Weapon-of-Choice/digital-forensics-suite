import os
import io
from celery import shared_task
from PIL import Image
import imagehash
import exifread
import magic

from db import get_media_by_id, update_media_status
from storage import get_storage


def extract_gps(tags):
    def to_degrees(value):
        d = float(value.values[0].num) / float(value.values[0].den)
        m = float(value.values[1].num) / float(value.values[1].den)
        s = float(value.values[2].num) / float(value.values[2].den)
        return d + (m / 60.0) + (s / 3600.0)
    
    lat = lon = None
    if "GPS GPSLatitude" in tags and "GPS GPSLatitudeRef" in tags:
        lat = to_degrees(tags["GPS GPSLatitude"])
        if tags["GPS GPSLatitudeRef"].values[0] != "N":
            lat = -lat
    
    if "GPS GPSLongitude" in tags and "GPS GPSLongitudeRef" in tags:
        lon = to_degrees(tags["GPS GPSLongitude"])
        if tags["GPS GPSLongitudeRef"].values[0] != "E":
            lon = -lon
    
    return lat, lon


def extract_exif(file_data: bytes):
    """Extract EXIF data from image bytes."""
    data = {
        "gps_lat": None, "gps_lon": None, "gps_alt": None,
        "capture_date": None, "camera_make": None, "camera_model": None
    }
    
    try:
        tags = exifread.process_file(io.BytesIO(file_data), details=False)
        
        lat, lon = extract_gps(tags)
        data["gps_lat"] = lat
        data["gps_lon"] = lon
        
        if "GPS GPSAltitude" in tags:
            alt = tags["GPS GPSAltitude"]
            data["gps_alt"] = float(alt.values[0].num) / float(alt.values[0].den)
        
        if "EXIF DateTimeOriginal" in tags:
            data["capture_date"] = str(tags["EXIF DateTimeOriginal"])
        
        if "Image Make" in tags:
            data["camera_make"] = str(tags["Image Make"])
        if "Image Model" in tags:
            data["camera_model"] = str(tags["Image Model"])
    except Exception as e:
        print(f"EXIF extraction error: {e}")
    
    return data


def compute_phash(file_data: bytes):
    """Compute perceptual hash from image bytes."""
    try:
        img = Image.open(io.BytesIO(file_data))
        return str(imagehash.phash(img))
    except Exception:
        return None


def create_thumbnail(file_data: bytes, size=(200, 200)) -> bytes:
    """Create thumbnail and return as bytes."""
    try:
        img = Image.open(io.BytesIO(file_data))
        img.thumbnail(size)
        output = io.BytesIO()
        img.save(output, "JPEG")
        return output.getvalue()
    except Exception:
        return None


@shared_task(bind=True, name="tasks.media.process_media")
def process_media(self, media_id: int):
    from tasks.faces import detect_and_store_faces
    from tasks.signatures import extract_and_store_signature
    from tasks.categorization import categorize_media
    from tasks.watchlist import check_against_watchlist
    from tasks.video import extract_video_signature
    
    media = get_media_by_id(media_id)
    if not media:
        return {"status": "error", "message": "Media not found"}
    
    # media tuple: (id, file_path, stored_filename, case_id)
    # file_path now contains the MinIO object path like "cases/1/uuid.jpg"
    object_path = media[1]
    stored_filename = media[2]
    case_id = media[3]
    
    update_media_status(media_id, "processing")
    
    try:
        storage = get_storage()
        
        # Download file from MinIO
        file_data = storage.download_file(object_path)
        
        # Detect mime type from bytes
        mime_type = magic.from_buffer(file_data, mime=True)
        updates = {"mime_type": mime_type}
        
        if mime_type.startswith("image/"):
            # Create and upload thumbnail
            thumb_data = create_thumbnail(file_data)
            if thumb_data:
                thumb_object_name = f"cases/{case_id}/{stored_filename}_thumb.jpg"
                storage.upload_thumbnail(thumb_data, thumb_object_name)
                updates["thumbnail_path"] = thumb_object_name
            
            # Compute perceptual hash
            phash = compute_phash(file_data)
            if phash:
                updates["phash"] = phash
            
            # Extract EXIF data
            exif_data = extract_exif(file_data)
            updates.update({k: v for k, v in exif_data.items() if v is not None})
            
            # Queue additional processing tasks
            detect_and_store_faces.delay(media_id, object_path)
            extract_and_store_signature.delay(media_id, object_path)
            categorize_media.delay(media_id, object_path)
            
        elif mime_type.startswith("video/"):
            # Queue video signature extraction
            extract_video_signature.delay(media_id, object_path)
        
        update_media_status(media_id, "completed", **updates)
        
        # Check against watchlists (applies to both, but primarily face-based for now)
        check_against_watchlist.delay(media_id)
        
        return {"status": "success", "media_id": media_id}
        
    except Exception as e:
        update_media_status(media_id, "failed")
        return {"status": "error", "message": str(e)}


@shared_task(name="tasks.media.reprocess_media")
def reprocess_media(media_id: int):
    return process_media(media_id)


@shared_task(name="tasks.media.batch_process")
def batch_process(media_ids: list):
    for media_id in media_ids:
        process_media.delay(media_id)
    return {"status": "queued", "count": len(media_ids)}
