# S6 Frontend Migration Design

**Date:** 2026-03-19
**Scope:** Migrate `packages/frontend/` (Vite SPA) UI into `apps/web/` (Next.js 16 App Router), add missing features per spec, delete old frontend.

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Base | `apps/web/` (Next.js 16) | Modern stack: App Router, shadcn v4, oklch, dark mode, Sui SDK v2.7 |
| UI Style | Migrate `packages/frontend/` patterns into apps/web | Preserve existing RWD, CSS, component feel |
| Colour System | Convert hex → oklch equivalents | Tailwind v4 native, better gradients & dark mode |
| Old Frontend | Delete `packages/frontend/` after Phase 3 | Keep as reference until core flows ported, then delete |
| Routing | Hybrid — Pool Detail uses tabs (searchParams), Document Preview is separate page | Tabs for fluid UX, full page for preview (PDF.js, watermark). **Deviates from implementation-architecture.md** which uses nested routes — consolidated here for better UX; impl-arch to be updated. |
| Login | Dual: zkLogin (Google/Apple) + Wallet Connect | Reduce web2 user friction |
| Approach | Incremental (7 phases, 1 session each) | Low risk, independently verifiable |

---

## 1. Design System

### Colour Mapping (hex → oklch)

| Token | Hex | oklch | Usage |
|-------|-----|-------|-------|
| `--color-primary` | `#007BFF` | `oklch(0.58 0.17 255)` | Trust Blue |
| `--color-bg` | `#f8fafc` | `oklch(0.98 0.005 260)` | Page background |
| `--color-surface` | `#ffffff` | `oklch(1 0 0)` | Card background |
| `--color-ink` | `#1A1C29` | `oklch(0.2 0.03 270)` | Primary text |
| `--color-ink-muted` | `#64748B` | `oklch(0.55 0.03 260)` | Secondary text |
| `--color-border` | `#e2e8f0` | `oklch(0.93 0.01 260)` | Borders |
| `--color-success` | `#10B981` | `oklch(0.7 0.17 165)` | Approved |
| `--color-warning` | `#F59E0B` | `oklch(0.75 0.16 75)` | Pending / Warning |
| `--color-danger` | `#EF4444` | `oklch(0.63 0.21 25)` | Rejected / Error |

### Shadcn Token Mapping

- `--primary` = `--color-primary`
- `--background` = `--color-bg`
- `--card` = `--color-surface`
- `--foreground` = `--color-ink`
- `--muted-foreground` = `--color-ink-muted`
- `--border` = `--color-border`
- `--destructive` = `--color-danger`
- **New:** `--success` = `--color-success`, `--warning` = `--color-warning`

### Typography

- Primary: `Inter`
- Monospace: `JetBrains Mono`
- Financial numbers: `font-variant-numeric: tabular-nums`

### Component Style Migration

| Pattern | Source (packages/frontend) | Target (apps/web) |
|---------|--------------------------|-------------------|
| Card: `rounded-xl border p-6` | Hand-crafted | Extend shadcn `<Card>` |
| Glassmorphism: `bg-slate-900/50 backdrop-blur-sm` | PoolCreationWizard modal | Extend shadcn `<Dialog>` overlay |
| Status Badge: `inline-flex gap-1.5 px-2 py-0.5 rounded text-xs` | Hand-crafted | Add shadcn `<Badge>` variants: success, warning, danger |
| Input focus: `focus:ring-1 focus:ring-primary` | Hand-crafted | Already in shadcn `<Input>` |

---

## 2. Route Structure

### App Router Layout

```
apps/web/src/app/
├── (auth)/                         # No sidebar layout
│   ├── login/page.tsx              # zkLogin + Wallet Connect
│   └── onboarding/page.tsx         # Create Org / Join Org
├── (main)/                         # Sidebar + Header layout
│   ├── layout.tsx                  # MainLayout wrapper + AuthProvider
│   ├── page.tsx                    # Redirect → /dashboard
│   ├── dashboard/page.tsx          # Pool list + stats
│   ├── pools/
│   │   ├── new/page.tsx            # Pool Creation Wizard (5 steps)
│   │   └── [id]/
│   │       ├── page.tsx            # Pool Detail (6 tabs via searchParams)
│   │       └── documents/
│   │           └── [docId]/page.tsx # Document preview (full screen)
│   └── settings/
│       └── page.tsx                # Profile + Notifications + Billing
└── globals.css
```

