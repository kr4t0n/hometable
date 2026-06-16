# hometable

A self-hosted, home-made food **recipe menu book** — store, organize, and cook from your own
recipes. Clean and photo-forward, pleasant to use from a phone in the kitchen or a laptop while
meal-planning. Recipes support **photos and video** (uploaded files are the first-class media
path; YouTube/Vimeo embeds are also supported).

> Status: under active construction. See the build phases in `AGENTS.md`.

## Why it exists

A personal cookbook that *you own and host yourself* — your recipes and media live in your own
Postgres database and S3-compatible object store, not a third-party service.

## Features

- **Recipes** with ingredients, steps, servings, prep/cook times, and tags/categories.
- **Photos & video** per recipe (drag-and-drop direct-to-S3 uploads, plus YouTube/Vimeo embeds).
- **Search & filter** by name, ingredient, and tag; grid or list views.
- **Built for cooking from.** On a recipe page you can scale quantities by servings, tick off
  ingredients as you gather them, and tap step numbers to track where you are (all local to the
  visit, nothing saved). Shopping lists show "x of y gathered" progress and print cleanly.
- **Plan a meal → shopping list.** A meal is several recipes, so select the recipes that make it
  up and hometable combines their ingredients into one list — quantities with the same name + unit
  are summed (it understands `2`, `1/2`, `1 1/2`, `1.5`), and free-text amounts like "a pinch" are
  kept as-is. Tick items off and print the list. Use it two ways:
  - **Quick / ephemeral** — pick recipes on the Recipes page and view the combined list, nothing
    saved. Backed by `GET /api/v1/meals/shopping-list?recipe_id=1&recipe_id=2`.
  - **Saved meals** — name the selection and save it; it shows up under **Meals**, where you can
    rename it, add/remove recipes, and reuse its shopping list any time. Full CRUD under
    `/api/v1/meals` (`GET` list, `POST`, `GET/PATCH/DELETE /{id}`, `GET /{id}/shopping-list`).

## API & agent access

The backend is a plain JSON API under `/api/v1` (recipes, tags, meals + per-recipe
media). It's reachable wherever the app is — the frontend's nginx proxies `/api/` to
the backend — so `https://<your-host>/api/v1/...` hits it directly. Interactive docs
and the machine-readable schema are served under `/api` (so they're proxied too):

- **Swagger UI:** `https://<your-host>/api/docs`
- **OpenAPI spec:** `https://<your-host>/api/openapi.json`

> The API has **no authentication** — access is gated only by network reachability
> (e.g. a Tailscale tailnet). Don't expose the ingress publicly as-is.

For automating recipe entry (e.g. an LLM agent recording recipes with photos/video),
see **[`docs/agent-add-recipe.md`](docs/agent-add-recipe.md)** — a step-by-step
playbook including the presigned direct-to-object-store media upload.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React + TypeScript + Vite + Tailwind + shadcn/ui ("Apricot Cream" design system, brand color `#F1D9C3`) |
| Backend | Python + FastAPI + SQLAlchemy + Alembic |
| Database | Postgres |
| Object storage | S3-compatible (MinIO locally; AWS S3 / Cloudflare R2 in prod) |
| Dev/CI infra | Docker Compose (bundled Postgres + MinIO) |
| Production | Helm chart targeting **external** Postgres + MinIO |

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) + Docker Compose
- [uv](https://docs.astral.sh/uv/) (Python tooling)
- Node.js 22+ and npm

## Run the whole app with Docker (simplest)

```bash
cp .env.example .env            # adjust S3_PUBLIC_ENDPOINT for remote access (see below)
docker compose up -d --build    # builds + runs app, Postgres, MinIO; applies migrations
```

Open **http://localhost:5173**. The frontend container serves the SPA and proxies `/api` to the
backend; the backend applies migrations on startup. MinIO console: http://localhost:9001
(`minioadmin` / `minioadmin`).

## Local dev (hot reload)

```bash
cp .env.example .env
docker compose up -d db storage          # just the dependencies

# Backend — http://localhost:8000 (docs at /docs)
cd backend && uv sync --dev && uv run alembic upgrade head && uv run uvicorn hometable.main:app --reload

# Frontend — http://localhost:5173 (proxies /api to the backend)
cd ../frontend && npm install && npm run dev
```

### Accessing from another machine (remote dev)

Media is served via **presigned URLs** the browser fetches directly from MinIO, so the signing
endpoint must be reachable by your browser. If you open the app from another device (LAN IP,
Tailscale, …), set `S3_PUBLIC_ENDPOINT` in `.env` to that reachable address — e.g.
`S3_PUBLIC_ENDPOINT=http://100.90.0.0:9000` — and restart the backend. Otherwise photos/videos
won't load (they'd point at `localhost`). The backend still reaches MinIO internally via
`S3_ENDPOINT_URL`.

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

