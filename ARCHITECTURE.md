<!-- last_verified: 2026-07-28 -->
# Architecture

## Components

- **apps/web/** — Next.js 16 frontend (App Router, Tailwind v4, shadcn/ui)
  - Dashboard with ingestion metrics and write-amplification panel
  - Documents (Corpus library) — add / ingest / edit-config / delete, plus a
    detail view with raw preview, rendered Markdown (react-markdown + remark-gfm
    so extracted tables paint), and a chunk browser
  - File upload with drag-and-drop, and the full-bucket file browser
  - Dark mode via `next-themes`
- **services/api/** — FastAPI backend (layered architecture)
  - Document ingestion: read raw from B2 → Docling parse+chunk → write derived artifacts back
  - B2 S3 integration via boto3 (source AND sink for the whole pipeline)
  - File metadata extraction (images, PDFs); health + Prometheus metrics
  - Structured JSON logging with request tracing
- **packages/shared/** — TypeScript type definitions
  - Mirrors Pydantic models from the API (files + documents)
  - Consumed by `apps/web/` as workspace dependency

## Backend Layering

The API follows a strict layered architecture:

```
types/     Pydantic models — no logic, no imports from other layers
  |
config/    Settings (pydantic-settings) — depends only on types
  |
repo/      Data access (boto3 B2 client) — no business logic
  |
service/   Business logic — calls repo, returns types
  |
runtime/   FastAPI routes — calls service, never repo directly
```

### Layering Rules

1. Dependencies flow downward only: `types` -> `config` -> `repo` -> `service` -> `runtime`
2. No backward imports (e.g., service must not import from runtime)
3. `boto3` only allowed in `repo/` layer
4. All boundary data uses Pydantic models (no raw dicts across layers)
5. Each file stays under 300 lines

### Directory Structure

```
services/api/
  main.py                  App entrypoint, middleware, router registration
  app/
    types/                 Pydantic models (FileMetadata, UploadStats, etc.)
    config/                Settings loaded from environment
    repo/                  B2 S3 client (data access layer)
    service/               Business logic (upload, files, metadata)
    runtime/               FastAPI route handlers
  tests/                   pytest tests (structural + integration)
```

## Boundary Invariants

- **No external SDK leakage**: `boto3` is only imported in `app/repo/`. All other layers interact with B2 through the repo interface.
- **No raw dicts at boundaries**: All data crossing layer boundaries uses typed Pydantic models.
- **No cross-layer mutable state**: Configuration is read-only after init, and no mutable state is shared *between* layers. Intra-layer caches/counters (the listing cache in `repo/list_cache.py`, the B2 connectivity cache in `repo/b2_client.py`, the download counter in `repo/counter.py`, the rate-limit and metrics state in `runtime/`) are module-local and guarded by a `threading.Lock`. The listing cache also owns the only background thread in the app: a stale entry is served immediately while that thread re-scans (stale-while-revalidate), and `main.lifespan` warms it once at startup so no user pays for the cold full-bucket scan.
- **Validated inputs**: All HTTP inputs validated by FastAPI/Pydantic. File keys reject empty and path-traversal patterns; optional prefix confinement via `ALLOWED_KEY_PREFIX` (off by default).

## Deployment

- **Local dev** — `pnpm dev` runs both services via `concurrently`
  - Web: `localhost:3000`
  - API: `localhost:8000`
- **Railway** — two services from the same repository: `web` builds from the
  repository root because it consumes `packages/shared`; `api` builds from
  `services/api`. The versioned per-service configs and the human-approved
  staging/production contract live in [infra/railway/README.md](infra/railway/README.md).
  External provisioning and deployment remain explicit user-approved actions.

## Corpus key layout (dual-layer, matching keys)

One folder per document holds the raw source and every derived artifact
side-by-side, so raw and derived sit literally under a matching key:

```
corpus/<doc-id>/source.<ext>     raw upload (immutable)
corpus/<doc-id>/parsed.<ext>     Docling export (Markdown by default)
corpus/<doc-id>/chunks.jsonl     one JSON chunk record per line
corpus/<doc-id>/manifest.json    status + config + result counts (source of truth)
```

`<doc-id>` = `slugify(filename-stem) + "-" + uuid4().hex[:8]`. Lists and deletes
are scoped to the `corpus/` prefix, so shared-bucket data is never touched. The
corpus listing is derived from the `*/manifest.json` objects (one GET per doc).
This is deliberately simple and fine at demo scale; **a production system would
maintain an index (DB / catalog) instead of GET-per-doc.**

## Ingestion data flow

```
Add:    Browser → POST /documents (multipart) → PutObject source.<ext>
                → write manifest.json (status=pending)
Ingest: Browser → POST /documents/{id}/ingest → GetObject source
                → repo/docling_engine parse+chunk (DocumentConverter + HybridChunker)
                → PutObject parsed.<ext> + chunks.jsonl → update manifest (status=ingested)
