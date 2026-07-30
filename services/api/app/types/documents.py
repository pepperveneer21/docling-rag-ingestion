"""Pydantic models for the document-ingestion corpus.

These mirror the per-document `manifest.json` stored in B2 (the corpus source of
truth) and the shapes the frontend consumes. No logic lives here — the types
layer is imported by every other layer and must stay dependency-light.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

# Finite option sets — the create/edit forms expose these as selectors, and the
# backend re-validates so an out-of-range value is a 422, not silent corruption.
ExportFormat = Literal["markdown", "json", "html", "text"]
MaxTokens = Literal[256, 512, 1024]
DocumentStatus = Literal["pending", "ingested", "failed"]

# Accepted source document types (extension allowlist). Docling reads these.
ACCEPTED_DOC_EXTENSIONS = ("pdf", "docx", "pptx", "html", "htm", "md", "txt")


class DocumentConfig(BaseModel):
    """Per-document ingestion configuration, persisted in the manifest.

    `edit` mutates this without re-running; the next `ingest` reads whatever is
    stored here. A document's raw bytes are immutable, so the config is the only
    thing there is to edit.
    """

    export_format: ExportFormat = "markdown"
    max_tokens: MaxTokens = 512
    merge_peers: bool = True


class DocumentResult(BaseModel):
    """Outcome of a successful ingest run — the derived-artifact bookkeeping."""

    parsed_key: str
    chunks_key: str
    page_count: int = 0
    table_count: int = 0
    chunk_count: int = 0
    raw_bytes: int = 0
    derived_bytes: int = 0
    ingested_at: str


class DocumentManifest(BaseModel):
    """The corpus's source of truth for one document (stored as manifest.json)."""

    doc_id: str
    filename: str
    source_key: str
    content_type: str
    # Source byte size, known at create time — kept top-level (in addition to
    # result.raw_bytes) so the corpus list and dashboard can show a document's
    # raw size before it has been ingested.
    raw_bytes: int = 0
    status: DocumentStatus = "pending"
    config: DocumentConfig = Field(default_factory=DocumentConfig)
    result: DocumentResult | None = None
    error: str | None = None
    created_at: str


class DocumentSummary(BaseModel):
    """Row shape for the /documents list — flattened for the table.

    Carries the stored `config` so the list's per-row "Edit config" opens
    pre-filled without a second round-trip.
    """

    doc_id: str
    filename: str
    content_type: str
    status: DocumentStatus
    config: DocumentConfig
    page_count: int
    table_count: int
    chunk_count: int
    raw_bytes: int
    raw_bytes_human: str
    derived_bytes: int
    derived_bytes_human: str
    amplification: float
    created_at: str


class DocumentChunk(BaseModel):
    """One token-aware chunk emitted by Docling's HybridChunker."""

    index: int
    text: str
    headings: list[str] = Field(default_factory=list)
    page_no: int | None = None
    char_count: int = 0


class DocumentChunksResponse(BaseModel):
    """Paged-for-the-UI chunk payload. `truncated` is surfaced, never silent."""

    doc_id: str
    total_chunks: int
    returned: int
    truncated: bool
    chunks: list[DocumentChunk]


class ParsedDocumentResponse(BaseModel):
    """Rendered parsed output (Markdown by default) with an explicit size cap."""

    doc_id: str
    export_format: ExportFormat
    content: str
    truncated: bool
    byte_count: int


class DocumentStats(BaseModel):
    """Corpus-wide aggregates for the dashboard, incl. write amplification."""

    total_documents: int
    ingested: int
    pending: int
    failed: int
    total_chunks: int
    total_pages: int
    total_tables: int
    raw_bytes: int
    raw_bytes_human: str
    derived_bytes: int
    derived_bytes_human: str
    amplification_ratio: float


class DocumentConfigUpdate(BaseModel):
    """PATCH body for editing a document's stored ingestion config."""

    export_format: ExportFormat
    max_tokens: MaxTokens
    merge_peers: bool
