# Build plan — `docling-rag-ingestion`

Source of truth for the starter tree:
`.claude/scratch/vcsk-0e8f0c70-1496-493e-bc63-19e594181fb6/` (already cloned in Phase 0).
Parent standards: `../CLAUDE.md`. Starter contract: the clone's `AGENTS.md`.

---

## 1. Purpose

`docling-rag-ingestion` is a B2-backed document-ingestion pipeline for RAG. An
enterprise developer drops a raw document (PDF / DOCX / PPTX / HTML) onto B2;
[Docling](https://github.com/docling-project/docling) reads it back, extracts
structure (headings, reading order, **tables**), and produces clean Markdown plus
token-aware, metadata-rich chunks. The Markdown and chunk JSONL land **back on B2
side-by-side with the raw source under a matching key**, turning a messy bucket of
PDFs into a versioned, dual-layer corpus. The headline B2 story is **write
amplification**: every raw document fans out into parsed + chunk artifacts, and the
app surfaces the raw-vs-derived byte ratio per document and across the corpus. B2 is
both **source and sink** for the whole pipeline, accessed only through the
S3-compatible API with a custom user-agent and standard `B2_*` env vars. It runs on
local OSS — **no second API key, B2 credentials only**.

Audience: developers and data engineers building RAG systems who want a reproducible,
object-storage-native ingestion pattern they can point any embedding/vector stack at.

---

## 2. Architecture delta from `vibe-coding-starter-kit`

The starter kit is the ceiling — strip what this app doesn't need, keep the reusable
B2 scaffolding, add the ingestion pipeline.

### KEEP (as-is — starter contract, do not strip/rename/replace)
- **UI kit / design system** — `apps/web/src/components/ui/`, tokens in
  `apps/web/src/app/globals.css`, the `/design` reference page. Build new screens
  from these primitives; never edit generated `ui/` files.
- **Full-bucket File Explorer** — `/files`, `apps/web/src/app/files/`,
  `apps/web/src/components/files/`. **Non-negotiable keep** (browse the whole
  bucket). The Files sidebar entry stays. The `file-preview-media.tsx` PDF/image
  inline preview is reused by the document detail view.
- **Upload** — `/upload` route + `apps/web/src/components/upload/` (dropzone,
  progress). Stays as the generic raw-B2 upload demo AND its dropzone is reused by
  the document create form. Sidebar entry stays.
- **Backend layering** `types → config → repo → service → runtime`, the health
  banner, rate limiting, list cache, structured logging, the contract/structure
  test harness, and `packages/shared` typing.

### TRIM (remove / neutralize from starter)
- **Dashboard illustrative content** — the generic upload stats cards, the raw
  "uploads over time" chart, and "recent uploads" table are replaced (not deleted
  wholesale) with ingestion metrics (see §4 Dashboard). This is the one screen the
  starter explicitly designates as per-app-rewritable.
- Any copy that markets it as a generic "starter kit" (README hero, `PRODUCT.md`,
  `app-config.ts` name/description). Retheme to the ingestion story.
- No routes/features are hard-deleted beyond rewriting the dashboard — the starter's
  file/upload surfaces are retained by contract.

### ADD (new for `docling-rag-ingestion`)
- **Primary entity: `Document`** (a source doc in the corpus) with a full lifecycle
  surface — see §4 Primary-entity lifecycle.
- **Scoped "Documents" (Corpus) explorer** — new `/documents` route: a Library view
  scoped to the sample's own `corpus/` prefix (distinct from the non-negotiable
  full-bucket `/files` Explorer). This is the sample-specific asset explorer the
  pipeline mandates in addition to the bucket explorer.
- **Docling ingestion engine** — `services/api/app/repo/docling_engine.py` wraps
  `DocumentConverter` + `HybridChunker` (external SDK confined to `repo/` per the
  layering invariant). **Imports are lazy** (inside functions) so structure/contract
  tests don't require the heavy ML stack installed.
- **Ingestion service + router** — `service/ingestion.py` (orchestrates read-raw →
  docling → write-artifacts → update-manifest) and `runtime/documents.py` (routes).
- **Per-document B2 manifest** as the corpus's source of truth (see §3 layout).
- **Document detail view** — raw preview (reused media preview iframe), rendered
  parsed Markdown (react-markdown + remark-gfm so extracted **tables** paint),
  chunk browser, and the write-amplification stat.

**Bucket-explorer tension note:** none — `/files` (full bucket) and `/documents`
(scoped corpus) coexist cleanly; the scoped view filters to `corpus/` while the
Explorer still browses everything.

---

## 3. B2 surface (S3-compatible only — no b2-native)

