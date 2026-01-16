import os
import sys

# Ensure current directory is in path so we can import app
sys.path.append(os.getcwd())

from sqlalchemy import text
from app.database import engine

def fix_schema():
    print("Connecting to database...")
    with engine.connect() as conn:
        # Force commit for schema changes
        conn = conn.execution_options(isolation_level="AUTOCOMMIT")
        
        print("Checking and fixing database schema...")

        # Fix 'faces' table
        print("Fixing 'faces' table...")
        try:
            # We add columns one by one to avoid issues if some exist and some don't in a single statement
            # standardized on ADD COLUMN IF NOT EXISTS which is supported in Postgres 9.6+
            conn.execute(text("ALTER TABLE faces ADD COLUMN IF NOT EXISTS person_id INTEGER REFERENCES persons(id)"))
            conn.execute(text("ALTER TABLE faces ADD COLUMN IF NOT EXISTS identity VARCHAR(255)"))
            conn.execute(text("ALTER TABLE faces ADD COLUMN IF NOT EXISTS confidence FLOAT"))
            conn.execute(text("ALTER TABLE faces ADD COLUMN IF NOT EXISTS thumbnail_path VARCHAR(512)"))
            print("Updated 'faces' table.")
        except Exception as e:
            print(f"Error updating faces table: {e}")

        # Fix 'media' table
        print("Fixing 'media' table...")
        try:
            conn.execute(text("ALTER TABLE media ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending'"))
            conn.execute(text("ALTER TABLE media ADD COLUMN IF NOT EXISTS phash VARCHAR(64)"))
            conn.execute(text("ALTER TABLE media ADD COLUMN IF NOT EXISTS gps_lat FLOAT"))
            conn.execute(text("ALTER TABLE media ADD COLUMN IF NOT EXISTS gps_lon FLOAT"))
            conn.execute(text("ALTER TABLE media ADD COLUMN IF NOT EXISTS gps_alt FLOAT"))
            conn.execute(text("ALTER TABLE media ADD COLUMN IF NOT EXISTS capture_date TIMESTAMP WITH TIME ZONE"))
            conn.execute(text("ALTER TABLE media ADD COLUMN IF NOT EXISTS camera_make VARCHAR(100)"))
            conn.execute(text("ALTER TABLE media ADD COLUMN IF NOT EXISTS camera_model VARCHAR(100)"))
            conn.execute(text("ALTER TABLE media ADD COLUMN IF NOT EXISTS categories TEXT"))
            print("Updated 'media' table.")
        except Exception as e:
            print(f"Error updating media table: {e}")

        print("Schema update complete.")

if __name__ == "__main__":
    fix_schema()
