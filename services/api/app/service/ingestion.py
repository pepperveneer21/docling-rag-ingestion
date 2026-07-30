"""Document-ingestion orchestration: raw → Docling → derived artifacts on B2.

Reads and writes the corpus exclusively through `repo/`. The Docling parse+chunk
is delegated to `repo.docling_engine.parse_and_chunk`, which is monkeypatched in
tests so this layer's flow can be verified without the ML stack installed.
"""

import json
import logging
import re
import uuid
from datetime import UTC, datetime

from app.repo import (
    delete_document_objects,
    document_prefix,
    get_object_bytes,
    get_object_text,
    get_presigned_url,
    list_manifest_keys,
    manifest_key,
    object_exists,
    parse_and_chunk,
    parsed_extension,
    put_object_bytes,
)
from app.types import (
    ACCEPTED_DOC_EXTENSIONS,
    DocumentChunk,
    DocumentChunksResponse,
    DocumentConfig,
    DocumentManifest,
    DocumentResult,
    DocumentSummary,
    ParsedDocumentResponse,
)
from app.types.formatting import humanize_bytes

logger = logging.getLogger(__name__)

# UI payload caps — surfaced to the user, never silently truncated.
CHUNK_LIMIT = 200
PARSED_BYTE_CAP = 200 * 1024


class DocumentNotFoundError(Exception):
    def __init__(self, detail: str = "Document not found"):
        self.detail = detail
        super().__init__(detail)


class DocumentValidationError(Exception):
    def __init__(self, detail: str, status_code: int = 400):
        self.detail = detail
        self.status_code = status_code
        super().__init__(detail)


class IngestionError(Exception):
    def __init__(self, detail: str = "Ingestion failed"):
        self.detail = detail
        super().__init__(detail)


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _slugify(value: str) -> str:
    stem = value.rsplit(".", 1)[0] if "." in value else value
    slug = re.sub(r"[^a-z0-9]+", "-", stem.lower()).strip("-")
    return slug[:48] or "document"


