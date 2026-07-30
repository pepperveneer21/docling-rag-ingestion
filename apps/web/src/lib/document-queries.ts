"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  createDocument,
  deleteDocument,
  getDocument,
  getDocumentChunks,
  getDocumentParsed,
  getDocuments,
  getDocumentSourceUrl,
  getDocumentStats,
  ingestDocument,
  updateDocumentConfig,
} from "@/lib/document-api";
import type { ApiError } from "@/lib/api-client";
import type {
  DocumentConfig,
  DocumentManifest,
  DocumentSummary,
} from "@docling-rag-ingestion/shared";

// Query keys, namespaced under the document domain so invalidating documents
// never disturbs the file/upload caches.
export const dqk = {
  all: ["documents"] as const,
  list: () => [...dqk.all, "list"] as const,
  stats: () => [...dqk.all, "stats"] as const,
  detail: (id: string) => [...dqk.all, "detail", id] as const,
  parsed: (id: string) => [...dqk.all, "parsed", id] as const,
  chunks: (id: string) => [...dqk.all, "chunks", id] as const,
  source: (id: string) => [...dqk.all, "source", id] as const,
};

export function useDocuments() {
  return useQuery<DocumentSummary[], ApiError>({
    queryKey: dqk.list(),
    queryFn: getDocuments,
  });
}

export function useDocumentStats() {
  return useQuery({ queryKey: dqk.stats(), queryFn: getDocumentStats });
}

export function useDocument(docId: string | undefined) {
  return useQuery<DocumentManifest, ApiError>({
    queryKey: dqk.detail(docId ?? ""),
    queryFn: () => getDocument(docId as string),
    enabled: !!docId,
  });
}

export function useDocumentParsed(docId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: dqk.parsed(docId ?? ""),
    queryFn: () => getDocumentParsed(docId as string),
    enabled: enabled && !!docId,
  });
}

export function useDocumentChunks(docId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: dqk.chunks(docId ?? ""),
    queryFn: () => getDocumentChunks(docId as string),
    enabled: enabled && !!docId,
  });
}

export function useDocumentSourceUrl(docId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: dqk.source(docId ?? ""),
    queryFn: () => getDocumentSourceUrl(docId as string),
    enabled: enabled && !!docId,
    staleTime: 60_000,
  });
}

export function useCreateDocument() {
  const qc = useQueryClient();
  return useMutation<
    DocumentManifest,
    ApiError,
    { file: File; config: DocumentConfig; onProgress?: (p: number) => void }
  >({
    mutationFn: ({ file, config, onProgress }) =>
      createDocument(file, config, onProgress),
    onSuccess: () => qc.invalidateQueries({ queryKey: dqk.all }),
  });
}

export function useIngestDocument() {
  const qc = useQueryClient();
  return useMutation<DocumentManifest, ApiError, string>({
    mutationFn: (docId) => ingestDocument(docId),
    onSuccess: (manifest) => {
      qc.setQueryData(dqk.detail(manifest.doc_id), manifest);
      // Parsed/chunks changed; drop their caches so the detail view refetches.
      qc.removeQueries({ queryKey: dqk.parsed(manifest.doc_id) });
      qc.removeQueries({ queryKey: dqk.chunks(manifest.doc_id) });
      qc.invalidateQueries({ queryKey: dqk.list() });
      qc.invalidateQueries({ queryKey: dqk.stats() });
    },
  });
}

export function useUpdateDocumentConfig() {
  const qc = useQueryClient();
  return useMutation<
    DocumentManifest,
    ApiError,
    { docId: string; config: DocumentConfig }
  >({
    mutationFn: ({ docId, config }) => updateDocumentConfig(docId, config),
    onSuccess: (manifest) => {
      qc.setQueryData(dqk.detail(manifest.doc_id), manifest);
      qc.invalidateQueries({ queryKey: dqk.list() });
    },
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation<
    { deleted: boolean; doc_id: string; objects_removed: number },
    ApiError,
    string
  >({
    mutationFn: (docId) => deleteDocument(docId),
    onSuccess: () => qc.invalidateQueries({ queryKey: dqk.all }),
  });
}
