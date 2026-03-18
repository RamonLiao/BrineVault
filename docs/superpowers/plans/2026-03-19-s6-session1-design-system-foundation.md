# S6 Session 1: Design System + Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify design system, establish route groups, providers, API layer skeleton, and error boundaries — producing a runnable Next.js skeleton with empty pages and complete infrastructure.

**Architecture:** Next.js 16 App Router with `(auth)` and `(main)` route groups. Root layout wraps providers (TanStack Query, Sui dApp Kit). `(main)` layout wraps AuthProvider + MainLayout (sidebar/header). Design tokens migrated from packages/frontend hex to oklch.

**Tech Stack:** Next.js 16.1.6, React 19, Tailwind v4 (oklch), shadcn v4 (Base Nova), @mysten/dapp-kit v1, @tanstack/react-query v5, lucide-react

**Spec:** `docs/superpowers/specs/2026-03-19-s6-frontend-migration-design.md`

**Existing codebase:** `apps/web/` — already has layout, 3 pages, 10 shadcn components. This plan restructures and extends it.

---

## File Map

### Create
- `apps/web/src/app/(auth)/layout.tsx` — minimal layout for login/onboarding (no sidebar)
- `apps/web/src/app/(auth)/login/page.tsx` — placeholder login page
- `apps/web/src/app/(auth)/onboarding/page.tsx` — placeholder onboarding page
- `apps/web/src/app/(main)/layout.tsx` — AuthProvider + MainLayout wrapper
- `apps/web/src/app/(main)/page.tsx` — redirect to /dashboard
- `apps/web/src/app/(main)/dashboard/page.tsx` — move existing page.tsx here
- `apps/web/src/app/(main)/pools/new/page.tsx` — move existing pools/new/page.tsx
- `apps/web/src/app/(main)/pools/[id]/page.tsx` — move existing pools/[id]/page.tsx
- `apps/web/src/app/(main)/pools/[id]/documents/[docId]/page.tsx` — placeholder doc preview
- `apps/web/src/app/(main)/settings/page.tsx` — placeholder settings page
- `apps/web/src/providers/index.tsx` — root Providers client component wrapper
- `apps/web/src/providers/auth-provider.tsx` — AuthProvider context + hook
- `apps/web/src/providers/web3-provider.tsx` — Sui dApp Kit + TanStack Query providers
- `apps/web/src/lib/api/client.ts` — fetch wrapper with JWT + refresh + error handling
- `apps/web/src/lib/api/query-keys.ts` — TanStack Query key factory
- `apps/web/src/hooks/use-permissions.ts` — role bitmask permission hook
- `apps/web/src/components/error-boundary.tsx` — reusable error boundary component
- `apps/web/src/types/index.ts` — shared types (roles, pool states, auth)

### Modify
- `apps/web/src/app/globals.css` — add success/warning tokens, migrate font to Inter, unify with packages/frontend variables
- `apps/web/src/app/layout.tsx` — swap Geist for Inter + JetBrains Mono, wrap with Providers
- `apps/web/src/components/ui/badge.tsx` — add success/warning/info variants
- `apps/web/src/components/ui/dialog.tsx` — add glassmorphism overlay variant
- `apps/web/src/components/layout/header.tsx` — add mobile menu toggle, make sidebar-aware
- `apps/web/src/components/layout/sidebar.tsx` — add responsive collapse, role-aware nav
- `apps/web/src/components/layout/main-layout.tsx` — support mobile sidebar overlay

### Delete (after all tasks complete)
- `apps/web/src/app/page.tsx` — moved to (main)/dashboard/page.tsx
- `apps/web/src/app/pools/` — moved to (main)/pools/

---

## Task 1: Shared Types

**Files:**
- Create: `apps/web/src/types/index.ts`

- [ ] **Step 1: Create types file**