def _extension(filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    return ext


def _amplification(raw_bytes: int, derived_bytes: int) -> float:
    if raw_bytes <= 0:
        return 0.0
    return round(derived_bytes / raw_bytes, 3)


def _write_manifest(manifest: DocumentManifest) -> None:
    body = json.dumps(manifest.model_dump(), indent=2).encode("utf-8")
    put_object_bytes(manifest_key(manifest.doc_id), body, "application/json")


def _read_manifest(doc_id: str) -> DocumentManifest:
    if not object_exists(manifest_key(doc_id)):
        raise DocumentNotFoundError()
    raw = get_object_text(manifest_key(doc_id))
    return DocumentManifest.model_validate_json(raw)


def create_document(
    file_data: bytes, filename: str, content_type: str, config: DocumentConfig
) -> DocumentManifest:
    """Store the raw source + a pending manifest. Does NOT run Docling."""
    if not filename:
        raise DocumentValidationError("No filename provided")
    if len(file_data) == 0:
        raise DocumentValidationError("Empty file")
    ext = _extension(filename)
    if ext not in ACCEPTED_DOC_EXTENSIONS:
        raise DocumentValidationError(
            f"Unsupported document type '.{ext}'. Accepted: "
            + ", ".join(f".{e}" for e in ACCEPTED_DOC_EXTENSIONS),
            status_code=415,
        )

    doc_id = f"{_slugify(filename)}-{uuid.uuid4().hex[:8]}"
    source_key = f"{document_prefix(doc_id)}source.{ext}"
    put_object_bytes(source_key, file_data, content_type)

    manifest = DocumentManifest(
        doc_id=doc_id,
        filename=filename,
        source_key=source_key,
        content_type=content_type,
        raw_bytes=len(file_data),
        status="pending",
        config=config,
        created_at=_now(),
    )
    _write_manifest(manifest)
    logger.info("Document created: doc_id=%s bytes=%d", doc_id, len(file_data))
    return manifest


def list_documents() -> list[DocumentSummary]:
    summaries: list[DocumentSummary] = []
    for key in list_manifest_keys():
        try:
            manifest = DocumentManifest.model_validate_json(get_object_text(key))
        except Exception:
            logger.warning("Skipping unreadable manifest: %s", key)
            continue
        summaries.append(_summarize(manifest))
    summaries.sort(key=lambda s: s.created_at, reverse=True)
    return summaries


def _summarize(manifest: DocumentManifest) -> DocumentSummary:
    result = manifest.result
    derived = result.derived_bytes if result else 0
    return DocumentSummary(
        doc_id=manifest.doc_id,
        filename=manifest.filename,
        content_type=manifest.content_type,
        status=manifest.status,
        config=manifest.config,
        page_count=result.page_count if result else 0,
        table_count=result.table_count if result else 0,
        chunk_count=result.chunk_count if result else 0,
        raw_bytes=manifest.raw_bytes,
        raw_bytes_human=humanize_bytes(manifest.raw_bytes),
        derived_bytes=derived,
        derived_bytes_human=humanize_bytes(derived),
        amplification=_amplification(manifest.raw_bytes, derived),
        created_at=manifest.created_at,
    )


def get_document(doc_id: str) -> DocumentManifest:
    return _read_manifest(doc_id)


def update_config(doc_id: str, config: DocumentConfig) -> DocumentManifest:
    """Persist a new ingestion config. Does NOT re-run; next ingest uses it."""
    manifest = _read_manifest(doc_id)
    manifest.config = config
    _write_manifest(manifest)
    logger.info("Document config updated: doc_id=%s", doc_id)
    return manifest


def delete_document(doc_id: str) -> int:
    if not object_exists(manifest_key(doc_id)):
        raise DocumentNotFoundError()
    return delete_document_objects(doc_id)


def get_source_preview_url(doc_id: str) -> str:
    manifest = _read_manifest(doc_id)
    return get_presigned_url(
        manifest.source_key, filename=manifest.filename, disposition="inline"
    )


def get_parsed(doc_id: str) -> ParsedDocumentResponse:
    manifest = _read_manifest(doc_id)
    if not manifest.result:
        raise DocumentValidationError(
            "Document has not been ingested yet — run Ingest first.", status_code=409
        )
    content = get_object_text(manifest.result.parsed_key)
    encoded = content.encode("utf-8")
    truncated = len(encoded) > PARSED_BYTE_CAP
    if truncated:
        content = encoded[:PARSED_BYTE_CAP].decode("utf-8", errors="ignore")
    return ParsedDocumentResponse(
        doc_id=doc_id,
        export_format=manifest.config.export_format,
        content=content,
        truncated=truncated,
        byte_count=len(encoded),
    )


def get_chunks(doc_id: str) -> DocumentChunksResponse:
    manifest = _read_manifest(doc_id)
    if not manifest.result:
        raise DocumentValidationError(
            "Document has not been ingested yet — run Ingest first.", status_code=409
        )
    lines = [
        line
        for line in get_object_text(manifest.result.chunks_key).splitlines()
        if line.strip()
    ]
    total = len(lines)
    shown = lines[:CHUNK_LIMIT]
    chunks = [DocumentChunk.model_validate_json(line) for line in shown]
    return DocumentChunksResponse(
        doc_id=doc_id,
        total_chunks=total,
        returned=len(chunks),
        truncated=total > len(chunks),
        chunks=chunks,
    )


def ingest_document(doc_id: str) -> DocumentManifest:
    """Read raw → Docling parse+chunk → write parsed + chunks → update manifest."""
    manifest = _read_manifest(doc_id)
    raw = get_object_bytes(manifest.source_key)
    config = manifest.config.model_dump()

    try:
        parsed = parse_and_chunk(raw, manifest.filename, config)
    except RuntimeError as e:
        manifest.status = "failed"
        manifest.error = str(e)
        _write_manifest(manifest)
        logger.warning("Ingestion failed: doc_id=%s error=%s", doc_id, e)
        raise IngestionError(str(e)) from e

    ext = parsed_extension(manifest.config.export_format)
    parsed_key = f"{document_prefix(doc_id)}parsed.{ext}"
    chunks_key = f"{document_prefix(doc_id)}chunks.jsonl"

    parsed_bytes = put_object_bytes(
        parsed_key, parsed["parsed_content"].encode("utf-8"), "text/plain"
    )
    chunk_lines = "\n".join(json.dumps(c) for c in parsed["chunks"])
    chunk_bytes = put_object_bytes(
        chunks_key, chunk_lines.encode("utf-8"), "application/x-ndjson"
    )
    derived_bytes = parsed_bytes + chunk_bytes

    manifest.status = "ingested"
    manifest.error = None
    manifest.result = DocumentResult(
        parsed_key=parsed_key,
        chunks_key=chunks_key,
        page_count=parsed["page_count"],
        table_count=parsed["table_count"],
        chunk_count=len(parsed["chunks"]),
        raw_bytes=manifest.raw_bytes,
        derived_bytes=derived_bytes,
        ingested_at=_now(),
    )
    _write_manifest(manifest)
    logger.info(
        "Document ingested: doc_id=%s chunks=%d pages=%d tables=%d derived=%d",
        doc_id,
        manifest.result.chunk_count,
        manifest.result.page_count,
        manifest.result.table_count,
        derived_bytes,
    )
    return manifest
