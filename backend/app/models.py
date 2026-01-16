from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, LargeBinary, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base


class Case(Base):
    __tablename__ = "cases"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    media = relationship("Media", back_populates="case", cascade="all, delete-orphan")


class Media(Base):
    __tablename__ = "media"
    
    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=False)
    original_filename = Column(String(255), nullable=False)
    stored_filename = Column(String(255), nullable=False)
    file_path = Column(String(512), nullable=False)
    thumbnail_path = Column(String(512))
    file_size = Column(Integer)
    mime_type = Column(String(100))
    
    # Analysis status
    status = Column(String(50), default="pending")  # pending, processing, completed, failed
    
    # Perceptual hash for similarity search
    phash = Column(String(64))
    
    # EXIF/GPS data
    gps_lat = Column(Float)
    gps_lon = Column(Float)
    gps_alt = Column(Float)
    capture_date = Column(DateTime(timezone=True))
    camera_make = Column(String(100))
    camera_model = Column(String(100))
    
    # Detected categories (JSON string)
    categories = Column(Text)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    case = relationship("Case", back_populates="media")
    faces = relationship("Face", back_populates="media", cascade="all, delete-orphan", passive_deletes=True)
    image_signature = relationship("ImageSignature", back_populates="media", cascade="all, delete-orphan", uselist=False, passive_deletes=True)
    video_signature = relationship("VideoSignature", back_populates="media", cascade="all, delete-orphan", uselist=False, passive_deletes=True)
    media_categories = relationship("MediaCategory", back_populates="media", cascade="all, delete-orphan", passive_deletes=True)


class ImageSignature(Base):
    """Stores ORB/SIFT feature signatures for precise image matching"""
    __tablename__ = "image_signatures"
    
    id = Column(Integer, primary_key=True, index=True)
    media_id = Column(Integer, ForeignKey("media.id", ondelete="CASCADE"), nullable=False, unique=True)
    
    # ORB keypoints and descriptors (binary)
    orb_keypoints = Column(LargeBinary)
    orb_descriptors = Column(LargeBinary)
    
    # Color histogram signature
    color_histogram = Column(LargeBinary)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    media = relationship("Media", back_populates="image_signature")


class VideoSignature(Base):
    """Stores video fingerprints for deduplication and matching"""
    __tablename__ = "video_signatures"
    
    id = Column(Integer, primary_key=True, index=True)
    media_id = Column(Integer, ForeignKey("media.id", ondelete="CASCADE"), nullable=False, unique=True)
    
    # Signatures
    temporal_signature = Column(String(64))  # 16-character hex string (64 bits)
    audio_fingerprint = Column(Text)
    
    # JSON or Array storage for complex types (using Text for compatibility)
    keyframe_hashes = Column(Text)  # Comma-separated list of hashes
    color_histogram = Column(LargeBinary)  # Serialized numpy array or float list
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    media = relationship("Media", back_populates="video_signature")


class Category(Base):
    """Predefined categories for media classification"""
    __tablename__ = "categories"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(Text)
    color = Column(String(7))  # Hex color for UI
    is_system = Column(Boolean, default=False)  # AI-generated vs user-created


