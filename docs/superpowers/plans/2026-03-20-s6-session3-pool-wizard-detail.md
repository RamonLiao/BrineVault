# S6 Session 3 — Pool Creation Wizard + Pool Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the pool creation wizard (5 steps with validation, DnD checklist, TX signing) and pool detail page (6-tab skeleton with live VDR).

**Architecture:** Page-centric. Wizard uses `useReducer` for form state, each step is a child component. Pool detail fetches real data via TanStack Query hooks, tabs routed via `?tab=` searchParams. VDR tab connects to backend documents API with client-side folder filtering.

**Tech Stack:** Next.js 16 App Router, TanStack Query, @dnd-kit/core+sortable, dApp Kit (useSignTransaction), shadcn/ui, sonner (toast), vitest + @testing-library/react

**Important implementation notes:**
- **PoolState representation:** The web frontend uses string-based PoolState (`'draft'`, `'dd_in_progress'`, etc.) as defined in `apps/web/src/types/index.ts`. The API returns these as strings. The shared package uses numeric states internally for Move contract alignment. The frontend should consistently use string states — no numeric-to-string mapping needed.
- **Import from shared:** Use `@rwa-dataroom/shared` for `DEFAULT_FOLDERS` and `DEFAULT_DD_CHECKLIST_ITEMS` where possible. If import fails due to package boundary issues, mirror the values but document the source.
- **zkLogin signing:** The `useCreatePool` hook uses `useSignTransaction` from dApp Kit which works for wallet-connected users. zkLogin transaction signing requires a separate flow via ephemeral keypair — this is deferred to Session 7 (zkLogin polish). For Session 3, pool creation requires wallet connection. Add a guard: if `authMethod === 'zklogin'`, show a toast "Pool creation requires wallet connection" and abort.
- **borrowerName field:** The API stores `borrowerNameHash` on-chain but the `GET /pools/:id` response includes the human-readable `borrowerName` field (populated by the event indexer from off-chain metadata). The `Pool` interface in `types/index.ts` correctly uses `borrowerName: string`.
- **Test Suspense:** Pool detail page uses `use(params)` which requires React Suspense. All tests rendering this component must wrap in `<Suspense fallback={<div />}>`.
- **DEFAULT_ITEMS factory:** Move `DEFAULT_ITEMS` initialisation inside `useReducer`'s lazy initializer to avoid SSR issues with `crypto.randomUUID()`.

**Spec:** `docs/superpowers/specs/2026-03-20-s6-session3-pool-wizard-detail.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `components/pool/pool-state-badge.tsx` | Pool state → coloured badge (9 states), imports POOL_STATE_LABELS |
| `components/pool/step-indicator.tsx` | 5-step progress dots with active/completed states |
| `components/pool/steps/step-basic-info.tsx` | Step 1 form: name, borrower, notional, currency, maturity |
| `components/pool/steps/step-encryption.tsx` | Step 2: AES vs Seal card radio + beta acknowledgement |
| `components/pool/steps/step-checklist.tsx` | Step 3: @dnd-kit sortable checklist items |
| `components/pool/steps/step-members.tsx` | Step 4: multi-row address + role invite form |
| `components/pool/steps/step-review.tsx` | Step 5: read-only summary with edit buttons |
| `components/vdr/folder-tree.tsx` | Folder list sidebar with active selection |
| `components/vdr/document-list.tsx` | Document table with status badges + empty state |
| `components/pool/tab-placeholder.tsx` | Generic "Coming in Session X" placeholder |
| `lib/api/hooks/use-pool-detail.ts` | `usePoolDetail(poolId)` — GET /pools/:poolId |
| `lib/api/hooks/use-documents.ts` | `useDocuments(poolId)` — GET /pools/:poolId/documents |
| `lib/api/hooks/use-create-pool.ts` | `useCreatePool()` — mutation: build TX → sign → submit → add members |
| `__tests__/pool-state-badge.test.tsx` | Tests for badge rendering |
| `__tests__/pool-wizard.test.tsx` | Wizard step navigation + validation tests |
| `__tests__/pool-detail.test.tsx` | Pool detail page + tab routing tests |
| `__tests__/use-create-pool.test.ts` | Create pool mutation hook tests |

### Modified Files

| File | Change |
|------|--------|
| `app/(main)/pools/new/page.tsx` | Full rewrite: useReducer + step components + TX flow |
| `app/(main)/pools/[id]/page.tsx` | Full rewrite: API fetch + 6 tabs + VDR live content |
| `lib/api/query-keys.ts` | Replace `documents.list` key with `pools.documents` (nested under pools for cache invalidation) |
| `types/index.ts` | Add Document type, add `'issued' | 'closed'` to PoolState union, add POOL_STATE_LABELS |
| `app/(main)/dashboard/page.tsx` | Use new `PoolStateBadge` component |

### New Dependencies

```
@dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities sonner
```

---

## Task 1: Install dependencies + toast setup

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/src/app/layout.tsx`

- [ ] **Step 1: Install @dnd-kit and sonner**

```bash
cd apps/web && pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities sonner
```

- [ ] **Step 2: Add Toaster to root layout**

In `apps/web/src/app/layout.tsx`, add `<Toaster />` from sonner inside the Providers wrapper:

```tsx
import { Toaster } from 'sonner';

// Inside the return, after <Providers>...</Providers> children:
<Toaster position="top-right" richColors closeButton />
```

- [ ] **Step 3: Verify build**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json apps/web/src/app/layout.tsx pnpm-lock.yaml
git commit -m "chore(web): add @dnd-kit, sonner dependencies and toast provider"
```

---

## Task 2: Shared components — PoolStateBadge + types update

**Files:**
- Create: `apps/web/src/components/pool/pool-state-badge.tsx`
- Modify: `apps/web/src/types/index.ts`
- Create: `apps/web/src/__tests__/pool-state-badge.test.tsx`
- Modify: `apps/web/src/app/(main)/dashboard/page.tsx`

- [ ] **Step 1: Add Document type and pool state utilities to types/index.ts**

Update `apps/web/src/types/index.ts`:

1. Add `'issued' | 'closed'` to the `PoolState` type union
2. Add the labels constant:

```typescript
// Update existing PoolState type:
export type PoolState =
  | 'draft'
  | 'dd_in_progress'
  | 'ic_review'
  | 'approved_internal'
  | 'ready_to_issue'
  | 'rejected'
  | 'cancelled'
  | 'issued'
  | 'closed';

// --- Pool State Labels ---
export const POOL_STATE_LABELS: Record<PoolState, string> = {
  draft: 'Draft',
  dd_in_progress: 'DD In Progress',
  ic_review: 'IC Review',
  approved_internal: 'Approved (Internal)',
  ready_to_issue: 'Ready to Issue',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  issued: 'Issued',
  closed: 'Closed',
};

// --- Document ---
export interface Document {
  id: string;
  poolId: string;
  folderId: number;
  title: string;
  docType: number;
  currentVersion: number;
  versionCount: number;
  requiredFlag: boolean;
  isArchived: boolean;
  visibleToRoles: number;
  encryptionScheme: number;
  tags: string[];
  createdBy: string;
  createdAt: string;
  lastUpdatedAt: string;
  approvalCount: number;
}
```

- [ ] **Step 2: Write the failing test for PoolStateBadge**

Create `apps/web/src/__tests__/pool-state-badge.test.tsx`:

```tsx
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
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd apps/web && npx vitest run src/__tests__/pool-state-badge.test.tsx
```

Expected: FAIL — module not found

- [ ] **Step 4: Implement PoolStateBadge**

Create `apps/web/src/components/pool/pool-state-badge.tsx`:

```tsx
import { Badge } from '@/components/ui/badge';
import { POOL_STATE_LABELS, type PoolState } from '@/types';

