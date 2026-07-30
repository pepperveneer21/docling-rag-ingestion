import { CheckCircle2, Clock, XCircle } from "lucide-react";
import type { DocumentStatus } from "@docling-rag-ingestion/shared";

const CONFIG: Record<
  DocumentStatus,
  { label: string; icon: typeof Clock; dot: string; text: string }
> = {
  pending: {
    label: "Pending",
    icon: Clock,
    dot: "bg-[var(--warning,theme(colors.amber.500))]",
    text: "text-muted-foreground",
  },
  ingested: {
    label: "Ingested",
    icon: CheckCircle2,
    dot: "bg-[var(--success)]",
    text: "text-foreground",
  },
  failed: {
    label: "Failed",
    icon: XCircle,
    dot: "bg-destructive",
    text: "text-destructive",
  },
};

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  const { label, icon: Icon, dot, text } = CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden />
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </span>
  );
}