```ts
// apps/web/src/types/index.ts

// --- Role bitmask (matches Move contract values) ---
export const ROLE = {
  VIEWER: 1,
  REVIEWER: 2,
  EDITOR: 4,
  OWNER: 8,
  AUDITOR: 16,
  ORG_ADMIN: 32,
} as const;

export type RoleBitmask = number;

// --- Pool states (matches Move contract) ---
export type PoolState =
  | 'draft'
  | 'dd_in_progress'
  | 'ic_review'
  | 'approved_internal'
  | 'ready_to_issue'
  | 'rejected'
  | 'cancelled';

// --- Encryption scheme ---
export type EncryptionScheme = 'aes256' | 'seal_beta';

// --- Auth ---
export type AuthMethod = 'wallet' | 'zklogin';

export interface User {
  id: string;
  address: string;
  displayName: string | null;
  email: string | null;
  authMethod: AuthMethod;
}

export interface Organisation {
  id: string;
  name: string;
  legalName: string | null;
  billingPlan: 'free_trial' | 'pro' | 'enterprise';
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  authMethod: AuthMethod | null;
  currentOrg: Organisation | null;
  isAuthenticated: boolean;
}

// --- Pool ---
export interface Pool {
  id: string;
  name: string;
  borrowerName: string;
  currency: string;
  targetSize: string;
  currentState: PoolState;
  encryptionScheme: EncryptionScheme;
  expectedMaturity: string;
  memberCount: number;
  createdAt: string;
}

// --- Pool Detail Tab ---
export type PoolTab = 'vdr' | 'checklist' | 'reviews' | 'ic' | 'audit' | 'members';

// --- API Error Envelope ---
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/types/index.ts
git commit -m "feat(web): add shared TypeScript types for roles, pools, auth"
```

---

## Task 2: Update Design Tokens in globals.css

**Files:**
- Modify: `apps/web/src/app/globals.css`

- [ ] **Step 1: Add success/warning tokens and update font**

In `globals.css`, find the `:root` block and add `--success` and `--warning` CSS custom properties. Also find any reference to `--font-sans` and ensure it maps to Inter.

Add after the existing `--destructive` line inside `:root`:
```css
  --success: oklch(0.7 0.17 165);
  --success-foreground: oklch(1 0 0);
  --warning: oklch(0.75 0.16 75);
  --warning-foreground: oklch(0.2 0.03 270);
```

Add inside the `.dark` block (after `--destructive` line):
```css
  --success: oklch(0.65 0.17 165);
  --success-foreground: oklch(0.2 0.03 270);
  --warning: oklch(0.7 0.16 75);
  --warning-foreground: oklch(0.2 0.03 270);
```

Add inside the `@theme inline` block:
```css
  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
```

- [ ] **Step 2: Verify CSS parses correctly**

Run: `cd apps/web && npx next build 2>&1 | tail -5`
Expected: Build succeeds (or at least no CSS parse errors)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "feat(web): add success/warning design tokens, update font to Inter"
```

---

## Task 3: Add Badge Variants (success, warning, info)

**Files:**
- Modify: `apps/web/src/components/ui/badge.tsx`

- [ ] **Step 1: Add new variants to badge CVA config**

Find the `variants` object inside the `cva()` call in badge.tsx. Add these variants alongside the existing ones (`default`, `secondary`, `destructive`, `outline`, `ghost`, `link`):

```ts
      success:
        "border-transparent bg-success text-success-foreground [a]:hover:bg-success/90",
      warning:
        "border-transparent bg-warning text-warning-foreground [a]:hover:bg-warning/90",
      info:
        "border-transparent bg-primary/10 text-primary [a]:hover:bg-primary/20",
```

- [ ] **Step 2: Verify build**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | head -10`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/ui/badge.tsx
git commit -m "feat(web): add success/warning/info badge variants"
```

---

## Task 4: Add Glassmorphism Dialog Overlay

**Files:**
- Modify: `apps/web/src/components/ui/dialog.tsx`

- [ ] **Step 1: Read current dialog.tsx to understand structure**

Read `apps/web/src/components/ui/dialog.tsx` to find the overlay/backdrop element. It should be using `@base-ui/react/dialog` with a Backdrop component.

- [ ] **Step 2: Update backdrop styling**

Find the Backdrop component and update its className to include glassmorphism:

Replace the existing backdrop class (likely something like `bg-black/50`) with:
```
bg-slate-900/50 backdrop-blur-sm
```

This matches the `packages/frontend` PoolCreationWizard modal style.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/ui/dialog.tsx
git commit -m "feat(web): add glassmorphism backdrop to Dialog overlay"
```

