import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import NewPoolPage from '@/app/(main)/pools/new/page';

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({
    user: { address: '0x' + 'a'.repeat(64) },
    currentOrg: { id: 'org-1' },
    apiClient: { post: vi.fn() },
    authMethod: 'wallet',
  }),
}));

vi.mock('@mysten/dapp-kit', () => ({
  useSignTransaction: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock('@/lib/api/hooks/use-create-pool', () => ({
  useCreatePool: () => ({
    mutateAsync: vi.fn().mockResolvedValue('pool-1'),
    isPending: false,
  }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// Mock DnD kit to avoid JSDOM issues
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: any) => <div>{children}</div>,
  closestCenter: vi.fn(),
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: () => [],
}));

vi.mock('@dnd-kit/sortable', () => ({
  arrayMove: vi.fn((arr: any[]) => arr),
  SortableContext: ({ children }: any) => <div>{children}</div>,
  sortableKeyboardCoordinates: vi.fn(),
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
  }),
  verticalListSortingStrategy: vi.fn(),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => '' } },
}));

describe('NewPoolPage', () => {
  it('renders step 1 with all required fields', () => {
    render(<NewPoolPage />);
    expect(screen.getByText('Create New Pool')).toBeInTheDocument();
    expect(screen.getByLabelText(/Pool Name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Borrower Entity/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Target Notional/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Maturity Date/)).toBeInTheDocument();
  });

  it('shows validation errors on empty next click', () => {
    render(<NewPoolPage />);
    fireEvent.click(screen.getByText('Next Step'));
    expect(screen.getByText(/Pool name is required/i)).toBeInTheDocument();
  });

  it('navigates between steps', () => {
    render(<NewPoolPage />);
    fireEvent.change(screen.getByLabelText(/Pool Name/), {
      target: { value: 'Test Pool' },
    });
    fireEvent.change(screen.getByLabelText(/Borrower Entity/), {
      target: { value: 'Test Corp' },
    });
    fireEvent.change(screen.getByLabelText(/Target Notional/), {
      target: { value: '1000000' },
    });
    fireEvent.change(screen.getByLabelText(/Maturity Date/), {
      target: { value: '2027-01-01' },
    });
    fireEvent.click(screen.getByText('Next Step'));
    expect(screen.getByText('AES-256 Production')).toBeInTheDocument();
  });

  it('shows Confirm & Submit on last step', () => {
    render(<NewPoolPage />);
    fireEvent.change(screen.getByLabelText(/Pool Name/), {
      target: { value: 'Test' },
    });
    fireEvent.change(screen.getByLabelText(/Borrower Entity/), {
      target: { value: 'Corp' },
    });
    fireEvent.change(screen.getByLabelText(/Target Notional/), {
      target: { value: '100' },
    });
    fireEvent.change(screen.getByLabelText(/Maturity Date/), {
      target: { value: '2027-01-01' },
    });
    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByText('Next Step'));
    }
    expect(screen.getByText('Confirm & Submit')).toBeInTheDocument();
  });
});

describe('Wizard — Monkey Tests', () => {
  it('handles extremely long pool name (256 chars)', () => {
    render(<NewPoolPage />);
    const input = screen.getByLabelText(/Pool Name/);
    fireEvent.change(input, { target: { value: 'A'.repeat(256) } });
    fireEvent.change(screen.getByLabelText(/Borrower Entity/), {
      target: { value: 'Corp' },
    });
    fireEvent.change(screen.getByLabelText(/Target Notional/), {
      target: { value: '100' },
    });
    fireEvent.change(screen.getByLabelText(/Maturity Date/), {
      target: { value: '2027-01-01' },
    });
    fireEvent.click(screen.getByText('Next Step'));
    // Should proceed to step 2 — 256 is the max
    expect(screen.getByText('AES-256 Production')).toBeInTheDocument();
  });

  it('rejects past maturity date', () => {
    render(<NewPoolPage />);
    fireEvent.change(screen.getByLabelText(/Pool Name/), {
      target: { value: 'Test' },
    });
    fireEvent.change(screen.getByLabelText(/Borrower Entity/), {
      target: { value: 'Corp' },
    });
    fireEvent.change(screen.getByLabelText(/Target Notional/), {
      target: { value: '100' },
    });
    fireEvent.change(screen.getByLabelText(/Maturity Date/), {
      target: { value: '2020-01-01' },
    });
    fireEvent.click(screen.getByText('Next Step'));
    expect(screen.getByText(/Maturity date must be in the future/i)).toBeInTheDocument();
  });

  it('rejects negative target notional', () => {
    render(<NewPoolPage />);
    fireEvent.change(screen.getByLabelText(/Pool Name/), {
      target: { value: 'Test' },
    });
    fireEvent.change(screen.getByLabelText(/Borrower Entity/), {
      target: { value: 'Corp' },
    });
    fireEvent.change(screen.getByLabelText(/Target Notional/), {
      target: { value: '-500' },
    });
    fireEvent.change(screen.getByLabelText(/Maturity Date/), {
      target: { value: '2027-01-01' },
    });
    fireEvent.click(screen.getByText('Next Step'));
    expect(screen.getByText(/Target notional must be greater than 0/i)).toBeInTheDocument();
  });

  it('rejects zero target notional', () => {
    render(<NewPoolPage />);
    fireEvent.change(screen.getByLabelText(/Pool Name/), {
      target: { value: 'Test' },
    });
    fireEvent.change(screen.getByLabelText(/Borrower Entity/), {
      target: { value: 'Corp' },
    });
    fireEvent.change(screen.getByLabelText(/Target Notional/), {
      target: { value: '0' },
    });
    fireEvent.change(screen.getByLabelText(/Maturity Date/), {
      target: { value: '2027-01-01' },
    });
    fireEvent.click(screen.getByText('Next Step'));
    expect(screen.getByText(/Target notional must be greater than 0/i)).toBeInTheDocument();
  });

  it('rejects empty borrower entity', () => {
    render(<NewPoolPage />);
    fireEvent.change(screen.getByLabelText(/Pool Name/), {
      target: { value: 'Test' },
    });
    // Leave borrower empty
    fireEvent.change(screen.getByLabelText(/Target Notional/), {
      target: { value: '100' },
    });
    fireEvent.change(screen.getByLabelText(/Maturity Date/), {
      target: { value: '2027-01-01' },
    });
    fireEvent.click(screen.getByText('Next Step'));
    expect(screen.getByText(/Borrower entity is required/i)).toBeInTheDocument();
  });

  it('back button is disabled on step 1', () => {
    render(<NewPoolPage />);
    const backBtn = screen.getByText('Back');
    expect(backBtn.closest('button')).toBeDisabled();
  });
});
