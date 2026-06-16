from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from hometable.config import settings
from hometable.database import engine
from hometable.storage import get_storage


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Best-effort: ensure the media bucket exists on startup.
    try:
        get_storage().ensure_bucket()
    except Exception:
        pass
    yield


# Docs/OpenAPI live under /api so they're reachable through the frontend's nginx,
# which only proxies /api/* to the backend (the app root serves the SPA). This
# lets an agent introspect the API at https://<host>/api/openapi.json.
app = FastAPI(
    title="hometable API",
    version="0.2.0",
    lifespan=lifespan,
    openapi_url="/api/openapi.json",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/healthz", tags=["ops"])
def healthz() -> dict[str, str]:
    """Liveness probe — process is up."""
    return {"status": "ok"}


@app.get("/readyz", tags=["ops"])
def readyz() -> JSONResponse:
    """Readiness probe — dependencies (Postgres + object store) are reachable."""
    db_ok = True
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception:
        db_ok = False
    s3_ok = get_storage().ping()
    ready = db_ok and s3_ok
    return JSONResponse(
        status_code=200 if ready else 503,
        content={"ready": ready, "db": db_ok, "storage": s3_ok},
    )


# Resource routers (recipes, tags, meals) are registered here.
def register_routers() -> None:
    from hometable.routers import meals, recipes, tags

    app.include_router(recipes.router, prefix="/api/v1")
    app.include_router(tags.router, prefix="/api/v1")
    app.include_router(meals.router, prefix="/api/v1")


try:
    register_routers()
except ImportError:
    # Routers not present yet (Phase 2); health endpoints still work.
    pass
