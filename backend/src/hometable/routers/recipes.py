from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import exists, func, or_, select
from sqlalchemy.orm import Session, selectinload

from hometable import schemas
from hometable.config import settings
from hometable.database import get_db
from hometable.models import Ingredient, Media, Recipe, Step, Tag
from hometable.storage import S3Storage, get_storage

router = APIRouter(tags=["recipes"])

_CONTENT_TYPE_EXT = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
}


# ── helpers ───────────────────────────────────────────────────────────
def _provider_from_url(url: str) -> str | None:
    u = url.lower()
    if "youtube.com" in u or "youtu.be" in u:
        return "youtube"
    if "vimeo.com" in u:
        return "vimeo"
    return None


def _media_out(m: Media, storage: S3Storage) -> schemas.MediaOut:
    if m.source == "embed":
        url = m.url
    else:
        url = storage.presigned_get_url(m.storage_key) if m.storage_key else None
    thumb = storage.presigned_get_url(m.thumbnail_key) if m.thumbnail_key else None
    return schemas.MediaOut(
        id=m.id,
        media_type=m.media_type,
        source=m.source,
        status=m.status,
        url=url,
        provider=m.provider,
        thumbnail_url=thumb,
        position=m.position,
    )


def _cover_url(recipe: Recipe, storage: S3Storage) -> str | None:
    if recipe.cover_media_id:
        for m in recipe.media:
            if m.id == recipe.cover_media_id:
                return _media_out(m, storage).url
    # Fall back to the first ready image.
    for m in recipe.media:
        if m.media_type == "image" and m.status == "ready":
            return _media_out(m, storage).url
    return None


def _recipe_out(recipe: Recipe, storage: S3Storage) -> schemas.RecipeOut:
    return schemas.RecipeOut(
        id=recipe.id,
        title=recipe.title,
        description=recipe.description,
        servings=recipe.servings,
        prep_time_min=recipe.prep_time_min,
        cook_time_min=recipe.cook_time_min,
        cover_media_id=recipe.cover_media_id,
        cover_url=_cover_url(recipe, storage),
        ingredients=[schemas.IngredientOut.model_validate(i) for i in recipe.ingredients],
        steps=[schemas.StepOut.model_validate(s) for s in recipe.steps],
        media=[_media_out(m, storage) for m in recipe.media],
        tags=[schemas.TagOut.model_validate(t) for t in recipe.tags],
        created_at=recipe.created_at,
        updated_at=recipe.updated_at,
    )


def _get_or_create_tag(db: Session, name: str) -> Tag:
    name = name.strip()
    tag = db.scalar(select(Tag).where(Tag.name == name))
    if tag is None:
        tag = Tag(name=name)
        db.add(tag)
        db.flush()
    return tag


def _load_recipe(db: Session, recipe_id: int) -> Recipe:
    recipe = db.get(Recipe, recipe_id)
    if recipe is None:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return recipe


def _get_media(db: Session, recipe_id: int, media_id: int) -> Media:
    media = db.get(Media, media_id)
    if media is None or media.recipe_id != recipe_id:
        raise HTTPException(status_code=404, detail="Media not found")
    return media


# ── recipe CRUD ───────────────────────────────────────────────────────
@router.get("/recipes", response_model=list[schemas.RecipeListItem])
def list_recipes(
    q: str | None = None,
    tag: list[str] | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    storage: S3Storage = Depends(get_storage),
) -> list[schemas.RecipeListItem]:
    stmt = select(Recipe).options(selectinload(Recipe.media), selectinload(Recipe.tags))
    if q:
        like = f"%{q.lower()}%"
        ingredient_match = exists().where(
            (Ingredient.recipe_id == Recipe.id) & (func.lower(Ingredient.name).like(like))
        )
        stmt = stmt.where(or_(func.lower(Recipe.title).like(like), ingredient_match))
    if tag:
        stmt = stmt.where(Recipe.tags.any(Tag.name.in_(tag)))
    stmt = stmt.order_by(Recipe.created_at.desc(), Recipe.id.desc()).limit(limit).offset(offset)

    items: list[schemas.RecipeListItem] = []
    for r in db.scalars(stmt).unique().all():
        total = None
        if r.prep_time_min or r.cook_time_min:
            total = (r.prep_time_min or 0) + (r.cook_time_min or 0)
        items.append(
            schemas.RecipeListItem(
                id=r.id,
                title=r.title,
                description=r.description,
                cover_url=_cover_url(r, storage),
                servings=r.servings,
                total_time_min=total,
                tags=[schemas.TagOut.model_validate(t) for t in r.tags],
            )
        )
    return items


