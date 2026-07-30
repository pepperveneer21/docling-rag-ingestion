"use client";

import Link from "next/link";
import { FileText, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { DocumentStatusBadge } from "@/components/documents/document-status-badge";
import { DocumentRowActions } from "@/components/documents/document-row-actions";
import { AddDocumentDialog } from "@/components/documents/add-document-dialog";
import { useDocuments } from "@/lib/document-queries";
import { formatDate } from "@/lib/utils";

function AmplificationCell({
  raw,
  derived,
  ratio,
  ingested,
}: {
  raw: string;
  derived: string;
  ratio: number;
  ingested: boolean;
}) {
  if (!ingested) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <span className="font-mono text-xs tabular-nums text-muted-foreground">
      {raw} → {derived}
      <span className="ml-1.5 rounded bg-muted px-1 py-0.5 text-foreground">
        {ratio}×
      </span>
    </span>
  );
}

export function DocumentList() {
  const { data: docs = [], isLoading, isFetching, error, refetch } = useDocuments();

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 space-y-0">
        <CardTitle className="card-title">Corpus documents</CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          className="h-7 shrink-0 text-xs"
          disabled={isFetching}
          aria-label={isFetching ? "Refreshing documents" : "Refresh documents"}
        >
          <RefreshCw className={`mr-1 h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="p-0" aria-busy={isLoading}>
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : error ? (
          <ErrorState error={error} title="Couldn't load documents" onRetry={() => refetch()} className="px-4" />
        ) : docs.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No documents in the corpus yet"
            description="Add a PDF, DOCX, PPTX, HTML, MD, or TXT and ingest it into RAG-ready Markdown + chunks."
            action={<AddDocumentDialog />}
            className="px-4"
          />
        ) : (
          <Table className="table-fixed">
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-[26%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">Document</TableHead>
                <TableHead className="w-[12%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                <TableHead className="w-[8%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pages</TableHead>
                <TableHead className="w-[8%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">Chunks</TableHead>
                <TableHead className="w-[8%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tables</TableHead>
                <TableHead className="w-[20%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">Raw → Derived</TableHead>
                <TableHead className="w-[18%] text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.map((doc) => (
                <TableRow key={doc.doc_id} className="table-row-hover">
                  <TableCell className="font-medium">
                    <Link
                      href={`/documents/${doc.doc_id}`}
                      className="block truncate rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      title={`Open ${doc.filename}`}
                    >
                      {doc.filename}
                    </Link>
                    <span className="block text-[11px] text-muted-foreground">
                      {formatDate(doc.created_at)}
                    </span>
                  </TableCell>
                  <TableCell><DocumentStatusBadge status={doc.status} /></TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {doc.status === "ingested" ? doc.page_count : "—"}
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {doc.status === "ingested" ? doc.chunk_count : "—"}
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {doc.status === "ingested" ? doc.table_count : "—"}
                  </TableCell>
                  <TableCell>
                    <AmplificationCell
                      raw={doc.raw_bytes_human}
                      derived={doc.derived_bytes_human}
                      ratio={doc.amplification}
                      ingested={doc.status === "ingested"}
                    />
                  </TableCell>
                  <TableCell>
                    <DocumentRowActions doc={doc} config={doc.config} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