## CI / CD (GitHub Actions)

Three workflows under `.github/workflows/`:

| Workflow | Trigger | What it does |
|---|---|---|
| `ci.yml` | push to `main`, all PRs | Backend: `ruff check` + `ruff format --check` + `pytest`. Frontend: `eslint` + `tsc --noEmit` + `vite build`. |
| `docker-publish.yml` | push to `main`, `v*` tags, PRs (build-only), manual | Builds **multi-arch** (`linux/amd64` + `linux/arm64`, native runners) images for `kr4t0n/hometable-backend` and `kr4t0n/hometable-frontend` and pushes one manifest list per tag to Docker Hub. |
| `helm-publish.yml` | push to `main` touching `deploy/helm/**`, manual | Packages the chart and publishes it to the `gh-pages` branch as a Helm repo at `https://kr4t0n.github.io/hometable/helm`. |

**Required repo secrets:** `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` (already configured).

**Image tags:** pushes to `main` publish `:latest`, `:main`, `:sha-<short>`. A `vX.Y.Z` git tag
additionally publishes `:X.Y.Z`, `:X.Y`, and `:latest`. PRs build both images as a smoke test but
don't push.

**Cutting a release:**

1. Bump `version` **and** `appVersion` in `deploy/helm/hometable/Chart.yaml` to `X.Y.Z`.
2. Tag and push: `git tag vX.Y.Z && git push origin vX.Y.Z`.

The tag builds `kr4t0n/hometable-{backend,frontend}:X.Y.Z`; merging the Chart bump to `main`
publishes a chart whose default image tag (via `appVersion`) resolves to those exact images. Using
the published chart:

```bash
helm repo add hometable https://kr4t0n.github.io/hometable/helm
helm repo update
helm upgrade --install hometable hometable/hometable -f my-values.yaml
```

> First-time setup: after the first `helm-publish` run creates the `gh-pages` branch, enable
> GitHub Pages (repo **Settings → Pages**, source = `gh-pages` branch) so the repo is served.

## Deployment

- **Dev / CI** → Docker Compose (this repo's `docker-compose.yml`).
- **Production** → the Helm chart under `deploy/helm/hometable/`, which deploys **only the app**
  (backend + frontend) and connects to your **existing** Postgres and MinIO via values + existing
  Secrets. Alembic migrations run as a `pre-install`/`pre-upgrade` **Job**.

```bash
# build & push images to your registry first, then:
helm upgrade --install hometable ./deploy/helm/hometable -f my-values.yaml
```

See `deploy/helm/hometable/values-prod-example.yaml` for a complete example (external Postgres +
MinIO via existing Secrets, ingress + TLS). The chart needs from you: container registry, ingress
class + hostname, and the Secret names/keys for Postgres + MinIO credentials.

> **Gotcha:** presigned media URLs are signed against `s3.publicEndpoint`, which must be the
> **browser-reachable** MinIO address (your MinIO ingress), *not* the in-cluster service DNS used
> for server-side calls (`s3.endpoint`).

## License

TBD.
