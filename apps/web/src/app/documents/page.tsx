import { AddDocumentDialog } from "@/components/documents/add-document-dialog";
import { DocumentList } from "@/components/documents/document-list";

export default function DocumentsPage() {
  return (
    <div className="space-y-8">
      <div className="animate-fade-in flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
        <div className="min-w-0">
          <h1 className="page-title">Documents</h1>
          <p className="mt-1.5 max-w-prose text-sm text-muted-foreground">
            Your scoped corpus under <code>corpus/</code> on B2. Add a source
            document, ingest it with Docling, and browse the parsed Markdown and
            token-aware chunks it produces.
          </p>
        </div>
        <AddDocumentDialog />
      </div>
      <div className="animate-fade-in-up stagger-2">
        <DocumentList />
      </div>
    </div>
  );
}