Read:   Browser → GET /documents[/{id}[/parsed|/chunks|/source]] ← manifests/artifacts
Edit:   Browser → PATCH /documents/{id}/config → update manifest.config (no re-run)
Delete: Browser → DELETE /documents/{id} → delete every object under corpus/{id}/
```

The Docling / transformers stack lives **only** in
`services/api/app/repo/docling_engine.py`, with **lazy imports** (inside
functions) so importing the module never pulls torch/docling — that keeps
`pnpm verify:api` fast and lets the ingestion service be tested with the engine
stubbed. Device selection auto-detects CUDA → Apple MPS → CPU and defaults to CPU.

## Data Stores

- **Backblaze B2** — object storage (S3-compatible API), source AND sink
  - Raw sources, derived artifacts, and per-document manifests in one bucket
  - Listing and metadata via S3 `list_objects_v2` / `head_object`; reads via
    `get_object`; writes via `put_object`; presigned GETs for inline preview
  - No application database — the per-document `manifest.json` on B2 is the
    corpus source of truth

## External Services

- **Backblaze B2 S3 API** — file storage, retrieval, deletion, presigned URLs
- **Docling** (on-device, no API key) — document parsing (`DocumentConverter`)
  and token-aware chunking (`HybridChunker`); models are downloaded on first
  use and cached. Confined to `repo/docling_engine.py`.

## Trust Boundaries

See [docs/SECURITY.md](docs/SECURITY.md) for full security documentation.

- **Frontend -> API** — CORS-restricted to configured origins. `CORSMiddleware` is registered LAST in `main.py` (outermost) so it wraps **every** response, including uncaught-exception 500s — otherwise the browser would block error responses and the UI would only see an opaque "network error". See [docs/RELIABILITY.md](docs/RELIABILITY.md#error-handling). A per-IP rate-limit middleware sits inner to CORS; see [docs/SECURITY.md](docs/SECURITY.md#rate-limiting).
- **API -> B2** — authenticated via application keys, signature v4
- **Client -> B2** — presigned URLs for download (10-min expiry, forced attachment)

## Data Flows

- **Upload**: Browser -> `POST /upload` (multipart) -> API validates -> service orchestrates -> repo writes to B2 -> metadata extracted -> response
- **List**: Browser -> `GET /files` -> service calls repo -> returns file list
- **Download**: Browser -> `GET /files/{key}/download` -> service validates key -> repo generates presigned URL -> browser downloads
- **Delete**: Browser -> `DELETE /files/{key}` -> service validates key -> repo deletes from B2

## Observability

- Structured JSON logging on all requests with `request_id`
- Request timing middleware (logs duration per request; also the catch-all that converts uncaught exceptions to a typed JSON 500)
- `/metrics` endpoint (Prometheus format: request count, latency, upload count)
- `/health` endpoint (B2 connectivity check)

## API Contract

- Checked-in OpenAPI artifact: `docs/api/openapi.json`
- Export/check command: `pnpm contract:export` / `pnpm contract:check`
- FastAPI freshness test: `services/api/tests/test_openapi_contract.py`
- Frontend route drift test: `apps/web/src/lib/api-contract.test.ts`

The frontend client keeps a small `API_CLIENT_ROUTES` registry in
`apps/web/src/lib/api-client.ts`. Tests compare that registry to the checked-in
OpenAPI artifact so route changes fail loudly before the hand-written client can
silently drift from FastAPI. `GET /metrics` is intentionally server-only.

## Canonical Files

- Ingestion route handler: `services/api/app/runtime/documents.py`
- Ingestion orchestration: `services/api/app/service/ingestion.py`
- Docling engine (external SDK, lazy imports): `services/api/app/repo/docling_engine.py`
- Corpus storage (S3-only): `services/api/app/repo/corpus.py`
- Layered API handler (upload demo): `services/api/app/runtime/upload.py`
- B2 data access (repo layer): `services/api/app/repo/b2_client.py`
- Pydantic models: `services/api/app/types/` (`documents.py`, `files.py`, `upload.py`, `stats.py`)
- Config (pydantic-settings): `services/api/app/config/settings.py`
- Structural tests: `services/api/tests/test_structure.py`
- OpenAPI contract: `docs/api/openapi.json`
- OpenAPI exporter: `services/api/scripts/export_openapi.py`
- Frontend API client: `apps/web/src/lib/api-client.ts`
- Shared TypeScript types: `packages/shared/src/types.ts`

## Core Features

- [Document Ingestion](docs/features/document-ingestion.md)
- [Corpus Library](docs/features/corpus-library.md)
- [Dashboard](docs/features/dashboard.md)
- [File Upload](docs/features/file-upload.md)
- [File Browser](docs/features/file-browser.md)
- [Metadata Extraction](docs/features/metadata-extraction.md)

## References

- [docs/SECURITY.md](docs/SECURITY.md) — security principles and implementation
- [docs/RELIABILITY.md](docs/RELIABILITY.md) — reliability expectations
- [AGENTS.md](AGENTS.md) — architectural invariants and agent instructions
