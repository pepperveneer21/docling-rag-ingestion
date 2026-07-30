"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FileText, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Progress } from "@/components/ui/progress";
import { Dropzone } from "@/components/upload/dropzone";
import {
  ConfigFields,
  configSchema,
  DEFAULT_CONFIG_VALUES,
  toDocumentConfig,
  type ConfigFormValues,
} from "@/components/documents/config-fields";
import { useCreateDocument } from "@/lib/document-queries";
import { ApiError } from "@/lib/api-client";
import { formatBytes } from "@/lib/format-bytes";

// Accepts exactly the document types Docling reads (plan §4 create form).
const DOC_ACCEPT = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
  "text/html": [".html", ".htm"],
  "text/markdown": [".md"],
  "text/plain": [".txt"],
};

export function AddDocumentDialog() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const createMutation = useCreateDocument();

  const form = useForm<ConfigFormValues>({
    resolver: zodResolver(configSchema),
    defaultValues: DEFAULT_CONFIG_VALUES,
  });

  function reset() {
    setFile(null);
    setProgress(0);
    form.reset(DEFAULT_CONFIG_VALUES);
  }

  function handleOpenChange(next: boolean) {
    if (!next && createMutation.isPending) return;
    if (!next) reset();
    setOpen(next);
  }

  const onSubmit = (values: ConfigFormValues) => {
    if (!file) {
      toast.error("Choose a document to ingest first");
      return;
    }
    createMutation.mutate(
      { file, config: toDocumentConfig(values), onProgress: setProgress },
      {
        onSuccess: (manifest) => {
          toast.success(`${manifest.filename} added to the corpus`, {
            description: "Run Ingest to parse it into Markdown + chunks.",
          });
          reset();
          setOpen(false);
        },
        onError: (err) => {
          const detail = err instanceof ApiError ? err.message : "Failed to add document";
          toast.error(detail);
        },
      },
    );
  };

  const busy = createMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-8">
          <Plus className="h-3.5 w-3.5" />
          Add Document
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88svh] w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a document</DialogTitle>
          <DialogDescription>
            Upload a source file to B2 and set how Docling should parse and chunk
            it. Ingestion runs on demand after it&apos;s added.
          </DialogDescription>
        </DialogHeader>

        {file ? (
          <div className="flex items-center gap-3 rounded-md border border-border bg-muted/40 px-3 py-2.5">
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
            </div>
            {!busy && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                aria-label="Remove selected file"
                onClick={() => setFile(null)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ) : (
          <Dropzone
            accept={DOC_ACCEPT}
            multiple={false}
            disabled={busy}
            idleTitle="Drop a PDF, DOCX, PPTX, HTML, MD, or TXT"
            idleDescription="One document at a time · max 100 MB"
            onFilesSelected={(files) => files[0] && setFile(files[0])}
            onFilesRejected={() =>
              toast.error("Unsupported file — accepted: PDF, DOCX, PPTX, HTML, MD, TXT")
            }
          />
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <ConfigFields form={form} showHints />

            {busy && (
              <div className="space-y-1.5" aria-live="polite">
                <Progress value={progress} />
                <p className="text-xs text-muted-foreground">
                  Uploading source to B2… {progress}%
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy || !file}>
                {busy ? "Adding…" : "Add document"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
