import Link from "next/link";
import { FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { IngestionStatsCards } from "@/components/dashboard/ingestion-stats-cards";
import { AmplificationPanel } from "@/components/dashboard/amplification-panel";
import { RecentDocumentsTable } from "@/components/dashboard/recent-documents-table";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div className="animate-fade-in border-b border-border pb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Ingestion metrics for your B2-backed RAG corpus — documents, chunks,
            and the raw-vs-derived write amplification.
          </p>
        </div>
        <Button asChild size="sm" className="h-8">
          <Link href="/documents">
            <FileText className="h-3.5 w-3.5" />
            Documents
          </Link>
        </Button>
      </div>
      <IngestionStatsCards />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="animate-fade-in-up stagger-3">
          <AmplificationPanel />
        </div>
        <div className="animate-fade-in-up stagger-4">
          <RecentDocumentsTable />
        </div>
      </div>
    </div>
  );
}
