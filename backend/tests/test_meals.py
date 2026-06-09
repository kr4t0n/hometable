from __future__ import annotations

from fractions import Fraction

from hometable.aggregate import format_quantity, parse_quantity


def _recipe(title: str, ingredients: list[dict]) -> dict:
    return {"title": title, "ingredients": ingredients}


def _create(client, title: str, ingredients: list[dict]) -> int:
    r = client.post("/api/v1/recipes", json=_recipe(title, ingredients))
    assert r.status_code == 201, r.text
    return r.json()["id"]


# ── pure quantity parsing/formatting ──────────────────────────────────
def test_parse_quantity_variants():
    assert parse_quantity("2") == Fraction(2)
    assert parse_quantity("1/2") == Fraction(1, 2)
    assert parse_quantity("1 1/2") == Fraction(3, 2)
    assert parse_quantity("1.5") == Fraction(3, 2)
    assert parse_quantity("  3  ") == Fraction(3)
    # non-numeric / unparseable -> None
    assert parse_quantity(None) is None
    assert parse_quantity("") is None
    assert parse_quantity("a pinch") is None
    assert parse_quantity("2-3") is None


def test_format_quantity_variants():
    assert format_quantity(Fraction(3)) == "3"
    assert format_quantity(Fraction(3, 4)) == "3/4"
    assert format_quantity(Fraction(7, 4)) == "1 3/4"


# ── endpoint behaviour ────────────────────────────────────────────────
def test_shopping_list_sums_numeric_quantities(client):
    a = _create(
        client,
        "Bread",
        [
            {"name": "Flour", "quantity": "2", "unit": "cups"},
            {"name": "Salt", "quantity": "1/2", "unit": "tsp"},
        ],
    )
    b = _create(
        client,
        "Cake",
        [
            {"name": "flour", "quantity": "1", "unit": "cups"},  # case-insensitive match
            {"name": "Salt", "quantity": "1/4", "unit": "tsp"},
            {"name": "Sugar", "quantity": "1 1/2", "unit": "cups"},
        ],
    )

    res = client.get("/api/v1/meals/shopping-list", params={"recipe_id": [a, b]})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["recipe_titles"] == ["Bread", "Cake"]
    items = {(i["name"].lower(), i["unit"]): i for i in body["items"]}
    assert items[("flour", "cups")]["quantity"] == "3"
    assert items[("flour", "cups")]["recipe_count"] == 2
    assert items[("salt", "tsp")]["quantity"] == "3/4"
    assert items[("sugar", "cups")]["quantity"] == "1 1/2"
    assert items[("sugar", "cups")]["recipe_count"] == 1


def test_shopping_list_keeps_freetext_quantities(client):
    a = _create(client, "Soup", [{"name": "Pepper", "quantity": "a pinch"}])
    b = _create(client, "Stew", [{"name": "Pepper", "quantity": "a pinch"}])
    body = client.get("/api/v1/meals/shopping-list", params={"recipe_id": [a, b]}).json()
    pepper = next(i for i in body["items"] if i["name"] == "Pepper")
    assert pepper["quantity"] == "a pinch ×2"
    assert pepper["recipe_count"] == 2


def test_shopping_list_mixes_numeric_and_text(client):
    a = _create(client, "A", [{"name": "Olive oil", "quantity": "2", "unit": "tbsp"}])
    b = _create(client, "B", [{"name": "Olive oil", "quantity": "a drizzle", "unit": "tbsp"}])
    body = client.get("/api/v1/meals/shopping-list", params={"recipe_id": [a, b]}).json()
    oil = next(i for i in body["items"] if i["name"] == "Olive oil")
    assert oil["quantity"] == "2 + a drizzle"


def test_shopping_list_different_units_stay_separate(client):
    a = _create(client, "A", [{"name": "Milk", "quantity": "1", "unit": "cup"}])
    b = _create(client, "B", [{"name": "Milk", "quantity": "200", "unit": "ml"}])
    body = client.get("/api/v1/meals/shopping-list", params={"recipe_id": [a, b]}).json()
    milks = [i for i in body["items"] if i["name"] == "Milk"]
    assert {m["unit"] for m in milks} == {"cup", "ml"}


def test_shopping_list_requires_ids(client):
    assert client.get("/api/v1/meals/shopping-list").status_code == 400


def test_shopping_list_unknown_ids_404(client):
    res = client.get("/api/v1/meals/shopping-list", params={"recipe_id": [9999]})
    assert res.status_code == 404