### Route Groups

- `(auth)` — Login/onboarding, no sidebar/header
- `(main)` — All authenticated pages, shared MainLayout

### Pool Detail Tabs (via `?tab=`)

| searchParam | Tab Content |
|-------------|-------------|
| `vdr` (default) | Virtual Data Room: folder tree + file list + review drawer |
| `checklist` | DD Checklist: progress bars + per-item table + gate conditions |
| `reviews` | Reviews: per-document reviewer status + submit review |
| `ic` | IC Decisions: vote panel + tally + RequestChanges |
| `audit` | Audit Trail: timeline + filters + JSON/CSV export |
| `members` | Member Management: list + add/remove |

### Document Preview (`/pools/[id]/documents/[docId]`)

- Full-screen layout (exits main layout)
- **Top bar:** Back button (→ pool VDR tab) + pool name breadcrumb + document title + download button
- PDF.js / native image / Monaco Editor (readonly) / download prompt
- Canvas watermark overlay (truncated address + UTC timestamp)
- Version history sidebar (desktop) / bottom sheet (mobile)

---

## 3. Directory Structure

```
apps/web/src/
├── app/                        # Next.js App Router pages
├── components/
│   ├── layout/                 # Header, Sidebar, MainLayout
│   ├── ui/                     # shadcn primitives
│   ├── pool/                   # PoolCard, PoolCreationWizard, PoolStateBadge
│   ├── vdr/                    # FolderTree, FileList, ReviewDrawer
│   ├── checklist/              # ChecklistTable, GateConditionBadge
│   ├── review/                 # ReviewPanel, ReviewerStatus
│   ├── ic/                     # ICVotePanel, VoteTally
│   ├── audit/                  # AuditTimeline, AuditFilters
│   ├── member/                 # MemberList, AddMemberDialog
│   ├── document/               # DocumentPreview, VersionTimeline
│   ├── comment/                # CommentThread, CommentInput
│   ├── billing/                # SubscriptionCard, InvoiceTable
│   └── auth/                   # WalletConnect, ZkLoginButtons, OnboardingForm
├── hooks/                      # useAuth, usePool, useDocuments, useEncryption, usePermissions
├── lib/
│   ├── api/                    # TanStack Query hooks + fetch wrapper + query-keys
│   ├── encryption/             # AES-256-GCM + Seal client-side
│   ├── walrus/                 # Direct upload/download
│   ├── sui/                    # TX helpers, zklogin.ts
│   └── utils.ts                # cn(), formatAddress()
├── providers/                  # Web3Provider, AuthProvider
└── types/                      # Shared TypeScript types
```

---

## 4. Provider Architecture

### Provider Stack

```tsx
// app/layout.tsx (root)
<QueryClientProvider>
  <SuiClientProvider networks={networks} defaultNetwork="testnet">
    <WalletProvider autoConnect>
      {children}
    </WalletProvider>
  </SuiClientProvider>
</QueryClientProvider>

// app/(main)/layout.tsx
<AuthProvider>
  <MainLayout>
    {children}
  </MainLayout>
</AuthProvider>
```

### State Management

| State Type | Method | Examples |
|------------|--------|----------|
| Server state | TanStack Query | pools, documents, notifications, billing, comments |
| Auth state | AuthProvider (context) | JWT, user, current org, role, authMethod |
| URL state | searchParams / pathname | active tab, current pool/doc |
| UI state | Component local state | sidebar open, wizard step, modal open |
| Wallet state | Sui dApp Kit (built-in) | connected wallet, network |

### TanStack Query Key Convention

```ts
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
  notifications: ['notifications'] as const,
  billing:       ['billing'] as const,
} as const;
```

### API Layer