---

## Task 5: Error Boundary Component

**Files:**
- Create: `apps/web/src/components/error-boundary.tsx`

- [ ] **Step 1: Create error boundary**

```tsx
// apps/web/src/components/error-boundary.tsx
'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  /** Label shown in error UI, e.g. "Documents", "Encryption" */
  section?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.section ? `:${this.props.section}` : ''}]`, error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <Card className="mx-auto mt-8 max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" />
              {this.props.section ? `${this.props.section} Error` : 'Something went wrong'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
          </CardContent>
          <CardFooter>
            <Button variant="outline" size="sm" onClick={this.handleReset}>
              Try Again
            </Button>
          </CardFooter>
        </Card>
      );
    }

    return this.props.children;
  }
}
```

- [ ] **Step 2: Verify build**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | head -10`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/error-boundary.tsx
git commit -m "feat(web): add reusable ErrorBoundary component"
```

---

## Task 6: Web3 Provider

**Files:**
- Create: `apps/web/src/providers/web3-provider.tsx`

- [ ] **Step 1: Create Web3Provider**

```tsx
// apps/web/src/providers/web3-provider.tsx
'use client';

import { createNetworkConfig, SuiClientProvider, WalletProvider } from '@mysten/dapp-kit';
import { getFullnodeUrl } from '@mysten/sui/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';

const { networkConfig } = createNetworkConfig({
  testnet: { url: getFullnodeUrl('testnet') },
  mainnet: { url: getFullnodeUrl('mainnet') },
});

export function Web3Provider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 3,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
        <WalletProvider autoConnect>
          {children}
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | head -10`
Expected: No errors (dapp-kit already in dependencies)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/providers/web3-provider.tsx
git commit -m "feat(web): add Web3Provider with Sui dApp Kit + TanStack Query"
```

---

## Task 7: Auth Provider

**Files:**
- Create: `apps/web/src/providers/auth-provider.tsx`

- [ ] **Step 1: Create AuthProvider**

```tsx
// apps/web/src/providers/auth-provider.tsx
'use client';

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import type { AuthMethod, AuthState, Organisation, User } from '@/types';

interface AuthContextValue extends AuthState {
  login: (user: User, token: string, method: AuthMethod, org: Organisation | null) => void;
  logout: () => void;
  setOrg: (org: Organisation) => void;
  getToken: () => string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authMethod, setAuthMethod] = useState<AuthMethod | null>(null);
  const [currentOrg, setCurrentOrg] = useState<Organisation | null>(null);
  // JWT stored in ref — never in localStorage/sessionStorage.
  // Consumers must use getToken() to read the current value.
  // We do NOT expose accessToken in context to avoid stale ref reads.
  const tokenRef = useRef<string | null>(null);

  const login = useCallback(
    (u: User, token: string, method: AuthMethod, org: Organisation | null) => {
      setUser(u);
      setAuthMethod(method);
      setCurrentOrg(org);
      tokenRef.current = token;
    },
    [],
  );

  const logout = useCallback(() => {
    setUser(null);
    setAuthMethod(null);
    setCurrentOrg(null);
    tokenRef.current = null;
  }, []);

  const setOrg = useCallback((org: Organisation) => {
    setCurrentOrg(org);
  }, []);

  const getToken = useCallback(() => tokenRef.current, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken: null, // Always null — use getToken() instead. Kept for interface compat.
        authMethod,
        currentOrg,
        isAuthenticated: !!user,
        login,
        logout,
        setOrg,
        getToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
```

- [ ] **Step 2: Verify build**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | head -10`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/providers/auth-provider.tsx
git commit -m "feat(web): add AuthProvider with JWT-in-memory pattern"
```

---

## Task 8: Root Providers Wrapper

**Files:**
- Create: `apps/web/src/providers/index.tsx`

- [ ] **Step 1: Create Providers wrapper**

