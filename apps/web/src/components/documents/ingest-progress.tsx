"use client";

import { useEffect, useState } from "react";

import { Progress } from "@/components/ui/progress";

// The real backend pipeline stages, in order, from
// docs/features/document-ingestion.md "Flow". The ingest API is a SINGLE blocking
// request that returns the finished manifest — the backend does not stream
// sub-step progress — so the frontend cannot know an exact percentage. This is an
// HONEST, time-driven estimate: the bar eases toward a ceiling (never 100% until
// the real result replaces this toast) and the stage label advances on a fixed
// schedule. It is deliberately NOT presented as an exact measured percentage.
const STAGES = [
  "Reading source from B2…",
  "Parsing layout & tables…",
  "Chunking…",
  "Writing to B2…",
] as const;

// Expected wall-clock for a warm ingest (~11s observed). First runs download
// Docling models and take longer; when that happens the bar simply plateaus at
// the ceiling and the label rests on the final stage — an honest "still working"
// signal rather than a false "done".
const EXPECTED_MS = 11_000;
const CEILING = 90;
const TICK_MS = 250;

export function IngestProgress({ filename }: { filename: string }) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(() => setElapsedMs(Date.now() - start), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const fraction = Math.min(elapsedMs / EXPECTED_MS, 1);
  // Ease-out: climbs quickly, then slows as it nears the ceiling so it reads as
  // "working hard" without ever claiming completion.
  const value = Math.round(CEILING * (1 - (1 - fraction) ** 2));
  const stageIndex = Math.min(
    Math.floor(fraction * STAGES.length),
    STAGES.length - 1,
  );

  return (
    <div className="flex w-full flex-col gap-2" aria-live="polite">
      <p className="truncate text-sm font-medium text-foreground">
        Ingesting {filename}…
      </p>
      <Progress value={value} className="h-1.5" />
      <p className="text-xs text-muted-foreground">{STAGES[stageIndex]}</p>
    </div>
  );
}