All access through the existing boto3 S3 client in `repo/b2_client.py` (custom
`user_agent_extra`, see §6). Operations exercised:

| Op | Where | Purpose |
|----|-------|---------|
| `PutObject` | create, ingest | write raw source, `parsed.md`, `chunks.jsonl`, `manifest.json` |
| `GetObject` | ingest, read | read raw for parsing; read parsed/chunks/manifest for the UI |
| `HeadObject` | metadata | object metadata (retained metadata-extraction feature) |
| `ListObjectsV2` | list, stats | enumerate `corpus/` manifests; dashboard aggregates |
| `DeleteObject` | delete | remove every object under `corpus/<doc-id>/` |
| `generate_presigned_url` (get_object) | preview/download | inline raw preview + artifact download |

No b2-native API anywhere. **Justified b2-native use: none.**

### Dual-layer key layout (matching keys, side-by-side)
One folder per document holds all layers so raw and derived sit literally side by side:
```
corpus/<doc-id>/source.<ext>     # raw upload (immutable)
corpus/<doc-id>/parsed.md        # Docling Markdown
corpus/<doc-id>/chunks.jsonl     # one JSON chunk record per line
corpus/<doc-id>/manifest.json    # status + config + result counts (source of truth)
```
`<doc-id>` = `slugify(filename-stem) + "-" + uuid4().hex[:8]`. Deletes and lists are
scoped to the `corpus/` prefix (never wipe shared bucket data — see parent
`CLAUDE.local.md`).

### Manifest schema (the corpus source of truth)
```json
{
  "doc_id": "invoice-1a2b3c4d",
  "filename": "invoice.pdf",
  "source_key": "corpus/invoice-1a2b3c4d/source.pdf",
  "content_type": "application/pdf",
  "status": "pending | ingested | failed",
  "config": { "export_format": "markdown", "max_tokens": 512, "merge_peers": true },
  "result": {
    "parsed_key": "corpus/invoice-1a2b3c4d/parsed.md",
    "chunks_key": "corpus/invoice-1a2b3c4d/chunks.jsonl",
    "page_count": 3, "table_count": 2, "chunk_count": 14,
    "raw_bytes": 84213, "derived_bytes": 20481, "ingested_at": "…Z"
  },
  "error": null,
  "created_at": "…Z"
}
```
Listing derives the corpus from the `*/manifest.json` objects (GET each — fine at
demo scale; note in ARCHITECTURE.md that production would index instead of
GET-per-doc).

---

## 4. Key features

Feature bullets seed the README list and `docs/features/<feature>.md` stubs.

1. **Document ingestion (Docling parse + chunk)** — raw → clean Markdown + token-aware
   chunks, written back to B2. Preserves tables and reading order.
2. **Dual-layer versioned corpus** — raw + parsed + chunks + manifest under one
   matching key per document; full traceability.
3. **Write-amplification insight** — per-document and corpus-wide raw-vs-derived byte
   ratio, front and center on the dashboard.
4. **Scoped Corpus library** — `/documents` view scoped to `corpus/`, separate from
   the full-bucket Explorer.
5. **Configurable chunking** — export format + max tokens + merge-peers per document,
   editable and re-runnable.
6. **B2 as source and sink** — S3-only, custom UA, standard `B2_*` env vars, no
   second API key.

### External API provider — per feature
- **Document ingestion (Docling)** — provider/model: **Docling** (`DocumentConverter`
  default layout+table models; `HybridChunker` with the default
  `sentence-transformers/all-MiniLM-L6-v2` tokenizer for token-aware chunking).
  `deployment: local`. This is the sample's whole point and a purely on-device
  capability, so LOCAL is the default (api-provider-selection.md Step 2 rule 1,
  on-device branch). **No external API key. Estimated cost for one full demo run:
  $0** (local compute only; B2 storage/egress only). Per the hard rule, the local
  feature **defaults to CPU and auto-detects a GPU** — Docling's default
  `AcceleratorOptions` is `AUTO` (CUDA → MPS → CPU), which satisfies this; MPS
  support in Docling is partial, so on Apple silicon it may fall back toward
  CPU — acceptable. First parse downloads Docling models (~500 MB–1 GB) + the
  chunker tokenizer (small); note this in README and as a verify-step consideration.
- No other feature needs an external provider. **No Genblaze** — the description's
  trending OSS is Docling and never mentions genblaze/`genblaze-*`/genblaze-s3, so
  provider orchestration via Genblaze does not apply.

### Primary-entity lifecycle — `Document` (mandatory UI completeness)

The single primary entity is **`Document`**. All five lifecycle verbs are exposed in
the UI and built (no omissions):

