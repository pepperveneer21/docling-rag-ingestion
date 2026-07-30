"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PreviewMedia } from "@/components/files/file-preview-media";
import { DocumentStatusBadge } from "@/components/documents/document-status-badge";
import { DocumentRowActions } from "@/components/documents/document-row-actions";
import { ParsedMarkdown } from "@/components/documents/parsed-markdown";
import { ChunkBrowser } from "@/components/documents/chunk-browser";
import {
  useDocument,
  useDocumentChunks,
  useDocumentParsed,
  useDocumentSourceUrl,
} from "@/lib/document-queries";
import { formatBytes } from "@/lib/format-bytes";
import type { DocumentManifest, DocumentSummary } from "@docling-rag-ingestion/shared";

function toSummary(m: DocumentManifest): DocumentSummary {
  const r = m.result;
  const derived = r?.derived_bytes ?? 0;
  return {
    doc_id: m.doc_id,
    filename: m.filename,
    content_type: m.content_type,
    status: m.status,
    config: m.config,
    page_count: r?.page_count ?? 0,
    table_count: r?.table_count ?? 0,
    chunk_count: r?.chunk_count ?? 0,
    raw_bytes: m.raw_bytes,
    raw_bytes_human: formatBytes(m.raw_bytes),
    derived_bytes: derived,
    derived_bytes_human: formatBytes(derived),
    amplification: r && r.raw_bytes > 0 ? Math.round((derived / r.raw_bytes) * 1000) / 1000 : 0,
    created_at: m.created_at,
  };
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="stat-value text-lg">{value}</div>
    </div>
  );
}

export function DocumentDetail({ docId }: { docId: string }) {
  const router = useRouter();
  const { data: doc, isLoading, error, refetch } = useDocument(docId);
  const [tab, setTab] = useState("parsed");

  const ingested = doc?.status === "ingested";
  const source = useDocumentSourceUrl(docId, tab === "raw");
  const parsed = useDocumentParsed(docId, !!ingested && tab === "parsed");
  const chunks = useDocumentChunks(docId, !!ingested && tab === "chunks");

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (error) {
    if (error.isNotFound) {
      return (
        <EmptyState
          icon={ArrowLeft}
          title="Document not found"
          description="It may have been deleted."
          action={
            <Button asChild size="sm">
              <Link href="/documents">Back to Documents</Link>
            </Button>
          }
        />
      );
    }
    return <ErrorState error={error} onRetry={() => refetch()} />;
  }
  if (!doc) return null;

  const r = doc.result;
  const amp = r && r.raw_bytes > 0 ? Math.round((r.derived_bytes / r.raw_bytes) * 1000) / 1000 : 0;

  return (
    <div className="space-y-6">
      <div className="animate-fade-in space-y-4 border-b border-border pb-5">
        <Link href="/documents" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Documents
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="page-title break-words">{doc.filename}</h1>
            <div className="mt-1.5 flex items-center gap-3 text-sm text-muted-foreground">
              <DocumentStatusBadge status={doc.status} />
              <span className="font-mono text-xs">{doc.doc_id}</span>
            </div>
          </div>
          <DocumentRowActions doc={toSummary(doc)} config={doc.config} onDeleted={() => router.push("/documents")} />
        </div>
        {doc.status === "failed" && doc.error && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            Ingestion failed: {doc.error}
          </p>
        )}
      </div>

      {/* Write-amplification: the headline B2 story — one raw doc fans out into
          parsed + chunk artifacts. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Raw source" value={formatBytes(doc.raw_bytes)} />
        <Stat label="Derived" value={ingested ? formatBytes(r!.derived_bytes) : "—"} />
        <Stat label="Amplification" value={ingested ? `${amp}×` : "—"} />
        <Stat label="Chunks" value={ingested ? r!.chunk_count : "—"} />
      </div>

      <Card>
        <CardContent className="p-4">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="raw">Raw source</TabsTrigger>
              <TabsTrigger value="parsed">Parsed</TabsTrigger>
              <TabsTrigger value="chunks">Chunks</TabsTrigger>
            </TabsList>

            <TabsContent value="raw" className="pt-4">
              {source.isLoading ? (
                <Skeleton className="h-[400px] w-full" />
              ) : source.data?.url ? (
                <PreviewMedia key={source.data.url} url={source.data.url} filename={doc.filename} isImage={false} />
              ) : (
                <ErrorState error={source.error} onRetry={() => source.refetch()} />
              )}
            </TabsContent>

            <TabsContent value="parsed" className="pt-4">
              {!ingested ? (
                <NotIngested />
              ) : parsed.isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : parsed.data ? (
                <ParsedMarkdown parsed={parsed.data} />
              ) : (
                <ErrorState error={parsed.error} onRetry={() => parsed.refetch()} />
              )}
            </TabsContent>

            <TabsContent value="chunks" className="pt-4">
              {!ingested ? (
                <NotIngested />
              ) : chunks.isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : chunks.data ? (
                <ChunkBrowser data={chunks.data} />
              ) : (
                <ErrorState error={chunks.error} onRetry={() => chunks.refetch()} />
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function NotIngested() {
  return (
    <p className="rounded-md border border-border bg-muted/40 px-3 py-6 text-center text-sm text-muted-foreground">
      Not ingested yet. Run <strong>Ingest</strong> to parse this document into
      Markdown and token-aware chunks.
    </p>
  );
}
