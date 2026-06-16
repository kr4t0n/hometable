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
- **Design system: "Apricot Cream."** Built around the brand color `#F1D9C3`, used as the
  **action color**: `--primary` is the apricot itself (buttons, active nav pill, view toggle,
  active filter chips, checkboxes, logo chip) with cocoa text on it, sitting on a quiet warm-cream
  canvas. Supporting surfaces are deliberately in the same family for consistency: `--secondary`/
  `--muted` are soft apricot tints, borders are apricot-warmed, tag badges are translucent apricot
  pills (`bg-primary/25 border-primary/40`), and empty states get a faint `bg-primary/5` wash.
  Because the primary is light, it must never be used *as text* — burnt sienna (`--accent`)
  carries text emphasis (eyebrow labels, icons, hover titles, step-number outlines), and `--ring`
  is cocoa so focus rings stay visible. Dark mode is cocoa-night charcoal where the primary is a
  **toasted-apricot counterpart** of the brand color (`hsl(28 50% 76%)` ≈ `#E0C0A3`, dimmed and
  desaturated) rather than `#F1D9C3` verbatim — full-luminance fills bloom against dark surfaces.
  Fraunces + Inter (self-hosted fonts), shadcn/ui components vendored in-repo. Tokens are CSS
  variables in `src/index.css`. Earlier palettes in git history: terracotta "Warm Cookbook"
  (original), green "Evergreen Bistro" (reverted), plum "Fig & Honey", "Slate & Copper",
  "Espresso & Caramel".

## Module responsibilities (backend)

- `main.py` — FastAPI app, CORS, router registration, `/healthz` + `/readyz`. **Docs/OpenAPI
  are relocated under `/api`** (`/api/docs`, `/api/openapi.json`) so the frontend nginx — which
  only proxies `/api/*` — exposes them; at the default root they'd be shadowed by the SPA. Agent
  integration playbook lives in `docs/agent-add-recipe.md`.
- `config.py` — settings from env (pydantic-settings).
- `database.py` — SQLAlchemy engine/session.
- `models.py` — ORM models: Recipe, Ingredient, Step, Media, Tag (+ join); Meal + MealRecipe
  (saved meals; `MealRecipe` is an association object carrying `position`).
- `schemas.py` — Pydantic request/response models.
- `storage.py` — `Storage` interface + S3 implementation (boto3 → MinIO); presign + bucket
  bootstrap.
- `aggregate.py` — pure, DB-free logic that merges several recipes' ingredients into one shopping
  list (group by name+unit, sum numeric quantities with `Fraction`, keep free-text amounts as-is).
- `routers/` — `recipes.py`, `tags.py` (+ media endpoints under recipes), `meals.py`. Meals covers
  both the **ephemeral** combined list (`GET /meals/shopping-list?recipe_id=…`) and **saved meal**
  CRUD (`GET/POST /meals`, `GET/PATCH/DELETE /meals/{id}`, `GET /meals/{id}/shopping-list`). The
  compact recipe representation is built by `recipes.list_item_from_recipe`, imported by the meals
  router so both render list items identically.

## Conventions

- Conventional Commits (`feat(scope): ...`).
- Backend: `uv` for deps, `ruff` for lint+format, `pytest` for tests. API under `/api/v1`.
- Frontend: TypeScript + Tailwind utilities + shadcn/ui; ESLint flat config; TanStack Query for
  server state; react-hook-form + zod for forms.
- Frontend UI patterns: destructive actions use the inline two-step `ConfirmButton`
  (`components/ui/confirm-button.tsx`) — never `window.confirm` or a modal. Long option lists get
  a searchable popover (`components/AddRecipePicker.tsx`), not a native `<select>`. Check-off
  interactions (shopping list, recipe ingredients/steps) are deliberately ephemeral component
  state — nothing persists. Recipe detail is editorial: title/description/meta first, hero media
  after. Print views rely on `print:hidden`; the global header/footer are hidden in `Layout`.

## Gotchas (non-obvious)

- **Presigned URLs need a browser-reachable endpoint.** The endpoint used to *sign* (
  `S3_PUBLIC_ENDPOINT`) must be reachable by the browser. In k8s that's the MinIO ingress/route,
  NOT the in-cluster service DNS used for server-side calls (`S3_ENDPOINT_URL`). Getting this wrong
  makes media URLs unreachable from the browser.
- **Media rows can be `pending`.** A media row exists before its bytes are uploaded; only `ready`
  media should be shown. Orphaned `pending` rows (abandoned uploads) may need periodic cleanup.
- **No transcoding in v1.** We accept what the browser can natively play (`.mp4`/H.264). No
  thumbnail generation for video yet.
