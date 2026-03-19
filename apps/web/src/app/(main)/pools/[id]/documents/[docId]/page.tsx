import { ArrowLeft, Download } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default async function DocumentPreviewPage({
  params,
}: {
  params: Promise<{ id: string; docId: string }>;
}) {
  const { id, docId } = await params;

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-14 items-center gap-4 border-b px-4">
        <Button variant="ghost" size="icon-sm" render={<Link href={`/pools/${id}?tab=vdr`} />}>
          <ArrowLeft className="size-4" />
        </Button>
        <span className="text-sm font-medium">Document {docId}</span>
        <div className="flex-1" />
        <Button variant="outline" size="sm">
          <Download className="mr-2 size-4" />
          Download
        </Button>
      </header>
      <main className="flex flex-1 items-center justify-center text-muted-foreground">
        Document preview implementation in S6 Session 4
      </main>
    </div>
  );
}
