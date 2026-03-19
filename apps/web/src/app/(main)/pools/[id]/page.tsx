'use client';

import { use, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Landmark,
  MessageSquare,
  ScrollText,
  UploadCloud,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PoolStateBadge } from '@/components/pool/pool-state-badge';
import { TabPlaceholder } from '@/components/pool/tab-placeholder';
import { FolderTree } from '@/components/vdr/folder-tree';
import { DocumentList } from '@/components/vdr/document-list';
import { usePoolDetail } from '@/lib/api/hooks/use-pool-detail';
import { useDocuments } from '@/lib/api/hooks/use-documents';
import type { PoolTab } from '@/types';
import { DEFAULT_FOLDERS } from '@rwa-dataroom/shared';

const TABS: { key: PoolTab; label: string; icon: typeof FileText }[] = [
  { key: 'vdr', label: 'VDR', icon: FileText },
  { key: 'checklist', label: 'Checklist', icon: CheckCircle2 },
  { key: 'reviews', label: 'Reviews', icon: MessageSquare },
  { key: 'ic', label: 'IC', icon: Landmark },
  { key: 'audit', label: 'Audit', icon: ScrollText },
  { key: 'members', label: 'Members', icon: Users },
];

const VALID_TABS = new Set(TABS.map((t) => t.key));

export default function PoolDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as PoolTab | null;
  const activeTab: PoolTab =
    tabParam && VALID_TABS.has(tabParam) ? tabParam : 'vdr';

  const { data: pool, isLoading: poolLoading } = usePoolDetail(id);
  const { data: docsData, isLoading: docsLoading } = useDocuments(id);

  const [activeFolderId, setActiveFolderId] = useState<number | null>(null);

  const filteredDocs = useMemo(() => {
    const docs = docsData?.data ?? [];
    if (activeFolderId === null) return docs;
    return docs.filter((d) => d.folderId === activeFolderId);
  }, [docsData, activeFolderId]);

  function setActiveTab(tab: PoolTab) {
    router.replace(`/pools/${id}?tab=${tab}`);
  }

  if (poolLoading) {
    return (
      <div className="max-w-6xl mx-auto py-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!pool) {
    return (
      <div className="max-w-6xl mx-auto py-6 text-center">
        <h2 className="text-xl font-semibold">Pool not found</h2>
        <Link href="/dashboard" className="text-primary underline mt-2 block">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{pool.name}</h1>
            <PoolStateBadge state={pool.currentState} />
          </div>
          <p className="text-muted-foreground mt-1 text-sm font-mono">
            Pool ID: {id.slice(0, 8)}...{id.slice(-4)}
          </p>
        </div>
        <div>
          <Button disabled title="Available after Session 4">
            <UploadCloud className="mr-2 h-4 w-4" />
            Upload Document
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                Pool Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <span className="text-muted-foreground block mb-1">
                  Borrower
                </span>
                <span className="font-medium">{pool.borrowerName}</span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-1">
                  Target Size
                </span>
                <span className="font-medium">
                  ${Number(pool.targetSize).toLocaleString()} {pool.currency}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-1">
                  Encryption
                </span>
                <span className="font-medium">
                  {pool.encryptionScheme === 'aes256'
                    ? 'AES-256'
                    : 'Seal Beta'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-1">
                  Maturity
                </span>
                <span className="font-medium">{pool.expectedMaturity}</span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-1">
                  Created
                </span>
                <span className="font-medium">{pool.createdAt}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">0% Complete</span>
                <span className="text-sm text-muted-foreground">0/0 items</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: '0%' }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Based on DD checklist completion
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main: Tabs */}
        <div className="col-span-1 md:col-span-3">
          {/* Tab Bar */}
          <div className="flex gap-0 border-b-2 border-muted mb-5">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors -mb-[2px] ${
                    isActive
                      ? 'text-primary border-b-2 border-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          {activeTab === 'vdr' && (
            <div className="grid grid-cols-[200px_1fr] gap-4">
              <FolderTree
                folders={DEFAULT_FOLDERS as any}
                activeFolderId={activeFolderId}
                onFolderSelect={setActiveFolderId}
              />
              <DocumentList
                documents={filteredDocs}
                isLoading={docsLoading}
                onViewDetails={(docId) =>
                  router.push(`/pools/${id}/documents/${docId}`)
                }
              />
            </div>
          )}
          {activeTab === 'checklist' && (
            <TabPlaceholder
              icon={CheckCircle2}
              title="DD Checklist"
              session="Session 5a"
            />
          )}
          {activeTab === 'reviews' && (
            <TabPlaceholder
              icon={MessageSquare}
              title="Document Reviews"
              session="Session 5a"
            />
          )}
          {activeTab === 'ic' && (
            <TabPlaceholder
              icon={Landmark}
              title="IC Decisions"
              session="Session 5b"
            />
          )}
          {activeTab === 'audit' && (
            <TabPlaceholder
              icon={ScrollText}
              title="Audit Trail"
              session="Session 5b"
            />
          )}
          {activeTab === 'members' && (
            <TabPlaceholder
              icon={Users}
              title="Members"
              session="Session 5b"
            />
          )}
        </div>
      </div>
    </div>
  );
}
