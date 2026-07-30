"use client";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ParsedDocumentResponse } from "@docling-rag-ingestion/shared";

// Tailwind arbitrary-variant styling for the rendered Markdown. remark-gfm makes
// Docling's extracted tables render as real HTML tables — the border classes
// here are what make those tables actually paint and read cleanly.
const PROSE = [
  "max-w-none text-sm leading-relaxed",
  "[&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-xl [&_h1]:font-semibold",
  "[&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold",
  "[&_h3]:mt-3 [&_h3]:mb-1.5 [&_h3]:text-base [&_h3]:font-semibold",
  "[&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5",
  "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2",
  "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs",
  "[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:border [&_pre]:border-border [&_pre]:bg-muted/50 [&_pre]:p-3",
  "[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
  "[&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs",
  "[&_th]:border [&_th]:border-border [&_th]:bg-muted/50 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-semibold",
  "[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_td]:align-top",
].join(" ");

export function ParsedMarkdown({ parsed }: { parsed: ParsedDocumentResponse }) {
  const isMarkdown = parsed.export_format === "markdown";

  return (
    <div className="space-y-3">
      {parsed.truncated && (
        <p
          role="note"
          className="rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground"
        >
          Showing the first 200 KB of a {(parsed.byte_count / 1024).toFixed(0)} KB
          parsed document. Download the full artifact from B2 for the complete
          output — nothing is silently truncated.
        </p>
      )}
      {isMarkdown ? (
        <div className={PROSE}>
          <Markdown remarkPlugins={[remarkGfm]}>{parsed.content}</Markdown>
        </div>
      ) : (
        // Non-Markdown exports (JSON/HTML/Text) are shown verbatim so the raw
        // artifact is inspectable rather than re-interpreted.
        <pre className="max-h-[60vh] overflow-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-xs">
          {parsed.content}
        </pre>
      )}
    </div>
  );
}