```
lib/api/client.ts       — fetch wrapper: auto JWT header, 401 refresh, error envelope
lib/api/hooks/           — one file per backend module
  use-auth.ts            — useLogin(), useLogout(), useRefresh()
  use-pools.ts           — usePoolList(), usePoolDetail(), useCreatePool(), useTransitionPool()
  use-documents.ts       — useDocumentList(), useUploadDocument(), useDocumentPreview()
  use-comments.ts        — useComments(), useCreateComment()
  use-checklist.ts       — useChecklist(), useUpdateChecklistItem()
  use-reviews.ts         — useReviews(), useSubmitReview()
  use-ic-decisions.ts    — useICDecisions(), useSubmitVote()
  use-audit.ts           — useAuditEvents(), useExportAudit()
  use-members.ts         — useMembers(), useAddMember(), useRemoveMember()
  use-notifications.ts   — useNotifications(), useMarkRead()
  use-billing.ts         — useSubscription(), useInvoices()
```

---

## 5. Authentication

### Dual Login: zkLogin + Wallet

**Login Page Layout:**
- zkLogin buttons (Google, Apple) — primary, top position
- Divider: "or"
- Wallet Connect button — secondary

### zkLogin Flow

```
Click "Sign in with Google"
→ Generate ephemeral keypair (sessionStorage)
→ Redirect to Google OAuth
→ Google callback returns id_token
→ Send JWT to salt server → user_salt
→ Generate ZK proof (Mysten proving service)
→ Derive Sui address: hash(iss + sub + salt)
→ POST /auth/verify-zklogin { jwt, zkProof, ephemeralPubKey, salt }
→ Backend verifies → issues app JWT
→ AuthProvider stores JWT in memory
→ Redirect /dashboard or /onboarding
```

> **Backend dependency:** `/auth/verify-zklogin` is a new endpoint not in the current backend.
> Must be implemented before Phase 2. Request/response contract:
> - Request: `{ jwt: string, zkProof: ZkLoginProof, ephemeralPubKey: string, maxEpoch: number, salt: string }`
> - Response: `{ access_token: string, user: User }` (same shape as `/auth/verify`)

### Wallet Connect Flow

```
Click "Connect Wallet" (Sui dApp Kit)
→ GET /auth/challenge → { nonce, timestamp }
→ Sign message in wallet
→ POST /auth/verify { signature, publicKey }
→ Backend verifies → issues app JWT
→ AuthProvider stores JWT in memory
→ Redirect /dashboard or /onboarding
```

### AuthProvider State

```ts
interface AuthState {
  user: User | null;
  accessToken: string | null;       // memory only, never localStorage
  authMethod: 'wallet' | 'zklogin' | null;
  currentOrg: Organisation | null;
  isAuthenticated: boolean;
}
```

### TX Signing (auth-method aware)

```ts
// hooks/use-sign-and-submit.ts
function useSignAndSubmit() {
  const { authMethod } = useAuth();

  return async (txBytes: string) => {
    if (authMethod === 'wallet') {
      // Sui dApp Kit: wallet.signTransaction(txBytes)
    } else {
      // zkLogin: sign with ephemeral key + attach ZK proof
    }
    // POST signed TX to backend → backend submits to Sui
  };
}
```

### Security

- JWT stored in memory only (React ref)
- Refresh token via httpOnly cookie
- 401 → auto refresh → fail → redirect `/login`
- Ephemeral keypair (zkLogin) in sessionStorage only
- ZK proof has expiry (~1 hr), background refresh needed

### OAuth Providers (Phase 1)

- Google — largest user base, required
- Apple — iOS users, recommended
- Twitch — optional, defer to Phase 7

---

## 6. Client-Side Encryption & Walrus

### Encryption Hook

```ts
// hooks/use-encryption.ts
// Internally uses wallet provider (dApp Kit or ephemeral key) to decrypt folder keys from Sui.
function useEncryption(poolId: string) {
  return {
    encryptFile:  (file: File, folderId: string) => Promise<EncryptedBlob>,
    decryptBlob:  (blob: ArrayBuffer, folderId: string) => Promise<ArrayBuffer>,
    verifyHash:   (plaintext: ArrayBuffer, expectedHash: string) => Promise<boolean>,
  };
}
```

