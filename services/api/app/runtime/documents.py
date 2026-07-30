import logging

# The B2/Docling-backed handlers are sync `def` on purpose: the whole chain is
# blocking (boto3 + Docling), and Starlette runs sync handlers in its threadpool,
# so one slow ingest doesn't stall the event loop for every other request.
from fastapi import APIRouter, Form, HTTPException, Request, UploadFile
from fastapi.concurrency import run_in_threadpool

from app.config import settings
from app.service.document_stats import get_stats
from app.service.ingestion import (
    DocumentNotFoundError,
    DocumentValidationError,
    IngestionError,
    create_document,
    delete_document,
    get_chunks,
    get_document,
    get_parsed,
    get_source_preview_url,
    ingest_document,
    list_documents,
    update_config,
)
from app.types import (
    DocumentChunksResponse,
    DocumentConfig,
    DocumentConfigUpdate,
    DocumentManifest,
    DocumentStats,
    DocumentSummary,
    ParsedDocumentResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()

# SECURITY: these routes are intentionally UNAUTHENTICATED and single-tenant
# (see docs/SECURITY.md). Corpus lists/reads/deletes are scoped to the `corpus/`
# prefix; a multi-tenant clone must add auth AND per-user prefix scoping.


def _config_from(export_format: str, max_tokens: int, merge_peers: bool) -> DocumentConfig:
    try:
        return DocumentConfig(
            export_format=export_format,
            max_tokens=max_tokens,
            merge_peers=merge_peers,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=f"Invalid ingestion config: {e}") from None


@router.get("/documents", response_model=list[DocumentSummary])
def list_documents_endpoint():
    return list_documents()


@router.get("/documents/stats", response_model=DocumentStats)
def document_stats_endpoint():
    return get_stats()


@router.post("/documents", response_model=DocumentManifest)
async def create_document_endpoint(
    request: Request,
    file: UploadFile,
    export_format: str = Form("markdown"),
    max_tokens: int = Form(512),
    merge_peers: bool = Form(True),
):
    config = _config_from(export_format, max_tokens, merge_peers)
    content_type = file.content_type or "application/octet-stream"

    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(1024 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > settings.max_file_size:
            raise HTTPException(status_code=413, detail="File too large")
        chunks.append(chunk)
    file_data = b"".join(chunks)

    try:
        return await run_in_threadpool(
            create_document,
            file_data=file_data,
            filename=file.filename or "",
            content_type=content_type,
            config=config,
        )
    except DocumentValidationError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail) from None


@router.get("/documents/{doc_id}", response_model=DocumentManifest)
def get_document_endpoint(doc_id: str):
    try:
        return get_document(doc_id)
    except DocumentNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.detail) from None


@router.get("/documents/{doc_id}/parsed", response_model=ParsedDocumentResponse)
def get_document_parsed_endpoint(doc_id: str):
    try:
        return get_parsed(doc_id)
    except DocumentNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.detail) from None
    except DocumentValidationError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail) from None


@router.get("/documents/{doc_id}/chunks", response_model=DocumentChunksResponse)
def get_document_chunks_endpoint(doc_id: str):
    try:
        return get_chunks(doc_id)
    except DocumentNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.detail) from None
    except DocumentValidationError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail) from None


@router.get("/documents/{doc_id}/source")
def get_document_source_endpoint(doc_id: str):
    """Presigned inline URL for the raw source (reused media preview iframe)."""
    try:
        return {"url": get_source_preview_url(doc_id)}
    except DocumentNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.detail) from None


@router.post("/documents/{doc_id}/ingest", response_model=DocumentManifest)
def ingest_document_endpoint(doc_id: str):
    try:
        return ingest_document(doc_id)
    except DocumentNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.detail) from None
    except IngestionError as e:
        raise HTTPException(status_code=500, detail=e.detail) from None


@router.patch("/documents/{doc_id}/config", response_model=DocumentManifest)
def update_document_config_endpoint(doc_id: str, body: DocumentConfigUpdate):
    config = _config_from(body.export_format, body.max_tokens, body.merge_peers)
    try:
        return update_config(doc_id, config)
    except DocumentNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.detail) from None


@router.delete("/documents/{doc_id}")
def delete_document_endpoint(doc_id: str):
    try:
        deleted = delete_document(doc_id)
    except DocumentNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.detail) from None
    except RuntimeError:
        raise HTTPException(status_code=500, detail="Failed to delete document") from None
    logger.info("Document deleted: doc_id=%s objects=%d", doc_id, deleted)
    return {"deleted": True, "doc_id": doc_id, "objects_removed": deleted}