@router.post("/recipes", response_model=schemas.RecipeOut, status_code=201)
def create_recipe(
    payload: schemas.RecipeCreate,
    db: Session = Depends(get_db),
    storage: S3Storage = Depends(get_storage),
) -> schemas.RecipeOut:
    recipe = Recipe(
        title=payload.title,
        description=payload.description,
        servings=payload.servings,
        prep_time_min=payload.prep_time_min,
        cook_time_min=payload.cook_time_min,
    )
    for i, ing in enumerate(payload.ingredients):
        recipe.ingredients.append(
            Ingredient(position=i, name=ing.name, quantity=ing.quantity, unit=ing.unit)
        )
    for i, st in enumerate(payload.steps):
        recipe.steps.append(Step(position=i, instruction=st.instruction))
    # Add the recipe to the session before resolving tags so the tag<->recipe
    # backref has a persistent recipe to attach to.
    db.add(recipe)
    db.flush()
    for name in payload.tags:
        if name.strip():
            recipe.tags.append(_get_or_create_tag(db, name))
    db.commit()
    db.refresh(recipe)
    return _recipe_out(recipe, storage)


@router.get("/recipes/{recipe_id}", response_model=schemas.RecipeOut)
def get_recipe(
    recipe_id: int,
    db: Session = Depends(get_db),
    storage: S3Storage = Depends(get_storage),
) -> schemas.RecipeOut:
    return _recipe_out(_load_recipe(db, recipe_id), storage)


@router.patch("/recipes/{recipe_id}", response_model=schemas.RecipeOut)
def update_recipe(
    recipe_id: int,
    payload: schemas.RecipeUpdate,
    db: Session = Depends(get_db),
    storage: S3Storage = Depends(get_storage),
) -> schemas.RecipeOut:
    recipe = _load_recipe(db, recipe_id)
    data = payload.model_dump(exclude_unset=True)

    for field in ("title", "description", "servings", "prep_time_min", "cook_time_min"):
        if field in data:
            setattr(recipe, field, data[field])

    if "ingredients" in data:
        recipe.ingredients = [
            Ingredient(
                position=i, name=ing["name"], quantity=ing.get("quantity"), unit=ing.get("unit")
            )
            for i, ing in enumerate(data["ingredients"])
        ]
    if "steps" in data:
        recipe.steps = [
            Step(position=i, instruction=s["instruction"]) for i, s in enumerate(data["steps"])
        ]
    if "tags" in data:
        recipe.tags = [_get_or_create_tag(db, n) for n in data["tags"] if n.strip()]
    if "cover_media_id" in data:
        cover_id = data["cover_media_id"]
        if cover_id is not None and not any(m.id == cover_id for m in recipe.media):
            raise HTTPException(
                status_code=400, detail="cover_media_id does not belong to this recipe"
            )
        recipe.cover_media_id = cover_id

    db.commit()
    db.refresh(recipe)
    return _recipe_out(recipe, storage)


@router.delete("/recipes/{recipe_id}", status_code=204)
def delete_recipe(
    recipe_id: int,
    db: Session = Depends(get_db),
    storage: S3Storage = Depends(get_storage),
) -> None:
    recipe = _load_recipe(db, recipe_id)
    for m in recipe.media:
        if m.source == "upload" and m.storage_key:
            storage.delete(m.storage_key)
    db.delete(recipe)
    db.commit()


