from __future__ import annotations

from fastapi.testclient import TestClient


def test_openapi_served_under_api(client: TestClient) -> None:
    # Relocated under /api so the frontend nginx (which only proxies /api/*)
    # exposes it to agents at https://<host>/api/openapi.json.
    r = client.get("/api/openapi.json")
    assert r.status_code == 200
    spec = r.json()
    assert spec["info"]["title"] == "hometable API"
    assert "/api/v1/recipes" in spec["paths"]


def test_swagger_ui_served_under_api(client: TestClient) -> None:
    r = client.get("/api/docs")
    assert r.status_code == 200
    assert "text/html" in r.headers["content-type"]


def test_root_openapi_is_not_served(client: TestClient) -> None:
    # The default root location must not serve the spec (it's relocated).
    assert client.get("/openapi.json").status_code == 404
