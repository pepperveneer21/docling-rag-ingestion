"use client";

import { type UseFormReturn } from "react-hook-form";
import { z } from "zod";

import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import type {
  DocumentConfig,
  MaxTokens,
} from "@docling-rag-ingestion/shared";

// Finite-option fields render as selectors (never free text), matching the
// starter's settings-form exemplar and the plan's Form UX conventions.
export const EXPORT_FORMAT_OPTIONS = [
  { value: "markdown", label: "Markdown" },
  { value: "json", label: "JSON" },
  { value: "html", label: "HTML" },
  { value: "text", label: "Text" },
] as const;

export const MAX_TOKENS_OPTIONS = ["256", "512", "1024"] as const;

export const configSchema = z.object({
  export_format: z.enum(["markdown", "json", "html", "text"]),
  max_tokens: z.enum(["256", "512", "1024"]),
  merge_peers: z.boolean(),
});

export type ConfigFormValues = z.infer<typeof configSchema>;

export const DEFAULT_CONFIG_VALUES: ConfigFormValues = {
  export_format: "markdown",
  max_tokens: "512",
  merge_peers: true,
};

export function toDocumentConfig(v: ConfigFormValues): DocumentConfig {
  return {
    export_format: v.export_format,
    max_tokens: Number(v.max_tokens) as MaxTokens,
    merge_peers: v.merge_peers,
  };
}

export function fromDocumentConfig(c: DocumentConfig): ConfigFormValues {
  return {
    export_format: c.export_format,
    max_tokens: String(c.max_tokens) as ConfigFormValues["max_tokens"],
    merge_peers: c.merge_peers,
  };
}

/**
 * The three ingestion-config fields, shared by the create and edit forms.
 *
 * `showHints` gates the safe-default guidance (placeholder/description only —
 * never an autofill button): the create form shows it, the edit form opens on a
 * real resource and omits it.
 */
export function ConfigFields({
  form,
  showHints = false,
}: {
  form: UseFormReturn<ConfigFormValues>;
  showHints?: boolean;
}) {
  return (
    <div className="space-y-5">
      <FormField
        control={form.control}
        name="export_format"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Export format</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {EXPORT_FORMAT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {showHints && (
              <FormDescription>
                Markdown keeps tables and reading order — the best default for RAG.
              </FormDescription>
            )}
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="max_tokens"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Max tokens per chunk</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {MAX_TOKENS_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {showHints && (
              <FormDescription>
                512 tokens + Markdown export suits most PDFs.
              </FormDescription>
            )}
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="merge_peers"
        render={({ field }) => (
          <FormItem className="flex flex-row items-center justify-between rounded-md border border-border p-3">
            <div className="space-y-0.5">
              <FormLabel>Merge undersized peer chunks</FormLabel>
              {showHints && (
                <FormDescription>
                  Combine adjacent small sections into fuller, more useful chunks.
                </FormDescription>
              )}
            </div>
            <FormControl>
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            </FormControl>
          </FormItem>
        )}
      />
    </div>
  );
}
