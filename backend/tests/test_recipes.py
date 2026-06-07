from __future__ import annotations


def _sample() -> dict:
    return {
        "title": "Tomato Pasta",
        "description": "Weeknight staple",
        "servings": 2,
        "prep_time_min": 10,
        "cook_time_min": 15,
        "ingredients": [
            {"name": "Pasta", "quantity": "200", "unit": "g"},
            {"name": "Tomato", "quantity": "3", "unit": None},
        ],
        "steps": [
            {"instruction": "Boil pasta."},
            {"instruction": "Make sauce."},
        ],
        "tags": ["dinner", "vegetarian"],
    }


def test_create_and_get_recipe(client):
    r = client.post("/api/v1/recipes", json=_sample())
    assert r.status_code == 201, r.text
    body = r.json()
    rid = body["id"]
    assert body["title"] == "Tomato Pasta"
    assert [i["name"] for i in body["ingredients"]] == ["Pasta", "Tomato"]
    assert [s["position"] for s in body["steps"]] == [0, 1]
    assert sorted(t["name"] for t in body["tags"]) == ["dinner", "vegetarian"]

    g = client.get(f"/api/v1/recipes/{rid}")
    assert g.status_code == 200
    assert g.json()["title"] == "Tomato Pasta"


def test_get_missing_recipe_404(client):
    assert client.get("/api/v1/recipes/9999").status_code == 404


def test_list_search_and_tag_filter(client):
    client.post("/api/v1/recipes", json=_sample())
    client.post(
        "/api/v1/recipes",
        json={"title": "Pancakes", "tags": ["breakfast"], "ingredients": [{"name": "Flour"}]},
    )

    # all
    assert len(client.get("/api/v1/recipes").json()) == 2
    # search by title
    res = client.get("/api/v1/recipes", params={"q": "pasta"}).json()
    assert len(res) == 1 and res[0]["title"] == "Tomato Pasta"
    # search by ingredient
    res = client.get("/api/v1/recipes", params={"q": "flour"}).json()
    assert len(res) == 1 and res[0]["title"] == "Pancakes"
    # tag filter
    res = client.get("/api/v1/recipes", params={"tag": "breakfast"}).json()
    assert len(res) == 1 and res[0]["title"] == "Pancakes"
    # pagination
    assert len(client.get("/api/v1/recipes", params={"limit": 1}).json()) == 1


def test_list_item_total_time(client):
    client.post("/api/v1/recipes", json=_sample())
    item = client.get("/api/v1/recipes").json()[0]
    assert item["total_time_min"] == 25


def test_update_recipe_partial_and_replace(client):
    rid = client.post("/api/v1/recipes", json=_sample()).json()["id"]

    # partial scalar update leaves other fields intact
    r = client.patch(f"/api/v1/recipes/{rid}", json={"title": "Better Pasta"})
    assert r.status_code == 200
    body = r.json()
    assert body["title"] == "Better Pasta"
    assert body["servings"] == 2

    # replacing ingredients swaps the whole list
    r = client.patch(f"/api/v1/recipes/{rid}", json={"ingredients": [{"name": "Spaghetti"}]})
    assert [i["name"] for i in r.json()["ingredients"]] == ["Spaghetti"]

    # replacing tags
    r = client.patch(f"/api/v1/recipes/{rid}", json={"tags": ["quick"]})
    assert [t["name"] for t in r.json()["tags"]] == ["quick"]


def test_delete_recipe(client):
    rid = client.post("/api/v1/recipes", json=_sample()).json()["id"]
    assert client.delete(f"/api/v1/recipes/{rid}").status_code == 204
    assert client.get(f"/api/v1/recipes/{rid}").status_code == 404


def test_tags_listed_implicitly(client):
    client.post("/api/v1/recipes", json=_sample())
    names = {t["name"] for t in client.get("/api/v1/tags").json()}
    assert {"dinner", "vegetarian"} <= names
