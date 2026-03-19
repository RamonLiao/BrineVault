import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePoolStats } from '@/lib/api/hooks/use-pools';

describe('usePoolStats', () => {
  it('returns null for undefined pools', () => {
    const { result } = renderHook(() => usePoolStats(undefined));
    expect(result.current).toBeNull();
  });

  it('computes stats from pool list', () => {
    const pools = [
      { id: '1', currentState: 'dd_in_progress', targetSize: '5000000' },
      { id: '2', currentState: 'ic_review', targetSize: '10000000' },
    ] as any;
    const { result } = renderHook(() => usePoolStats(pools));
    expect(result.current).toEqual({
      totalPools: 2,
      totalAssetValue: 15_000_000,
      pendingICReviews: 1,
    });
  });

  it('handles empty pool list', () => {
    const { result } = renderHook(() => usePoolStats([]));
    expect(result.current).toEqual({
      totalPools: 0,
      totalAssetValue: 0,
      pendingICReviews: 0,
    });
  });

  it('handles pools with no targetSize', () => {
    const pools = [
      { id: '1', currentState: 'draft', targetSize: '' },
    ] as any;
    const { result } = renderHook(() => usePoolStats(pools));
    expect(result.current).toEqual({
      totalPools: 1,
      totalAssetValue: 0,
      pendingICReviews: 0,
    });
  });

  it('counts multiple IC reviews', () => {
    const pools = [
      { id: '1', currentState: 'ic_review', targetSize: '1000' },
      { id: '2', currentState: 'ic_review', targetSize: '2000' },
      { id: '3', currentState: 'draft', targetSize: '3000' },
    ] as any;
    const { result } = renderHook(() => usePoolStats(pools));
    expect(result.current?.pendingICReviews).toBe(2);
  });
});
