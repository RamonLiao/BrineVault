import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { useCreatePool } from '@/lib/api/hooks/use-create-pool';

const mockPost = vi.fn();
const mockSignTx = vi.fn();

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({
    apiClient: { post: mockPost },
    currentOrg: { id: 'org-123' },
    user: { address: '0x' + 'a'.repeat(64) },
    authMethod: 'wallet',
  }),
}));

vi.mock('@mysten/dapp-kit', () => ({
  useSignTransaction: () => ({ mutateAsync: mockSignTx }),
}));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client: qc }, children);
}

describe('useCreatePool', () => {
  it('returns mutateAsync function', () => {
    const { result } = renderHook(() => useCreatePool(), { wrapper });
    expect(result.current.mutateAsync).toBeDefined();
    expect(result.current.isPending).toBe(false);
  });

  it('calls POST /pools, signs, and submits', async () => {
    mockPost
      .mockResolvedValueOnce({ txBytes: 'abc123', poolId: 'pool-1' })
      .mockResolvedValueOnce({ txDigest: 'digest-1' });
    mockSignTx.mockResolvedValueOnce({ bytes: 'abc123', signature: 'sig-1' });

    const { result } = renderHook(() => useCreatePool(), { wrapper });

    const poolId = await result.current.mutateAsync({
      name: 'Test Pool',
      borrowerEntity: 'Test Corp',
      targetNotional: '1000000',
      currency: 'USD',
      maturityDate: '2027-01-01',
      encryptionScheme: 0,
      tags: [],
      members: [],
    });

    expect(poolId).toBe('pool-1');
    expect(mockPost).toHaveBeenCalledTimes(2);
    expect(mockSignTx).toHaveBeenCalledTimes(1);
  });
});