class MediaCategory(Base):
    """Media categorization with voting"""
    __tablename__ = "media_categories"
    
    id = Column(Integer, primary_key=True, index=True)
    media_id = Column(Integer, ForeignKey("media.id", ondelete="CASCADE"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    
    # Source of categorization
    source = Column(String(50))  # "ai", "user"
    confidence = Column(Float)  # AI confidence score
    
    # Voting
    upvotes = Column(Integer, default=0)
    downvotes = Column(Integer, default=0)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    media = relationship("Media", back_populates="media_categories")


class CaseCategory(Base):
    """Case-level categorization with voting"""
    __tablename__ = "case_categories"
    
    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    
    source = Column(String(50))
    upvotes = Column(Integer, default=0)
    downvotes = Column(Integer, default=0)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Vote(Base):
    """Track individual votes to prevent duplicates"""
    __tablename__ = "votes"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(100))  # Session/user identifier
    vote_type = Column(String(20))  # "media_category", "case_category"
    target_id = Column(Integer)  # MediaCategory.id or CaseCategory.id
    vote = Column(Integer)  # 1 = upvote, -1 = downvote
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Face(Base):
    __tablename__ = "faces"
    
    id = Column(Integer, primary_key=True, index=True)
    media_id = Column(Integer, ForeignKey("media.id", ondelete="CASCADE"), nullable=False)
    
    top = Column(Integer)
    right = Column(Integer)
    bottom = Column(Integer)
    left = Column(Integer)
    
    encoding = Column(LargeBinary)
    thumbnail_path = Column(String(512))
    
    identity = Column(String(255))
    confidence = Column(Float)
    
    person_id = Column(Integer, ForeignKey("persons.id"))
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    media = relationship("Media", back_populates="faces")
    person = relationship("Person", back_populates="faces")


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    keycloak_id = Column(String(100), unique=True, nullable=False)
    email = Column(String(255), unique=True)
    display_name = Column(String(255))
    role = Column(String(50), default="analyst")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_login = Column(DateTime(timezone=True))


class Person(Base):
    __tablename__ = "persons"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    aliases = Column(Text)
    description = Column(Text)
    date_of_birth = Column(DateTime)
    nationality = Column(String(100))
    is_watchlist = Column(Boolean, default=False)
    threat_level = Column(String(20))
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    faces = relationship("Face", back_populates="person")


class CaseNote(Base):
    __tablename__ = "case_notes"
    
    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String(255))
    content = Column(Text, nullable=False)
    is_pinned = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class TimelineEvent(Base):
    __tablename__ = "timeline_events"
    
    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=False)
    event_type = Column(String(50), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    event_date = Column(DateTime(timezone=True))
    media_id = Column(Integer, ForeignKey("media.id"))
    person_id = Column(Integer, ForeignKey("persons.id"))
    location_lat = Column(Float)
    location_lon = Column(Float)
    location_name = Column(String(255))
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class EvidenceChain(Base):
    __tablename__ = "evidence_chain"
    
    id = Column(Integer, primary_key=True, index=True)
    media_id = Column(Integer, ForeignKey("media.id", ondelete="CASCADE"), nullable=False)
    action = Column(String(100), nullable=False)
    description = Column(Text)
    user_id = Column(Integer, ForeignKey("users.id"))
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    hash_before = Column(String(128))
    hash_after = Column(String(128))
    meta_data = Column(Text)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    action = Column(String(100), nullable=False)
    resource_type = Column(String(50))
    resource_id = Column(Integer)
    details = Column(Text)
    ip_address = Column(String(50))
    user_agent = Column(String(512))
    timestamp = Column(DateTime(timezone=True), server_default=func.now())


class Task(Base):
    __tablename__ = "tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    status = Column(String(50), default="pending")
    priority = Column(String(20), default="medium")
    assigned_to = Column(Integer, ForeignKey("users.id"))
    created_by = Column(Integer, ForeignKey("users.id"))
    due_date = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Watchlist(Base):
    __tablename__ = "watchlists"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    alert_on_match = Column(Boolean, default=True)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    entries = relationship("WatchlistEntry", back_populates="watchlist", cascade="all, delete-orphan")


class WatchlistEntry(Base):
    __tablename__ = "watchlist_entries"
    
    id = Column(Integer, primary_key=True, index=True)
    watchlist_id = Column(Integer, ForeignKey("watchlists.id"), nullable=False)
    person_id = Column(Integer, ForeignKey("persons.id"))
    face_encoding = Column(LargeBinary)
    name = Column(String(255))
    notes = Column(Text)
    added_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    watchlist = relationship("Watchlist", back_populates="entries")


class Alert(Base):
    __tablename__ = "alerts"
    
    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"))
    media_id = Column(Integer, ForeignKey("media.id"))
    watchlist_id = Column(Integer, ForeignKey("watchlists.id"))
    watchlist_entry_id = Column(Integer, ForeignKey("watchlist_entries.id"))
    alert_type = Column(String(50), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    severity = Column(String(20), default="medium")
    status = Column(String(50), default="new")
    match_confidence = Column(Float)
    reviewed_by = Column(Integer, ForeignKey("users.id"))
    reviewed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class EntityLink(Base):
    __tablename__ = "entity_links"
    
    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=False)
    source_type = Column(String(50), nullable=False)
    source_id = Column(Integer, nullable=False)
    target_type = Column(String(50), nullable=False)
    target_id = Column(Integer, nullable=False)
    relationship_type = Column(String(100))
    description = Column(Text)
    confidence = Column(Float)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
