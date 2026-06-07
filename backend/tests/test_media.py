from __future__ import annotations


def _make_recipe(client) -> int:
    return client.post("/api/v1/recipes", json={"title": "Curry"}).json()["id"]


def test_embed_media_youtube(client):
    rid = _make_recipe(client)
    r = client.post(
        f"/api/v1/recipes/{rid}/media",
        json={"source": "embed", "media_type": "video", "url": "https://youtu.be/abc123"},
    )
    assert r.status_code == 201, r.text
    media = r.json()["media"]
    assert r.json()["upload_url"] is None
    assert media["source"] == "embed"
    assert media["status"] == "ready"
    assert media["provider"] == "youtube"
    assert media["url"] == "https://youtu.be/abc123"


def test_embed_requires_url(client):
    rid = _make_recipe(client)
    r = client.post(f"/api/v1/recipes/{rid}/media", json={"source": "embed", "media_type": "video"})
    assert r.status_code == 400


def test_upload_flow_and_presigned_urls(client, storage):
    rid = _make_recipe(client)
    # 1. init upload -> pending media + presigned PUT url
    r = client.post(
        f"/api/v1/recipes/{rid}/media",
        json={"source": "upload", "media_type": "video", "content_type": "video/mp4"},
    )
    assert r.status_code == 201, r.text
    init = r.json()
    assert init["upload_url"].startswith("http://minio.test/put/")
    media = init["media"]
    assert media["status"] == "pending"
    mid = media["id"]

    # 2. complete -> ready, presigned GET url
    c = client.post(f"/api/v1/recipes/{rid}/media/{mid}/complete")
    assert c.status_code == 200, c.text
    assert c.json()["status"] == "ready"
    assert c.json()["url"].startswith("http://minio.test/get/")


def test_complete_rejects_oversized(client, storage):
    rid = _make_recipe(client)
    init = client.post(
        f"/api/v1/recipes/{rid}/media",
        json={"source": "upload", "media_type": "video", "content_type": "video/mp4"},
    ).json()
    mid = init["media"]["id"]
    # Force every head to report an enormous file.
    storage.head = lambda k: {"ContentLength": 10**12, "ContentType": "video/mp4"}  # type: ignore
    r = client.post(f"/api/v1/recipes/{rid}/media/{mid}/complete")
    assert r.status_code == 413


def test_reorder_and_set_cover_then_delete(client):
    rid = _make_recipe(client)
    # add an image upload and complete it
    init = client.post(
        f"/api/v1/recipes/{rid}/media",
        json={"source": "upload", "media_type": "image", "content_type": "image/png"},
    ).json()
    mid = init["media"]["id"]
    client.post(f"/api/v1/recipes/{rid}/media/{mid}/complete")

    # reorder
    r = client.patch(f"/api/v1/recipes/{rid}/media/{mid}", json={"position": 5})
    assert r.status_code == 200 and r.json()["position"] == 5

    # set as cover via recipe PATCH
    r = client.patch(f"/api/v1/recipes/{rid}", json={"cover_media_id": mid})
    assert r.status_code == 200
    assert r.json()["cover_media_id"] == mid
    assert r.json()["cover_url"].startswith("http://minio.test/get/")

    # invalid cover rejected
    assert client.patch(f"/api/v1/recipes/{rid}", json={"cover_media_id": 999}).status_code == 400

    # delete media clears cover and removes the storage object
    assert client.delete(f"/api/v1/recipes/{rid}/media/{mid}").status_code == 204
    assert client.get(f"/api/v1/recipes/{rid}").json()["cover_media_id"] is None


def test_media_404_for_wrong_recipe(client):
    rid = _make_recipe(client)
    other = _make_recipe(client)
    init = client.post(
        f"/api/v1/recipes/{rid}/media",
        json={"source": "embed", "media_type": "video", "url": "https://vimeo.com/1"},
    ).json()
    mid = init["media"]["id"]
    assert client.delete(f"/api/v1/recipes/{other}/media/{mid}").status_code == 404