```tsx
// apps/web/src/providers/index.tsx
'use client';

import type { ReactNode } from 'react';
import { Web3Provider } from './web3-provider';

/**
 * Root-level client providers.
 * Keeps app/layout.tsx as a Server Component (preserves metadata exports).
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <Web3Provider>
      {children}
    </Web3Provider>
  );
}
```

Note: AuthProvider is NOT here — it goes in `(main)/layout.tsx` since `(auth)` routes don't need it.

> **TODO (Phase 2):** Add `import '@mysten/dapp-kit/dist/index.css'` to `web3-provider.tsx` for wallet modal styling when implementing wallet connect.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/providers/index.tsx
git commit -m "feat(web): add root Providers client wrapper"
```

---

## Task 9: API Client + Query Keys

**Files:**
- Create: `apps/web/src/lib/api/client.ts`
- Create: `apps/web/src/lib/api/query-keys.ts`

- [ ] **Step 1: Create fetch wrapper**

```ts
// apps/web/src/lib/api/client.ts

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/v1';

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

export class ApiClient {
  private getToken: () => string | null;
  private onUnauthorised: () => void;

  constructor(getToken: () => string | null, onUnauthorised: () => void) {
    this.getToken = getToken;
    this.onUnauthorised = onUnauthorised;
  }

  async fetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { body, headers: extraHeaders, ...rest } = options;
    const token = this.getToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...extraHeaders as Record<string, string>,
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    let attempts = 0;
    const maxRetries = 3;

    while (attempts <= maxRetries) {
      try {
        const res = await fetch(`${API_BASE}${path}`, {
          ...rest,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });

        if (res.status === 401) {
          // TODO: implement token refresh via POST /auth/refresh
          this.onUnauthorised();
          throw new ApiRequestError('Unauthorised', 'E_UNAUTHORISED', 401);
        }

        if (!res.ok) {
          const error = await res.json().catch(() => ({ message: res.statusText }));
          throw new ApiRequestError(
            error.message ?? 'Request failed',
            error.code ?? 'E_UNKNOWN',
            res.status,
            error.details,
          );
        }

        if (res.status === 204) return undefined as T;
        return (await res.json()) as T;
      } catch (err) {
        if (err instanceof ApiRequestError) throw err;
        // Only retry on network errors (TypeError from fetch)
        if (!(err instanceof TypeError)) throw err;
        attempts++;
        if (attempts > maxRetries) throw err;
        await new Promise(r => setTimeout(r, Math.pow(2, attempts) * 1000));
      }
    }

    throw new Error('Unreachable');
  }

  get<T>(path: string) {
    return this.fetch<T>(path, { method: 'GET' });
  }

  post<T>(path: string, body?: unknown) {
    return this.fetch<T>(path, { method: 'POST', body });
  }

  put<T>(path: string, body?: unknown) {
    return this.fetch<T>(path, { method: 'PUT', body });
  }

  delete<T>(path: string) {
    return this.fetch<T>(path, { method: 'DELETE' });
  }
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}
```

- [ ] **Step 2: Create query keys factory**

```ts
// apps/web/src/lib/api/query-keys.ts

export const queryKeys = {
  pools: {
    all:    ['pools'] as const,
    list:   (orgId: string) => ['pools', 'list', orgId] as const,
    detail: (poolId: string) => ['pools', 'detail', poolId] as const,
  },
  documents: {
    list:   (poolId: string) => ['documents', 'list', poolId] as const,
    detail: (docId: string)  => ['documents', 'detail', docId] as const,
  },
  comments:      (contextType: string, contextId: string) => ['comments', contextType, contextId] as const,
  checklist:     (poolId: string) => ['checklist', poolId] as const,
  reviews:       (docId: string)  => ['reviews', docId] as const,
  icDecisions:   (poolId: string) => ['ic-decisions', poolId] as const,
  audit:         (poolId: string) => ['audit', poolId] as const,
  members:       (poolId: string) => ['members', poolId] as const,
  notifications: ['notifications'] as const,
  billing:       ['billing'] as const,
} as const;
```

- [ ] **Step 3: Verify build**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | head -10`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/api/
git commit -m "feat(web): add API client with retry + query keys factory"
```

---

## Task 10: Permissions Hook

**Files:**
- Create: `apps/web/src/hooks/use-permissions.ts`

- [ ] **Step 1: Create permissions hook**

```ts
// apps/web/src/hooks/use-permissions.ts
import { ROLE, type RoleBitmask } from '@/types';

