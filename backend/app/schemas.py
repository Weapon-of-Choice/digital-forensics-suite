from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List


# ============ CASE ============

class CaseCreate(BaseModel):
    name: str
    description: Optional[str] = None


class Case(BaseModel):
    id: int
    name: str
    description: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


class CaseDetail(Case):
    media_count: Optional[int] = 0
    face_count: Optional[int] = 0


# ============ SIGNATURES ============

class VideoSignature(BaseModel):
    id: int
    temporal_signature: Optional[str]
    audio_fingerprint: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True

class ImageSignature(BaseModel):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True


# ============ FACE ============

class Face(BaseModel):
    id: int
    media_id: int
    top: int
    right: int
    bottom: int
    left: int
    identity: Optional[str]
    confidence: Optional[float]
    thumbnail_path: Optional[str]
    
    class Config:
        from_attributes = True


class FaceMatch(BaseModel):
    face: Face
    distance: float
    media_id: int
    case_id: int


# ============ MEDIA ============

class MediaCreate(BaseModel):
    case_id: int
    original_filename: str
    stored_filename: str
    file_path: str
    file_size: int


class Media(BaseModel):
    id: int
    case_id: int
    original_filename: str
    status: str
    file_size: int
    mime_type: Optional[str]
    gps_lat: Optional[float]
    gps_lon: Optional[float]
    capture_date: Optional[datetime]
    created_at: datetime
    video_signature: Optional[VideoSignature] = None
    image_signature: Optional[ImageSignature] = None
    
    class Config:
        from_attributes = True


class MediaDetail(Media):
    phash: Optional[str]
    gps_alt: Optional[float]
    camera_make: Optional[str]
    camera_model: Optional[str]
    categories: Optional[str]
    faces: List["Face"] = []


# ============ MAP ============

class MapMarker(BaseModel):
    media_id: int
    case_id: int
    lat: float
    lon: float
    thumbnail_path: Optional[str]
    original_filename: str
    capture_date: Optional[datetime]


# ============ CATEGORIES ============

class CategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None
    color: Optional[str] = "#6366f1"


class Category(BaseModel):
    id: int
    name: str
    description: Optional[str]
    color: Optional[str]
    is_system: bool
    
    class Config:
        from_attributes = True


class MediaCategoryCreate(BaseModel):
    media_id: int
    category_id: int
    source: str = "user"
    confidence: Optional[float] = None


class MediaCategoryResponse(BaseModel):
    id: int
    media_id: int
    category: Category
    source: str
    confidence: Optional[float]
    upvotes: int
    downvotes: int
    score: int  # upvotes - downvotes
    
    class Config:
        from_attributes = True


class CaseCategoryCreate(BaseModel):
    case_id: int
    category_id: int
    source: str = "user"


class CaseCategoryResponse(BaseModel):
    id: int
    case_id: int
    category: Category
    source: str
    upvotes: int
    downvotes: int
    score: int
    
    class Config:
        from_attributes = True


class VoteRequest(BaseModel):
    user_id: str
    vote: int  # 1 or -1


# ============ IMAGE SIGNATURE MATCH ============

class SignatureMatch(BaseModel):
    media_id: int
    case_id: int
    original_filename: str
    match_score: float
    match_type: str  # "orb", "color", "combined"


# ============ CASE NOTES ============

class CaseNoteCreate(BaseModel):
    title: Optional[str] = None
    content: str
    is_pinned: bool = False


class CaseNote(BaseModel):
    id: int
    case_id: int
    user_id: Optional[int]
    title: Optional[str]
    content: str
    is_pinned: bool
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True


# ============ TIMELINE ============

class TimelineEventCreate(BaseModel):
    event_type: str
    title: str
    description: Optional[str] = None
    event_date: Optional[datetime] = None
    media_id: Optional[int] = None
    person_id: Optional[int] = None
    location_lat: Optional[float] = None
    location_lon: Optional[float] = None
    location_name: Optional[str] = None


class TimelineEvent(BaseModel):
    id: int
    case_id: int
    event_type: str
    title: str
    description: Optional[str]
    event_date: Optional[datetime]
    media_id: Optional[int]
    person_id: Optional[int]
    location_lat: Optional[float]
    location_lon: Optional[float]
    location_name: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


# ============ TASKS ============

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    priority: str = "medium"
    assigned_to: Optional[int] = None
    due_date: Optional[datetime] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_to: Optional[int] = None
    due_date: Optional[datetime] = None


class Task(BaseModel):
    id: int
    case_id: int
    title: str
    description: Optional[str]
    status: str
    priority: str
    assigned_to: Optional[int]
    due_date: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime
    
    class Config:
        from_attributes = True


# ============ WATCHLISTS ============

class WatchlistCreate(BaseModel):
    name: str
    description: Optional[str] = None
    alert_on_match: bool = True


class WatchlistUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    alert_on_match: Optional[bool] = None


class Watchlist(BaseModel):
    id: int
    name: str
    description: Optional[str]
    is_active: bool
    alert_on_match: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class WatchlistEntryCreate(BaseModel):
    person_id: Optional[int] = None
    name: Optional[str] = None
    notes: Optional[str] = None


class WatchlistEntry(BaseModel):
    id: int
    watchlist_id: int
    person_id: Optional[int]
    name: Optional[str]
    notes: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


# ============ ALERTS ============

class Alert(BaseModel):
    id: int
    case_id: Optional[int]
    media_id: Optional[int]
    watchlist_id: Optional[int]
    alert_type: str
    title: str
    description: Optional[str]
    severity: str
    status: str
    match_confidence: Optional[float]
    created_at: datetime
    
    class Config:
        from_attributes = True


class AlertUpdate(BaseModel):
    status: str
    reviewed_by: Optional[int] = None


# ============ PERSONS ============

class PersonCreate(BaseModel):
    name: str
    aliases: Optional[str] = None
    description: Optional[str] = None
    date_of_birth: Optional[datetime] = None
    nationality: Optional[str] = None
    is_watchlist: bool = False
    threat_level: Optional[str] = None


class PersonUpdate(BaseModel):
    name: Optional[str] = None
    aliases: Optional[str] = None
    description: Optional[str] = None
    date_of_birth: Optional[datetime] = None
    nationality: Optional[str] = None
    is_watchlist: Optional[bool] = None
    threat_level: Optional[str] = None


class Person(BaseModel):
    id: int
    name: str
    aliases: Optional[str]
    description: Optional[str]
    date_of_birth: Optional[datetime]
    nationality: Optional[str]
    is_watchlist: bool
    threat_level: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


# ============ MEDIA UPDATE ============

class MediaUpdate(BaseModel):
    gps_lat: Optional[float] = None
    gps_lon: Optional[float] = None
    gps_alt: Optional[float] = None
    capture_date: Optional[datetime] = None
    notes: Optional[str] = None


# ============ AUDIT LOG ============

class AuditLog(BaseModel):
    id: int
    user_id: Optional[int]
    action: str
    resource_type: Optional[str]
    resource_id: Optional[int]
    details: Optional[str]
    ip_address: Optional[str]
    timestamp: datetime
    
    class Config:
        from_attributes = True


MediaDetail.model_rebuild()
