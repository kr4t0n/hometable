# Agent guide — adding a recipe to hometable

A focused playbook for an autonomous agent that records a recipe (text, plus
optional photos/video) into a hometable instance via the HTTP API.

## Endpoint & auth

- **Base URL:** `https://<your-host>/api/v1` (e.g. `https://hometable.<tailnet>.ts.net/api/v1`).
- **Auth:** none. Access is gated only by network reachability (e.g. your tailnet).
  Treat the ability to reach the host as full read/write — do not expose it publicly.
- **Schema discovery:** the OpenAPI spec is served at `/api/openapi.json` and a
  human/Swagger UI at `/api/docs`. Fetch the spec first if you want to self-verify
  field names and types instead of trusting this doc.

```bash
curl -s https://<host>/api/openapi.json | jq '.paths | keys'
```

## The happy path: text-only recipe

One call. Only `title` is required; everything else is optional.

```bash
curl -X POST https://<host>/api/v1/recipes \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "Tomato Pasta",
    "description": "Weeknight classic",
    "servings": 4,
    "prep_time_min": 10,
    "cook_time_min": 20,
    "ingredients": [
      {"name": "spaghetti", "quantity": "400", "unit": "g"},
      {"name": "garlic",    "quantity": "2",   "unit": "clove"},
      {"name": "olive oil", "quantity": "2",   "unit": "tbsp"},
      {"name": "salt",      "quantity": "a pinch"}
    ],
    "steps": [
      {"instruction": "Boil the spaghetti until al dente."},
      {"instruction": "Sauté garlic in oil, toss with the drained pasta."}
    ],
    "tags": ["dinner", "italian"]
  }'
# → 201 { "id": 42, ... full recipe ... }
```

Field rules:

- `quantity` and `unit` are **free-text strings**, not numbers. `"1/2"`, `"1 1/2"`,
  `"a pinch"` are all valid. Omit `unit` for countable things (`"2"` eggs).
- `tags` are plain strings; unknown tags are created automatically.
- Keep `ingredients[].name` clean and singular (`"garlic"`, not `"2 cloves garlic"`),
  with the amount in `quantity`/`unit` — this is what makes the shopping-list
  aggregation across recipes work.

Capture the returned `id`; you need it for media.

## Optional: attach an uploaded photo or video (3 steps)

Uploads are **direct-to-object-store** by design: the API hands you a short-lived
presigned URL and you `PUT` the bytes straight to the object store. The big file
never flows through the app server. Do this per file:

**1. Init** — register the file, get a presigned `PUT` URL:

```bash
curl -X POST https://<host>/api/v1/recipes/42/media \
  -H 'Content-Type: application/json' \
  -d '{"source":"upload","media_type":"image","content_type":"image/jpeg"}'
# → 201 { "media": { "id": 7, "status": "pending", ... }, "upload_url": "https://<object-store>/...signed..." }
```

- `media_type`: `"image"` or `"video"`.
- `content_type` is **required** and must match the bytes you'll upload
  (`image/jpeg`, `image/png`, `image/webp`, `video/mp4`).

**2. Upload** — `PUT` the raw bytes to `upload_url` with the **same** `Content-Type`:

```bash
curl -X PUT "<upload_url>" -H 'Content-Type: image/jpeg' --data-binary @photo.jpg
```

- This request goes to the **object store host**, not the API host. The agent must
  be able to reach both.
- The URL expires (default 1 hour). Upload promptly.
- The `Content-Type` must equal what you sent in step 1 — it's part of the signature.

**3. Complete** — flip the row from `pending` → `ready` (until you do, it won't show):

```bash
curl -X POST https://<host>/api/v1/recipes/42/media/7/complete
# → 200 { "id": 7, "status": "ready", "url": "<presigned GET>", ... }
```

Repeat 1–3 for each additional photo/video.

## Optional: attach a video by link (1 step)

YouTube / Vimeo links are stored as embeds — no upload, immediately `ready`:

```bash
curl -X POST https://<host>/api/v1/recipes/42/media \
  -H 'Content-Type: application/json' \
  -d '{"source":"embed","media_type":"video","url":"https://youtu.be/XXXXXXXXXXX"}'
```

## Optional: set the cover image

By default the first media item is the cover. To pick a specific one:

```bash
curl -X PATCH https://<host>/api/v1/recipes/42 \
  -H 'Content-Type: application/json' \
  -d '{"cover_media_id": 7}'
```

## Recommended overall flow

1. `POST /recipes` with the parsed recipe → keep `id`.
2. For each photo/video file: `init` → `PUT` → `complete`.
3. (If desired) `PATCH /recipes/{id}` with `cover_media_id` to choose the hero image.
4. Verify with `GET /recipes/{id}` — confirm `media[].status` is all `ready` and the
   ingredient/step counts match what you intended.

## Constraints & gotchas

- **No transcoding (v1):** video must be browser-playable — `.mp4` / H.264. Other
  formats upload but won't play.
- **Max upload size** is enforced on `complete` (returns `413` and deletes the row if
  the object is too big). Default limit is set by `MAX_UPLOAD_MB`.
- **Always call `complete`** for uploads — a `pending` row that's never completed is an
  orphan that never renders.
- **Two hosts for uploads:** the API host (recipe + init + complete) and the object
  store host (the `PUT`). Embeds and text-only recipes need only the API host.
- **Idempotency:** there's no dedupe — re-running `POST /recipes` creates a second
  recipe. Track created `id`s if you retry.
