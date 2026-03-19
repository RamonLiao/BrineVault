import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import LoginPage from '@/app/(auth)/login/page';

// Mock dApp Kit hooks
vi.mock('@mysten/dapp-kit', () => ({
  useSuiClient: () => ({ getLatestSuiSystemState: vi.fn() }),
  useCurrentAccount: () => null,
  useSignPersonalMessage: () => ({ mutateAsync: vi.fn() }),
  ConnectModal: ({ trigger }: any) => trigger,
}));

vi.mock('@/lib/api/hooks/use-auth', () => ({
  useWalletLogin: () => ({ mutate: vi.fn(), isPending: false }),
  useZkLogin: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({
    login: vi.fn(),
    apiClient: { post: vi.fn() },
  }),
}));

describe('LoginPage', () => {
  it('renders Google and Apple zkLogin buttons', () => {
    render(<LoginPage />);
    expect(screen.getByText('Continue with Google')).toBeInTheDocument();
    expect(screen.getByText('Continue with Apple')).toBeInTheDocument();
  });

  it('renders wallet connect button', () => {
    render(<LoginPage />);
    expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
  });

  it('shows BrineVault brand name', () => {
    render(<LoginPage />);
    expect(screen.getAllByText('BrineVault').length).toBeGreaterThan(0);
  });

  it('shows "Powered by Sui Network"', () => {
    render(<LoginPage />);
    expect(screen.getByText('Sui Network')).toBeInTheDocument();
  });
});