| Verb | UI surface | Backend |
|------|-----------|---------|
| **create** | `/documents` "Add Document" dialog: dropzone + chunk-config form | `POST /documents` (multipart): PutObject raw + write `manifest.json` (status=pending) |
| **read** | `/documents` list (status, chunk/page counts) + `/documents/[id]` detail | `GET /documents`, `GET /documents/{id}`, `GET /documents/{id}/parsed`, `GET /documents/{id}/chunks` |
| **run (Ingest)** | "Ingest" button on each row + detail | `POST /documents/{id}/ingest`: read raw → Docling parse+chunk → write `parsed.md`+`chunks.jsonl` → update manifest |
| **edit** | "Edit config" dialog (pre-filled from `manifest.config`) | `PATCH /documents/{id}/config`: update manifest config (does NOT re-run; next Ingest uses it) |
| **delete** | "Delete" (AlertDialog confirm) on row + detail | `DELETE /documents/{id}`: delete every object under `corpus/{id}/` |

`edit` is genuine and non-duplicative: a source doc's bytes are immutable, so "edit"
edits the **ingestion config** (persisted in the manifest); "run" executes with
whatever config is stored. `omitted_ui_verbs` is therefore **empty**.

### Form UX conventions
- **Create form** (Add Document): file dropzone (accept `.pdf,.docx,.pptx,.html,.md,.txt`)
  + config fields. **Finite-value fields use selectors, never free text:**
  - `export_format` → `Select`: Markdown (default) · JSON · HTML · Text
  - `max_tokens` → `Select`: 256 · **512 (default)** · 1024
  - `merge_peers` → `Switch` (default on)
  Safe-default guidance via placeholder / `FormDescription` (guidance only, never an
  autofill button): e.g. "512 tokens + Markdown export suits most PDFs." Mirror the
  starter exemplar `apps/web/src/components/settings/settings-form.tsx`.
- **Edit form** (Edit config): same three selector fields, **pre-filled** from the
  document's stored config (no file field, no default-hint — it opens on the real
  resource).

---

## 5. Doc transforms

- **Rewrite:** `docs/features/dashboard.md` (ingestion metrics + write amplification);
  `README.md` (hero, features, `B2_*` env table per §6, Docling model-download note,
  run/demo steps); `ARCHITECTURE.md` (ingestion data flow + `corpus/` key layout +
  docling engine in repo layer); `docs/app-workflows.md` (ingestion journey);
  `PRODUCT.md` (positioning). Retheme `app-config.ts` (APP_NAME/APP_DESCRIPTION).
- **Keep (light edit only):** `docs/features/file-upload.md`,
  `docs/features/file-browser.md`, `docs/features/metadata-extraction.md`,
  `docs/features/settings.md`, `docs/SECURITY.md`, `docs/RELIABILITY.md`,
  `docs/dev-workflows.md`.
- **New stubs:** `docs/features/document-ingestion.md`, `docs/features/corpus-library.md`
  (use `docs/features/_template.md`).
- **AGENTS.md + shims:** update the repo map / feature notes to include the ingestion
  pipeline, but **keep every `pnpm check:agent-docs` invariant intact** (agent-doc
  size bounds, thin shims `CLAUDE.md`/`GEMINI.md`/copilot, the Secret-Handling
  section + `docs/SECURITY.md` anchor link, the command list, CI gate claims). Any
  new frontend-consumed route must update `runtime/documents.py` +
  `lib/api-client.ts` (`API_CLIENT_ROUTES`) + `lib/queries.ts` +
  `docs/api/openapi.json` (`pnpm contract:export`) + `packages/shared/src/types.ts`,
  or `pnpm test:api` / `pnpm test:web` fail.

---

## 6. Rename table (`vibe-coding-starter-kit` → `docling-rag-ingestion`)

| Identifier / location | From | To |
|---|---|---|
| Repo / dir / kebab slug | `vibe-coding-starter-kit` | `docling-rag-ingestion` |
| Root `package.json` name | `vibe-coding-starter-kit` | `docling-rag-ingestion` |
| pnpm workspace scope (pkgs + `--filter` in scripts) | `@vibe-coding-starter-kit/web`,`/shared` | `@docling-rag-ingestion/web`,`/shared` |
| Frontend TS imports | `@vibe-coding-starter-kit/shared` | `@docling-rag-ingestion/shared` |
| `services/api` pyproject name | (starter value) | `docling-rag-ingestion-api` |
| FastAPI `title` (`main.py`) | `OSS Starter Kit API` | `Docling RAG Ingestion API` |
| `app-config.ts` `APP_NAME` | `OSS Starter Kit` | `Docling RAG Ingestion` |
| `app-config.ts` `APP_DESCRIPTION` | file mgmt dashboard… | `Parse documents into RAG-ready Markdown + chunks on Backblaze B2` |
| `header.tsx` `pageTitles` | (map) | add `/documents`; APP_NAME already sourced from app-config |
| S3 `user_agent_extra` (`b2_client.py`) | `b2ai-oss-start` | `docling-rag-ingestion` |
| README `blze`/UTM `content` tag | starter tag | `docling-rag-ingestion` |
| infra/railway image tags / service slugs | starter slug | `docling-rag-ingestion` |
| CI workflow names / "starter kit" prose | — | `docling-rag-ingestion` |

