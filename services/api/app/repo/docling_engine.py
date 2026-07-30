"""Docling parse + chunk engine.

The ONLY module that touches the Docling / transformers stack. Every heavy import
is LAZY (inside functions) so importing this module - which the repo package does
at collection time - never pulls torch/docling. That keeps `pnpm verify:api` fast
and lets the ingestion service be tested with this engine monkeypatched.

`deployment: local` device policy: `_select_device()` auto-detects CUDA -> Apple
MPS -> CPU and DEFAULTS TO CPU. No GPU is ever hard-required; a machine with no
accelerator runs on CPU. (Docling's MPS support is partial, so on Apple silicon
the underlying models may still fall back toward CPU - acceptable per the plan.)

First real parse downloads Docling's layout/table models (~500 MB-1 GB) plus the
chunker tokenizer; subsequent runs are cached. This is documented in the README.
"""

import json
import logging

logger = logging.getLogger(__name__)

_PARSED_EXT = {"markdown": "md", "json": "json", "html": "html", "text": "txt"}


def parsed_extension(export_format: str) -> str:
    return _PARSED_EXT.get(export_format, "md")


def _select_device() -> str:
    """CUDA -> MPS -> CPU, defaulting to CPU. Never hard-requires a GPU."""
    try:
        import torch
    except Exception:
        return "cpu"
    try:
        if torch.cuda.is_available():
            return "cuda"
        mps = getattr(torch.backends, "mps", None)
        if mps is not None and mps.is_available():
            return "mps"
    except Exception:
        return "cpu"
    return "cpu"


def _build_converter():
    """Construct a DocumentConverter, wiring the auto-detected accelerator.

    Falls back to a plain converter (whose default accelerator is AUTO =
    CUDA -> MPS -> CPU) if this Docling version arranges accelerator options
    differently - the plain path is still CPU-safe and never requires a GPU.
    """
    from docling.document_converter import DocumentConverter

    device = _select_device()
    logger.info("Docling accelerator device selected: %s", device)
    try:
        from docling.datamodel.accelerator_options import (
            AcceleratorDevice,
            AcceleratorOptions,
        )
        from docling.datamodel.pipeline_options import PdfPipelineOptions
        from docling.document_converter import PdfFormatOption

        pipeline_options = PdfPipelineOptions()
        pipeline_options.accelerator_options = AcceleratorOptions(
            device=AcceleratorDevice(device)
        )
        from docling.datamodel.base_models import InputFormat

        return DocumentConverter(
            format_options={
                InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)
            }
        )
    except Exception as e:
        # Version drift is expected across Docling releases; degrade safely to
        # the default converter (still CPU-safe, never GPU-required).
        logger.info("Falling back to default DocumentConverter (%s)", e)
        return DocumentConverter()


def _export_parsed(document, export_format: str) -> str:
    if export_format == "html":
        return document.export_to_html()
    if export_format == "json":
        return json.dumps(document.export_to_dict(), indent=2, ensure_ascii=False)
    if export_format == "text":
        to_text = getattr(document, "export_to_text", None)
        if callable(to_text):
            return to_text()
        return document.export_to_markdown()
    return document.export_to_markdown()


def _chunk_page_no(chunk) -> int | None:
    """Best-effort first page number for a chunk, tolerant of schema drift."""
    try:
        for item in getattr(chunk.meta, "doc_items", []) or []:
            for prov in getattr(item, "prov", []) or []:
                page_no = getattr(prov, "page_no", None)
                if page_no is not None:
                    return int(page_no)
    except Exception:
        return None
    return None


def _chunk_headings(chunk) -> list[str]:
    try:
        return list(getattr(chunk.meta, "headings", None) or [])
    except Exception:
        return []


def parse_and_chunk(raw: bytes, filename: str, config: dict) -> dict:
    """Parse `raw` with Docling and chunk it with the HybridChunker.

    Returns a plain dict (no Docling objects leak past the repo layer):
        {parsed_content, parsed_ext, chunks[], page_count, table_count}

    Raises RuntimeError on any Docling failure so the service can mark the
    document `failed` with a readable message.
    """
    from io import BytesIO

    from docling.datamodel.base_models import DocumentStream
    from docling_core.transforms.chunker.hybrid_chunker import HybridChunker

    export_format = config.get("export_format", "markdown")
    max_tokens = int(config.get("max_tokens", 512))
    merge_peers = bool(config.get("merge_peers", True))

    try:
        converter = _build_converter()
        source = DocumentStream(name=filename, stream=BytesIO(raw))
        result = converter.convert(source)
        document = result.document

        parsed_content = _export_parsed(document, export_format)
        page_count = len(getattr(document, "pages", {}) or {})
        table_count = len(getattr(document, "tables", []) or [])

        chunker = HybridChunker(max_tokens=max_tokens, merge_peers=merge_peers)
        chunks: list[dict] = []
        for index, chunk in enumerate(chunker.chunk(dl_doc=document)):
            text = chunker.contextualize(chunk=chunk)
            chunks.append(
                {
                    "index": index,
                    "text": text,
                    "headings": _chunk_headings(chunk),
                    "page_no": _chunk_page_no(chunk),
                    "char_count": len(text),
                }
            )
    except Exception as e:
        # Surface any Docling failure uniformly so the service can mark the
        # document failed with a readable message.
        raise RuntimeError(f"Docling ingestion failed for '{filename}': {e}") from e

    return {
        "parsed_content": parsed_content,
        "parsed_ext": parsed_extension(export_format),
        "chunks": chunks,
        "page_count": page_count,
        "table_count": table_count,
    }
