"use client";

import Link from "next/link";
import { ArrowRight, Inbox } from "lucide-react";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useDocuments } from "@/lib/document-queries";
import { formatDate } from "@/lib/utils";

export function RecentDocumentsTable() {
  const { data: docs = [], isLoading, error, refetch } = useDocuments();
  const recent = docs.slice(0, 6);

  return (
    <Card>
      <CardHeader className="border-b border-border py-4 px-5">
        <CardTitle className="card-title">Recent documents</CardTitle>
        <CardAction className="self-center">
          <Link
            href="/documents"
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            View all
            <ArrowRight className="h-3 w-3" />
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : error ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : recent.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No documents yet"
            description="Head to Documents to add your first source file."
          />
        ) : (
          <Table className="table-fixed">
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-[42%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">Document</TableHead>
                <TableHead className="w-[22%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                <TableHead className="w-[14%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">Chunks</TableHead>
                <TableHead className="w-[22%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">Added</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.map((doc) => (
                <TableRow key={doc.doc_id} className="table-row-hover">
                  <TableCell className="font-medium">
                    <Link
                      href={`/documents/${doc.doc_id}`}
                      className="block truncate rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      title={`Open ${doc.filename}`}
                    >
                      {doc.filename}
                    </Link>
                  </TableCell>
                  <TableCell><DocumentStatusBadge status={doc.status} /></TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {doc.status === "ingested" ? doc.chunk_count : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {formatDate(doc.created_at)}
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
