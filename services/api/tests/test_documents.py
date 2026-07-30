"""End-to-end tests for the document-ingestion pipeline.

The corpus storage layer is replaced by an in-memory fake and the Docling engine
is stubbed, so the full create → ingest → read → edit → delete flow is exercised
through the real HTTP routes without B2 or the ML stack. This is exactly the
"engine monkeypatched" discipline the build plan mandates for fast verify:api.
"""

import json

import pytest

from app.service import document_stats, ingestion


class FakeCorpus:
    """A dict-backed stand-in for the `corpus/` prefix in B2."""

    def __init__(self):
        self.store: dict[str, bytes] = {}

    def put(self, key: str, body: bytes, content_type: str) -> int:
        self.store[key] = body
        return len(body)

    def get_text(self, key: str) -> str:
        return self.store[key].decode("utf-8")

    def get_bytes(self, key: str) -> bytes:
        return self.store[key]

    def exists(self, key: str) -> bool:
        return key in self.store

    def list_manifests(self) -> list[str]:
        return [k for k in self.store if k.endswith("/manifest.json")]

    def delete_doc(self, doc_id: str) -> int:
        prefix = f"corpus/{doc_id}/"
        keys = [k for k in self.store if k.startswith(prefix)]
        for k in keys:
            del self.store[k]
        return len(keys)


def _fake_parse(raw: bytes, filename: str, config: dict) -> dict:
    """Canned Docling output: two chunks, one table, three pages."""
    return {
        "parsed_content": "# Title\n\n| a | b |\n| - | - |\n| 1 | 2 |\n",
        "parsed_ext": "md",
        "chunks": [
            {"index": 0, "text": "Title chunk", "headings": ["Title"], "page_no": 1, "char_count": 11},
            {"index": 1, "text": "Body chunk", "headings": ["Title"], "page_no": 2, "char_count": 10},
        ],
        "page_count": 3,
        "table_count": 1,
    }


@pytest.fixture
def corpus(monkeypatch):
    fake = FakeCorpus()
    monkeypatch.setattr(ingestion, "put_object_bytes", fake.put)
    monkeypatch.setattr(ingestion, "get_object_text", fake.get_text)
    monkeypatch.setattr(ingestion, "get_object_bytes", fake.get_bytes)
    monkeypatch.setattr(ingestion, "object_exists", fake.exists)
    monkeypatch.setattr(ingestion, "list_manifest_keys", fake.list_manifests)
    monkeypatch.setattr(ingestion, "delete_document_objects", fake.delete_doc)
    monkeypatch.setattr(ingestion, "parse_and_chunk", _fake_parse)
    # The stats endpoint reads manifests through its own module.
    monkeypatch.setattr(document_stats, "list_manifest_keys", fake.list_manifests)
    monkeypatch.setattr(document_stats, "get_object_text", fake.get_text)
    return fake


async def _create(client, name="report.pdf", data=b"%PDF-1.4 fake", **form):
    files = {"file": (name, data, "application/pdf")}
    return await client.post("/documents", files=files, data=form)


@pytest.mark.asyncio
async def test_create_lists_and_reads_pending(client, corpus):
    resp = await _create(client)
    assert resp.status_code == 200
    manifest = resp.json()
    doc_id = manifest["doc_id"]
    assert manifest["status"] == "pending"
    assert manifest["source_key"] == f"corpus/{doc_id}/source.pdf"
    assert manifest["raw_bytes"] == len(b"%PDF-1.4 fake")

    listing = (await client.get("/documents")).json()
    assert any(row["doc_id"] == doc_id for row in listing)

    detail = await client.get(f"/documents/{doc_id}")
    assert detail.status_code == 200
    assert detail.json()["config"]["max_tokens"] == 512


@pytest.mark.asyncio
async def test_create_rejects_unsupported_extension(client, corpus):
    resp = await _create(client, name="photo.jpeg", data=b"\xff\xd8\xff")
    assert resp.status_code == 415


@pytest.mark.asyncio
async def test_ingest_writes_artifacts_and_updates_manifest(client, corpus):
    doc_id = (await _create(client)).json()["doc_id"]

    ingested = await client.post(f"/documents/{doc_id}/ingest")
    assert ingested.status_code == 200
    body = ingested.json()
    assert body["status"] == "ingested"
    assert body["result"]["chunk_count"] == 2
    assert body["result"]["table_count"] == 1
    assert body["result"]["page_count"] == 3
    assert body["result"]["derived_bytes"] > 0

    parsed = await client.get(f"/documents/{doc_id}/parsed")
    assert parsed.status_code == 200
    assert "| a | b |" in parsed.json()["content"]

    chunks = await client.get(f"/documents/{doc_id}/chunks")
    assert chunks.status_code == 200
    assert chunks.json()["total_chunks"] == 2
    assert chunks.json()["chunks"][0]["headings"] == ["Title"]


@pytest.mark.asyncio
async def test_parsed_before_ingest_is_conflict(client, corpus):
    doc_id = (await _create(client)).json()["doc_id"]
    resp = await client.get(f"/documents/{doc_id}/parsed")
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_ingest_failure_marks_document_failed(client, corpus, monkeypatch):
    doc_id = (await _create(client)).json()["doc_id"]

    def _boom(raw, filename, config):
        raise RuntimeError("Docling ingestion failed for 'report.pdf': boom")

    monkeypatch.setattr(ingestion, "parse_and_chunk", _boom)
    resp = await client.post(f"/documents/{doc_id}/ingest")
    assert resp.status_code == 500

    manifest = json.loads(corpus.get_text(f"corpus/{doc_id}/manifest.json"))
    assert manifest["status"] == "failed"
    assert "boom" in manifest["error"]


@pytest.mark.asyncio
async def test_edit_config_persists_without_reingest(client, corpus):
    doc_id = (await _create(client)).json()["doc_id"]
    resp = await client.patch(
        f"/documents/{doc_id}/config",
        json={"export_format": "html", "max_tokens": 1024, "merge_peers": False},
    )
    assert resp.status_code == 200
    assert resp.json()["config"]["export_format"] == "html"
    assert resp.json()["config"]["max_tokens"] == 1024
    # Editing config must NOT run ingestion.
    assert resp.json()["status"] == "pending"


@pytest.mark.asyncio
async def test_edit_config_rejects_out_of_range_value(client, corpus):
    doc_id = (await _create(client)).json()["doc_id"]
    resp = await client.patch(
        f"/documents/{doc_id}/config",
        json={"export_format": "markdown", "max_tokens": 999, "merge_peers": True},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_delete_removes_all_document_objects(client, corpus):
    doc_id = (await _create(client)).json()["doc_id"]
    await client.post(f"/documents/{doc_id}/ingest")
    assert any(k.startswith(f"corpus/{doc_id}/") for k in corpus.store)

    resp = await client.delete(f"/documents/{doc_id}")
    assert resp.status_code == 200
    assert resp.json()["deleted"] is True
    assert not any(k.startswith(f"corpus/{doc_id}/") for k in corpus.store)

    missing = await client.get(f"/documents/{doc_id}")
    assert missing.status_code == 404


@pytest.mark.asyncio
async def test_stats_aggregate_amplification(client, corpus):
    doc_id = (await _create(client)).json()["doc_id"]
    await client.post(f"/documents/{doc_id}/ingest")

    stats = (await client.get("/documents/stats")).json()
    assert stats["total_documents"] == 1
    assert stats["ingested"] == 1
    assert stats["total_chunks"] == 2
    assert stats["total_tables"] == 1
    assert stats["derived_bytes"] > 0
    assert stats["amplification_ratio"] >= 0