const STATE_COLOURS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600 border-slate-200',
  dd_in_progress: 'bg-blue-100 text-blue-600 border-blue-200',
  ic_review: 'bg-amber-100 text-amber-600 border-amber-200',
  approved_internal: 'bg-green-100 text-green-600 border-green-200',
  ready_to_issue: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-100 text-red-600 border-red-200',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
  issued: 'bg-indigo-100 text-indigo-600 border-indigo-200',
  closed: 'bg-gray-100 text-gray-500 border-gray-200',
};

interface PoolStateBadgeProps {
  state: PoolState | string;
  className?: string;
}

export function PoolStateBadge({ state, className }: PoolStateBadgeProps) {
  const label = POOL_STATE_LABELS[state] ?? 'Unknown';
  const colours = STATE_COLOURS[state] ?? 'bg-gray-100 text-gray-500 border-gray-200';

  return (
    <Badge variant="outline" className={`${colours} ${className ?? ''}`}>
      {label}
    </Badge>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd apps/web && npx vitest run src/__tests__/pool-state-badge.test.tsx
```

Expected: PASS

- [ ] **Step 6: Update dashboard to use PoolStateBadge**

In `apps/web/src/app/(main)/dashboard/page.tsx`, replace the inline Badge for pool state with `<PoolStateBadge state={pool.currentState} />`. Import from `@/components/pool/pool-state-badge`.

- [ ] **Step 7: Verify build**

```bash
cd apps/web && npx tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/pool/pool-state-badge.tsx apps/web/src/types/index.ts apps/web/src/__tests__/pool-state-badge.test.tsx apps/web/src/app/\(main\)/dashboard/page.tsx
git commit -m "feat(web): add PoolStateBadge component with 9-state colour mapping"
```

---

## Task 3: Data hooks — usePoolDetail + useDocuments

**Files:**
- Create: `apps/web/src/lib/api/hooks/use-pool-detail.ts`
- Create: `apps/web/src/lib/api/hooks/use-documents.ts`
- Modify: `apps/web/src/lib/api/query-keys.ts`

- [ ] **Step 1: Add documents query key to query-keys.ts**

In `apps/web/src/lib/api/query-keys.ts`:

1. Add `documents` key under the `pools` namespace
2. Remove the existing `documents.list` key (migrate to nested structure)

```typescript
export const queryKeys = {
  pools: {
    all:       ['pools'] as const,
    list:      (orgId: string) => ['pools', 'list', orgId] as const,
    detail:    (poolId: string) => ['pools', 'detail', poolId] as const,
    stats:     (orgId: string) => ['pools', 'stats', orgId] as const,
    documents: (poolId: string) => ['pools', poolId, 'documents'] as const,
  },
  // Remove old documents.list — replaced by pools.documents above
  documents: {
    detail: (docId: string) => ['documents', 'detail', docId] as const,
  },
  // ... rest unchanged
} as const;
```

Verify no existing code references `queryKeys.documents.list` — if found, update those references to use `queryKeys.pools.documents(poolId)` instead.

- [ ] **Step 2: Create usePoolDetail hook**

Create `apps/web/src/lib/api/hooks/use-pool-detail.ts`:

```typescript
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
```

- [ ] **Step 3: Create useDocuments hook**

Create `apps/web/src/lib/api/hooks/use-documents.ts`:

```typescript
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
```

- [ ] **Step 4: Verify build**

```bash
cd apps/web && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/api/hooks/use-pool-detail.ts apps/web/src/lib/api/hooks/use-documents.ts apps/web/src/lib/api/query-keys.ts
git commit -m "feat(web): add usePoolDetail and useDocuments query hooks"
```

---

## Task 4: useCreatePool mutation hook

**Files:**
- Create: `apps/web/src/lib/api/hooks/use-create-pool.ts`
- Create: `apps/web/src/__tests__/use-create-pool.test.ts`

- [ ] **Step 1: Write failing test**

Create `apps/web/src/__tests__/use-create-pool.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/web && npx vitest run src/__tests__/use-create-pool.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement useCreatePool**

Create `apps/web/src/lib/api/hooks/use-create-pool.ts`:

```typescript
'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSignTransaction } from '@mysten/dapp-kit';
import { useAuth } from '@/providers/auth-provider';
import { queryKeys } from '@/lib/api/query-keys';

interface CreatePoolInput {
  name: string;
  borrowerEntity: string;
  targetNotional: string;
  currency: string;
  maturityDate: string;
  encryptionScheme: 0 | 1;
  tags: string[];
  // Note: checklistItems are NOT sent to POST /pools — they're configured
  // on-chain separately. The wizard collects them for future use.
  members: { address: string; role: number }[];
}

interface BuildTxResponse {
  txBytes: string;
  poolId: string;
}

interface SubmitTxResponse {
  txDigest: string;
}

/** SHA-256 hash a string → 64-char hex (no 0x prefix) */
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function useCreatePool() {
  const { apiClient, currentOrg, authMethod } = useAuth();
  const { mutateAsync: signTransaction } = useSignTransaction();
  const queryClient = useQueryClient();

  const adminConfigId =
    process.env.NEXT_PUBLIC_ADMIN_CONFIG_ID ?? '';

  return useMutation({
    mutationFn: async (input: CreatePoolInput): Promise<string> => {
      // 0. Guard: zkLogin signing deferred to Session 7
      if (authMethod === 'zklogin') {
        throw new Error('Pool creation requires wallet connection. zkLogin signing coming soon.');
      }

      // 1. Transform form data to backend DTO
      const orgIdHash = await sha256Hex(currentOrg?.id ?? '');
      const borrowerNameHash = await sha256Hex(input.borrowerEntity);
      const maturityTimestamp = Math.floor(
        new Date(input.maturityDate).getTime() / 1000,
      );

      // 2. Build unsigned TX
      const { txBytes, poolId } = await apiClient.post<BuildTxResponse>(
        '/pools',
        {
          adminConfigId,
          orgIdHash,
          name: input.name,
          borrowerNameHash,
          currency: input.currency,
          targetNotional: input.targetNotional,
          expectedMaturityDate: maturityTimestamp,
          encryptionScheme: input.encryptionScheme,
          tags: input.tags,
        },
      );

      // 3. Sign TX via wallet
      const { signature } = await signTransaction({
        transaction: txBytes as any,
      });

      // 4. Submit signed TX
      await apiClient.post<SubmitTxResponse>(`/pools/${poolId}/sign`, {
        txBytes,
        signature,
      });

      // 5. Add members (if any) — non-blocking failures
      for (const member of input.members) {
        try {
          await apiClient.post(`/pools/${poolId}/dataroom/members`, {
            adminConfigId,
            address: member.address,
            role: member.role,
            tags: [],
          });
        } catch {
          // Best-effort — pool already created, member add failure is non-fatal
          console.warn(`Failed to add member ${member.address}`);
        }
      }

      // 6. Invalidate pool list cache
      queryClient.invalidateQueries({ queryKey: queryKeys.pools.all });

      return poolId;
    },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/web && npx vitest run src/__tests__/use-create-pool.test.ts
```

Expected: PASS

- [ ] **Step 5: Verify build**

```bash
cd apps/web && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/api/hooks/use-create-pool.ts apps/web/src/__tests__/use-create-pool.test.ts
git commit -m "feat(web): add useCreatePool mutation hook with TX signing flow"
```

---

## Task 5: Wizard step components (Steps 1–2)

**Files:**
- Create: `apps/web/src/components/pool/step-indicator.tsx`
- Create: `apps/web/src/components/pool/steps/step-basic-info.tsx`
- Create: `apps/web/src/components/pool/steps/step-encryption.tsx`

- [ ] **Step 1: Create StepIndicator**

Create `apps/web/src/components/pool/step-indicator.tsx`:

```tsx
interface StepIndicatorProps {
  steps: string[];
  currentStep: number;
}

export function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-between mb-8 relative">
      <div className="absolute left-0 top-1/2 w-full h-0.5 bg-muted -z-10 -translate-y-1/2" />
      {steps.map((step, index) => {
        const isActive = index === currentStep;
        const isCompleted = index < currentStep;
        return (
          <div key={step} className="flex flex-col items-center gap-2 bg-background px-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors ${
                isActive
                  ? 'border-primary bg-primary text-primary-foreground'
                  : isCompleted
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-muted-foreground/30 bg-background text-muted-foreground'
              }`}
            >
              {isCompleted ? '✓' : index + 1}
            </div>
            <span
              className={`text-xs font-medium ${
                isActive || isCompleted ? 'text-foreground' : 'text-muted-foreground'
              }`}
            >
              {step}
            </span>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Create StepBasicInfo**

Create `apps/web/src/components/pool/steps/step-basic-info.tsx`:

```tsx
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface StepBasicInfoProps {
  name: string;
  borrowerEntity: string;
  targetNotional: string;
  currency: string;
  maturityDate: string;
  errors: Record<string, string>;
  onChange: (field: string, value: string) => void;
}

export function StepBasicInfo({
  name,
  borrowerEntity,
  targetNotional,
  currency,
  maturityDate,
  errors,
  onChange,
}: StepBasicInfoProps) {
  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <Label htmlFor="pool-name">
          Pool Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="pool-name"
          value={name}
          onChange={(e) => onChange('name', e.target.value)}
          placeholder="e.g. Apex Series A Secured Notes"
          maxLength={256}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name}</p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="borrower-name">
          Borrower Entity <span className="text-destructive">*</span>
        </Label>
        <Input
          id="borrower-name"
          value={borrowerEntity}
          onChange={(e) => onChange('borrowerEntity', e.target.value)}
          placeholder="e.g. Apex Holdings Ltd."
          maxLength={256}
        />
        {errors.borrowerEntity && (
          <p className="text-sm text-destructive">{errors.borrowerEntity}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="target-notional">
            Target Notional <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-muted-foreground">
              $
            </span>
            <Input
              id="target-notional"
              type="number"
              value={targetNotional}
              onChange={(e) => onChange('targetNotional', e.target.value)}
              placeholder="5,000,000"
              className="pl-7"
              min={1}
            />
          </div>
          {errors.targetNotional && (
            <p className="text-sm text-destructive">{errors.targetNotional}</p>
          )}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="currency">Currency</Label>
          <Input
            id="currency"
            value={currency}
            onChange={(e) => onChange('currency', e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="maturity-date">
          Maturity Date <span className="text-destructive">*</span>
        </Label>
        <Input
          id="maturity-date"
          type="date"
          value={maturityDate}
          onChange={(e) => onChange('maturityDate', e.target.value)}
          min={new Date().toISOString().split('T')[0]}
        />
        {errors.maturityDate && (
          <p className="text-sm text-destructive">{errors.maturityDate}</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create StepEncryption**

Create `apps/web/src/components/pool/steps/step-encryption.tsx`:

```tsx
import { Lock, ShieldCheck } from 'lucide-react';

interface StepEncryptionProps {
  encryptionScheme: 0 | 1;
  sealBetaAcknowledged: boolean;
  onChange: (field: string, value: unknown) => void;
}

export function StepEncryption({
  encryptionScheme,
  sealBetaAcknowledged,
  onChange,
}: StepEncryptionProps) {
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => onChange('encryptionScheme', 0)}
          className={`border-2 rounded-xl p-6 text-left cursor-pointer hover:border-primary transition-colors ${
            encryptionScheme === 0
              ? 'border-primary bg-primary/5'
              : 'border-border'
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-background rounded-lg shadow-sm border">
              <Lock className="h-6 w-6 text-foreground" />
            </div>
            <div
              className={`h-4 w-4 rounded-full border-4 ${
                encryptionScheme === 0
                  ? 'border-primary bg-background'
                  : 'border-muted-foreground/30 bg-background'
              }`}
            />
          </div>
          <h3 className="font-semibold text-lg">AES-256 Production</h3>
          <p className="text-sm text-muted-foreground mt-2">
            Industry standard symmetric encryption. Keys are distributed
            on-chain via public keys.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onChange('encryptionScheme', 1)}
          className={`border-2 rounded-xl p-6 text-left cursor-pointer hover:border-primary transition-colors relative overflow-hidden ${
            encryptionScheme === 1
              ? 'border-primary bg-primary/5'
              : 'border-border'
          }`}
        >
          <div className="absolute top-0 right-0 bg-warning text-warning-foreground text-xs font-bold px-3 py-1 rounded-bl-lg">
            Beta - 10% Off
          </div>
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-background rounded-lg shadow-sm border">
              <ShieldCheck className="h-6 w-6 text-warning" />
            </div>
            <div
              className={`h-4 w-4 rounded-full border-4 ${
                encryptionScheme === 1
                  ? 'border-primary bg-background'
                  : 'border-muted-foreground/30 bg-background'
              }`}
            />
          </div>
          <h3 className="font-semibold text-lg">Seal Beta</h3>
          <p className="text-sm text-muted-foreground mt-2">
            Threshold encryption via Sui Seal. Innovative on-chain policy
            enforcement.
          </p>
        </button>
      </div>

      {encryptionScheme === 1 && (
        <label className="flex items-center gap-2 p-3 bg-warning/10 rounded-lg border border-warning/20 cursor-pointer">
          <input
            type="checkbox"
            checked={sealBetaAcknowledged}
            onChange={(e) =>
              onChange('sealBetaAcknowledged', e.target.checked)
            }
            className="h-4 w-4 rounded border-warning accent-warning"
          />
          <span className="text-sm">
            I understand this is a Beta feature and may have limitations.
          </span>
        </label>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verify build**

```bash
cd apps/web && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/pool/step-indicator.tsx apps/web/src/components/pool/steps/
git commit -m "feat(web): add StepIndicator, StepBasicInfo, StepEncryption components"
```

---

## Task 6: Wizard Step 3 — DnD Checklist

**Files:**
- Create: `apps/web/src/components/pool/steps/step-checklist.tsx`

- [ ] **Step 1: Create StepChecklist with @dnd-kit**

Create `apps/web/src/components/pool/steps/step-checklist.tsx`:

```tsx
'use client';

import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface ChecklistItemData {
  id: string;
  folderId: number;
  label: string;
  description: string;
  requirementLevel: 'required' | 'recommended' | 'optional';
  expectedDocType: number;
  sortOrder: number;
}

interface StepChecklistProps {
  items: ChecklistItemData[];
  onItemsChange: (items: ChecklistItemData[]) => void;
}

const REQUIREMENT_CYCLE: Array<'required' | 'recommended' | 'optional'> = [
  'required',
  'recommended',
  'optional',
];

const REQUIREMENT_STYLES: Record<string, string> = {
  required: 'bg-blue-100 text-blue-700',
  recommended: 'bg-amber-100 text-amber-700',
  optional: 'bg-slate-100 text-slate-600',
};

function SortableItem({
  item,
  onToggleRequirement,
  onRemove,
}: {
  item: ChecklistItemData;
  onToggleRequirement: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 bg-card border rounded-lg px-3 py-2.5"
    >
      <button
        type="button"
        className="touch-none text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="flex-1 text-sm font-medium">{item.label}</span>
      <button
        type="button"
        onClick={onToggleRequirement}
        className={`text-xs font-medium px-2 py-0.5 rounded-md ${REQUIREMENT_STYLES[item.requirementLevel]}`}
      >
        {item.requirementLevel.charAt(0).toUpperCase() +
          item.requirementLevel.slice(1)}
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="text-muted-foreground hover:text-destructive"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function StepChecklist({ items, onItemsChange }: StepChecklistProps) {
  const [newItemLabel, setNewItemLabel] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    const reordered = arrayMove(items, oldIndex, newIndex).map((item, idx) => ({
      ...item,
      sortOrder: idx,
    }));
    onItemsChange(reordered);
  }

  function toggleRequirement(id: string) {
    onItemsChange(
      items.map((item) => {
        if (item.id !== id) return item;
        const currentIdx = REQUIREMENT_CYCLE.indexOf(item.requirementLevel);
        const nextLevel =
          REQUIREMENT_CYCLE[(currentIdx + 1) % REQUIREMENT_CYCLE.length];
        return { ...item, requirementLevel: nextLevel };
      }),
    );
  }

  function removeItem(id: string) {
    if (items.length <= 1) return; // minimum 1 item
    onItemsChange(items.filter((i) => i.id !== id));
  }

  function addCustomItem() {
    if (!newItemLabel.trim()) return;
    const newItem: ChecklistItemData = {
      id: crypto.randomUUID(),
      folderId: 5, // Misc folder
      label: newItemLabel.trim(),
      description: '',
      requirementLevel: 'optional',
      expectedDocType: 9, // MISC
      sortOrder: items.length,
    };
    onItemsChange([...items, newItem]);
    setNewItemLabel('');
  }

  return (
    <div className="space-y-3">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          {items.map((item) => (
            <SortableItem
              key={item.id}
              item={item}
              onToggleRequirement={() => toggleRequirement(item.id)}
              onRemove={() => removeItem(item.id)}
            />
          ))}
        </SortableContext>
      </DndContext>

      <div className="flex gap-2">
        <Input
          value={newItemLabel}
          onChange={(e) => setNewItemLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addCustomItem()}
          placeholder="Add custom checklist item..."
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addCustomItem}
          disabled={!newItemLabel.trim()}
        >
          Add
        </Button>
      </div>
      {items.length <= 1 && (
        <p className="text-xs text-muted-foreground">
          At least one checklist item is required.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd apps/web && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/pool/steps/step-checklist.tsx
git commit -m "feat(web): add StepChecklist with @dnd-kit drag-to-sort"
```

---

## Task 7: Wizard Steps 4–5 — Members + Review

**Files:**
- Create: `apps/web/src/components/pool/steps/step-members.tsx`
- Create: `apps/web/src/components/pool/steps/step-review.tsx`

- [ ] **Step 1: Create StepMembers**

Create `apps/web/src/components/pool/steps/step-members.tsx`:

```tsx
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ROLE } from '@/types';

export interface MemberInviteData {
  id: string;
  address: string;
  role: number;
}

interface StepMembersProps {
  members: MemberInviteData[];
  currentUserAddress: string;
  errors: Record<string, string>;
  onMembersChange: (members: MemberInviteData[]) => void;
  onSkip: () => void;
}

const ROLE_OPTIONS = [
  { label: 'Editor', value: ROLE.EDITOR },
  { label: 'Reviewer', value: ROLE.REVIEWER },
  { label: 'Viewer', value: ROLE.VIEWER },
];

const SUI_ADDRESS_RE = /^0x[a-fA-F0-9]{64}$/;

export function StepMembers({
  members,
  currentUserAddress,
  errors,
  onMembersChange,
  onSkip,
}: StepMembersProps) {
  function updateMember(
    id: string,
    field: 'address' | 'role',
    value: string | number,
  ) {
    onMembersChange(
      members.map((m) => (m.id === id ? { ...m, [field]: value } : m)),
    );
  }

  function removeMember(id: string) {
    onMembersChange(members.filter((m) => m.id !== id));
  }

  function addMember() {
    onMembersChange([
      ...members,
      { id: crypto.randomUUID(), address: '', role: ROLE.VIEWER },
    ]);
  }

  function getAddressError(member: MemberInviteData): string | null {
    if (!member.address) return null;
    if (!SUI_ADDRESS_RE.test(member.address)) return 'Invalid Sui address format';
    if (member.address.toLowerCase() === currentUserAddress.toLowerCase())
      return 'Cannot invite yourself';
    const dupes = members.filter(
      (m) =>
        m.id !== member.id &&
        m.address &&
        m.address.toLowerCase() === member.address.toLowerCase(),
    );
    if (dupes.length > 0) return 'Duplicate address';
    return null;
  }

  return (
    <div className="space-y-4">
      {members.map((member) => {
        const addrError = getAddressError(member);
        return (
          <div key={member.id} className="space-y-1">
            <div className="grid grid-cols-[2fr_1fr_32px] gap-3 items-center">
              <Input
                value={member.address}
                onChange={(e) =>
                  updateMember(member.id, 'address', e.target.value)
                }
                placeholder="0x..."
                className={addrError ? 'border-destructive' : ''}
              />
              <select
                value={member.role}
                onChange={(e) =>
                  updateMember(member.id, 'role', Number(e.target.value))
                }
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => removeMember(member.id)}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {addrError && (
              <p className="text-xs text-destructive pl-1">{addrError}</p>
            )}
          </div>
        );
      })}

      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" size="sm" onClick={addMember}>
          + Add Member
        </Button>
        <button
          type="button"
          onClick={onSkip}
          className="text-sm text-muted-foreground hover:text-foreground underline"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create StepReview**

Create `apps/web/src/components/pool/steps/step-review.tsx`:

```tsx
import { Lock, ShieldCheck, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ChecklistItemData } from './step-checklist';
import type { MemberInviteData } from './step-members';

interface StepReviewProps {
  name: string;
  borrowerEntity: string;
  targetNotional: string;
  currency: string;
  maturityDate: string;
  encryptionScheme: 0 | 1;
  checklistItems: ChecklistItemData[];
  members: MemberInviteData[];
  onEditStep: (step: number) => void;
}

export function StepReview({
  name,
  borrowerEntity,
  targetNotional,
  currency,
  maturityDate,
  encryptionScheme,
  checklistItems,
  members,
  onEditStep,
}: StepReviewProps) {
  const requiredCount = checklistItems.filter(
    (i) => i.requirementLevel === 'required',
  ).length;
  const validMembers = members.filter((m) => m.address);

  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <div className="rounded-lg border p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-sm">Basic Info</h4>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onEditStep(0)}
          >
            <Pencil className="h-3 w-3 mr-1" /> Edit
          </Button>
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Pool Name</dt>
            <dd className="font-medium mt-0.5">{name}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Borrower</dt>
            <dd className="font-medium mt-0.5">{borrowerEntity}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Target Size</dt>
            <dd className="font-medium mt-0.5">
              ${Number(targetNotional).toLocaleString()} {currency}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Maturity Date</dt>
            <dd className="font-medium mt-0.5">{maturityDate}</dd>
          </div>
        </dl>
      </div>

      {/* Encryption */}
      <div className="rounded-lg border p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-sm">Encryption Engine</h4>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onEditStep(1)}
          >
            <Pencil className="h-3 w-3 mr-1" /> Edit
          </Button>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {encryptionScheme === 0 ? (
            <>
              <Lock className="h-4 w-4" />
              <span className="font-medium">AES-256 Production</span>
            </>
          ) : (
            <>
              <ShieldCheck className="h-4 w-4 text-warning" />
              <span className="font-medium">Seal Beta</span>
            </>
          )}
        </div>
      </div>

      {/* Checklist */}
      <div className="rounded-lg border p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-sm">DD Checklist</h4>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onEditStep(2)}
          >
            <Pencil className="h-3 w-3 mr-1" /> Edit
          </Button>
        </div>
        <p className="text-sm">
          {checklistItems.length} items ({requiredCount} required,{' '}
          {checklistItems.length - requiredCount} recommended/optional)
        </p>
      </div>

      {/* Members */}
      <div className="rounded-lg border p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-sm">Initial Members</h4>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onEditStep(3)}
          >
            <Pencil className="h-3 w-3 mr-1" /> Edit
          </Button>
        </div>
        <p className="text-sm">
          {validMembers.length > 0
            ? `${validMembers.length} member(s) will be invited`
            : 'No members added — you can invite later'}
        </p>
      </div>

      {/* Disclaimer */}
      <div className="p-4 bg-muted/50 rounded-md border text-sm text-muted-foreground">
        By clicking submit, you will be prompted to sign a{' '}
        <strong>Sui Transaction</strong> to create this pool on-chain.
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
cd apps/web && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/pool/steps/step-members.tsx apps/web/src/components/pool/steps/step-review.tsx
git commit -m "feat(web): add StepMembers and StepReview wizard components"
```

---

## Task 8: Wizard page — full rewrite with useReducer + TX flow

**Files:**
- Modify: `apps/web/src/app/(main)/pools/new/page.tsx`
- Create: `apps/web/src/__tests__/pool-wizard.test.tsx`

- [ ] **Step 1: Write wizard tests**

Create `apps/web/src/__tests__/pool-wizard.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import NewPoolPage from '@/app/(main)/pools/new/page';

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({
    user: { address: '0x' + 'a'.repeat(64) },
    currentOrg: { id: 'org-1' },
    apiClient: { post: vi.fn() },
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
    // Fill step 1 required fields
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
    // Should be on step 2
    expect(screen.getByText('AES-256 Production')).toBeInTheDocument();
  });

  it('shows Confirm & Submit on last step', () => {
    render(<NewPoolPage />);
    // Fill and advance through all steps
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
    // Step 1→2→3→4→5
    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByText('Next Step'));
    }
    expect(screen.getByText('Confirm & Submit')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/web && npx vitest run src/__tests__/pool-wizard.test.tsx
```

- [ ] **Step 3: Rewrite pools/new/page.tsx**

Rewrite `apps/web/src/app/(main)/pools/new/page.tsx` with the full implementation. Key structure:

```tsx
'use client';

import { useReducer } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAuth } from '@/providers/auth-provider';
import { useCreatePool } from '@/lib/api/hooks/use-create-pool';
import { StepIndicator } from '@/components/pool/step-indicator';
import { StepBasicInfo } from '@/components/pool/steps/step-basic-info';
import { StepEncryption } from '@/components/pool/steps/step-encryption';
import {
  StepChecklist,
  type ChecklistItemData,
} from '@/components/pool/steps/step-checklist';
import {
  StepMembers,
  type MemberInviteData,
} from '@/components/pool/steps/step-members';
import { StepReview } from '@/components/pool/steps/step-review';

// Import from shared package — map to add id + sortOrder for DnD
import { DEFAULT_DD_CHECKLIST_ITEMS } from '@rwa-dataroom/shared';
// If import fails, check tsconfig paths or use: import { DEFAULT_DD_CHECKLIST_ITEMS } from '../../../../packages/shared/src/types/checklist';

const STEPS = [
  'Basic Info',
  'Encryption Engine',
  'DD Checklist',
  'Initial Members',
  'Review & Confirm',
];

interface PoolFormState {
  name: string;
  borrowerEntity: string;
  targetNotional: string;
  currency: string;
  maturityDate: string;
  encryptionScheme: 0 | 1;
  sealBetaAcknowledged: boolean;
  checklistItems: ChecklistItemData[];
  members: MemberInviteData[];
  currentStep: number;
  errors: Record<string, string>;
  isSubmitting: boolean;
  returnToReview: boolean;
}

type FormAction =
  | { type: 'SET_FIELD'; field: string; value: unknown }
  | { type: 'SET_STEP'; step: number }
  | { type: 'SET_ERRORS'; errors: Record<string, string> }
  | { type: 'SET_CHECKLIST'; items: ChecklistItemData[] }
  | { type: 'SET_MEMBERS'; members: MemberInviteData[] }
  | { type: 'SET_SUBMITTING'; value: boolean }
  | { type: 'EDIT_FROM_REVIEW'; step: number }
  | { type: 'RETURN_TO_REVIEW' };

function formReducer(state: PoolFormState, action: FormAction): PoolFormState {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value, errors: {} };
    case 'SET_STEP':
      return { ...state, currentStep: action.step, errors: {}, returnToReview: false };
    case 'SET_ERRORS':
      return { ...state, errors: action.errors };
    case 'SET_CHECKLIST':
      return { ...state, checklistItems: action.items };
    case 'SET_MEMBERS':
      return { ...state, members: action.members };
    case 'SET_SUBMITTING':
      return { ...state, isSubmitting: action.value };
    case 'EDIT_FROM_REVIEW':
      return { ...state, currentStep: action.step, returnToReview: true };
    case 'RETURN_TO_REVIEW':
      return { ...state, currentStep: 4, returnToReview: false };
    default:
      return state;
  }
}

// Build default items from shared constant — called inside useReducer lazy init
function buildDefaultItems(): ChecklistItemData[] {
  return DEFAULT_DD_CHECKLIST_ITEMS.map((item, idx) => ({
    id: crypto.randomUUID(),
    folderId: item.folderId,
    label: item.label,
    description: item.description ?? '',
    requirementLevel: item.requirementLevel as 'required' | 'recommended' | 'optional',
    expectedDocType: item.expectedDocType,
    sortOrder: idx,
  }));
}

function validateStep1(state: PoolFormState): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!state.name.trim()) errors.name = 'Pool name is required';
  if (state.name.length > 256) errors.name = 'Pool name must be 256 characters or less';
  if (!state.borrowerEntity.trim()) errors.borrowerEntity = 'Borrower entity is required';
  if (!state.targetNotional || Number(state.targetNotional) <= 0)
    errors.targetNotional = 'Target notional must be greater than 0';
  if (!state.maturityDate) errors.maturityDate = 'Maturity date is required';
  else if (new Date(state.maturityDate) <= new Date())
    errors.maturityDate = 'Maturity date must be in the future';
  return errors;
}

function validateStep2(state: PoolFormState): Record<string, string> {
  if (state.encryptionScheme === 1 && !state.sealBetaAcknowledged) {
    return { sealBetaAcknowledged: 'Please acknowledge the Beta disclaimer' };
  }
  return {};
}

export default function NewPoolPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { mutateAsync: createPool, isPending } = useCreatePool();

  // Lazy initializer to avoid crypto.randomUUID() at module level (SSR safe)
  const [state, dispatch] = useReducer(formReducer, null, () => ({
    name: '',
    borrowerEntity: '',
    targetNotional: '',
    currency: 'USD',
    maturityDate: '',
    encryptionScheme: 0 as 0 | 1,
    sealBetaAcknowledged: false,
    checklistItems: buildDefaultItems(),
    members: [] as MemberInviteData[],
    currentStep: 0,
    errors: {} as Record<string, string>,
    isSubmitting: false,
    returnToReview: false,
  }));

  function handleFieldChange(field: string, value: unknown) {
    dispatch({ type: 'SET_FIELD', field, value });
  }

  function handleNext() {
    // Validate current step
    if (state.currentStep === 0) {
      const errors = validateStep1(state);
      if (Object.keys(errors).length > 0) {
        dispatch({ type: 'SET_ERRORS', errors });
        return;
      }
    }
    if (state.currentStep === 1) {
      const errors = validateStep2(state);
      if (Object.keys(errors).length > 0) {
        dispatch({ type: 'SET_ERRORS', errors });
        return;
      }
    }

    if (state.returnToReview) {
      dispatch({ type: 'RETURN_TO_REVIEW' });
    } else {
      dispatch({ type: 'SET_STEP', step: state.currentStep + 1 });
    }
  }

  function handleBack() {
    if (state.returnToReview) {
      dispatch({ type: 'RETURN_TO_REVIEW' });
    } else {
      dispatch({ type: 'SET_STEP', step: state.currentStep - 1 });
    }
  }

  async function handleSubmit() {
    dispatch({ type: 'SET_SUBMITTING', value: true });
    try {
      const poolId = await createPool({
        name: state.name,
        borrowerEntity: state.borrowerEntity,
        targetNotional: state.targetNotional,
        currency: state.currency,
        maturityDate: state.maturityDate,
        encryptionScheme: state.encryptionScheme,
        tags: [],
        members: state.members.filter((m) => m.address),
      });
      toast.success('Pool created successfully!');
      router.push(`/pools/${poolId}`);
    } catch (err: any) {
      if (err?.message?.includes('cancelled') || err?.message?.includes('rejected')) {
        toast.error('Transaction cancelled');
      } else {
        toast.error(err?.message ?? 'Failed to create pool');
      }
      dispatch({ type: 'SET_SUBMITTING', value: false });
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-8">
      <div className="mb-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Create New Pool</h1>
        <p className="text-muted-foreground mt-2">
          Follow the steps below to set up a new data room for your credit pool.
        </p>
      </div>

      <StepIndicator steps={STEPS} currentStep={state.currentStep} />

      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle>{STEPS[state.currentStep]}</CardTitle>
          <CardDescription>
            {state.currentStep === 0 &&
              'Provide basic details about the new credit pool.'}
            {state.currentStep === 1 &&
              'Select the cryptographic protocol to secure your files.'}
            {state.currentStep === 2 &&
              'Customize the Due Diligence checklist template.'}
            {state.currentStep === 3 &&
              'Invite initial members and reviewers.'}
            {state.currentStep === 4 &&
              'Review your pool configuration before submission.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="min-h-[300px]">
          {state.currentStep === 0 && (
            <StepBasicInfo
              name={state.name}
              borrowerEntity={state.borrowerEntity}
              targetNotional={state.targetNotional}
              currency={state.currency}
              maturityDate={state.maturityDate}
              errors={state.errors}
              onChange={handleFieldChange}
            />
          )}
          {state.currentStep === 1 && (
            <StepEncryption
              encryptionScheme={state.encryptionScheme}
              sealBetaAcknowledged={state.sealBetaAcknowledged}
              onChange={handleFieldChange}
            />
          )}
          {state.currentStep === 2 && (
            <StepChecklist
              items={state.checklistItems}
              onItemsChange={(items) =>
                dispatch({ type: 'SET_CHECKLIST', items })
              }
            />
          )}
          {state.currentStep === 3 && (
            <StepMembers
              members={state.members}
              currentUserAddress={user?.address ?? ''}
              errors={state.errors}
              onMembersChange={(members) =>
                dispatch({ type: 'SET_MEMBERS', members })
              }
              onSkip={handleNext}
            />
          )}
          {state.currentStep === 4 && (
            <StepReview
              name={state.name}
              borrowerEntity={state.borrowerEntity}
              targetNotional={state.targetNotional}
              currency={state.currency}
              maturityDate={state.maturityDate}
              encryptionScheme={state.encryptionScheme}
              checklistItems={state.checklistItems}
              members={state.members}
              onEditStep={(step) =>
                dispatch({ type: 'EDIT_FROM_REVIEW', step })
              }
            />
          )}
        </CardContent>
        <CardFooter className="flex justify-between border-t pt-6 bg-muted/10">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={state.currentStep === 0 || state.isSubmitting}
          >
            Back
          </Button>
          {state.currentStep < STEPS.length - 1 ? (
            <Button
              onClick={handleNext}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Next Step
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={state.isSubmitting || isPending}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {state.isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Confirm & Submit'
              )}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
```

Note: Import `DEFAULT_DD_CHECKLIST_ITEMS` from `@rwa-dataroom/shared` if the package exports it. If not accessible from the frontend package, use the inline `DEFAULT_ITEMS` shown above (mirroring the shared constant). Check the actual import path at implementation time:

```bash
# Check if shared package is accessible
grep -r "DEFAULT_DD_CHECKLIST" packages/shared/src/
```

- [ ] **Step 4: Run tests**

```bash
cd apps/web && npx vitest run src/__tests__/pool-wizard.test.tsx
```

Expected: PASS

- [ ] **Step 5: Verify build**

```bash
cd apps/web && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/\(main\)/pools/new/page.tsx apps/web/src/__tests__/pool-wizard.test.tsx
git commit -m "feat(web): rewrite pool creation wizard with useReducer, validation, and TX signing"
```

---

## Task 9: VDR components — FolderTree + DocumentList

**Files:**
- Create: `apps/web/src/components/vdr/folder-tree.tsx`
- Create: `apps/web/src/components/vdr/document-list.tsx`

- [ ] **Step 1: Create FolderTree**

Create `apps/web/src/components/vdr/folder-tree.tsx`:

```tsx
import { Folder } from 'lucide-react';

interface FolderMeta {
  id: number;
  name: string;
}

interface FolderTreeProps {
  folders: FolderMeta[];
  activeFolderId: number | null; // null = "All"
  onFolderSelect: (folderId: number | null) => void;
}

export function FolderTree({
  folders,
  activeFolderId,
  onFolderSelect,
}: FolderTreeProps) {
  return (
    <div className="border rounded-lg p-3">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        Folders
      </div>
      <nav className="space-y-0.5">
        <button
          type="button"
          onClick={() => onFolderSelect(null)}
          className={`w-full text-left text-sm px-2 py-1.5 rounded-md transition-colors ${
            activeFolderId === null
              ? 'bg-primary/10 text-primary font-medium'
              : 'text-foreground hover:bg-muted'
          }`}
        >
          All Files
        </button>
        {folders.map((folder) => (
          <button
            key={folder.id}
            type="button"
            onClick={() => onFolderSelect(folder.id)}
            className={`w-full text-left text-sm px-2 py-1.5 rounded-md flex items-center gap-2 transition-colors ${
              activeFolderId === folder.id
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-foreground hover:bg-muted'
            }`}
          >
            <Folder className="h-4 w-4" />
            {folder.name}
          </button>
        ))}
      </nav>
    </div>
  );
}
```

- [ ] **Step 2: Create DocumentList**

Create `apps/web/src/components/vdr/document-list.tsx`:

```tsx
import { FileText, MoreVertical } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Document } from '@/types';

interface DocumentListProps {
  documents: Document[];
  isLoading: boolean;
  onViewDetails?: (docId: string) => void;
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  approved: { label: 'Approved', className: 'bg-green-100 text-green-700' },
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-700' },
  under_review: {
    label: 'Under Review',
    className: 'bg-blue-100 text-blue-700',
  },
  needs_revision: {
    label: 'Needs Revision',
    className: 'bg-red-100 text-red-700',
  },
};

function getDocStatus(doc: Document) {
  // Derive status from approvalCount and version info
  if (doc.approvalCount > 0)
    return STATUS_STYLES.approved ?? STATUS_STYLES.pending;
  return STATUS_STYLES.pending;
}

export function DocumentList({
  documents,
  isLoading,
  onViewDetails,
}: DocumentListProps) {
  if (isLoading) {
    return (
      <div className="border rounded-lg overflow-hidden">
        <div className="grid grid-cols-[2fr_1fr_1fr_60px] p-3 bg-muted/30 border-b">
          {['Name', 'Status', 'Updated', ''].map((h) => (
            <div
              key={h}
              className="text-xs font-semibold text-muted-foreground uppercase tracking-wide"
            >
              {h}
            </div>
          ))}
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-[2fr_1fr_1fr_60px] p-3 border-b items-center gap-2"
          >
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-4" />
          </div>
        ))}
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="border rounded-lg flex flex-col items-center justify-center py-16 text-center">
        <FileText className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-medium">No documents yet</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Documents will appear here once uploaded to the data room.
        </p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="grid grid-cols-[2fr_1fr_1fr_60px] p-3 bg-muted/30 border-b">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Name
        </div>
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Status
        </div>
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Updated
        </div>
        <div />
      </div>
      {documents.map((doc) => {
        const status = getDocStatus(doc);
        return (
          <div
            key={doc.id}
            className="grid grid-cols-[2fr_1fr_1fr_60px] p-3 border-b last:border-b-0 items-center hover:bg-muted/10 transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{doc.title}</div>
                <div className="text-xs text-muted-foreground">
                  v{doc.currentVersion}
                </div>
              </div>
            </div>
            <div>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-md ${status.className}`}
              >
                {status.label}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              {formatRelativeTime(doc.lastUpdatedAt)}
            </div>
            <div className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent">
                  <MoreVertical className="h-4 w-4" />
                  <span className="sr-only">Open menu</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => onViewDetails?.(doc.id)}
                  >
                    View Details
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
cd apps/web && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/vdr/
git commit -m "feat(web): add FolderTree and DocumentList VDR components"
```

---

## Task 10: Pool detail page — full rewrite with tabs + VDR

**Files:**
- Modify: `apps/web/src/app/(main)/pools/[id]/page.tsx`
- Create: `apps/web/src/components/pool/tab-placeholder.tsx`
- Create: `apps/web/src/__tests__/pool-detail.test.tsx`

- [ ] **Step 1: Create TabPlaceholder**

Create `apps/web/src/components/pool/tab-placeholder.tsx`:

```tsx
import type { LucideIcon } from 'lucide-react';

interface TabPlaceholderProps {
  icon: LucideIcon;
  title: string;
  session: string;
}

export function TabPlaceholder({
  icon: Icon,
  title,
  session,
}: TabPlaceholderProps) {
  return (
    <div className="border rounded-lg flex flex-col items-center justify-center py-20 text-center">
      <Icon className="h-10 w-10 text-muted-foreground/30 mb-3" />
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1">
        Coming in {session}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Write pool detail tests**

Create `apps/web/src/__tests__/pool-detail.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import { describe, it, expect, vi } from 'vitest';
import PoolDetailPage from '@/app/(main)/pools/[id]/page';

// Wrapper with Suspense for use(params) support
function renderDetail(id = 'pool-1') {
  return render(
    <Suspense fallback={<div>Loading...</div>}>
      <PoolDetailPage params={Promise.resolve({ id })} />
    </Suspense>,
  );
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
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
  useParams: () => ({ id: 'pool-1' }),
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ apiClient: { get: vi.fn() } }),
}));

describe('PoolDetailPage', () => {
  it('renders pool name and state badge', () => {
    renderDetail();
    expect(screen.getByText('Test Pool')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('renders all 6 tabs', () => {
    renderDetail();
    expect(screen.getByText('VDR')).toBeInTheDocument();
    expect(screen.getByText('Checklist')).toBeInTheDocument();
    expect(screen.getByText('Reviews')).toBeInTheDocument();
    expect(screen.getByText('IC')).toBeInTheDocument();
    expect(screen.getByText('Audit')).toBeInTheDocument();
    expect(screen.getByText('Members')).toBeInTheDocument();
  });

  it('shows upload button as disabled', () => {
    renderDetail();
    const uploadBtn = screen.getByText(/Upload Document/);
    expect(uploadBtn.closest('button')).toBeDisabled();
  });

  it('shows empty state for VDR when no documents', () => {
    renderDetail();
    expect(screen.getByText('No documents yet')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd apps/web && npx vitest run src/__tests__/pool-detail.test.tsx
```

- [ ] **Step 4: Rewrite pool detail page**

Rewrite `apps/web/src/app/(main)/pools/[id]/page.tsx`:

```tsx
'use client';

import { use, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Landmark,
  MessageSquare,
  ScrollText,
  UploadCloud,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PoolStateBadge } from '@/components/pool/pool-state-badge';
import { TabPlaceholder } from '@/components/pool/tab-placeholder';
import { FolderTree } from '@/components/vdr/folder-tree';
import { DocumentList } from '@/components/vdr/document-list';
import { usePoolDetail } from '@/lib/api/hooks/use-pool-detail';
import { useDocuments } from '@/lib/api/hooks/use-documents';
import type { PoolTab } from '@/types';

// Import from shared package
import { DEFAULT_FOLDERS } from '@rwa-dataroom/shared';
// Fallback if import fails: const DEFAULT_FOLDERS = [{ id: 0, name: 'Legal' }, ...];

const TABS: { key: PoolTab; label: string; icon: typeof FileText }[] = [
  { key: 'vdr', label: 'VDR', icon: FileText },
  { key: 'checklist', label: 'Checklist', icon: CheckCircle2 },
  { key: 'reviews', label: 'Reviews', icon: MessageSquare },
  { key: 'ic', label: 'IC', icon: Landmark },
  { key: 'audit', label: 'Audit', icon: ScrollText },
  { key: 'members', label: 'Members', icon: Users },
];

const VALID_TABS = new Set(TABS.map((t) => t.key));

export default function PoolDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as PoolTab | null;
  const activeTab: PoolTab =
    tabParam && VALID_TABS.has(tabParam) ? tabParam : 'vdr';

  const { data: pool, isLoading: poolLoading } = usePoolDetail(id);
  const { data: docsData, isLoading: docsLoading } = useDocuments(id);

  const [activeFolderId, setActiveFolderId] = useState<number | null>(null);

  const filteredDocs = useMemo(() => {
    const docs = docsData?.data ?? [];
    if (activeFolderId === null) return docs;
    return docs.filter((d) => d.folderId === activeFolderId);
  }, [docsData, activeFolderId]);

  function setActiveTab(tab: PoolTab) {
    router.replace(`/pools/${id}?tab=${tab}`);
  }

  if (poolLoading) {
    return (
      <div className="max-w-6xl mx-auto py-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!pool) {
    return (
      <div className="max-w-6xl mx-auto py-6 text-center">
        <h2 className="text-xl font-semibold">Pool not found</h2>
        <Link href="/dashboard" className="text-primary underline mt-2 block">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{pool.name}</h1>
            <PoolStateBadge state={pool.currentState} />
          </div>
          <p className="text-muted-foreground mt-1 text-sm font-mono">
            Pool ID: {id.slice(0, 8)}...{id.slice(-4)}
          </p>
        </div>
        <div>
          <Button disabled title="Available after Session 4">
            <UploadCloud className="mr-2 h-4 w-4" />
            Upload Document
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                Pool Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <span className="text-muted-foreground block mb-1">
                  Borrower
                </span>
                <span className="font-medium">{pool.borrowerName}</span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-1">
                  Target Size
                </span>
                <span className="font-medium">
                  ${Number(pool.targetSize).toLocaleString()} {pool.currency}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-1">
                  Encryption
                </span>
                <span className="font-medium">
                  {pool.encryptionScheme === 'aes256'
                    ? '🔒 AES-256'
                    : '🛡️ Seal Beta'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-1">
                  Maturity
                </span>
                <span className="font-medium">{pool.expectedMaturity}</span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-1">
                  Created
                </span>
                <span className="font-medium">{pool.createdAt}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">0% Complete</span>
                <span className="text-sm text-muted-foreground">0/0 items</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: '0%' }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Based on DD checklist completion
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main: Tabs */}
        <div className="col-span-1 md:col-span-3">
          {/* Tab Bar */}
          <div className="flex gap-0 border-b-2 border-muted mb-5">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors -mb-[2px] ${
                    isActive
                      ? 'text-primary border-b-2 border-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          {activeTab === 'vdr' && (
            <div className="grid grid-cols-[200px_1fr] gap-4">
              <FolderTree
                folders={DEFAULT_FOLDERS}
                activeFolderId={activeFolderId}
                onFolderSelect={setActiveFolderId}
              />
              <DocumentList
                documents={filteredDocs}
                isLoading={docsLoading}
                onViewDetails={(docId) =>
                  router.push(`/pools/${id}/documents/${docId}`)
                }
              />
            </div>
          )}
          {activeTab === 'checklist' && (
            <TabPlaceholder
              icon={CheckCircle2}
              title="DD Checklist"
              session="Session 5a"
            />
          )}
          {activeTab === 'reviews' && (
            <TabPlaceholder
              icon={MessageSquare}
              title="Document Reviews"
              session="Session 5a"
            />
          )}
          {activeTab === 'ic' && (
            <TabPlaceholder
              icon={Landmark}
              title="IC Decisions"
              session="Session 5b"
            />
          )}
          {activeTab === 'audit' && (
            <TabPlaceholder
              icon={ScrollText}
              title="Audit Trail"
              session="Session 5b"
            />
          )}
          {activeTab === 'members' && (
            <TabPlaceholder
              icon={Users}
              title="Members"
              session="Session 5b"
            />
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run tests**

```bash
cd apps/web && npx vitest run src/__tests__/pool-detail.test.tsx
```

Expected: PASS

- [ ] **Step 6: Verify build**

```bash
cd apps/web && npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/\(main\)/pools/\[id\]/page.tsx apps/web/src/components/pool/tab-placeholder.tsx apps/web/src/__tests__/pool-detail.test.tsx
git commit -m "feat(web): rewrite pool detail page with 6-tab skeleton and live VDR"
```

---

## Task 11: Full build verification + monkey tests

**Files:**
- Modify: `apps/web/src/__tests__/pool-wizard.test.tsx` (add edge case tests)
- Modify: `apps/web/src/__tests__/pool-detail.test.tsx` (add edge case tests)

- [ ] **Step 1: Run all tests**

```bash
cd apps/web && npx vitest run
```

Expected: all tests pass

- [ ] **Step 2: Add wizard monkey tests**

Append to `apps/web/src/__tests__/pool-wizard.test.tsx`:

```tsx
describe('Wizard — Monkey Tests', () => {
  it('handles extremely long pool name (256 chars)', () => {
    render(<NewPoolPage />);
    const input = screen.getByLabelText(/Pool Name/);
    fireEvent.change(input, { target: { value: 'A'.repeat(256) } });
    // Should not show error — 256 is the max
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
    // Should proceed to step 2
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
});
```

- [ ] **Step 3: Add pool detail monkey tests**

Append to `apps/web/src/__tests__/pool-detail.test.tsx`:

```tsx
describe('PoolDetail — Monkey Tests', () => {
  it('handles invalid tab param by falling back to vdr', () => {
    vi.mocked(useSearchParams as any).mockReturnValue(
      new URLSearchParams('tab=nonexistent'),
    );
    renderDetail();
    // Should show VDR content (empty state)
    expect(screen.getByText('No documents yet')).toBeInTheDocument();
  });
});
```

Note: Adjust mock setup as needed based on how useSearchParams is mocked.

- [ ] **Step 4: Run all tests**

```bash
cd apps/web && npx vitest run
```

Expected: all pass

- [ ] **Step 5: Full build check**

```bash
cd apps/web && npx tsc --noEmit && npx next build
```

Expected: build succeeds, all routes detected

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/__tests__/
git commit -m "test(web): add monkey tests for pool wizard and pool detail edge cases"
```

---

## Task Dependencies

```
Task 1 (deps)
  ↓
Task 2 (badge + types)     Task 3 (query hooks)
  ↓                           ↓
Task 5 (steps 1-2)         Task 4 (create pool hook)
  ↓                           ↓
Task 6 (step 3 DnD)        Task 9 (VDR components)
  ↓                           ↓
Task 7 (steps 4-5)         Task 10 (pool detail page)
  ↓                           ↓
Task 8 (wizard page)       ────→ Task 11 (verification)
```

Tasks 2+3 can run in parallel. Tasks 5+4 can run in parallel. Tasks 6+9 can run in parallel. Task 8 depends on 4+5+6+7. Task 10 depends on 2+3+9. Task 11 depends on all.
