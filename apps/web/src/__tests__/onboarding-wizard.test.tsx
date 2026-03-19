import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { OnboardingWizard } from '@/components/auth/onboarding-wizard';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({
    setOrg: vi.fn(),
    apiClient: { post: vi.fn().mockResolvedValue({ id: '1', name: 'Test', legalName: null, billingPlan: 'free_trial' }) },
  }),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => {
      const { initial, animate, exit, transition, ...rest } = props;
      return <div {...rest}>{children}</div>;
    },
  },
  AnimatePresence: ({ children }: any) => children,
}));

describe('OnboardingWizard', () => {
  it('shows step 1 with two path options', () => {
    render(<OnboardingWizard />);
    expect(screen.getByText('Create Organisation')).toBeInTheDocument();
    expect(screen.getByText('Join with Invite Code')).toBeInTheDocument();
  });

  it('shows step indicator', () => {
    render(<OnboardingWizard />);
    expect(screen.getByText('Step 1 of 2')).toBeInTheDocument();
  });

  it('transitions to step 2 create form on click', () => {
    render(<OnboardingWizard />);
    fireEvent.click(screen.getByText('Create Organisation'));
    expect(screen.getByLabelText('Organisation Name *')).toBeInTheDocument();
  });

  it('transitions to step 2 join form on click', () => {
    render(<OnboardingWizard />);
    fireEvent.click(screen.getByText('Join with Invite Code'));
    expect(screen.getByLabelText('Invite Code *')).toBeInTheDocument();
  });

  it('back button returns to step 1', () => {
    render(<OnboardingWizard />);
    fireEvent.click(screen.getByText('Create Organisation'));
    fireEvent.click(screen.getByText('Back'));
    expect(screen.getByText('Create Organisation')).toBeInTheDocument();
    expect(screen.getByText('Join with Invite Code')).toBeInTheDocument();
  });
});