interface PoolContext {
  myRole: RoleBitmask;
  icCommitteeMembers?: string[]; // wallet addresses
}

export function usePermissions(pool: PoolContext | null, userAddress: string | null) {
  const role = pool?.myRole ?? 0;

  const isICMember = !!(
    userAddress &&
    pool?.icCommitteeMembers?.includes(userAddress)
  );

  return {
    canUpload:        (role & (ROLE.EDITOR | ROLE.OWNER | ROLE.ORG_ADMIN)) !== 0,
    canReview:        (role & (ROLE.REVIEWER | ROLE.EDITOR | ROLE.OWNER | ROLE.ORG_ADMIN)) !== 0,
    canManagePool:    (role & (ROLE.OWNER | ROLE.ORG_ADMIN)) !== 0,
    canVoteIC:        isICMember,
    canManageMembers: (role & (ROLE.OWNER | ROLE.ORG_ADMIN)) !== 0,
    canComment:       role !== 0,
    canViewAudit:     true,
  };
}
```

- [ ] **Step 2: Verify build**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | head -10`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/hooks/use-permissions.ts
git commit -m "feat(web): add usePermissions hook with role bitmask gating"
```

---

## Task 11: Route Group Restructure

This is the big structural change. Move existing pages into `(main)` route group, create `(auth)` group with placeholders.

**Files:**
- Create: `apps/web/src/app/(auth)/layout.tsx`
- Create: `apps/web/src/app/(auth)/login/page.tsx`
- Create: `apps/web/src/app/(auth)/onboarding/page.tsx`
- Create: `apps/web/src/app/(main)/layout.tsx`
- Create: `apps/web/src/app/(main)/page.tsx`
- Create: `apps/web/src/app/(main)/dashboard/page.tsx`
- Create: `apps/web/src/app/(main)/settings/page.tsx`
- Create: `apps/web/src/app/(main)/pools/[id]/documents/[docId]/page.tsx`
- Move: `apps/web/src/app/pools/` → `apps/web/src/app/(main)/pools/`
- Delete: `apps/web/src/app/page.tsx` (after moving content)
- Modify: `apps/web/src/app/layout.tsx` — remove MainLayout, wrap with Providers

- [ ] **Step 1: Create (auth) layout**

```tsx
// apps/web/src/app/(auth)/layout.tsx
import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Create login placeholder**

```tsx
// apps/web/src/app/(auth)/login/page.tsx
import { Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-primary/10">
          <Shield className="size-6 text-primary" />
        </div>
        <CardTitle className="text-xl">RWA DataRoom</CardTitle>
        <p className="text-sm text-muted-foreground">
          Sign in to access your data rooms
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Phase 2: zkLogin buttons + wallet connect */}
        <p className="text-center text-sm text-muted-foreground">
          Login implementation in S6 Session 2
        </p>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Create onboarding placeholder**

```tsx
// apps/web/src/app/(auth)/onboarding/page.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function OnboardingPage() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Welcome</CardTitle>
        <p className="text-sm text-muted-foreground">
          Create or join an organisation
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Phase 2: Create Org / Join Org forms */}
        <p className="text-center text-sm text-muted-foreground">
          Onboarding implementation in S6 Session 2
        </p>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Create (main) layout with AuthProvider**

```tsx
// apps/web/src/app/(main)/layout.tsx
import type { ReactNode } from 'react';
import { AuthProvider } from '@/providers/auth-provider';
import { MainLayout } from '@/components/layout/main-layout';

export default function MainGroupLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <MainLayout>{children}</MainLayout>
    </AuthProvider>
  );
}
```

- [ ] **Step 5: Create (main)/page.tsx redirect**

```tsx
// apps/web/src/app/(main)/page.tsx
import { redirect } from 'next/navigation';

export default function MainIndexPage() {
  redirect('/dashboard');
}
```

