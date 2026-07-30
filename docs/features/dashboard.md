<!-- last_verified: 2026-07-30 -->
# Feature: Dashboard

## Purpose
Give an at-a-glance overview of the ingestion corpus — how many documents exist,
how many are ingested, how many chunks were produced, and the raw-vs-derived
**write amplification** across the corpus.

## Used By
- UI: `/` page (dashboard home)
- API: `GET /documents/stats`, `GET /documents`

## Core Functions
- `apps/web/src/components/dashboard/ingestion-stats-cards.tsx` — 4 stat cards (documents, ingested, pending, total chunks)
- `apps/web/src/components/dashboard/amplification-panel.tsx` — raw vs. derived bytes bar chart + amplification ratio
- `apps/web/src/components/dashboard/recent-documents-table.tsx` — latest documents with status + chunk counts
- `apps/web/src/lib/document-queries.ts` — `useDocumentStats()`, `useDocuments()`
- `apps/web/src/lib/document-api.ts` — `getDocumentStats()`, `getDocuments()`
- `services/api/app/runtime/documents.py` — `GET /documents/stats` handler
- `services/api/app/service/document_stats.py` — corpus aggregation + amplification ratio
- `services/api/app/repo/corpus.py` — lists `corpus/*/manifest.json` objects

## Canonical Files
- Dashboard aggregation: `services/api/app/service/document_stats.py`
- Amplification panel: `apps/web/src/components/dashboard/amplification-panel.tsx`

## Inputs
- None (dashboard loads data automatically)

## Outputs
- `GET /documents/stats` → `DocumentStats` (total_documents, ingested, pending, failed, total_chunks, total_pages, total_tables, raw_bytes, derived_bytes, amplification_ratio)
- `GET /documents` → `DocumentSummary[]` for the recent-documents table (sorted newest-first)

## Flow
- Page loads → two TanStack Query calls (`useDocumentStats`, `useDocuments`)
- Stat cards render document counts and total chunks
- The amplification panel charts corpus-wide raw bytes vs. derived bytes and shows
  the ratio; it derives the ratio from ingested documents only (a pending document
  has no derived bytes yet)
- The recent-documents table links each filename to `/documents/[id]`

## Edge Cases
- API unavailable → inline error states with retry
- No documents → empty states on cards, panel, and table
- No ingested documents yet → the amplification panel shows an empty state (there
  is nothing to compare until at least one document has derived artifacts)
- Large corpus → stats aggregate one GET per `manifest.json`; fine at demo scale,
  and ARCHITECTURE.md notes production would index instead

## UX States
- Loading: skeletons on cards, panel, and table
- Empty: "No documents yet" / "No ingested documents yet"
- Loaded: populated cards, chart, table

## Verification
- Test files: `services/api/tests/test_documents.py` (`test_stats_aggregate_amplification`)
- Required cases: stats with an ingested document, empty corpus, amplification ratio computed from ingested docs only
- Focused verify command: `pnpm test:api`
- Default pre-PR verify command: `pnpm verify`
- Full local verify command: `pnpm verify:full` when the E2E/live prerequisites in [Dev Workflows](../dev-workflows.md#commands) are available
- Pass criteria: focused tests and `pnpm verify` green

## Related Docs
- [Document Ingestion](document-ingestion.md)
- [Corpus Library](corpus-library.md)
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [App Workflows](../app-workflows.md)
