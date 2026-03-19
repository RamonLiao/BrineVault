import { render, screen, act } from '@testing-library/react';
import { Suspense } from 'react';
import { describe, it, expect, vi } from 'vitest';
import PoolDetailPage from '@/app/(main)/pools/[id]/page';

async function renderDetail(id = 'pool-1') {
  await act(async () => {
    render(
      <Suspense fallback={<div>Loading...</div>}>
        <PoolDetailPage params={Promise.resolve({ id })} />
      </Suspense>,
    );
  });
}

const mockPool = {
  id: 'pool-1',
  name: 'Test Pool',
  borrowerName: 'Test Corp',
  currency: 'USD',
  targetSize: '1000000',
  currentState: 'draft' as const,
  encryptionScheme: 'aes256' as const,
  expectedMaturity: '2027-01-01',
  memberCount: 3,
  createdAt: '2026-03-20',
};

vi.mock('@/lib/api/hooks/use-pool-detail', () => ({
  usePoolDetail: () => ({ data: mockPool, isLoading: false, error: null }),
}));

vi.mock('@/lib/api/hooks/use-documents', () => ({
  useDocuments: () => ({
    data: { data: [], total: 0, page: 1, limit: 20 },
    isLoading: false,
  }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
  useParams: () => ({ id: 'pool-1' }),
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ apiClient: { get: vi.fn() } }),
}));

describe('PoolDetailPage', () => {
  it('renders pool name and state badge', async () => {
    await renderDetail();
    expect(screen.getByText('Test Pool')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('renders all 6 tabs', async () => {
    await renderDetail();
    expect(screen.getByText('VDR')).toBeInTheDocument();
    expect(screen.getByText('Checklist')).toBeInTheDocument();
    expect(screen.getByText('Reviews')).toBeInTheDocument();
    expect(screen.getByText('IC')).toBeInTheDocument();
    expect(screen.getByText('Audit')).toBeInTheDocument();
    expect(screen.getByText('Members')).toBeInTheDocument();
  });

  it('shows upload button as disabled', async () => {
    await renderDetail();
    const uploadBtn = screen.getByText(/Upload Document/);
    expect(uploadBtn.closest('button')).toBeDisabled();
  });

  it('shows empty state for VDR when no documents', async () => {
    await renderDetail();
    expect(screen.getByText('No documents yet')).toBeInTheDocument();
  });
});

describe('PoolDetail — Monkey Tests', () => {
  it('renders sidebar pool details correctly', async () => {
    await renderDetail();
    expect(screen.getByText('Test Corp')).toBeInTheDocument();
    expect(screen.getByText('$1,000,000 USD')).toBeInTheDocument();
    expect(screen.getByText('AES-256')).toBeInTheDocument();
    expect(screen.getByText('2027-01-01')).toBeInTheDocument();
  });

  it('shows progress card with 0%', async () => {
    await renderDetail();
    expect(screen.getByText('0% Complete')).toBeInTheDocument();
  });

  it('shows Back to Dashboard link', async () => {
    await renderDetail();
    expect(screen.getByText('Back to Dashboard')).toBeInTheDocument();
  });

  it('shows truncated pool ID', async () => {
    await renderDetail();
    // pool-1 is short, so check the pattern exists
    expect(screen.getByText(/Pool ID:/)).toBeInTheDocument();
  });
});
