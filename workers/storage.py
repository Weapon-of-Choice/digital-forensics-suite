"""MinIO storage utility for worker services."""
import os
import io
import tempfile
from typing import Optional, BinaryIO
from minio import Minio
from minio.error import S3Error
from contextlib import contextmanager


class StorageClient:
    """MinIO/S3-compatible storage client for workers."""
    
    _instance: Optional['StorageClient'] = None
    
    def __init__(self):
        self.endpoint = os.getenv("MINIO_ENDPOINT", "minio:9000")
        self.access_key = os.getenv("MINIO_ACCESS_KEY", "forensics")
        self.secret_key = os.getenv("MINIO_SECRET_KEY", "forensics123")
        self.bucket = os.getenv("MINIO_BUCKET", "media")
        self.thumbnails_bucket = "thumbnails"
        self.secure = os.getenv("MINIO_SECURE", "false").lower() == "true"
        
        self.client = Minio(
            self.endpoint,
            access_key=self.access_key,
            secret_key=self.secret_key,
            secure=self.secure
        )
        
        # Ensure buckets exist
        self._ensure_buckets()
    
    @classmethod
    def get_instance(cls) -> 'StorageClient':
        """Get singleton instance."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
    
    def _ensure_buckets(self):
        """Ensure required buckets exist."""
        for bucket_name in [self.bucket, self.thumbnails_bucket]:
            try:
                if not self.client.bucket_exists(bucket_name):
                    self.client.make_bucket(bucket_name)
            except S3Error as e:
                print(f"Warning: Could not create bucket {bucket_name}: {e}")
    
    def download_file(self, object_name: str, bucket: Optional[str] = None) -> bytes:
        """
        Download a file from storage.
        
        Args:
            object_name: Object key/path in bucket
            bucket: Source bucket (defaults to media bucket)
            
        Returns:
            File contents as bytes
        """
        bucket = bucket or self.bucket
        
        response = self.client.get_object(bucket, object_name)
        try:
            return response.read()
        finally:
            response.close()
            response.release_conn()
    
    @contextmanager
    def download_to_temp_file(self, object_name: str, bucket: Optional[str] = None, suffix: str = None):
        """
        Download file to a temporary file and yield the path.
        Cleans up the temp file after the context exits.
        
        Args:
            object_name: Object key/path in bucket
            bucket: Source bucket (defaults to media bucket)
            suffix: File suffix (e.g., '.jpg')
            
        Yields:
            Path to temporary file
        """
        bucket = bucket or self.bucket
        data = self.download_file(object_name, bucket)
        
        # Create temp file
        fd, temp_path = tempfile.mkstemp(suffix=suffix)
        try:
            with os.fdopen(fd, 'wb') as f:
                f.write(data)
            yield temp_path
        finally:
            # Clean up temp file
            try:
                os.unlink(temp_path)
            except OSError:
                pass
    
    def upload_file(
        self,
        file_data: BinaryIO,
        object_name: str,
        content_type: str = "application/octet-stream",
        bucket: Optional[str] = None
    ) -> str:
        """
        Upload a file to storage.
        
        Args:
            file_data: File-like object or bytes
            object_name: Object key/path in bucket
            content_type: MIME type of the file
            bucket: Target bucket (defaults to media bucket)
            
        Returns:
            Object path (bucket/object_name)
        """
        bucket = bucket or self.bucket
        
        # Get file size
        if hasattr(file_data, 'seek') and hasattr(file_data, 'tell'):
            file_data.seek(0, 2)  # Seek to end
            file_size = file_data.tell()
            file_data.seek(0)  # Seek back to start
        else:
            # If it's bytes, wrap in BytesIO
            if isinstance(file_data, bytes):
                file_size = len(file_data)
                file_data = io.BytesIO(file_data)
            else:
                raise ValueError("Cannot determine file size")
        
        self.client.put_object(
            bucket,
            object_name,
            file_data,
            file_size,
            content_type=content_type
        )
        
        return f"{bucket}/{object_name}"
    
    def upload_bytes(
        self,
        data: bytes,
        object_name: str,
        content_type: str = "application/octet-stream",
        bucket: Optional[str] = None
    ) -> str:
        """Upload bytes to storage."""
        return self.upload_file(
            io.BytesIO(data),
            object_name,
            content_type,
            bucket
        )
    
    def file_exists(self, object_name: str, bucket: Optional[str] = None) -> bool:
        """Check if a file exists in storage."""
        bucket = bucket or self.bucket
        
        try:
            self.client.stat_object(bucket, object_name)
            return True
        except S3Error:
            return False
    
    def delete_file(self, object_name: str, bucket: Optional[str] = None) -> bool:
        """Delete a file from storage."""
        bucket = bucket or self.bucket
        
        try:
            self.client.remove_object(bucket, object_name)
            return True
        except S3Error:
            return False
    
    # Convenience methods for thumbnails
    def upload_thumbnail(self, data: bytes, object_name: str, content_type: str = "image/jpeg") -> str:
        """Upload a thumbnail image."""
        return self.upload_bytes(data, object_name, content_type, self.thumbnails_bucket)
    
    def download_thumbnail(self, object_name: str) -> bytes:
        """Download a thumbnail."""
        return self.download_file(object_name, self.thumbnails_bucket)


# Global instance getter
def get_storage() -> StorageClient:
    """Get the storage client instance."""
    return StorageClient.get_instance()
