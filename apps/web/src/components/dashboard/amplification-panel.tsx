"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { TrendingUp } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useDocumentStats } from "@/lib/document-queries";
import { formatBytes } from "@/lib/format-bytes";

const chartConfig = {
  bytes: { label: "Bytes", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function AmplificationPanel() {
  const { data: stats, isLoading, error, refetch } = useDocumentStats();

  const data = useMemo(
    () => [
      { layer: "Raw", bytes: stats?.raw_bytes ?? 0 },
      { layer: "Derived", bytes: stats?.derived_bytes ?? 0 },
    ],
    [stats],
  );

  const hasData = !!stats && stats.ingested > 0;

  return (
    <Card>
      <CardHeader className="border-b border-border py-4 px-5">
        <CardTitle className="card-title">Write amplification</CardTitle>
        <CardDescription className="text-xs">
          Raw sources vs. Docling-derived artifacts across the corpus
        </CardDescription>
      </CardHeader>
      <CardContent className="p-5">
        {isLoading ? (
          <Skeleton className="h-[240px] w-full" />
        ) : error ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : !hasData ? (
          <EmptyState
            icon={TrendingUp}
            title="No ingested documents yet"
            description="Ingest a document to see the raw-vs-derived byte ratio here."
          />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Amplification
                </div>
                <div className="stat-value text-2xl">{stats.amplification_ratio}×</div>
              </div>
              <div className="text-xs text-muted-foreground">
                {stats.raw_bytes_human} raw → {stats.derived_bytes_human} derived
                across {stats.ingested} document{stats.ingested === 1 ? "" : "s"}
                {" · "}
                {stats.total_pages} pages · {stats.total_tables} tables
              </div>
            </div>
            <ChartContainer config={chartConfig} className="h-[200px] w-full">
              <BarChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="layer" tickLine={false} axisLine={false} tickMargin={10} fontSize={11} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={6}
                  fontSize={11}
                  width={52}
                  tickFormatter={(v: number) => formatBytes(v)}
                />
                <ChartTooltip
                  cursor={{ fill: "var(--accent-subtle)" }}
                  content={<ChartTooltipContent formatter={(v) => formatBytes(Number(v))} />}
                />
                <Bar dataKey="bytes" fill="var(--color-bytes)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
