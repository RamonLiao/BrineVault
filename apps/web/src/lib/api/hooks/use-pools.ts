'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { queryKeys } from '@/lib/api/query-keys';
import type { Pool } from '@/types';

export function usePoolList() {
  const { currentOrg, apiClient } = useAuth();
  const orgId = currentOrg?.id ?? '';

  return useQuery({
    queryKey: queryKeys.pools.list(orgId),
    queryFn: () => apiClient.get<Pool[]>('/pools'),
    enabled: !!orgId,
    staleTime: 30_000,
  });
}

export function usePoolStats(pools: Pool[] | undefined) {
  return useMemo(() => {
    if (!pools) return null;
    return {
      totalPools: pools.length,
      totalAssetValue: pools.reduce(
        (sum, p) => sum + parseFloat(p.targetSize || '0'),
        0,
      ),
      pendingICReviews: pools.filter(
        (p) => p.currentState === 'ic_review',
      ).length,
    };
  }, [pools]);
}
