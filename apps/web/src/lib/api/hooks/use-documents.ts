'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import { queryKeys } from '@/lib/api/query-keys';
import type { Document } from '@/types';

interface PaginatedDocuments {
  data: Document[];
  total: number;
  page: number;
  limit: number;
}

export function useDocuments(poolId: string) {
  const { apiClient } = useAuth();

  return useQuery({
    queryKey: queryKeys.pools.documents(poolId),
    queryFn: () =>
      apiClient.get<PaginatedDocuments>(`/pools/${poolId}/documents`),
    enabled: !!poolId,
    staleTime: 30_000,
  });
}