# ── saved meals (CRUD) ────────────────────────────────────────────────
def _two_recipes(client) -> tuple[int, int]:
    a = _create(
        client,
        "Bread",
        [
            {"name": "Flour", "quantity": "2", "unit": "cups"},
            {"name": "Salt", "quantity": "1/2", "unit": "tsp"},
        ],
    )
    b = _create(
        client,
        "Cake",
        [
            {"name": "Flour", "quantity": "1", "unit": "cups"},
            {"name": "Sugar", "quantity": "1", "unit": "cups"},
        ],
    )
    return a, b


def test_create_and_get_meal(client):
    a, b = _two_recipes(client)
    r = client.post("/api/v1/meals", json={"name": "Sunday", "notes": "yum", "recipe_ids": [a, b]})
    assert r.status_code == 201, r.text
    meal = r.json()
    assert meal["name"] == "Sunday" and meal["notes"] == "yum"
    assert [x["id"] for x in meal["recipes"]] == [a, b]  # order preserved
    flour = next(i for i in meal["items"] if i["name"] == "Flour")
    assert flour["quantity"] == "3"  # combined shopping list embedded (2 + 1)

    g = client.get(f"/api/v1/meals/{meal['id']}")
    assert g.status_code == 200 and g.json()["name"] == "Sunday"


def test_list_meals(client):
    a, _ = _two_recipes(client)
    client.post("/api/v1/meals", json={"name": "M1", "recipe_ids": [a]})
    client.post("/api/v1/meals", json={"name": "M2", "recipe_ids": []})
    by_name = {m["name"]: m for m in client.get("/api/v1/meals").json()}
    assert by_name.keys() == {"M1", "M2"}
    assert by_name["M1"]["recipe_count"] == 1
    assert by_name["M2"]["recipe_count"] == 0


def test_update_meal_rename_and_swap_recipes(client):
    a, b = _two_recipes(client)
    mid = client.post("/api/v1/meals", json={"name": "Old", "recipe_ids": [a]}).json()["id"]

    # rename only — recipe set stays intact
    r = client.patch(f"/api/v1/meals/{mid}", json={"name": "New"})
    assert r.json()["name"] == "New"
    assert [x["id"] for x in r.json()["recipes"]] == [a]

    # replace the recipe set (and reorder)
    r = client.patch(f"/api/v1/meals/{mid}", json={"recipe_ids": [b, a]})
    assert [x["id"] for x in r.json()["recipes"]] == [b, a]


def test_create_meal_rejects_unknown_recipe(client):
    r = client.post("/api/v1/meals", json={"name": "X", "recipe_ids": [9999]})
    assert r.status_code == 400


def test_create_meal_requires_name(client):
    r = client.post("/api/v1/meals", json={"name": "   ", "recipe_ids": []})
    assert r.status_code == 400


def test_delete_meal(client):
    a, _ = _two_recipes(client)
    mid = client.post("/api/v1/meals", json={"name": "Bye", "recipe_ids": [a]}).json()["id"]
    assert client.delete(f"/api/v1/meals/{mid}").status_code == 204
    assert client.get(f"/api/v1/meals/{mid}").status_code == 404


def test_deleting_recipe_cascades_out_of_meal(client):
    a, b = _two_recipes(client)
    mid = client.post("/api/v1/meals", json={"name": "M", "recipe_ids": [a, b]}).json()["id"]
    assert client.delete(f"/api/v1/recipes/{a}").status_code == 204
    meal = client.get(f"/api/v1/meals/{mid}").json()
    assert [x["id"] for x in meal["recipes"]] == [b]  # 'a' cascaded out of the meal


def test_meal_shopping_list_endpoint(client):
    a, b = _two_recipes(client)
    mid = client.post("/api/v1/meals", json={"name": "M", "recipe_ids": [a, b]}).json()["id"]
    body = client.get(f"/api/v1/meals/{mid}/shopping-list").json()
    assert body["recipe_ids"] == [a, b]
    flour = next(i for i in body["items"] if i["name"] == "Flour")
    assert flour["quantity"] == "3"


def test_ephemeral_shopping_list_not_shadowed_by_meal_route(client):
    # the literal /meals/shopping-list must resolve, not be captured by /meals/{id}
    a, b = _two_recipes(client)
    r = client.get("/api/v1/meals/shopping-list", params={"recipe_id": [a, b]})
    assert r.status_code == 200
    assert r.json()["recipe_ids"] == [a, b]


def test_get_unknown_meal_404(client):
    assert client.get("/api/v1/meals/9999").status_code == 404
