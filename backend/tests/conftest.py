from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from hometable.database import get_db
from hometable.main import app
from hometable.models import Base
from hometable.storage import get_storage


class FakeStorage:
    """In-memory stand-in for S3Storage. Records uploaded keys for assertions."""

    def __init__(self) -> None:
        self.deleted: list[str] = []
        # key -> head dict (ContentLength / ContentType). Missing keys still "exist"
        # by default so /complete succeeds without a real upload round-trip.
        self.heads: dict[str, dict] = {}

    def ensure_bucket(self) -> None:  # pragma: no cover - noop in tests
        pass

    def presigned_put_url(self, key: str, content_type: str) -> str:
        return f"http://minio.test/put/{key}?ct={content_type}"

    def presigned_get_url(self, key: str) -> str:
        return f"http://minio.test/get/{key}"

    def head(self, key: str) -> dict | None:
        return self.heads.get(key, {"ContentLength": 1024, "ContentType": "video/mp4"})

    def delete(self, key: str) -> None:
        self.deleted.append(key)

    def ping(self) -> bool:
        return True


@pytest.fixture
def storage() -> FakeStorage:
    return FakeStorage()


@pytest.fixture
def client(storage: FakeStorage) -> TestClient:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    # SQLite ignores foreign keys (incl. ON DELETE CASCADE) unless asked, so
    # enable enforcement to mirror Postgres — e.g. deleting a recipe should
    # cascade out of meal_recipes.
    @event.listens_for(engine, "connect")
    def _enable_sqlite_fk(dbapi_conn, _record):
        dbapi_conn.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_storage] = lambda: storage
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
