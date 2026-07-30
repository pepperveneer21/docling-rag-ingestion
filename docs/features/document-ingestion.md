<!-- last_verified: 2026-07-30 -->
# Feature: Document Ingestion

## Purpose
Turn a raw document (PDF / DOCX / PPTX / HTML / MD / TXT) stored on B2 into clean
Markdown plus token-aware, metadata-rich chunks, written back to B2 side-by-side
with the source — the sample's headline capability.

## Used By
- UI: `/documents` (Add / Ingest / Edit config / Delete) and `/documents/[id]` (detail)
- API: `POST /documents`, `POST /documents/{doc_id}/ingest`, `GET /documents/{doc_id}/parsed`, `GET /documents/{doc_id}/chunks`, `PATCH /documents/{doc_id}/config`, `DELETE /documents/{doc_id}`
- Model: Docling `DocumentConverter` (layout + table models) + `HybridChunker` (default `sentence-transformers/all-MiniLM-L6-v2` tokenizer). On-device, no API key.

## Core Functions
- `services/api/app/repo/docling_engine.py` — `parse_and_chunk()` (lazy Docling imports; CUDA → MPS → CPU auto-detect, CPU default)
- `services/api/app/repo/corpus.py` — S3 put/get/list/delete scoped to `corpus/`
- `services/api/app/service/ingestion.py` — orchestration (create, ingest, read, edit, delete)
- `services/api/app/runtime/documents.py` — routes
- `apps/web/src/components/documents/` — add/edit dialogs, list, detail, chunk browser
- `apps/web/src/lib/document-api.ts`, `apps/web/src/lib/document-queries.ts`

## Canonical Files
- Docling engine: `services/api/app/repo/docling_engine.py`
- Ingestion orchestration: `services/api/app/service/ingestion.py`

## Inputs
- file: multipart upload (source document) — create
- config: `DocumentConfig` { export_format, max_tokens, merge_peers } (form fields / PATCH body)
- doc_id: path param (ingest / read / edit / delete)

## Outputs
- B2 writes: `corpus/<doc-id>/source.<ext>`, `parsed.<ext>`, `chunks.jsonl`, `manifest.json`
- `DocumentManifest` (status pending → ingested/failed, result counts)
- `ParsedDocumentResponse` (capped at 200 KB, `truncated` surfaced)
- `DocumentChunksResponse` (capped at first 200 chunks, `truncated` surfaced)

## Flow
- Create: validate extension → PutObject source → write manifest (pending)
- Ingest: GetObject source → Docling parse+chunk → PutObject parsed + chunks → update manifest (ingested)
- Edit: PATCH config on the manifest — does NOT re-run; next ingest uses it
- Delete: remove every object under `corpus/<doc-id>/`

## Edge Cases
- Unsupported extension → 415
- Read parsed/chunks before ingest → 409 ("run Ingest first")
- Docling failure → manifest marked `failed` with the error; route returns 500
- Oversized parsed/chunk payloads → capped for the UI with an explicit notice (no silent truncation)
- First ingest downloads models (~500 MB–1 GB) and can take minutes; a GPU is never required (CPU default)

## UX States
- Empty: "No documents in the corpus yet"
- Loading (upload): determinate progress bar driven by the real byte-upload percent
- Loading (ingest): the ingest button shows an "Ingesting…" spinner while a sonner
  loading toast renders `IngestProgress` — an advancing estimate for the whole wait.
  Because the ingest API is a single blocking call that returns the finished
  manifest (no sub-step streaming), the bar is an HONEST time-driven estimate: it
  eases toward ~90% (never 100% until the real result arrives) while the stage
  label advances through the fixed pipeline stages — "Reading source from B2…" →
  "Parsing layout & tables…" → "Chunking…" → "Writing to B2…". On completion the
  loading toast is replaced by the success (chunk/table counts) or error toast.
- Error: 415/409/500 surfaced as toasts; failed status shown on the row and detail

## Verification
- Test files: `services/api/tests/test_documents.py`, `services/api/tests/test_docling_engine.py`
- Required cases: create → list → read pending, ingest writes artifacts + updates manifest, parsed-before-ingest conflict, ingest failure marks failed, edit persists without re-run, delete removes all objects, unsupported extension rejected
- Focused verify command: `pnpm test:api`
- Default pre-PR verify command: `pnpm verify`
- Full local verify command: `pnpm verify:full` when E2E/live prerequisites apply
- Pass criteria: focused tests and `pnpm verify` green; the real Docling parse is exercised by ingesting a document in `pnpm dev`

## Related Docs
- [Corpus Library](corpus-library.md)
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [docs/app-workflows.md](../app-workflows.md)
