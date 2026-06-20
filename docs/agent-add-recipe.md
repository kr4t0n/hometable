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
- Prefer **ingredient-related tags** when an agent is extracting from media
  (`"pork ribs"`, `"black pepper"`), not workflow/source/style tags
  (`"video recipe"`, `"weeknight"`) unless the caller explicitly asks for them.
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

For video-only recipes, upload a still image as `media_type:"image"` and set that
image as `cover_media_id`. Do **not** use the video media row as the cover if you
can avoid it; the list/grid UI expects an image-like cover.

For the current card layout, a 4:3 image works well. A practical target is a
`720x540` JPEG: it displays sharply in a roughly `362x272` cover slot without
shipping a huge file.

## Recommended overall flow

1. `POST /recipes` with the parsed recipe → keep `id`.
2. For each photo/video file: `init` → `PUT` → `complete`.
3. (If desired) `PATCH /recipes/{id}` with `cover_media_id` to choose the hero image.
4. Verify with `GET /recipes/{id}` — confirm `media[].status` is all `ready` and the
   ingredient/step counts match what you intended.

## Worked example: video-only recipe intake

Use this flow when the source is a local cooking video and no text recipe was
provided. The example is based on a short MP4 recipe video for pepper pork ribs,
but keep the same pattern for any video.

### 1. Inspect the video before writing fields

Do not upload a bare title and stop. Extract enough visual context to read the
recipe from the video:

- Sample frames across the full duration.
- Look for title cards, subtitle overlays, ingredient quantities, time cues, and
  plating shots.
- If captions or speech are unavailable, mark uncertain values as estimates in
  the description instead of inventing exact quantities.
- If a video has a visible recipe title, use that title in the recipe and consider
  extracting a cover frame that includes it.

If `ffmpeg` is available, a quick contact sheet is usually enough:

```bash
ffmpeg -i recipe.mp4 \
  -vf "fps=1/5,scale=320:-1,tile=5x6" \
  /tmp/recipe-contact-sheet.jpg
```

If `ffmpeg` is not available but `uv` is, use a temporary OpenCV/Pillow tool
without changing project dependencies:

```bash
uv run --with opencv-python-headless --with pillow --with numpy python - <<'PY'
from pathlib import Path
import math

import cv2
from PIL import Image, ImageDraw, ImageFont

video = Path("recipe.mp4")
out = Path("/tmp/hometable-video-frames")
out.mkdir(parents=True, exist_ok=True)

cap = cv2.VideoCapture(str(video))
fps = cap.get(cv2.CAP_PROP_FPS) or 30
frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
duration = frames / fps if frames else 0

times = [0] if duration <= 0 else [
    round(i * max(1.5, duration / 30), 2)
    for i in range(int(duration // max(1.5, duration / 30)) + 1)
]

thumbs = []
font = ImageFont.load_default()
for idx, t in enumerate(times):
    cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
    ok, frame = cap.read()
    if not ok:
        continue
    img = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
    img.thumbnail((320, 568))
    canvas = Image.new("RGB", (320, 600), "white")
    canvas.paste(img, ((320 - img.width) // 2, 0))
    draw = ImageDraw.Draw(canvas)
    draw.rectangle((0, 568, 320, 600), fill="black")
    draw.text((8, 578), f"{t:05.1f}s", fill="white", font=font)
    thumbs.append(canvas)

cols = 5
rows = math.ceil(len(thumbs) / cols)
sheet = Image.new("RGB", (cols * 320, rows * 600), "white")
for i, img in enumerate(thumbs):
    sheet.paste(img, ((i % cols) * 320, (i // cols) * 600))

sheet.save(out / "contact-sheet.jpg", quality=90)
print(out / "contact-sheet.jpg")
PY
```

### 2. Create the initial recipe and upload the video

Create the recipe first, then attach the MP4. The first `POST /recipes` can be
minimal if you still need to inspect the video, but the final recipe should be
filled with ingredients, steps, and timing.

```bash
curl -X POST https://<host>/api/v1/recipes \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "Pepper Pork Ribs",
    "description": "Initial record created from a local MP4; fields will be filled after reading the video.",
    "tags": []
  }'
# → 201 { "id": 42, ... }
```

Upload the MP4 as normal media:

```bash
curl -X POST https://<host>/api/v1/recipes/42/media \
  -H 'Content-Type: application/json' \
  -d '{"source":"upload","media_type":"video","content_type":"video/mp4"}'
# → 201 { "media": { "id": 7, "status": "pending", ... }, "upload_url": "..." }

curl -X PUT "<upload_url>" \
  -H 'Content-Type: video/mp4' \
  --data-binary @recipe.mp4

curl -X POST https://<host>/api/v1/recipes/42/media/7/complete
```

### 3. Fill the recipe from video captions and frames

After reading the video, replace the placeholder fields with the extracted
recipe. This example keeps measurements visible in the video and marks the
servings/time as estimates when the source does not state them exactly.

