import {
  API_BASE,
  API_CLIENT_ROUTES,
  ApiError,
  apiFetch,
} from "@/lib/api-client";
import type {
  DocumentChunksResponse,
  DocumentConfig,
  DocumentManifest,
  DocumentStats,
  DocumentSummary,
  ParsedDocumentResponse,
} from "@docling-rag-ingestion/shared";

/** Substitute a document id into a `{doc_id}` route template. */
function withId(path: string, docId: string): string {
  return path.replace("{doc_id}", encodeURIComponent(docId));
}

export async function getDocuments() {
  return apiFetch<DocumentSummary[]>(API_CLIENT_ROUTES.documents.path);
}

export async function getDocumentStats() {
  return apiFetch<DocumentStats>(API_CLIENT_ROUTES.documentStats.path);
}

export async function getDocument(docId: string) {
  return apiFetch<DocumentManifest>(withId(API_CLIENT_ROUTES.document.path, docId));
}

export async function getDocumentParsed(docId: string) {
  return apiFetch<ParsedDocumentResponse>(
    withId(API_CLIENT_ROUTES.documentParsed.path, docId),
  );
}

export async function getDocumentChunks(docId: string) {
  return apiFetch<DocumentChunksResponse>(
    withId(API_CLIENT_ROUTES.documentChunks.path, docId),
  );
}

export async function getDocumentSourceUrl(docId: string) {
  return apiFetch<{ url: string }>(
    withId(API_CLIENT_ROUTES.documentSource.path, docId),
  );
}

export async function ingestDocument(docId: string) {
  return apiFetch<DocumentManifest>(
    withId(API_CLIENT_ROUTES.ingestDocument.path, docId),
    { method: API_CLIENT_ROUTES.ingestDocument.method.toUpperCase() },
  );
}

export async function updateDocumentConfig(docId: string, config: DocumentConfig) {
  return apiFetch<DocumentManifest>(
    withId(API_CLIENT_ROUTES.updateDocumentConfig.path, docId),
    {
      method: API_CLIENT_ROUTES.updateDocumentConfig.method.toUpperCase(),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    },
  );
}

export async function deleteDocument(docId: string) {
  return apiFetch<{ deleted: boolean; doc_id: string; objects_removed: number }>(
    withId(API_CLIENT_ROUTES.deleteDocument.path, docId),
    { method: API_CLIENT_ROUTES.deleteDocument.method.toUpperCase() },
  );
}

/**
 * Multipart create with upload progress. Uses XHR (like `uploadFile`) so the
 * dialog can show a determinate bar while the raw source streams to the API.
 */
export function createDocument(
  file: File,
  config: DocumentConfig,
  onProgress?: (percent: number) => void,
): Promise<DocumentManifest> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", file);
    formData.append("export_format", config.export_format);
    formData.append("max_tokens", String(config.max_tokens));
    formData.append("merge_peers", String(config.merge_peers));

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        try {
          const body = JSON.parse(xhr.responseText);
          reject(new ApiError(body.detail || `Create failed: ${xhr.status}`, xhr.status));
        } catch {
          reject(new ApiError(`Create failed: ${xhr.status}`, xhr.status));
        }
      }
    });

    xhr.addEventListener("error", () =>
      reject(new ApiError("Couldn't reach the API. Check the API logs.", 0)),
    );
    xhr.addEventListener("abort", () =>
      reject(new ApiError("Create aborted", 0)),
    );

    xhr.open(
      API_CLIENT_ROUTES.createDocument.method.toUpperCase(),
      `${API_BASE}${API_CLIENT_ROUTES.createDocument.path}`,
    );
    xhr.send(formData);
  });
}