### AES-256-GCM Flow (Production)

1. Fetch encrypted folder key from Sui (Pool dynamic field)
2. Decrypt folder key with user's keypair (Web Crypto API)
3. Encrypt: random IV (12 bytes) + AES-256-GCM → `[IV | ciphertext | authTag]`
4. Compute SHA-256 of plaintext
5. Upload encrypted blob to Walrus
6. POST metadata to backend (blobId, contentHash, size)

### Seal Flow (Beta)

- Same hook interface
- Step 2 differs: request key shares from Seal servers → Shamir reconstruct
- Pool's `encryptionScheme` determines which path

### Walrus Client

```ts
// lib/walrus/client.ts
class WalrusClient {
  upload(encrypted: ArrayBuffer, epochs: number): Promise<WalrusResult>
  download(blobId: string): Promise<ArrayBuffer>
  uploadChunked(file: File, key: CryptoKey, epochs: number): Promise<ChunkedResult>
}
```

- Small files (<=50MB): single upload
- Large files (>50MB): 10MB chunks, 3 concurrent, per-chunk retry (3x exponential backoff)
- **Note:** Chunking threshold standardised at 50MB across all specs (system-architecture.md to be updated if inconsistent)
- Progress callback for UI progress bars

### File Preview

| MIME Type | Renderer |
|-----------|----------|
| `application/pdf` | PDF.js (react-pdf) |
| `image/*` | `<img>` native |
| `text/*`, `json`, `csv` | Monaco Editor (readonly) |
| Other | Download prompt |

### Security Rules

- Private key never leaves wallet — all signing via dApp Kit or ephemeral key
- Plaintext never sent to backend — encrypt/decrypt in browser only
- Folder key in memory only, cleared on component unmount
- IV random per encryption, never reused
- SHA-256 verification mandatory after decrypt, abort on mismatch

---

## 7. Review & Revision Cycle (NEW)

### Comment System (all tabs)

Context-aware comment threads attached to any entity:

```
POST /v1/pools/{poolId}/comments
{
  context_type: 'document' | 'checklist_item' | 'review' | 'ic_decision' | 'general',
  context_id:   string,
  body:         string,     // markdown
  mentions:     string[],   // wallet addresses to notify
}
```

**UI:**
- Document row: comment count badge
- ReviewDrawer: comment thread at bottom
- Checklist item: expandable comment section
- IC vote: comment attached to each vote
- General comments in Audit tab

### Document Review — Multi-Round Cycle

```
Upload v1 → Pending Review → Approved
                  │
                  ▼
            NeedsRevision → Originator notified
                  │              │
                  │              ▼
                  │         Upload v2 (new version)
                  │              │
                  │              ▼
                  └──── Re-submit (status → Pending)
```

**Actions:**

| Action | Role | Requirement |
|--------|------|-------------|
| Approve | Reviewer | Optional comment |
| Request Revision | Reviewer | **Mandatory** comment (explain why) |
| Re-submit | Editor/Owner | Upload new version, all reviewer statuses reset to Pending |

### Pool State — Reverse Transitions

New backward transitions added to state machine:

| Transition | Who | Requirement |
|-----------|-----|-------------|
| IC_Review → DD_In_Progress | IC member (vote: RequestChanges) | Mandatory comment |
| DD_In_Progress → Draft | Owner | Mandatory comment |
| Approved_Internal → DD_In_Progress | Owner / ORG_ADMIN | Mandatory comment |

**UI:** Pool header action dropdown includes "Send Back" button → dialog with target state selector + mandatory comment.

### Checklist Item — Revision Cycle

```
Reviewed → NeedsRevision    (Reviewer rejects item)
NeedsRevision → Uploaded    (Originator re-uploads linked doc)
Uploaded → Reviewed          (Reviewer re-approves)
```

All status changes require a comment.

### IC Decision — RequestChanges

Three vote options (was two):

