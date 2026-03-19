'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FolderKanban, ShieldCheck, PieChart, Users, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { usePoolList, usePoolStats } from '@/lib/api/hooks/use-pools';

export default function DashboardPage() {
  const { data: pools, isLoading, error, refetch } = usePoolList();
  const stats = usePoolStats(pools);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <p className="text-sm text-destructive">Failed to load dashboard data.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="mt-2 text-muted-foreground">
            Overview of your pools and pending actions.
          </p>
        </div>
        <Link href="/pools/new">
          <Button className="bg-primary hover:bg-primary/90">
            <Plus className="mr-2 size-4" />
            Create New Pool
          </Button>
        </Link>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatsCard
          title="Total Pools"
          icon={<FolderKanban className="size-4 text-muted-foreground" />}
          value={stats?.totalPools}
          subtitle="Actively managed data rooms"
          isLoading={isLoading}
        />
        <StatsCard
          title="Total Asset Value"
          icon={<PieChart className="size-4 text-muted-foreground" />}
          value={stats ? `$${(stats.totalAssetValue / 1_000_000).toFixed(1)}M` : undefined}
          subtitle="Across all active pools"
          isLoading={isLoading}
        />
        <StatsCard
          title="Pending IC Reviews"
          icon={<ShieldCheck className="size-4 text-warning" />}
          value={stats?.pendingICReviews}
          subtitle="Require immediate attention"
          isLoading={isLoading}
          variant={stats && stats.pendingICReviews > 0 ? 'warning' : 'default'}
        />
      </div>

      {/* Pool list */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight">Active Pools</h2>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="mt-2 h-4 w-32" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="mt-2 h-1.5 w-full rounded-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !pools?.length ? (
          <Card className="py-12">
            <CardContent className="flex flex-col items-center text-center">
              <FolderKanban className="mb-4 size-10 text-muted-foreground/40" />
              <h3 className="mb-1 text-base font-semibold">No pools yet</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Create your first pool to get started.
              </p>
              <Link href="/pools/new">
                <Button size="sm">
                  <Plus className="mr-2 size-4" />
                  Create New Pool
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {pools.map((pool) => (
              <Link href={`/pools/${pool.id}`} key={pool.id} className="group">
                <Card className="h-full cursor-pointer transition-colors hover:border-primary">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg transition-colors group-hover:text-primary">
                          {pool.name}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {pool.borrowerName}
                        </CardDescription>
                      </div>
                      <Badge
                        variant={pool.currentState === 'dd_in_progress' ? 'default' : 'secondary'}
                        className={
                          pool.currentState === 'dd_in_progress'
                            ? 'bg-primary/20 text-primary border-primary/30'
                            : ''
                        }
                      >
                        {pool.currentState.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4 flex items-center justify-between text-sm">
                      <div className="flex items-center text-muted-foreground">
                        <Users className="mr-2 size-4" />
                        {pool.memberCount} Members
                      </div>
                      <div className="font-semibold tabular-nums">
                        ${parseFloat(pool.targetSize).toLocaleString()}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatsCard({
  title,
  icon,
  value,
  subtitle,
  isLoading,
  variant = 'default',
}: {
  title: string;
  icon: React.ReactNode;
  value: string | number | undefined;
  subtitle: string;
  isLoading: boolean;
  variant?: 'default' | 'warning';
}) {
  return (
    <Card
      className={
        variant === 'warning'
          ? 'border-warning/50 bg-warning/5 hover:shadow-md transition-shadow'
          : 'hover:shadow-md transition-shadow'
      }
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle
          className={`text-sm font-medium ${variant === 'warning' ? 'text-warning' : ''}`}
        >
          {title}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <div
            className={`text-2xl font-bold tabular-nums ${variant === 'warning' ? 'text-warning' : ''}`}
          >
            {value}
          </div>
        )}
        <p
          className={`mt-1 text-xs ${variant === 'warning' ? 'text-warning/80' : 'text-muted-foreground'}`}
        >
          {subtitle}
        </p>
      </CardContent>
    </Card>
  );
}
