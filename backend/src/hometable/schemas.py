from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

MediaType = Literal["image", "video"]
MediaSource = Literal["upload", "embed"]
MediaStatus = Literal["pending", "ready"]


# ── Ingredients & steps ───────────────────────────────────────────────
class IngredientIn(BaseModel):
    name: str
    quantity: str | None = None
    unit: str | None = None


class IngredientOut(IngredientIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    position: int


class StepIn(BaseModel):
    instruction: str


class StepOut(StepIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    position: int


# ── Tags ──────────────────────────────────────────────────────────────
class TagOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    kind: str


# ── Media ─────────────────────────────────────────────────────────────
class MediaOut(BaseModel):
    id: int
    media_type: MediaType
    source: MediaSource
    status: MediaStatus
    url: str | None = None  # presigned GET (upload) or embed URL
    provider: str | None = None
    thumbnail_url: str | None = None
    position: int


class MediaCreate(BaseModel):
    source: MediaSource
    media_type: MediaType = "image"
    content_type: str | None = None  # required for source=upload
    url: str | None = None  # required for source=embed


class MediaInitOut(BaseModel):
    media: MediaOut
    upload_url: str | None = None  # presigned PUT for uploads; None for embeds


class MediaReorder(BaseModel):
    position: int


# ── Recipes ───────────────────────────────────────────────────────────
class RecipeBase(BaseModel):
    title: str
    description: str | None = None
    servings: int | None = None
    prep_time_min: int | None = None
    cook_time_min: int | None = None


class RecipeCreate(RecipeBase):
    ingredients: list[IngredientIn] = Field(default_factory=list)
    steps: list[StepIn] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)  # tag names; created implicitly


class RecipeUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    servings: int | None = None
    prep_time_min: int | None = None
    cook_time_min: int | None = None
    cover_media_id: int | None = None
    ingredients: list[IngredientIn] | None = None
    steps: list[StepIn] | None = None
    tags: list[str] | None = None


class RecipeOut(RecipeBase):
    id: int
    cover_media_id: int | None = None
    cover_url: str | None = None
    ingredients: list[IngredientOut] = Field(default_factory=list)
    steps: list[StepOut] = Field(default_factory=list)
    media: list[MediaOut] = Field(default_factory=list)
    tags: list[TagOut] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class RecipeListItem(BaseModel):
    id: int
    title: str
    description: str | None = None
    cover_url: str | None = None
    servings: int | None = None
    total_time_min: int | None = None
    tags: list[TagOut] = Field(default_factory=list)


# ── Meals / shopping list ─────────────────────────────────────────────
class AggregatedIngredient(BaseModel):
    name: str
    unit: str | None = None
    quantity: str | None = None  # combined human-readable amount, e.g. "3 cups"
    recipe_count: int  # how many of the selected recipes call for this ingredient


class MealShoppingList(BaseModel):
    recipe_ids: list[int]
    recipe_titles: list[str]
    items: list[AggregatedIngredient]


# ── Saved meals ───────────────────────────────────────────────────────
class MealCreate(BaseModel):
    name: str
    notes: str | None = None
    recipe_ids: list[int] = Field(default_factory=list)  # in display order


class MealUpdate(BaseModel):
    name: str | None = None
    notes: str | None = None
    recipe_ids: list[int] | None = None  # full replacement of the recipe set


class MealListItem(BaseModel):
    id: int
    name: str
    recipe_count: int
    cover_url: str | None = None  # cover of the first recipe, for a thumbnail
    created_at: datetime
    updated_at: datetime


class MealOut(BaseModel):
    id: int
    name: str
    notes: str | None = None
    recipes: list[RecipeListItem] = Field(default_factory=list)
    items: list[AggregatedIngredient] = Field(default_factory=list)  # combined shopping list
    created_at: datetime
    updated_at: datetime
