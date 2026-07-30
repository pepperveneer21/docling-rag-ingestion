"use client";

import type { DocumentChunksResponse } from "@docling-rag-ingestion/shared";

export function ChunkBrowser({ data }: { data: DocumentChunksResponse }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {data.total_chunks} token-aware chunk{data.total_chunks === 1 ? "" : "s"}
        </span>
        {data.truncated && (
          <span
            role="note"
            className="rounded-md border border-border bg-muted/50 px-2 py-1"
          >
            Showing the first {data.returned} — the rest are in{" "}
            <code>chunks.jsonl</code> on B2.
          </span>
        )}
      </div>

      <ol className="space-y-2">
        {data.chunks.map((chunk) => (
          <li
            key={chunk.index}
            className="rounded-md border border-border bg-card p-3"
          >
            <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span className="rounded bg-muted px-1.5 py-0.5 font-mono">
                #{chunk.index}
              </span>
              {chunk.page_no !== null && <span>page {chunk.page_no}</span>}
              <span>{chunk.char_count} chars</span>
              {chunk.headings.length > 0 && (
                <span className="truncate italic">{chunk.headings.join(" › ")}</span>
              )}
            </div>
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/90">
              {chunk.text}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
