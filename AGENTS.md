# AGENTS.md — hometable

Single source of truth for understanding hometable at a high level. Keep this updated alongside
architectural changes.

## What it is

A self-hosted recipe menu book: CRUD recipes with ingredients, steps, tags, and **media (photos +
video)**. Uploaded media is first-class; YouTube/Vimeo embeds are a secondary option.

## Architecture (monorepo)

```
backend/   FastAPI + SQLAlchemy + Alembic  → Postgres + S3 (MinIO)
frontend/  React + Vite + Tailwind + shadcn/ui
deploy/    Helm chart for k8s (external Postgres + MinIO)
```

The backend is a **thin metadata/control-plane API** in front of Postgres and an S3-compatible
object store. It does **not** stream media bytes: clients upload directly to the object store via
presigned URLs and read media via presigned GET URLs. This keeps the app server cheap and lets the
object store handle range requests (video seeking) natively.

## Key design decisions & trade-offs

- **Python/FastAPI over Go.** The backend is a thin layer in front of Postgres + S3, so language
  performance is a wash for this workload. Python wins on developer velocity, auto-generated
  OpenAPI, Pydantic for the nested recipe model, and keeping future **AI features** (photo→recipe,
  semantic search via `pgvector`) within easy reach.
- **Uploads first-class, via presigned direct-to-object-store.** Large video files never pass
  through the app server. `POST .../media` returns a presigned upload URL + a `pending` media row;
  the browser uploads to MinIO/S3, then calls `.../complete` to flip it to `ready`.
- **Presigned reads.** API responses expand a stored `storage_key` into a short-lived presigned
  GET URL. The object store serves bytes with HTTP range support.
- **S3-compatible storage behind a `Storage` interface.** MinIO locally == AWS S3 / Cloudflare R2
  in prod with no code change. Optional local-disk impl for the lightest dev.
- **Postgres everywhere** (dev via Compose, prod external) for dev/prod parity. SQLite remains an
  optional quick-start and is used for fast unit tests.
- **Two deploy targets.** Docker Compose bundles Postgres + MinIO for dev/CI. The Helm chart ships
  only the app and points at **external** Postgres + MinIO (existing infra).
- **Design system: "Warm Cookbook."** Terracotta/sage/cream palette, Fraunces + Inter (self-hosted
  fonts), shadcn/ui components vendored in-repo. Tokens are CSS variables so dark mode is cheap.

## Module responsibilities (backend)

- `main.py` — FastAPI app, CORS, router registration, `/healthz` + `/readyz`.
- `config.py` — settings from env (pydantic-settings).
- `database.py` — SQLAlchemy engine/session.
- `models.py` — ORM models: Recipe, Ingredient, Step, Media, Tag (+ join).
- `schemas.py` — Pydantic request/response models.
- `storage.py` — `Storage` interface + S3 implementation (boto3 → MinIO); presign + bucket
  bootstrap.
- `routers/` — `recipes.py`, `tags.py` (+ media endpoints under recipes).

## Conventions

- Conventional Commits (`feat(scope): ...`).
- Backend: `uv` for deps, `ruff` for lint+format, `pytest` for tests. API under `/api/v1`.
- Frontend: TypeScript + Tailwind utilities + shadcn/ui; ESLint flat config; TanStack Query for
  server state; react-hook-form + zod for forms.

## Gotchas (non-obvious)

- **Presigned URLs need a browser-reachable endpoint.** The endpoint used to *sign* (
  `S3_PUBLIC_ENDPOINT`) must be reachable by the browser. In k8s that's the MinIO ingress/route,
  NOT the in-cluster service DNS used for server-side calls (`S3_ENDPOINT_URL`). Getting this wrong
  makes media URLs unreachable from the browser.
- **Media rows can be `pending`.** A media row exists before its bytes are uploaded; only `ready`
  media should be shown. Orphaned `pending` rows (abandoned uploads) may need periodic cleanup.
- **No transcoding in v1.** We accept what the browser can natively play (`.mp4`/H.264). No
  thumbnail generation for video yet.

## Build phases

1. Repo & tooling scaffold ✅
2. Backend foundation (FastAPI, Postgres, models, Alembic, S3 storage, health) ✅
3. Recipe CRUD API + tests ✅
4. Frontend foundation (Vite + Tailwind + shadcn/ui + design tokens) ✅
5. Recipe features UI (list/detail/editor + media manager with presigned upload) ✅
6. Search, tags & categories ✅
7. Dev/test packaging (Dockerfiles + full Compose) ✅
8. Helm chart (k8s, external Postgres + MinIO) ✅

## Planned / deferred (v2)

Meal-planning calendar, shopping-list generation, household accounts & auth, and AI features
(photo→recipe extraction, recommendations, `pgvector` semantic search). The schema reserves a
nullable `user_id` on recipes to make multi-user additive.
