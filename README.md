# hometable

A self-hosted, home-made food **recipe menu book** — store, organize, and cook from your own
recipes. Clean and photo-forward, pleasant to use from a phone in the kitchen or a laptop while
meal-planning. Recipes support **photos and video** (uploaded files are the first-class media
path; YouTube/Vimeo embeds are also supported).

> Status: under active construction. See the build phases in `AGENTS.md`.

## Why it exists

A personal cookbook that *you own and host yourself* — your recipes and media live in your own
Postgres database and S3-compatible object store, not a third-party service.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React + TypeScript + Vite + Tailwind + shadcn/ui ("Warm Cookbook" design system) |
| Backend | Python + FastAPI + SQLAlchemy + Alembic |
| Database | Postgres |
| Object storage | S3-compatible (MinIO locally; AWS S3 / Cloudflare R2 in prod) |
| Dev/CI infra | Docker Compose (bundled Postgres + MinIO) |
| Production | Helm chart targeting **external** Postgres + MinIO |

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) + Docker Compose
- [uv](https://docs.astral.sh/uv/) (Python tooling)
- Node.js 22+ and npm

## Quick start (development)

```bash
# 1. Start dependencies (Postgres + MinIO) and create the media bucket
cp .env.example .env
docker compose up -d

# 2. Backend (FastAPI) — http://localhost:8000  (docs at /docs)
cd backend
uv sync --dev
uv run alembic upgrade head
uv run uvicorn hometable.main:app --reload

# 3. Frontend (Vite dev server) — http://localhost:5173
cd ../frontend
npm install
npm run dev
```

The frontend dev server proxies `/api` to the backend, so no CORS juggling locally.

MinIO console is at http://localhost:9001 (user/pass `minioadmin` / `minioadmin`).

## Build, test, lint

```bash
# Backend
cd backend
uv run ruff check . && uv run ruff format --check .
uv run pytest

# Frontend
cd frontend
npx eslint .
npx tsc --noEmit
npm run build
```

## Configuration (environment variables)

See `.env.example` for the full list. Key ones:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | SQLAlchemy Postgres URL |
| `S3_ENDPOINT_URL` | Object store endpoint the backend uses (server-side) |
| `S3_PUBLIC_ENDPOINT` | Endpoint used to **sign** presigned URLs — must be browser-reachable |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | Object store credentials |
| `S3_BUCKET` | Bucket for media |
| `MEDIA_PRESIGN_EXPIRY` | Presigned URL lifetime (seconds) |
| `MAX_UPLOAD_MB` | Max upload size |
| `CORS_ORIGINS` | Allowed browser origins (comma-separated) |

## Project structure

```
hometable/
├── docker-compose.yml     # dev/CI: app deps (Postgres + MinIO)
├── backend/               # FastAPI service (Python, uv)
├── frontend/              # React + Vite app (TypeScript)
└── deploy/helm/hometable/ # Helm chart for k8s (external Postgres + MinIO)
```

## Deployment

- **Dev / CI** → Docker Compose (this repo's `docker-compose.yml`).
- **Production** → the Helm chart under `deploy/helm/hometable/`, which deploys only the app and
  connects to your **existing** Postgres and MinIO via values + existing Secrets. See that chart's
  values for the wiring. Note: presigned URLs are signed against `S3_PUBLIC_ENDPOINT`, which must
  be the externally reachable MinIO address.

## License

TBD.
