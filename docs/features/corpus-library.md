<!-- last_verified: 2026-07-30 -->
# Feature: Corpus Library

## Purpose
Provide a scoped view of the sample's own document corpus — everything under the
`corpus/` prefix — distinct from the full-bucket File Explorer (`/files`). This is
where documents are added, ingested, configured, and browsed.

## Used By
- UI: `/documents` (list) and `/documents/[id]` (detail)
- API: `GET /documents`, `GET /documents/{doc_id}`, `GET /documents/{doc_id}/source`

## Core Functions
- `apps/web/src/app/documents/page.tsx` — list page
- `apps/web/src/app/documents/[id]/page.tsx` — detail page
- `apps/web/src/components/documents/document-list.tsx` — table with status, counts, amplification
- `apps/web/src/components/documents/document-detail.tsx` — Raw / Parsed / Chunks tabs + amplification stat
- `apps/web/src/components/documents/document-row-actions.tsx` — Ingest / Edit config / Delete
- `services/api/app/service/ingestion.py` — `list_documents()`, `get_document()`, `get_source_preview_url()`

## Canonical Files
- Corpus list: `apps/web/src/components/documents/document-list.tsx`
- Corpus detail: `apps/web/src/components/documents/document-detail.tsx`

## Inputs
- None for the list (loads automatically)
- doc_id: path param for the detail view

## Outputs
- `GET /documents` → `DocumentSummary[]` (doc_id, filename, status, config, counts, raw/derived bytes, amplification)
- `GET /documents/{doc_id}` → `DocumentManifest`
- `GET /documents/{doc_id}/source` → `{ url }` presigned inline URL for the raw preview

## Flow
- List loads all `corpus/*/manifest.json` objects → summaries, newest-first
- A row links to the detail view; per-row actions run Ingest / Edit config / Delete
- Detail: Raw tab renders the presigned source (reuses `file-preview-media`), Parsed
  tab renders the Markdown, Chunks tab lists the chunk records; a stat strip shows
  raw → derived bytes and the amplification ratio
- The scoped view filters to `corpus/`; the full-bucket Explorer at `/files` still
  browses everything — the two coexist cleanly

## Edge Cases
- Not-found document (deleted) → detail shows a "not found" state with a link back
- Pending document → Parsed/Chunks tabs show "not ingested yet"; counts show "—"
- Non-Markdown export (JSON/HTML/Text) → parsed tab shows the artifact verbatim

## UX States
- Empty: "No documents in the corpus yet" with an Add Document action
- Loading: skeleton rows / detail skeleton
- Error: inline error state with retry

## Verification
- Test files: `services/api/tests/test_documents.py`
- Required cases: list reflects created documents, detail returns the manifest, delete then 404
- Focused verify command: `pnpm test:api`
- Default pre-PR verify command: `pnpm verify`
- Full local verify command: `pnpm verify:full` when E2E/live prerequisites apply
- Pass criteria: focused tests and `pnpm verify` green

## Related Docs
- [Document Ingestion](document-ingestion.md)
- [File Browser](file-browser.md)
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