```bash
curl -X PATCH https://<host>/api/v1/recipes/42 \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "Pepper Pork Ribs",
    "description": "Extracted from video captions and frames. The source did not provide an exact rib weight, so the rib quantity and servings are estimated from the visible portion.",
    "servings": 3,
    "prep_time_min": 60,
    "cook_time_min": 55,
    "ingredients": [
      {"name": "pork ribs", "quantity": "1", "unit": "rack"},
      {"name": "salt", "quantity": "to taste"},
      {"name": "cracked black pepper", "quantity": "12", "unit": "g"},
      {"name": "ginger", "quantity": "to taste"},
      {"name": "garlic", "quantity": "to taste"},
      {"name": "oyster sauce", "quantity": "1", "unit": "tbsp"},
      {"name": "starch", "quantity": "2", "unit": "tbsp"},
      {"name": "camellia oil or neutral cooking oil", "quantity": "a little"},
      {"name": "high-proof baijiu", "quantity": "1", "unit": "capful"},
      {"name": "shallot", "quantity": "to taste"},
      {"name": "light soy sauce", "quantity": "1", "unit": "tbsp"},
      {"name": "huadiao wine", "quantity": "1", "unit": "tbsp"},
      {"name": "caramelized sugar syrup", "quantity": "1", "unit": "tbsp"},
      {"name": "dark soy sauce", "quantity": "1/2", "unit": "tbsp"},
      {"name": "boiling water", "quantity": "enough to come level with the ribs"},
      {"name": "scallions", "quantity": "a little"}
    ],
    "steps": [
      {"instruction": "Cut the ribs into small pieces, or ask the butcher to cut them."},
      {"instruction": "Soak the ribs with plenty of salt and water for at least 30 minutes to draw out blood."},
      {"instruction": "Drain and pat the ribs dry with paper towels so the marinade clings well."},
      {"instruction": "Prepare 12 g cracked black pepper. Add ginger, garlic, salt, oyster sauce, starch, and half of the black pepper to the ribs."},
      {"instruction": "Mix well and marinate for 20 minutes."},
      {"instruction": "Heat a little oil in a pan and sear the ribs until both sides are golden and aromatic."},
      {"instruction": "Add one capful of high-proof baijiu around the edge of the pan to add aroma and reduce gaminess."},
      {"instruction": "In a clay pot, heat a little oil and fry ginger, garlic, and shallot until fragrant."},
      {"instruction": "Add the seared ribs, light soy sauce, huadiao wine, caramelized sugar syrup, and dark soy sauce."},
      {"instruction": "Add boiling water until it is level with the ribs."},
      {"instruction": "Cover and boil over high heat for 10 minutes, then reduce to low heat and simmer for 30 minutes."},
      {"instruction": "Uncover, add the remaining black pepper, and reduce the sauce over high heat until glossy and thick."},
      {"instruction": "Garnish with scallions and serve hot."}
    ],
    "tags": ["pork ribs", "black pepper"]
  }'
```

### 4. Extract and set a video cover image

Prefer a cover that is both readable and useful in the recipe grid. If the video
has a title card, extract a frame with the dish name visible. Crop to 4:3 and
save a `720x540` JPEG so it renders cleanly in the UI's roughly `362x272` cover
slot.

Example with Python/OpenCV/Pillow:

```bash
uv run --with opencv-python-headless --with pillow --with numpy python - <<'PY'
from pathlib import Path

import cv2
from PIL import Image, ImageEnhance

video = Path("recipe.mp4")
cover = Path("/tmp/recipe-cover.jpg")
timestamp_seconds = 5

cap = cv2.VideoCapture(str(video))
cap.set(cv2.CAP_PROP_POS_MSEC, timestamp_seconds * 1000)
ok, frame = cap.read()
cap.release()
if not ok:
    raise SystemExit("could not read cover frame")

img = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
w, _ = img.size
crop = img.crop((0, 0, w, int(w * 3 / 4))).resize((720, 540), Image.Resampling.LANCZOS)
crop = ImageEnhance.Contrast(crop).enhance(1.05)
crop = ImageEnhance.Sharpness(crop).enhance(1.08)
crop.save(cover, "JPEG", quality=92, optimize=True)
print(cover)
PY
```

Upload the JPEG as image media and set it as the cover:

```bash
curl -X POST https://<host>/api/v1/recipes/42/media \
  -H 'Content-Type: application/json' \
  -d '{"source":"upload","media_type":"image","content_type":"image/jpeg"}'
# → 201 { "media": { "id": 8, "status": "pending", ... }, "upload_url": "..." }

curl -X PUT "<upload_url>" \
  -H 'Content-Type: image/jpeg' \
  --data-binary @/tmp/recipe-cover.jpg

curl -X POST https://<host>/api/v1/recipes/42/media/8/complete

curl -X PATCH https://<host>/api/v1/recipes/42 \
  -H 'Content-Type: application/json' \
  -d '{"cover_media_id": 8}'
```

If you replace a cover image, set the new `cover_media_id` first, then delete the
old unused image media row:

```bash
curl -X DELETE https://<host>/api/v1/recipes/42/media/old_media_id
```

### 5. Verify the finished recipe

Always fetch the finished recipe and check the important counts:

```bash
curl -s https://<host>/api/v1/recipes/42 | jq '{
  id,
  title,
  servings,
  prep_time_min,
  cook_time_min,
  ingredient_count: (.ingredients | length),
  step_count: (.steps | length),
  cover_media_id,
  tags: [.tags[].name],
  media: [.media[] | {id, media_type, status}]
}'
```

Expected shape for the worked example:

```json
{
  "title": "Pepper Pork Ribs",
  "servings": 3,
  "prep_time_min": 60,
  "cook_time_min": 55,
  "ingredient_count": 16,
  "step_count": 13,
  "tags": ["pork ribs", "black pepper"],
  "media": [
    {"media_type": "video", "status": "ready"},
    {"media_type": "image", "status": "ready"}
  ]
}
```

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
- **Removing a tag from a recipe does not delete the tag row.** `PATCH /recipes/{id}`
  replaces the recipe's tag associations, but previously-created tags remain in
  the `tags` table and will still appear in `GET /tags` if nothing cleans them up.
  The current HTTP API has no tag delete endpoint. A database maintenance cleanup
  can remove orphan tag rows:

  ```sql
  DELETE FROM tags t
  WHERE t.kind = 'tag'
    AND NOT EXISTS (
      SELECT 1
      FROM recipe_tags rt
      WHERE rt.tag_id = t.id
    )
  RETURNING id, name;
  ```
