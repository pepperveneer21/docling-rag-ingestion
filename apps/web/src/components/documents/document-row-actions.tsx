"use client";

import { useState } from "react";
import { Loader2, Play, RotateCw, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EditConfigDialog } from "@/components/documents/edit-config-dialog";
import { IngestProgress } from "@/components/documents/ingest-progress";
import { useDeleteDocument, useIngestDocument } from "@/lib/document-queries";
import { ApiError } from "@/lib/api-client";
import type { DocumentSummary, DocumentConfig } from "@docling-rag-ingestion/shared";

// The list carries a summary, not the full manifest/config, so the row asks the
// user to open the config dialog with the document's stored config. We fetch it
// lazily there via the detail cache; here we accept it as a prop from the list.
export function DocumentRowActions({
  doc,
  config,
  onDeleted,
}: {
  doc: DocumentSummary;
  config: DocumentConfig;
  /** Called after a successful delete (e.g. to navigate off a detail page). */
  onDeleted?: () => void;
}) {
  const ingest = useIngestDocument();
  const del = useDeleteDocument();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const ingesting = ingest.isPending && ingest.variables === doc.doc_id;

  const runIngest = () => {
    // A single blocking ingest can run ~11s (longer on a cold first run). Show an
    // advancing, honest progress indicator for the whole wait instead of a static
    // spinner + fixed text — see IngestProgress.
    const toastId = toast.loading(<IngestProgress filename={doc.filename} />);
    ingest.mutate(doc.doc_id, {
      onSuccess: (m) =>
        toast.success(`Ingested ${doc.filename}`, {
          id: toastId,
          description: `${m.result?.chunk_count ?? 0} chunks · ${m.result?.table_count ?? 0} tables`,
        }),
      onError: (err) =>
        toast.error(err instanceof ApiError ? err.message : "Ingestion failed", {
          id: toastId,
        }),
    });
  };

  const confirmDelete = () => {
    del.mutate(doc.doc_id, {
      onSuccess: () => {
        toast.success(`${doc.filename} deleted`);
        onDeleted?.();
      },
      onError: (err) =>
        toast.error(err instanceof ApiError ? err.message : "Failed to delete"),
      onSettled: () => setDeleteOpen(false),
    });
  };

  const isReingest = doc.status === "ingested";

  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        size="sm"
        variant={isReingest ? "outline" : "default"}
        className="h-7 text-xs"
        disabled={ingesting}
        onClick={runIngest}
      >
        {ingesting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : isReingest ? (
          <RotateCw className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <Play className="h-3.5 w-3.5" aria-hidden />
        )}
        {ingesting ? "Ingesting…" : isReingest ? "Re-ingest" : "Ingest"}
      </Button>

      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7"
        aria-label={`Edit config for ${doc.filename}`}
        onClick={() => setEditOpen(true)}
      >
        <Settings2 className="h-3.5 w-3.5" />
      </Button>

      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7 text-destructive hover:text-destructive"
        aria-label={`Delete ${doc.filename}`}
        onClick={() => setDeleteOpen(true)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>

      <EditConfigDialog
        docId={doc.doc_id}
        filename={doc.filename}
        config={config}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <AlertDialog open={deleteOpen} onOpenChange={(o) => !del.isPending && setDeleteOpen(o)}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document?</AlertDialogTitle>
            <AlertDialogDescription className="break-words">
              This permanently removes{" "}
              <strong className="break-all font-semibold text-foreground">
                {doc.filename}
              </strong>{" "}
              and every derived artifact under its <code>corpus/</code> key. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={del.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={del.isPending}
              className={buttonVariants({ variant: "destructive" })}
            >
              {del.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