- [ ] **Step 6: Move existing page.tsx content to dashboard**

Copy the content of `apps/web/src/app/page.tsx` to `apps/web/src/app/(main)/dashboard/page.tsx`. Keep the content identical but update any imports if needed.

- [ ] **Step 7: Move existing pools/ directory**

```bash
cd apps/web/src/app
mkdir -p "(main)/pools"
cp -r pools/new "(main)/pools/new"
cp -r "pools/[id]" "(main)/pools/[id]"
```

- [ ] **Step 8: Create document preview placeholder**

```tsx
// apps/web/src/app/(main)/pools/[id]/documents/[docId]/page.tsx
import { ArrowLeft, Download } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default async function DocumentPreviewPage({
  params,
}: {
  params: Promise<{ id: string; docId: string }>;
}) {
  const { id, docId } = await params;

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-14 items-center gap-4 border-b px-4">
        <Button variant="ghost" size="icon-sm" render={<Link href={`/pools/${id}?tab=vdr`} />}>
          <ArrowLeft className="size-4" />
        </Button>
        <span className="text-sm font-medium">Document {docId}</span>
        <div className="flex-1" />
        <Button variant="outline" size="sm">
          <Download className="mr-2 size-4" />
          Download
        </Button>
      </header>
      <main className="flex flex-1 items-center justify-center text-muted-foreground">
        Document preview implementation in S6 Session 4
      </main>
    </div>
  );
}
```

- [ ] **Step 9: Create settings placeholder**

```tsx
// apps/web/src/app/(main)/settings/page.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Settings implementation in S6 Session 6
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 10: Update root layout.tsx**

Replace the entire `apps/web/src/app/layout.tsx` with:

```tsx
// apps/web/src/app/layout.tsx
import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { Providers } from '@/providers';
import './globals.css';

const inter = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'RWA DataRoom',
  description: 'Compliance-grade on-chain Virtual Data Room for structured credit',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 11: Delete old pages**

```bash
cd apps/web/src/app
rm page.tsx
rm -rf pools/
```

- [ ] **Step 12: Verify build**

Run: `cd apps/web && npx next build 2>&1 | tail -20`
Expected: Build succeeds with route groups correctly detected

- [ ] **Step 13: Commit**

```bash
cd /Users/ramonliao/Documents/Code/Project/Web3/BlockchainDev/SUI/Projects/BrineVault
git add apps/web/src/app/ apps/web/src/providers/
git commit -m "feat(web): restructure into (auth)/(main) route groups with providers"
```

---

## Task 12: Update Layout Components (Responsive Sidebar)

**Files:**
- Modify: `apps/web/src/components/layout/main-layout.tsx`
- Modify: `apps/web/src/components/layout/sidebar.tsx`
- Modify: `apps/web/src/components/layout/header.tsx`

- [ ] **Step 1: Read current layout files**

Read all three files to understand current structure before editing.

- [ ] **Step 2: Update main-layout.tsx for mobile support**

Replace `apps/web/src/components/layout/main-layout.tsx` with:

```tsx
// apps/web/src/components/layout/main-layout.tsx
'use client';

import { useState, type ReactNode } from 'react';
import { Header } from './header';
import { Sidebar } from './sidebar';

export function MainLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="relative min-h-screen bg-background">
      <Header onMenuToggle={() => setSidebarOpen(v => !v)} />

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="pt-16 lg:pl-64">
        <div className="mx-auto max-w-7xl p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Update sidebar.tsx for responsive collapse**

Replace `apps/web/src/components/layout/sidebar.tsx` with:

```tsx
// apps/web/src/components/layout/sidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, FolderOpen, Settings, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/pools', label: 'Pools', icon: FolderOpen },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-30 w-64 border-r bg-card pt-16 transition-transform duration-300',
        open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      )}
    >
      {/* Mobile close button */}
      <div className="flex items-center justify-end p-2 lg:hidden">
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      <nav className="space-y-1 px-3 py-2">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 4: Update header.tsx with mobile menu toggle**

Replace `apps/web/src/components/layout/header.tsx` with:

