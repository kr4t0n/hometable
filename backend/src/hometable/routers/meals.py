from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from hometable import schemas
from hometable.aggregate import aggregate_ingredients
from hometable.database import get_db
from hometable.models import Meal, MealRecipe, Recipe
from hometable.routers.recipes import list_item_from_recipe
from hometable.storage import S3Storage, get_storage

router = APIRouter(prefix="/meals", tags=["meals"])


# ── helpers ───────────────────────────────────────────────────────────
def _validate_recipe_ids(db: Session, ids: list[int]) -> list[int]:
    """De-dupe (preserving order) and confirm every recipe exists."""
    seen = list(dict.fromkeys(ids))
    if not seen:
        return []
    found = set(db.scalars(select(Recipe.id).where(Recipe.id.in_(seen))).all())
    missing = [i for i in seen if i not in found]
    if missing:
        raise HTTPException(status_code=400, detail=f"Unknown recipe_id(s): {missing}")
    return seen


def _load_meal(db: Session, meal_id: int) -> Meal:
    """Load a meal with its recipes (and each recipe's ingredients/media/tags)."""
    link_to_recipe = selectinload(Meal.recipe_links).selectinload(MealRecipe.recipe)
    meal = db.scalar(
        select(Meal)
        .where(Meal.id == meal_id)
        .options(
            link_to_recipe.selectinload(Recipe.ingredients),
            link_to_recipe.selectinload(Recipe.media),
            link_to_recipe.selectinload(Recipe.tags),
        )
    )
    if meal is None:
        raise HTTPException(status_code=404, detail="Meal not found")
    return meal


def _meal_out(meal: Meal, storage: S3Storage) -> schemas.MealOut:
    recipes = [link.recipe for link in meal.recipe_links]
    return schemas.MealOut(
        id=meal.id,
        name=meal.name,
        notes=meal.notes,
        recipes=[list_item_from_recipe(r, storage) for r in recipes],
        items=aggregate_ingredients(recipes),
        created_at=meal.created_at,
        updated_at=meal.updated_at,
    )


def _set_recipes(meal: Meal, ids: list[int]) -> None:
    # Replace the whole set; delete-orphan cleans up the removed links.
    meal.recipe_links = [MealRecipe(recipe_id=rid, position=i) for i, rid in enumerate(ids)]


# ── ephemeral shopping list (no saved meal) ───────────────────────────
# NOTE: this literal route MUST stay before "/meals/{meal_id}" so the path
# isn't captured by the dynamic route and rejected as a non-int meal_id.
@router.get("/shopping-list", response_model=schemas.MealShoppingList)
def shopping_list(
    recipe_id: list[int] = Query(default=[]),
    db: Session = Depends(get_db),
) -> schemas.MealShoppingList:
    """Combine the ingredients of several recipes into one shopping list.

    Pass the recipes as repeated query params, e.g. ``?recipe_id=1&recipe_id=2``.
    Ingredients with the same name + unit are summed when numeric; free-text
    amounts ("a pinch") are kept verbatim. See ``hometable.aggregate``.
    """
    ids = list(dict.fromkeys(recipe_id))  # de-dupe, preserve request order
    if not ids:
        raise HTTPException(status_code=400, detail="Provide at least one recipe_id")
    recipes = db.scalars(
        select(Recipe).where(Recipe.id.in_(ids)).options(selectinload(Recipe.ingredients))
    ).all()
    if not recipes:
        raise HTTPException(status_code=404, detail="No matching recipes found")
    by_id = {r.id: r for r in recipes}
    ordered = [by_id[i] for i in ids if i in by_id]
    return schemas.MealShoppingList(
        recipe_ids=[r.id for r in ordered],
        recipe_titles=[r.title for r in ordered],
        items=aggregate_ingredients(ordered),
    )


# ── saved meals (CRUD) ────────────────────────────────────────────────
@router.get("", response_model=list[schemas.MealListItem])
def list_meals(
    db: Session = Depends(get_db),
    storage: S3Storage = Depends(get_storage),
) -> list[schemas.MealListItem]:
    link_to_recipe = selectinload(Meal.recipe_links).selectinload(MealRecipe.recipe)
    meals = db.scalars(
        select(Meal)
        .order_by(Meal.updated_at.desc(), Meal.id.desc())
        .options(
            link_to_recipe.selectinload(Recipe.media), link_to_recipe.selectinload(Recipe.tags)
        )
    ).all()
    out: list[schemas.MealListItem] = []
    for m in meals:
        recipes = [link.recipe for link in m.recipe_links]
        cover = list_item_from_recipe(recipes[0], storage).cover_url if recipes else None
        out.append(
            schemas.MealListItem(
                id=m.id,
                name=m.name,
                recipe_count=len(recipes),
                cover_url=cover,
                created_at=m.created_at,
                updated_at=m.updated_at,
            )
        )
    return out


@router.post("", response_model=schemas.MealOut, status_code=201)
def create_meal(
    payload: schemas.MealCreate,
    db: Session = Depends(get_db),
    storage: S3Storage = Depends(get_storage),
) -> schemas.MealOut:
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")
    ids = _validate_recipe_ids(db, payload.recipe_ids)
    meal = Meal(name=name, notes=payload.notes)
    _set_recipes(meal, ids)
    db.add(meal)
    db.commit()
    return _meal_out(_load_meal(db, meal.id), storage)


@router.get("/{meal_id}", response_model=schemas.MealOut)
def get_meal(
    meal_id: int,
    db: Session = Depends(get_db),
    storage: S3Storage = Depends(get_storage),
) -> schemas.MealOut:
    return _meal_out(_load_meal(db, meal_id), storage)


@router.patch("/{meal_id}", response_model=schemas.MealOut)
def update_meal(
    meal_id: int,
    payload: schemas.MealUpdate,
    db: Session = Depends(get_db),
    storage: S3Storage = Depends(get_storage),
) -> schemas.MealOut:
    meal = _load_meal(db, meal_id)
    data = payload.model_dump(exclude_unset=True)
    if "name" in data:
        name = (data["name"] or "").strip()
        if not name:
            raise HTTPException(status_code=400, detail="name cannot be empty")
        meal.name = name
    if "notes" in data:
        meal.notes = data["notes"]
    if "recipe_ids" in data:
        _set_recipes(meal, _validate_recipe_ids(db, data["recipe_ids"]))
    db.commit()
    return _meal_out(_load_meal(db, meal_id), storage)


@router.delete("/{meal_id}", status_code=204)
def delete_meal(meal_id: int, db: Session = Depends(get_db)) -> None:
    meal = db.get(Meal, meal_id)
    if meal is None:
        raise HTTPException(status_code=404, detail="Meal not found")
    db.delete(meal)
    db.commit()


@router.get("/{meal_id}/shopping-list", response_model=schemas.MealShoppingList)
def meal_shopping_list(
    meal_id: int,
    db: Session = Depends(get_db),
) -> schemas.MealShoppingList:
    meal = _load_meal(db, meal_id)
    recipes = [link.recipe for link in meal.recipe_links]
    return schemas.MealShoppingList(
        recipe_ids=[r.id for r in recipes],
        recipe_titles=[r.title for r in recipes],
        items=aggregate_ingredients(recipes),
    )
