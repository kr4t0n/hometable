from __future__ import annotations

import boto3
from botocore.client import Config

from hometable.config import settings


class S3Storage:
    """S3-compatible object storage (MinIO locally; AWS S3 / Cloudflare R2 in prod).

    Two clients are used:
      * ``_client``  — internal endpoint, for server-side ops (head/delete/create-bucket).
      * ``_public``  — public endpoint, used ONLY to sign URLs the browser will fetch.
    """

    def __init__(self) -> None:
        common = dict(
            aws_access_key_id=settings.s3_access_key_id,
            aws_secret_access_key=settings.s3_secret_access_key,
            region_name=settings.s3_region,
            config=Config(signature_version="s3v4"),
        )
        self._client = boto3.client("s3", endpoint_url=settings.s3_endpoint_url, **common)
        self._public = boto3.client("s3", endpoint_url=settings.s3_public_endpoint, **common)
        self._bucket = settings.s3_bucket

    def ensure_bucket(self) -> None:
        try:
            self._client.head_bucket(Bucket=self._bucket)
        except Exception:
            self._client.create_bucket(Bucket=self._bucket)

    def presigned_put_url(self, key: str, content_type: str) -> str:
        return self._public.generate_presigned_url(
            "put_object",
            Params={"Bucket": self._bucket, "Key": key, "ContentType": content_type},
            ExpiresIn=settings.media_presign_expiry,
        )

    def presigned_get_url(self, key: str) -> str:
        return self._public.generate_presigned_url(
            "get_object",
            Params={"Bucket": self._bucket, "Key": key},
            ExpiresIn=settings.media_presign_expiry,
        )

    def head(self, key: str) -> dict | None:
        try:
            return self._client.head_object(Bucket=self._bucket, Key=key)
        except Exception:
            return None

    def delete(self, key: str) -> None:
        try:
            self._client.delete_object(Bucket=self._bucket, Key=key)
        except Exception:
            pass

    def ping(self) -> bool:
        try:
            self._client.head_bucket(Bucket=self._bucket)
            return True
        except Exception:
            return False


_storage: S3Storage | None = None


def get_storage() -> S3Storage:
    global _storage
    if _storage is None:
        _storage = S3Storage()
    return _storage
