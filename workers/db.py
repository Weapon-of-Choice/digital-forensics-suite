import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from contextlib import contextmanager

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://forensics:forensics123@db:5432/forensics")

engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_recycle=300)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@contextmanager
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def update_media_status(media_id: int, status: str, **extra_fields):
    with get_db() as db:
        updates = {"status": status, **extra_fields}
        set_clause = ", ".join([f"{k} = :{k}" for k in updates.keys()])
        updates["id"] = media_id
        db.execute(text(f"UPDATE media SET {set_clause} WHERE id = :id"), updates)
        db.commit()


def get_media_by_id(media_id: int):
    with get_db() as db:
        return db.execute(
            text("SELECT id, file_path, stored_filename, case_id FROM media WHERE id = :id"),
            {"id": media_id}
        ).fetchone()


def insert_face(media_id: int, top: int, right: int, bottom: int, left: int, 
                encoding: bytes, thumbnail_path: str = None):
    with get_db() as db:
        result = db.execute(
            text("""
                INSERT INTO faces (media_id, top, right, bottom, left, encoding, thumbnail_path)
                VALUES (:media_id, :top, :right, :bottom, :left, :encoding, :thumbnail_path)
                RETURNING id
            """),
            {
                "media_id": media_id,
                "top": top, "right": right, "bottom": bottom, "left": left,
                "encoding": encoding,
                "thumbnail_path": thumbnail_path
            }
        )
        db.commit()
        return result.fetchone()[0]


def insert_signature(media_id: int, orb_kp: bytes, orb_desc: bytes, color_hist: bytes):
    with get_db() as db:
        db.execute(
            text("""
                INSERT INTO image_signatures (media_id, orb_keypoints, orb_descriptors, color_histogram)
                VALUES (:media_id, :orb_kp, :orb_desc, :color_hist)
                ON CONFLICT (media_id) DO UPDATE SET
                    orb_keypoints = :orb_kp,
                    orb_descriptors = :orb_desc,
                    color_histogram = :color_hist
            """),
            {"media_id": media_id, "orb_kp": orb_kp, "orb_desc": orb_desc, "color_hist": color_hist}
        )
        db.commit()


def insert_video_signature(media_id: int, temporal_sig: str, keyframe_hashes: str, 
                           color_hist: bytes, audio_fp: str = None):
    with get_db() as db:
        db.execute(
            text("""
                INSERT INTO video_signatures (media_id, temporal_signature, keyframe_hashes, 
                                            color_histogram, audio_fingerprint)
                VALUES (:media_id, :temp_sig, :kf_hashes, :color_hist, :audio_fp)
                ON CONFLICT (media_id) DO UPDATE SET
                    temporal_signature = :temp_sig,
                    keyframe_hashes = :kf_hashes,
                    color_histogram = :color_hist,
                    audio_fingerprint = :audio_fp
            """),
            {
                "media_id": media_id, "temp_sig": temporal_sig, 
                "kf_hashes": keyframe_hashes, "color_hist": color_hist,
                "audio_fp": audio_fp
            }
        )
        db.commit()


def get_or_create_category(name: str, color: str = "#6366f1", is_system: bool = True):
    with get_db() as db:
        result = db.execute(text("SELECT id FROM categories WHERE name = :name"), {"name": name}).fetchone()
        if result:
            return result[0]
        result = db.execute(
            text("INSERT INTO categories (name, color, is_system) VALUES (:name, :color, :is_system) RETURNING id"),
            {"name": name, "color": color, "is_system": is_system}
        )
        db.commit()
        return result.fetchone()[0]


def add_media_category(media_id: int, category_id: int, source: str, confidence: float = None):
    with get_db() as db:
        db.execute(
            text("""
                INSERT INTO media_categories (media_id, category_id, source, confidence)
                VALUES (:media_id, :cat_id, :source, :confidence)
                ON CONFLICT DO NOTHING
            """),
            {"media_id": media_id, "cat_id": category_id, "source": source, "confidence": confidence}
        )
        db.commit()


def get_all_faces_with_encoding():
    with get_db() as db:
        return db.execute(
            text("SELECT id, media_id, encoding FROM faces WHERE encoding IS NOT NULL")
        ).fetchall()


def get_watchlist_entries_active():
    with get_db() as db:
        return db.execute(
            text("""
                SELECT we.id, we.watchlist_id, we.name, we.face_encoding, w.alert_on_match
                FROM watchlist_entries we
                JOIN watchlists w ON we.watchlist_id = w.id
                WHERE w.is_active = true
            """)
        ).fetchall()


def create_alert(case_id: int, media_id: int, watchlist_id: int, watchlist_entry_id: int,
                 alert_type: str, title: str, description: str, severity: str, match_confidence: float):
    with get_db() as db:
        db.execute(
            text("""
                INSERT INTO alerts (case_id, media_id, watchlist_id, watchlist_entry_id,
                                   alert_type, title, description, severity, match_confidence)
                VALUES (:case_id, :media_id, :watchlist_id, :watchlist_entry_id,
                        :alert_type, :title, :description, :severity, :match_confidence)
            """),
            {
                "case_id": case_id, "media_id": media_id, "watchlist_id": watchlist_id,
                "watchlist_entry_id": watchlist_entry_id, "alert_type": alert_type,
                "title": title, "description": description, "severity": severity,
                "match_confidence": match_confidence
            }
        )
        db.commit()
