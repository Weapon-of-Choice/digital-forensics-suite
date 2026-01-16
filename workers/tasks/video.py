import os
import io
from celery import shared_task
import requests
import json
import numpy as np

from db import insert_video_signature
from storage import get_storage

VSM_SERVICE_URL = os.environ.get("VSM_SERVICE_URL", "http://vsm-service:5000")

@shared_task(bind=True, name="tasks.video.extract_video_signature")
def extract_video_signature(self, media_id: int, object_path: str):
    """Extract video signature using VSM service."""
    try:
        storage = get_storage()
        
        # Download video from MinIO
        file_data = storage.download_file(object_path)
        
        files = {"file": ("video.mp4", io.BytesIO(file_data), "video/mp4")}
        
        response = requests.post(
            f"{VSM_SERVICE_URL}/extract",
            files=files,
            timeout=300
        )
        
        if response.status_code != 200:
            return {"status": "error", "message": f"VSM service error: {response.text}"}
            
        data = response.json()
        
        temporal_sig = data.get("temporal_signature")
        keyframe_hashes = ",".join(data.get("keyframe_hashes", []))
        
        color_hist_list = data.get("color_histogram", [])
        color_hist_bytes = np.array(color_hist_list, dtype=np.float32).tobytes()
        
        audio_fp = data.get("audio_fingerprint")
        
        insert_video_signature(
            media_id=media_id,
            temporal_sig=temporal_sig,
            keyframe_hashes=keyframe_hashes,
            color_hist=color_hist_bytes,
            audio_fp=audio_fp
        )
        
        return {
            "status": "success",
            "media_id": media_id,
            "fps": data.get("fps"),
            "duration": data.get("duration")
        }
        
    except Exception as e:
        return {"status": "error", "message": str(e)}