| Vote | Effect |
|------|--------|
| Approve | Positive vote |
| Reject | Pool → Rejected (terminal) |
| RequestChanges | If majority → Pool state reverts to DD_In_Progress; IC comments consolidated as "IC Feedback" notification to Owner |

### Move Contract Upgrade — Precise Scope

**Already exists in contracts:**
- `IC_REQUEST_CHANGES` (value 2) in `types.move`
- `record_ic_request_changes` (IC_REVIEW → DD_IN_PROGRESS) in `pool_entry.move`
- `is_valid_transition`: `ic_review → dd_in_progress` and `rejected → draft` already allowed

**Must be added:**
- `DD_IN_PROGRESS → Draft` reverse transition in `is_valid_transition` (currently only allows `draft → dd`)
- `Approved_Internal → DD_IN_PROGRESS` reverse transition (currently only allows `approved → ready`)

**Scheduled for Phase 5a (Move upgrade first, then frontend tabs).**

---

## 8. Role-Based UI Gating

```ts
// hooks/use-permissions.ts
const VIEWER    = 1;
const REVIEWER  = 2;
const EDITOR    = 4;
const OWNER     = 8;
const AUDITOR   = 16;
const ORG_ADMIN = 32;

function usePermissions() {
  const { user, currentPool } = useAuth();
  const role = currentPool?.myRole ?? 0;

  return {
    canUpload:       (role & (EDITOR | OWNER | ORG_ADMIN)) !== 0,
    canReview:       (role & (REVIEWER | EDITOR | OWNER | ORG_ADMIN)) !== 0,
    canManagePool:   (role & (OWNER | ORG_ADMIN)) !== 0,
    canVoteIC:       isICCommitteeMember(user, currentPool),  // check pool.ic_committee membership, not just role bitmask
    canManageMembers:(role & (OWNER | ORG_ADMIN)) !== 0,
    canComment:      role !== 0,  // all roles except no-role
    canViewAudit:    true,
  };
}
```

- Buttons: hidden or disabled with tooltip based on `canX`
- Backend also enforces via guards — frontend is UX only

---

## 9. Migration Phases

### Phase 1 — Design System + Foundation (S6 Session 1)

- Unify globals.css (oklch colours, success/warning tokens)
- Extend shadcn components (Badge variants, Dialog glassmorphism)
- Migrate layout patterns from packages/frontend
- Provider stack (AuthProvider, Web3Provider) — root layout uses `<Providers>` client component wrapper
- `lib/api/client.ts` fetch wrapper + query-keys
- `hooks/use-permissions.ts` role bitmask
- Route group structure `(auth)` / `(main)`
- React Error Boundaries: one per Pool Detail tab, one around encryption/upload, one around wallet interactions
- `packages/frontend/` remains as read-only reference (deleted in Phase 3)

**Output:** Runnable skeleton — empty pages, layout + providers + error boundaries complete

### Phase 2 — Login + Onboarding + Dashboard (S6 Session 2)

- **Backend prerequisite:** implement `/auth/verify-zklogin` endpoint before this phase
- Login page: zkLogin (Google/Apple) + Wallet Connect
- `lib/sui/zklogin.ts`: ephemeral keypair, OAuth redirect, ZK proof
- Onboarding page: Create/Join Org
- Dashboard: stats cards + pool list + pagination
- `lib/api/hooks/use-auth.ts`, `use-pools.ts`

**Output:** Full login → onboarding → pool list flow

### Phase 3 — Pool Creation + Pool Detail Skeleton (S6 Session 3)

- Pool Creation Wizard (5 steps, migrated UI + API + TX signing)
- Pool Detail page skeleton: header + tab bar + 6 tab containers
- `useSignAndSubmit()` hook (shared TX signing)
- VDR tab: FolderTree + FileList (UI only)

- Delete `packages/frontend/` (core flows now ported)

**Output:** Create pool, enter pool detail, see VDR structure

### Phase 4 — Encryption + Walrus + Document Flow (S6 Session 4)

