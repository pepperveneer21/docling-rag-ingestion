"""Corpus-wide aggregation for the dashboard, incl. the write-amplification ratio.

Split from `service/ingestion.py` to keep each service module under the 300-line
ceiling. Reads manifests through `repo/` exactly like the ingestion service.
"""

import logging

from app.repo import get_object_text, list_manifest_keys
from app.types import DocumentManifest, DocumentStats
from app.types.formatting import humanize_bytes

logger = logging.getLogger(__name__)


def _amplification(raw_bytes: int, derived_bytes: int) -> float:
    if raw_bytes <= 0:
        return 0.0
    return round(derived_bytes / raw_bytes, 3)


def _load_manifests() -> list[DocumentManifest]:
    manifests: list[DocumentManifest] = []
    for key in list_manifest_keys():
        try:
            manifests.append(DocumentManifest.model_validate_json(get_object_text(key)))
        except Exception:
            logger.warning("Skipping unreadable manifest: %s", key)
    return manifests


def get_stats() -> DocumentStats:
    manifests = _load_manifests()
    ingested = [m for m in manifests if m.status == "ingested" and m.result]
    raw_bytes = sum(m.raw_bytes for m in manifests)
    ingested_raw = sum(m.result.raw_bytes for m in ingested)
    derived_bytes = sum(m.result.derived_bytes for m in ingested)
    return DocumentStats(
        total_documents=len(manifests),
        ingested=len(ingested),
        pending=sum(1 for m in manifests if m.status == "pending"),
        failed=sum(1 for m in manifests if m.status == "failed"),
        total_chunks=sum(m.result.chunk_count for m in ingested),
        total_pages=sum(m.result.page_count for m in ingested),
        total_tables=sum(m.result.table_count for m in ingested),
        raw_bytes=raw_bytes,
        raw_bytes_human=humanize_bytes(raw_bytes),
        derived_bytes=derived_bytes,
        derived_bytes_human=humanize_bytes(derived_bytes),
        amplification_ratio=_amplification(ingested_raw, derived_bytes),
    )
