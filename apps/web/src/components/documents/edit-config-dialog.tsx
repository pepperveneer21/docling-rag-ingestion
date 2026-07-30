"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import {
  ConfigFields,
  configSchema,
  fromDocumentConfig,
  toDocumentConfig,
  type ConfigFormValues,
} from "@/components/documents/config-fields";
import { useUpdateDocumentConfig } from "@/lib/document-queries";
import { ApiError } from "@/lib/api-client";
import type { DocumentConfig } from "@docling-rag-ingestion/shared";

/**
 * Edits the stored ingestion config. `edit` is genuine and non-duplicative: a
 * source doc's bytes are immutable, so this edits the config the next Ingest
 * will use. It opens pre-filled on the real resource — no file field, no
 * safe-default hints (those belong only on create).
 */
export function EditConfigDialog({
  docId,
  filename,
  config,
  open,
  onOpenChange,
}: {
  docId: string;
  filename: string;
  config: DocumentConfig;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const updateMutation = useUpdateDocumentConfig();
  const form = useForm<ConfigFormValues>({
    resolver: zodResolver(configSchema),
    defaultValues: fromDocumentConfig(config),
  });

  // Re-seed the form from the real resource whenever the dialog opens.
  useEffect(() => {
    if (open) form.reset(fromDocumentConfig(config));
  }, [open, config, form]);

  const onSubmit = (values: ConfigFormValues) => {
    updateMutation.mutate(
      { docId, config: toDocumentConfig(values) },
      {
        onSuccess: () => {
          toast.success("Ingestion config updated", {
            description: "Run Ingest to apply it to this document.",
          });
          onOpenChange(false);
        },
        onError: (err) => {
          const detail =
            err instanceof ApiError ? err.message : "Failed to update config";
          toast.error(detail);
        },
      },
    );
  };

  const busy = updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit ingestion config</DialogTitle>
          <DialogDescription className="break-words">
            {filename} — changes take effect on the next Ingest run. The stored
            source bytes are unchanged.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <ConfigFields form={form} />
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save config"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