### Env-var standardization (Standard #3 — REQUIRED; starter deviates)
The starter uses `B2_ENDPOINT` + `B2_KEY_ID` and no `B2_REGION`/`B2_PUBLIC_URL_BASE`.
Rename to the five standard names everywhere (`.env.example`, `settings.py`,
`main.py` `REQUIRED_B2_SETTINGS`/`PLACEHOLDER_VALUES`, `b2_client.py`,
`scripts/doctor.mjs`, README, docs):

| From (starter) | To (Standard #3) | Notes |
|---|---|---|
| `B2_KEY_ID` | `B2_APPLICATION_KEY_ID` | settings attr `b2_application_key_id` |
| `B2_APPLICATION_KEY` | `B2_APPLICATION_KEY` | unchanged |
| `B2_BUCKET_NAME` | `B2_BUCKET_NAME` | unchanged |
| `B2_ENDPOINT` | `B2_REGION` | e.g. `us-west-004`; derive endpoint `https://s3.{region}.backblazeb2.com` as a settings property. Drop the standalone `B2_ENDPOINT` env. |
| `B2_PUBLIC_URL` | `B2_PUBLIC_URL_BASE` | optional; keep empty-string default → do **not** make it a required/blocking key |

Required-at-startup keys: `B2_APPLICATION_KEY_ID`, `B2_APPLICATION_KEY`,
`B2_BUCKET_NAME`. `B2_REGION` keeps a sensible default (`us-west-004`) so it's never
"missing"; `B2_PUBLIC_URL_BASE` is optional.

---

## 7. Python dependencies

`requirements.txt` uses `>=` lower bounds only (enforced by
`tests/test_dependency_lock.py`); exact resolution is regenerated into
`requirements.lock` (used by setup + CI). Add:
- `docling>=2.7.0` (pulls torch/torchvision etc. transitively — captured in the lock)
- `transformers>=4.40.0` (HybridChunker tokenizer)
Keep existing `PyPDF2`/`Pillow` (retained metadata-extraction feature).

**Fast-green build discipline (important):** Docling imports are lazy inside
`repo/docling_engine.py`; the ingestion service is tested with the engine
**stubbed/monkeypatched**, so `pnpm verify:api` (lint + pytest + structure) stays fast
and needs no torch/docling installed. The full ML stack + real parse are exercised
later at the verify step, not in this build. `requirements.txt`/`.lock` must still
declare docling completely so a fresh clone's real run works (unpinned ML = false
green — the lock prevents it).

---

## 8. Frontend wiring summary

New shared types in `packages/shared/src/types.ts`: `DocumentConfig`,
`DocumentManifest`, `DocumentSummary`, `DocumentChunk`, `DocumentStats`. New
api-client routes + functions, new `queries.ts` hooks
(`useDocuments`, `useDocument`, `useDocumentChunks`, `useDocumentStats`,
`useCreateDocument`, `useIngestDocument`, `useUpdateDocumentConfig`,
`useDeleteDocument`) — all data flows through TanStack Query (no bare
`useEffect+fetch`). Detail view renders parsed Markdown with
`react-markdown` + `remark-gfm` (tables paint), reuses `file-preview-media` for the
raw PDF iframe (presigned inline URL), and lists chunks (cap the chunk/markdown
payload for the UI — e.g. first 200 chunks / 200 KB — and note the cap in the UI, no
silent truncation). Dashboard adapts stats-cards + chart + recent-table to
ingestion metrics (documents, ingested/pending, total chunks, total pages, raw vs
derived bytes + amplification ratio). Sidebar order: Dashboard · Documents ·
Upload · Files · Settings · (Design link).

---

## 9. Verify gates the build must pass
`pnpm verify` green (`check:agent-docs`, `verify:api` = lint+pytest+structure,
`verify:web` = lint+vitest+typecheck+build), OpenAPI + api-contract in sync, all
files < 300 lines, no boto3 outside `repo/`, no backward imports, structured logging
only. B2 standards audited: S3-only, custom UA on the client, the five `B2_*` names.