```tsx
// apps/web/src/components/layout/header.tsx
'use client';

import { Bell, Menu, Shield } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface HeaderProps {
  onMenuToggle: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center gap-4 border-b bg-background/80 backdrop-blur-md px-4">
      <Button
        variant="ghost"
        size="icon-sm"
        className="lg:hidden"
        onClick={onMenuToggle}
      >
        <Menu className="size-5" />
      </Button>

      <Link href="/dashboard" className="flex items-center gap-2">
        <Shield className="size-5 text-primary" />
        <span className="text-sm font-semibold tracking-tight">RWA DataRoom</span>
      </Link>

      <div className="flex-1" />

      <Button variant="ghost" size="icon-sm" className="relative">
        <Bell className="size-4" />
        <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-destructive" />
      </Button>

      {/* Phase 2: ConnectButton / user avatar */}
      <Button variant="outline" size="sm">
        Connect Wallet
      </Button>
    </header>
  );
}
```

- [ ] **Step 5: Verify build**

Run: `cd apps/web && npx next build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/layout/
git commit -m "feat(web): responsive sidebar with mobile overlay + header menu toggle"
```

---

## Task 13: Update Root Font in globals.css

**Files:**
- Modify: `apps/web/src/app/globals.css`

- [ ] **Step 1: Update font-sans in @theme block**

In `globals.css`, find the `@theme inline` block. The `--font-sans` line (currently `var(--font-sans)`) re-exports the Next.js font loader variable to Tailwind — keep this pattern. The root layout (Task 11) sets `inter.variable` as `--font-sans` via className, so no fallback chain needed.

Update the mono line to match:
```css
  --font-mono: var(--font-mono);
```

No need to add a `tabular-nums` utility — Tailwind v4 has it built-in.

- [ ] **Step 2: Verify fonts render correctly**

Run: `cd apps/web && npx next dev &` then check http://localhost:3000/login
Expected: Inter font loads, no FOUT

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "feat(web): switch font to Inter + JetBrains Mono, add tabular-nums"
```

---

## Task 14: Final Verification

- [ ] **Step 1: Full build check**

Run: `cd apps/web && npx next build 2>&1 | tail -30`
Expected: Build succeeds, all routes detected:
- `/(auth)/login`
- `/(auth)/onboarding`
- `/(main)` (redirect)
- `/(main)/dashboard`
- `/(main)/pools/new`
- `/(main)/pools/[id]`
- `/(main)/pools/[id]/documents/[docId]`
- `/(main)/settings`

- [ ] **Step 2: TypeScript strict check**

Run: `cd apps/web && npx tsc --noEmit 2>&1`
Expected: No errors

- [ ] **Step 3: Verify dev server**

Run: `cd apps/web && npx next dev`
Manually check:
- `http://localhost:3000/login` — centred card, no sidebar
- `http://localhost:3000/dashboard` — sidebar + header + pool cards
- `http://localhost:3000/pools/new` — wizard inside main layout
- `http://localhost:3000/settings` — placeholder card

- [ ] **Step 4: Final commit (if any unstaged changes)**

```bash
git status
# If clean, skip. Otherwise:
git add -A apps/web/
git commit -m "chore(web): S6 Session 1 cleanup"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Shared types | `types/index.ts` |
| 2 | Design tokens (success/warning) | `globals.css` |
| 3 | Badge variants | `badge.tsx` |
| 4 | Glassmorphism dialog | `dialog.tsx` |
| 5 | Error boundary (component only; wired into tabs/encryption/wallet in Phase 3-4) | `error-boundary.tsx` |
| 6 | Web3 provider | `providers/web3-provider.tsx` |
| 7 | Auth provider | `providers/auth-provider.tsx` |
| 8 | Root providers wrapper | `providers/index.tsx` |
| 9 | API client + query keys | `lib/api/client.ts`, `lib/api/query-keys.ts` |
| 10 | Permissions hook | `hooks/use-permissions.ts` |
| 11 | Route group restructure | 11 files created/moved/deleted |
| 12 | Responsive layout components | 3 layout files updated |
| 13 | Font update | `globals.css` |
| 14 | Final verification | Build + type check + dev server |