# ── media ─────────────────────────────────────────────────────────────
@router.post("/recipes/{recipe_id}/media", response_model=schemas.MediaInitOut, status_code=201)
def add_media(
    recipe_id: int,
    payload: schemas.MediaCreate,
    db: Session = Depends(get_db),
    storage: S3Storage = Depends(get_storage),
) -> schemas.MediaInitOut:
    recipe = _load_recipe(db, recipe_id)
    next_pos = max((m.position for m in recipe.media), default=-1) + 1

    if payload.source == "embed":
        if not payload.url:
            raise HTTPException(status_code=400, detail="url is required for embed media")
        media = Media(
            recipe_id=recipe.id,
            media_type=payload.media_type or "video",
            source="embed",
            status="ready",
            url=payload.url,
            provider=_provider_from_url(payload.url),
            position=next_pos,
        )
        db.add(media)
        db.commit()
        db.refresh(media)
        return schemas.MediaInitOut(media=_media_out(media, storage), upload_url=None)

    # source == "upload"
    if not payload.content_type:
        raise HTTPException(status_code=400, detail="content_type is required for upload media")
    ext = _CONTENT_TYPE_EXT.get(payload.content_type, "bin")
    key = f"recipes/{recipe.id}/{uuid.uuid4().hex}.{ext}"
    media = Media(
        recipe_id=recipe.id,
        media_type=payload.media_type,
        source="upload",
        status="pending",
        storage_key=key,
        position=next_pos,
    )
    db.add(media)
    db.commit()
    db.refresh(media)
    upload_url = storage.presigned_put_url(key, payload.content_type)
    return schemas.MediaInitOut(media=_media_out(media, storage), upload_url=upload_url)


@router.post("/recipes/{recipe_id}/media/{media_id}/complete", response_model=schemas.MediaOut)
def complete_media(
    recipe_id: int,
    media_id: int,
    db: Session = Depends(get_db),
    storage: S3Storage = Depends(get_storage),
) -> schemas.MediaOut:
    media = _get_media(db, recipe_id, media_id)
    if media.source != "upload":
        raise HTTPException(status_code=400, detail="only uploaded media can be completed")
    head = storage.head(media.storage_key)
    if head is None:
        raise HTTPException(status_code=400, detail="object not found in storage; upload failed")
    size = head.get("ContentLength", 0)
    if size and size > settings.max_upload_bytes:
        storage.delete(media.storage_key)
        db.delete(media)
        db.commit()
        raise HTTPException(status_code=413, detail="uploaded file exceeds the maximum size")
    media.status = "ready"
    db.commit()
    db.refresh(media)
    return _media_out(media, storage)


@router.patch("/recipes/{recipe_id}/media/{media_id}", response_model=schemas.MediaOut)
def reorder_media(
    recipe_id: int,
    media_id: int,
    payload: schemas.MediaReorder,
    db: Session = Depends(get_db),
    storage: S3Storage = Depends(get_storage),
) -> schemas.MediaOut:
    media = _get_media(db, recipe_id, media_id)
    media.position = payload.position
    db.commit()
    db.refresh(media)
    return _media_out(media, storage)


@router.delete("/recipes/{recipe_id}/media/{media_id}", status_code=204)
def delete_media(
    recipe_id: int,
    media_id: int,
    db: Session = Depends(get_db),
    storage: S3Storage = Depends(get_storage),
) -> None:
    media = _get_media(db, recipe_id, media_id)
    recipe = media.recipe
    if recipe is not None and recipe.cover_media_id == media.id:
        recipe.cover_media_id = None
    if media.source == "upload" and media.storage_key:
        storage.delete(media.storage_key)
    db.delete(media)
    db.commit()
