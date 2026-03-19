import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PoolStateBadge } from '@/components/pool/pool-state-badge';

describe('PoolStateBadge', () => {
  it('renders Draft label', () => {
    render(<PoolStateBadge state="draft" />);
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('renders DD In Progress label', () => {
    render(<PoolStateBadge state="dd_in_progress" />);
    expect(screen.getByText('DD In Progress')).toBeInTheDocument();
  });

  it('renders all 9 states without error', () => {
    const states = ['draft', 'dd_in_progress', 'ic_review', 'approved_internal',
      'ready_to_issue', 'rejected', 'cancelled', 'issued', 'closed'];
    for (const state of states) {
      const { unmount } = render(<PoolStateBadge state={state} />);
      expect(screen.getByText(/.+/)).toBeInTheDocument();
      unmount();
    }
  });

  it('falls back to unknown state gracefully', () => {
    render(<PoolStateBadge state={'unknown_state' as any} />);
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });
});
