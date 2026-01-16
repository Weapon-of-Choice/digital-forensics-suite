import os
from celery import Celery

REDIS_URL = os.environ.get("REDIS_URL", "redis://redis:6379/0")

app = Celery(
    "forensics",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=[
        "tasks.media",
        "tasks.faces",
        "tasks.signatures",
        "tasks.categorization",
        "tasks.watchlist",
    ]
)

app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=600,
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_routes={
        "tasks.media.*": {"queue": "media"},
        "tasks.faces.*": {"queue": "faces"},
        "tasks.signatures.*": {"queue": "signatures"},
        "tasks.categorization.*": {"queue": "categorization"},
        "tasks.watchlist.*": {"queue": "watchlist"},
    },
    task_queues={
        "media": {"exchange": "media", "routing_key": "media"},
        "faces": {"exchange": "faces", "routing_key": "faces"},
        "signatures": {"exchange": "signatures", "routing_key": "signatures"},
        "categorization": {"exchange": "categorization", "routing_key": "categorization"},
        "watchlist": {"exchange": "watchlist", "routing_key": "watchlist"},
        "celery": {"exchange": "celery", "routing_key": "celery"},
    },
)