- `lib/encryption/aes.ts`: AES-256-GCM (Web Crypto API)
- `lib/walrus/client.ts`: upload/download + chunked
- Document upload: encrypt → Walrus → POST metadata
- Document download + preview: fetch → decrypt → verify → render
- Document Preview page (`/pools/[id]/documents/[docId]`)
- Watermark overlay

**Output:** Full document upload → encrypt → download → preview flow

### Phase 5a — Move Upgrade + Comments Backend + Checklist + Reviews (S6 Session 5a)

- **Move contract upgrade:** add `DD_IN_PROGRESS → Draft` and `Approved_Internal → DD_IN_PROGRESS` transitions
- **Comments backend module:** new NestJS module with `POST/GET /comments` endpoints (DB table exists)
- DD Checklist tab (revision cycle, gate conditions)
- Reviews tab (multi-round review cycle)
- Comment thread UI component

**Output:** Move contracts upgraded, comments API ready, checklist + reviews tabs functional

### Phase 5b — IC + Audit + Members + Send Back (S6 Session 5b)

- IC Decision tab (Approve / Reject / RequestChanges)
- Audit tab (timeline, filters, JSON/CSV export)
- Members tab (add/remove, role assignment)
- Pool state "Send Back" mechanism (reverse transitions UI)

**Output:** All Pool Detail tabs functional

### Phase 6 — Settings + Notifications + Polish (S6 Session 6)

- Settings: Profile + Notification prefs + Billing/Subscription
- Notification bell (header) + notification panel
- Grace period banners
- Seal Beta integration (`lib/encryption/seal.ts`)
- Loading states (skeleton screens), error toasts
- RWD fine-tuning + mobile testing

**Output:** Feature complete

### Phase 7 — zkLogin Polish + E2E (S6 Session 7, or merge into S7)

- zkLogin proof refresh mechanism
- Apple / Twitch provider support
- E2E tests (Playwright)
- Cross-browser testing

### Dependency Graph

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5a → Phase 5b → Phase 6 → Phase 7
                                          (delete old FE)
```

- Phase 3: delete `packages/frontend/` after core flows ported
- Phase 4 must precede Phase 5a (reviews need documents to exist)
- Phase 5a must precede Phase 5b (comments + Move upgrade needed for IC/audit/send-back)
- Total: 8 sessions (was 7)

---

## 10. Spec Updates Required

The following additions to the system spec are needed to support the review/revision cycle:

1. **Comment system** — new `POST/GET /comments` endpoints, context-aware threading
2. **Document review multi-round** — Re-submit action resets reviewer statuses
3. **Pool state reverse transitions** — IC_Review→DD, DD→Draft, Approved→DD
4. **IC RequestChanges vote** — third option, majority triggers state revert
5. **Checklist item revision** — Reviewed→NeedsRevision→Uploaded→Reviewed cycle
6. **Move contract changes** — reverse transitions in state machine, REQUEST_CHANGES enum variant

These will be incorporated into `specs/system-architecture.md` during Phase 5a planning.

---

## 11. Network Failure & Error Handling

### Retry Policies

| Service | Retry | Backoff | User-Facing |
|---------|-------|---------|-------------|
| Backend API | 3 attempts | Exponential (1s, 2s, 4s) | Toast: "Request failed, retrying..." then "Network error, please try again" |
| Walrus upload | 3 per chunk | Exponential | Progress bar + "Retry" button on failure |
| Walrus download | 3 attempts | Exponential | "File temporarily unavailable, please try again" |
| Sui RPC | 3 attempts | Exponential | "Blockchain service temporarily unavailable" |
| Wallet disconnect | N/A | N/A | "Reconnect Wallet" button in header |

### Graceful Degradation

- Walrus down → upload/download disabled, other features work normally
- Sui RPC down → read-only mode (data from PostgreSQL), TX signing disabled
- Backend down → full app offline, show maintenance page
- Never auto-fallback encryption engines

---

## 12. Deletion Plan

After Phase 3 (core flows ported):
- Delete `packages/frontend/` directory entirely
- Remove from `pnpm-workspace.yaml` if listed
- Git history preserves all original code for reference
