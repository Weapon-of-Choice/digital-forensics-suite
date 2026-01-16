"""MinIO storage utility for media file management."""
import os
import io
from typing import Optional, BinaryIO
from minio import Minio
from minio.error import S3Error
from urllib.parse import urlparse


class StorageClient:
    """MinIO/S3-compatible storage client."""
    
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
    
    def get_presigned_url(
        self,
        object_name: str,
        bucket: Optional[str] = None,
        expires: int = 3600
    ) -> str:
        """
        Get a presigned URL for downloading a file.
        
        Args:
            object_name: Object key/path in bucket
            bucket: Source bucket (defaults to media bucket)
            expires: URL expiration time in seconds (default 1 hour)
            
        Returns:
            Presigned URL string
        """
        bucket = bucket or self.bucket
        from datetime import timedelta
        
        url = self.client.presigned_get_object(
            bucket,
            object_name,
            expires=timedelta(seconds=expires)
        )
        return url
    
    def get_presigned_upload_url(
        self,
        object_name: str,
        bucket: Optional[str] = None,
        expires: int = 3600
    ) -> str:
        """
        Get a presigned URL for uploading a file.
        
        Args:
            object_name: Object key/path in bucket
            bucket: Target bucket (defaults to media bucket)
            expires: URL expiration time in seconds (default 1 hour)
            
        Returns:
            Presigned URL string
        """
        bucket = bucket or self.bucket
        from datetime import timedelta
        
        url = self.client.presigned_put_object(
            bucket,
            object_name,
            expires=timedelta(seconds=expires)
        )
        return url
    
    def delete_file(self, object_name: str, bucket: Optional[str] = None) -> bool:
        """
        Delete a file from storage.
        
        Args:
            object_name: Object key/path in bucket
            bucket: Source bucket (defaults to media bucket)
            
        Returns:
            True if successful
        """
        bucket = bucket or self.bucket
        
        try:
            self.client.remove_object(bucket, object_name)
            return True
        except S3Error:
            return False
    
    def file_exists(self, object_name: str, bucket: Optional[str] = None) -> bool:
        """Check if a file exists in storage."""
        bucket = bucket or self.bucket
        
        try:
            self.client.stat_object(bucket, object_name)
            return True
        except S3Error:
            return False
    
    def list_files(self, prefix: str = "", bucket: Optional[str] = None) -> list:
        """
        List files in storage with optional prefix filter.
        
        Args:
            prefix: Filter by object name prefix
            bucket: Source bucket (defaults to media bucket)
            
        Returns:
            List of object names
        """
        bucket = bucket or self.bucket
        
        objects = self.client.list_objects(bucket, prefix=prefix, recursive=True)
        return [obj.object_name for obj in objects]
    
    def get_file_info(self, object_name: str, bucket: Optional[str] = None) -> dict:
        """
        Get file metadata.
        
        Args:
            object_name: Object key/path in bucket
            bucket: Source bucket (defaults to media bucket)
            
        Returns:
            Dict with file info (size, content_type, last_modified, etag)
        """
        bucket = bucket or self.bucket
        
        try:
            stat = self.client.stat_object(bucket, object_name)
            return {
                "size": stat.size,
                "content_type": stat.content_type,
                "last_modified": stat.last_modified,
                "etag": stat.etag
            }
        except S3Error:
            return None
    
    # Convenience methods for thumbnails
    def upload_thumbnail(self, file_data: BinaryIO, object_name: str, content_type: str = "image/jpeg") -> str:
        """Upload a thumbnail image."""
        return self.upload_file(file_data, object_name, content_type, self.thumbnails_bucket)
    
    def get_thumbnail_url(self, object_name: str, expires: int = 86400) -> str:
        """Get a presigned URL for a thumbnail (default 24 hour expiry)."""
        return self.get_presigned_url(object_name, self.thumbnails_bucket, expires)
    
    def delete_thumbnail(self, object_name: str) -> bool:
        """Delete a thumbnail."""
        return self.delete_file(object_name, self.thumbnails_bucket)


# Global instance getter
def get_storage() -> StorageClient:
    """Get the storage client instance."""
    return StorageClient.get_instance()
