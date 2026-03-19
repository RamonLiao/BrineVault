import { FileText, MoreVertical } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Document } from '@/types';

interface DocumentListProps {
  documents: Document[];
  isLoading: boolean;
  onViewDetails?: (docId: string) => void;
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  approved: { label: 'Approved', className: 'bg-green-100 text-green-700' },
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-700' },
  under_review: {
    label: 'Under Review',
    className: 'bg-blue-100 text-blue-700',
  },
  needs_revision: {
    label: 'Needs Revision',
    className: 'bg-red-100 text-red-700',
  },
};

function getDocStatus(doc: Document) {
  if (doc.approvalCount > 0)
    return STATUS_STYLES.approved ?? STATUS_STYLES.pending;
  return STATUS_STYLES.pending;
}

export function DocumentList({
  documents,
  isLoading,
  onViewDetails,
}: DocumentListProps) {
  if (isLoading) {
    return (
      <div className="border rounded-lg overflow-hidden">
        <div className="grid grid-cols-[2fr_1fr_1fr_60px] p-3 bg-muted/30 border-b">
          {['Name', 'Status', 'Updated', ''].map((h) => (
            <div
              key={h}
              className="text-xs font-semibold text-muted-foreground uppercase tracking-wide"
            >
              {h}
            </div>
          ))}
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-[2fr_1fr_1fr_60px] p-3 border-b items-center gap-2"
          >
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-4" />
          </div>
        ))}
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="border rounded-lg flex flex-col items-center justify-center py-16 text-center">
        <FileText className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-medium">No documents yet</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Documents will appear here once uploaded to the data room.
        </p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="grid grid-cols-[2fr_1fr_1fr_60px] p-3 bg-muted/30 border-b">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Name
        </div>
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Status
        </div>
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Updated
        </div>
        <div />
      </div>
      {documents.map((doc) => {
        const status = getDocStatus(doc);
        return (
          <div
            key={doc.id}
            className="grid grid-cols-[2fr_1fr_1fr_60px] p-3 border-b last:border-b-0 items-center hover:bg-muted/10 transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{doc.title}</div>
                <div className="text-xs text-muted-foreground">
                  v{doc.currentVersion}
                </div>
              </div>
            </div>
            <div>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-md ${status.className}`}
              >
                {status.label}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              {formatRelativeTime(doc.lastUpdatedAt)}
            </div>
            <div className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent">
                  <MoreVertical className="h-4 w-4" />
                  <span className="sr-only">Open menu</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => onViewDetails?.(doc.id)}
                  >
                    View Details
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        );
      })}
    </div>
  );
}