- **Ingredient quantity is free text, not a number** (`"2"`, `"1/2"`, `"a pinch"`). The shopping
  list only sums quantities it can parse (int / decimal / fraction / mixed number) *and* that share
  the same unit; everything else is listed verbatim. Same ingredient with different units (e.g.
  `cup` vs `ml`) stays as separate lines — there is no unit conversion.
- **Two meal flows share one router.** "Plan a meal" supports an *ephemeral* path (multi-select →
  `/shopping-list?ids=…`, nothing saved) and a *saved* path (`Meal` rows). Both end up calling the
  same `aggregate_ingredients()`.
- **Meals route ordering matters.** The literal `GET /meals/shopping-list` is declared *before*
  `GET /meals/{meal_id}` in `meals.py` — otherwise `"shopping-list"` is captured by the dynamic
  route and rejected as a non-int `meal_id` (422). Keep static segments above dynamic ones.
- **Deleting a recipe cascades out of meals via the DB, not the ORM.** `Recipe` has no relationship
  back to `MealRecipe` (avoids a double delete-orphan parent), so removal relies on the
  `meal_recipes.recipe_id` FK `ON DELETE CASCADE`. Postgres enforces this; SQLite does not unless
  asked, so the test fixture (`conftest.py`) turns on `PRAGMA foreign_keys=ON` to match prod.

## CI / CD (GitHub Actions)

Three workflows in `.github/workflows/` (the latter two patterned on the sibling `argus` repo):

- **`ci.yml`** — backend (`ruff` + `pytest`) and frontend (`eslint` + `tsc` + `vite build`) on
  push to `main` and all PRs.
- **`docker-publish.yml`** — multi-arch image build/publish. Two-stage: per-platform `build` jobs
  run on **native runners** (amd64 on `ubuntu-latest`, arm64 on `ubuntu-24.04-arm`) and push *by
  digest* with no tag (avoids the QEMU tax); per-image `merge` jobs then `docker buildx imagetools
  create` the tag list onto those digests as one manifest list. Each image builds from its **own
  directory as context** (`./backend`, `./frontend`) because the Dockerfiles COPY relative to their
  folder. Publishes `kr4t0n/hometable-backend` and `kr4t0n/hometable-frontend`. PRs smoke-test
  (build, no push). Needs secrets `DOCKERHUB_USERNAME` + `DOCKERHUB_TOKEN`.
- **`helm-publish.yml`** — packages `deploy/helm/hometable` and pushes the `.tgz` + regenerated
  `index.yaml` to the `gh-pages` branch (served at `https://kr4t0n.github.io/hometable/helm`).
  Triggers on `main` pushes touching `deploy/helm/**`. **Self-bootstraps** the `gh-pages` branch on
  first run (the `Checkout gh-pages` step is `continue-on-error`, then a bootstrap step inits an
  orphan branch). `helm package` won't overwrite an existing `name-version`, so **bumping
  `Chart.yaml`'s `version` is the release action**; `--merge` keeps older versions installable.

**Release coupling (non-obvious):** the chart's image tag defaults to `.Chart.AppVersion` (see
`_helpers.tpl`), but `docker-publish` only emits a `:X.Y.Z` image tag on a `vX.Y.Z` **git tag**.
So a release is two steps that must agree: cut `vX.Y.Z` (builds the images) *and* set Chart.yaml's
`version`/`appVersion` to `X.Y.Z` (so the published chart points at them). Bumping one without the
other yields a chart that references a nonexistent image tag.

## Build phases

1. Repo & tooling scaffold ✅
2. Backend foundation (FastAPI, Postgres, models, Alembic, S3 storage, health) ✅
3. Recipe CRUD API + tests ✅
4. Frontend foundation (Vite + Tailwind + shadcn/ui + design tokens) ✅
5. Recipe features UI (list/detail/editor + media manager with presigned upload) ✅
6. Search, tags & categories ✅
7. Dev/test packaging (Dockerfiles + full Compose) ✅
8. Helm chart (k8s, external Postgres + MinIO) ✅
9. Meal shopping list — combine selected recipes' ingredients (ephemeral) ✅
10. Saved meals — `Meal`/`MealRecipe` tables, CRUD API, Meals list/detail pages, "Save as meal" ✅

## Planned / deferred (v2)

Meal-planning calendar (scheduling meals by date), household accounts & auth, and AI features
(photo→recipe extraction, recommendations, `pgvector` semantic search). Possible shopping-list
upgrades: unit conversion/normalisation and scaling quantities by per-recipe servings (the
`MealRecipe` association object is the place to hang a scale factor). The schema reserves a nullable
`user_id` on recipes to make multi-user additive.
