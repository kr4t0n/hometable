from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """App configuration, loaded from environment / .env.

    Defaults match the dev docker-compose stack so the app runs with no .env present.
    """

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    env: str = "development"
    database_url: str = "postgresql+psycopg://hometable:hometable@localhost:5432/hometable"

    # Object storage (S3-compatible / MinIO)
    s3_endpoint_url: str = "http://localhost:9000"  # server-side calls
    s3_public_endpoint: str = "http://localhost:9000"  # used to SIGN browser-facing URLs
    s3_access_key_id: str = "minioadmin"
    s3_secret_access_key: str = "minioadmin"
    s3_bucket: str = "hometable-media"
    s3_region: str = "us-east-1"

    media_presign_expiry: int = 3600
    max_upload_mb: int = 512

    cors_origins: str = "http://localhost:5173"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024


settings = Settings()
