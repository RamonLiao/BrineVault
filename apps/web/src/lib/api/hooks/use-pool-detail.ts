'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import { queryKeys } from '@/lib/api/query-keys';
import type { Pool } from '@/types';

export function usePoolDetail(poolId: string) {
  const { apiClient } = useAuth();

  return useQuery({
    queryKey: queryKeys.pools.detail(poolId),
    queryFn: () => apiClient.get<Pool>(`/pools/${poolId}`),
    enabled: !!poolId,
    staleTime: 30_000,
  });
}
