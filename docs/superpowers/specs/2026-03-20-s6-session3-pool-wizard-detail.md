# S6 Session 3 — Pool Creation Wizard + Pool Detail

**Date:** 2026-03-20
**Status:** Draft
**Scope:** Frontend only — `apps/web/`
**Depends on:** S6 Session 2 (auth, dashboard, shared types), Backend pool + document APIs

---

## 1. Goals

- Complete the 5-step pool creation wizard with form state, validation, DnD checklist, member invite, and Sui TX signing
- Build the pool detail page with 6-tab skeleton, live VDR tab, and real pool data
- Establish shared components (state badge, folder tree, document list) for reuse in later sessions

## 2. Non-Goals

- Document upload / download (Session 4 — encryption + Walrus)
- Document review actions: approve, reject, request changes (Session 5a)
- Checklist gate logic, IC voting, audit trail, member management (Sessions 5a/5b)
- Mobile responsive layout (Session 7)

---

## 3. Pool Creation Wizard (`/pools/new`)

### 3.1 Architecture

Page-centric design. `NewPoolPage` owns all form state via a single `useReducer`. Each step is a child component receiving state + dispatch.

```
NewPoolPage (page.tsx)
├── StepIndicator       — extracted, reusable 5-dot progress
├── StepBasicInfo       — name, borrower, notional, currency, maturity
├── StepEncryption      — AES vs Seal card selector
├── StepChecklist       — @dnd-kit sortable + toggle + add/delete
├── StepMembers         — multi-row address + role input
├── StepReview          — read-only summary + edit buttons per section
└── Footer              — Back / Next / Confirm & Submit
```

### 3.2 Form State

```typescript
interface PoolFormState {
  // Step 1
  name: string;                // ≤256 chars
  borrowerEntity: string;      // plaintext; SHA-256 hashed to borrowerNameHash on submit
  targetNotional: string;      // string for input, parse to bigint on submit
  currency: string;            // default "USD"
  maturityDate: string;        // ISO date string (YYYY-MM-DD)
  tags: string[];              // optional tags, default []

  // Step 2
  encryptionScheme: 0 | 1;     // 0 = AES-256, 1 = Seal
  sealBetaAcknowledged: boolean; // required when encryptionScheme === 1

  // Step 3
  checklistItems: ChecklistItem[];

  // Step 4
  members: MemberInvite[];

  // Meta
  currentStep: number;         // 0–4
  errors: Record<string, string>;
  isSubmitting: boolean;
}

interface ChecklistItem {
  id: string;                  // nanoid for DnD key
  folderId: number;            // which folder this item belongs to
  label: string;
  description: string;         // carried from template, editable
  requirementLevel: 'required' | 'recommended' | 'optional';
  expectedDocType: number;     // from DOC_TYPES constant
  sortOrder: number;
}

interface MemberInvite {
  id: string;                  // nanoid for list key
  address: string;
  role: number;                // bitmask: VIEWER=1, REVIEWER=2, EDITOR=4
}
```

**Submit-time transformations (not stored in form state):**
- `adminConfigId` — read from environment config (`NEXT_PUBLIC_ADMIN_CONFIG_ID`)
- `orgIdHash` — derived from `AuthProvider.currentOrg.id` (SHA-256 hash)
- `borrowerNameHash` — SHA-256 hash of `borrowerEntity`
- `targetNotional` — parse string to `bigint`
- `expectedMaturityDate` — parse ISO date to Unix timestamp
- Members are added via separate `POST /pools/:poolId/dataroom/members` calls after pool creation TX succeeds (not part of `POST /pools` payload). Each call sends `{ adminConfigId, address, role, tags: [] }` — `adminConfigId` from env config, `address` and `role` from form state.

### 3.3 Step Details

**Step 1 — Basic Info**

| Field | Type | Validation | Required |
|-------|------|-----------|----------|
| Pool Name | text | non-empty, ≤256 chars | yes |
| Borrower Entity | text | non-empty, ≤256 chars | yes |
| Target Notional | number | > 0, numeric | yes |
| Currency | text | non-empty, default "USD" | yes |
| Maturity Date | date | must be future date | yes |

Inline error messages below each field. "Next" button disabled until all required fields pass validation.

**Step 2 — Encryption Engine**

Two card-style radio buttons (existing UI). Wire selected state to `encryptionScheme`. AES-256 selected by default. When Seal is selected, show a confirmation checkbox: "I understand this is a Beta feature" — must be checked before proceeding (`sealBetaAcknowledged` in form state).

**Step 3 — DD Checklist Customization**

- Pre-populated from `DEFAULT_DD_CHECKLIST_ITEMS` in `@rwa-dataroom/shared` (preserves `folderId`, `description`, `requirementLevel`, `expectedDocType`)
- Each item rendered as a sortable row via `@dnd-kit/sortable`
- Row layout: `[drag handle ⠿] [label text] [requirement badge] [✕ delete]`
- Click badge to cycle: Required → Recommended → Optional → Required
- "Add Custom Item" button at bottom — inline text input + Enter to confirm
- Drag to reorder updates `sortOrder`
- Minimum 1 item required to proceed

**Step 4 — Invite Initial Members**

- Multi-row form: `[Sui address input] [role dropdown: Editor(4)|Reviewer(2)|Viewer(1)] [✕ remove]`
- Role dropdown displays human labels but stores numeric bitmask values
- Address validation: `/^0x[a-fA-F0-9]{64}$/`
- No duplicate addresses allowed
- Cannot invite self (compare with connected wallet address)
- "Add Member" button to append a new empty row
- Entire step is skippable — "Skip for now" link below the card, proceeds to Step 5

**Step 5 — Review & Confirm**

- Read-only summary grid showing all form data
- Each section (Basic Info, Encryption, Checklist, Members) has an "Edit" button that jumps to the corresponding step; after editing, user returns to Step 5
- Summary shows: pool name, borrower, target size + currency, maturity date, encryption engine, checklist item count (X required / Y optional), member count
- "Confirm & Submit" triggers the TX signing flow
- Disclaimer text: "By clicking submit, you will be prompted to sign a Sui Transaction to create this pool on-chain."

### 3.4 TX Signing Flow

```
1. User clicks "Confirm & Submit"
2. Set isSubmitting = true, disable button, show spinner
3. Transform form data:
   - SHA-256 hash borrowerEntity → borrowerNameHash
   - Derive orgIdHash from AuthProvider.currentOrg.id
   - Read adminConfigId from env config
   - Parse targetNotional to bigint, maturityDate to Unix timestamp
4. Frontend calls POST /pools with transformed DTO (camelCase)
   → Backend builds unsigned TX
   → Returns { txBytes: string, poolId: string }
5. Frontend calls useSignAndSubmit (branches by authMethod: wallet vs zkLogin)
   → Wallet: dApp Kit signTransaction(txBytes)
   → zkLogin: sign with ephemeral keypair
6. User signs → Frontend calls POST /pools/:poolId/sign with { txBytes, signature }
   → Backend submits TX to chain
   → Returns { txDigest: string }
7. If members were added in Step 4:
   → Call POST /pools/:poolId/dataroom/members for each member (fire sequentially)
8. router.push(`/pools/${poolId}`) — redirect to new pool detail
```

**Error handling:**

| Step | Error | Action |
|------|-------|--------|
| 4 (POST /pools) | Network / server error | Toast "Failed to build transaction", reset isSubmitting |
| 5 (signTransaction) | User rejects in wallet | Toast "Transaction cancelled", reset isSubmitting, stay on wizard |
| 6 (POST /sign) | TX submission fails | Toast "Transaction failed" + retry button |
| 7 (POST /members) | Member add fails | Toast "Pool created but some members failed to add" + continue to detail |

### 3.5 New Dependency

```
@dnd-kit/core
@dnd-kit/sortable
@dnd-kit/utilities
```

---

## 4. Pool Detail Page (`/pools/[id]`)

### 4.1 Architecture

```
PoolDetailPage (page.tsx)
├── PoolHeader          — back link, pool name, state badge, Upload btn (disabled)
├── PoolSidebar         — Pool Details card + Progress card
└── PoolTabs            — 6 tabs via searchParams
    ├── TabVdr          — FolderTree + DocumentList (live API)
    ├── TabChecklist    — placeholder
    ├── TabReviews      — placeholder
    ├── TabIc           — placeholder
    ├── TabAudit        — placeholder
    └── TabMembers      — placeholder
```

### 4.2 Layout

Desktop (≥1280px): 4-column grid. Sidebar = 1 col (260px), main tabs = 3 col.

- **Header:** Back to Dashboard link, pool name (from API), state badge, Upload Document button (disabled with "Soon" tooltip)
- **Sidebar:** Pool Details card (borrower, target size, encryption, maturity, created date) + Progress card (checklist completion %, derived from API when checklist tab is implemented; shows 0% for now)
- **Tabs:** Full-width in main area, tab bar with 6 entries

### 4.3 Tab Routing

URL-driven via `useSearchParams()`:

| URL | Active Tab |
|-----|-----------|
| `/pools/:id` | vdr (default) |
| `/pools/:id?tab=vdr` | VDR |
| `/pools/:id?tab=checklist` | DD Checklist |
| `/pools/:id?tab=reviews` | Reviews |
| `/pools/:id?tab=ic` | IC Decisions |
| `/pools/:id?tab=audit` | Audit Trail |
| `/pools/:id?tab=members` | Members |

Tab clicks call `router.replace()` to update URL without full page navigation. Invalid `?tab=` value falls back to `vdr`.

### 4.4 VDR Tab (Live)

Two-panel layout:

**Left panel — FolderTree (200px):**
- Renders `DEFAULT_FOLDERS` from shared constants (Legal, Financials, Collateral, Compliance, Reports, Misc)
- Click a folder → sets active `folderId`, filters document list
- "All" option at top to show all documents
- Active folder highlighted with primary background

**Right panel — DocumentList:**
- Table with columns: Name (+ version + filename), Status badge, Updated (relative time), Actions (⋯ menu)
- Data from `useDocuments(poolId)`, filtered client-side by active `folderId`
- Loading: skeleton rows
- Empty state: "No documents in this folder yet" with file icon
- Actions menu: "View Details" only (no review/download actions in Session 3)
- Click document row → navigate to `/pools/:poolId/documents/:docId` (stub page)

### 4.5 Placeholder Tabs

Tabs not implemented in Session 3 show a centered placeholder:

```
[Icon]
[Tab Name]
Coming in Session [5a|5b]
```

Icons: Checklist → CheckCircle2, Reviews → MessageSquare, IC → Landmark, Audit → ScrollText, Members → Users

### 4.6 Header Buttons

- **Upload Document:** Rendered but disabled (`disabled` prop + `cursor-not-allowed`), tooltip "Available after Session 4". No Audit Log button — added in Session 5b with the Audit tab.

### 4.7 Pool State Badge

Shared component `components/pool/pool-state-badge.tsx`, used in both Pool Detail header and Dashboard pool cards.

Labels imported from `POOL_STATE_LABELS` in `@rwa-dataroom/shared`. Colour mapping covers all 9 states:

| State | Label (from shared) | Colour | Background |
|-------|---------------------|--------|-----------|
| 0 Draft | Draft | slate | `bg-slate-100 text-slate-600` |
| 1 DD In Progress | DD In Progress | blue | `bg-blue-100 text-blue-600` |
| 2 IC Review | IC Review | amber | `bg-amber-100 text-amber-600` |
| 3 Approved Internal | Approved (Internal) | green | `bg-green-100 text-green-600` |
| 4 Ready to Issue | Ready to Issue | emerald | `bg-emerald-100 text-emerald-700` |
| 5 Rejected | Rejected | red | `bg-red-100 text-red-600` |
| 6 Cancelled | Cancelled | slate | `bg-slate-100 text-slate-500` |
| 7 Issued | Issued | indigo | `bg-indigo-100 text-indigo-600` |
| 8 Closed | Closed | gray | `bg-gray-100 text-gray-500` |

---

## 5. Data Fetching

### 5.1 New Hooks

**`usePoolDetail(poolId: string)`**
- API: `GET /pools/:poolId`
- Returns: `{ data: Pool, isLoading, error }`
- Query key: `['pools', 'detail', poolId]`

**`useDocuments(poolId: string)`**
- API: `GET /pools/:poolId/documents` (fetches all documents for the pool)
- Returns: `{ data: { data: Document[], total, page, limit }, isLoading, error }`
- Query key: `['pools', poolId, 'documents']`
- Folder filtering is done client-side: `FolderTree` sets active `folderId`, `DocumentList` filters the returned array by `doc.folderId === activeFolderId` (or shows all when "All" is selected)

**`useCreatePool()`**
- Mutation hook wrapping the 3-step TX flow:
  1. `POST /pools` (build TX)
  2. `signTransaction()` via dApp Kit
  3. `POST /pools/:poolId/sign` (submit TX)
- Returns: `{ mutateAsync, isPending, error }`
- On success: invalidates pool list query, returns `poolId` for redirect

### 5.2 Query Keys Extension

Add to `lib/api/query-keys.ts`:

```typescript
export const queryKeys = {
  // existing...
  pools: {
    all: ['pools'] as const,
    list: (orgId: string) => ['pools', 'list', orgId] as const,
    detail: (poolId: string) => ['pools', 'detail', poolId] as const,
    documents: (poolId: string) =>
      ['pools', poolId, 'documents'] as const,
  },
};
```

Note: `detail` key uses `['pools', 'detail', poolId]` to align with the parent S6 design spec convention. Documents are nested under `pools` (deviation from parent spec's separate `documents` namespace) for better cache invalidation — pool-scoped documents naturally belong under the pool key hierarchy. Parent spec should be updated to match in a future session.

---

## 6. New Files Summary

### Components

| File | Purpose |
|------|---------|
| `components/pool/pool-state-badge.tsx` | State → colour badge (9 states, labels from shared) |
| `components/pool/step-indicator.tsx` | 5-step progress indicator (extracted from wizard) |
| `components/vdr/folder-tree.tsx` | Folder list with active selection |
| `components/vdr/document-list.tsx` | Document table with status badges |

### Hooks

| File | Purpose |
|------|---------|
| `lib/api/hooks/use-pool-detail.ts` | GET /pools/:poolId |
| `lib/api/hooks/use-documents.ts` | GET /pools/:poolId/documents |
| `lib/api/hooks/use-create-pool.ts` | POST /pools → sign → POST /sign mutation |

### Page Updates

| File | Change |
|------|--------|
| `app/(main)/pools/new/page.tsx` | Full rewrite: useReducer, 5 step components, TX flow |
| `app/(main)/pools/[id]/page.tsx` | Full rewrite: API fetch, 6 tabs, VDR live content |
| `lib/api/query-keys.ts` | Add pool detail + documents keys |

---

## 7. Design Decisions

| Decision | Rationale |
|----------|-----------|
| Page-centric (no `usePoolForm` hook) | Single consumer, YAGNI — extract when Session 4+ adds complexity |
| `useReducer` over `useState` per field | 5 steps of form state = complex enough for reducer, simpler than form library |
| `@dnd-kit` over button reorder | Better UX for checklist reordering, supports keyboard a11y |
| searchParams tab routing | Bookmarkable URLs, no full page reload, spec alignment |
| VDR fetches real API data | Validates API integration early; upload deferred to Session 4 |
| Upload button disabled (not hidden) | User sees the affordance, knows it's coming |
| No Audit Log button | Not related to current flow; added with Audit tab in Session 5b |
| Step 5 edit buttons per section | Direct jump beats linear back-stepping for review corrections |
| Redirect to pool detail after creation | Natural next action (upload docs, invite members) |
| 6 tabs all rendered | Layout stability; later sessions fill content without structural changes |
| `useSignAndSubmit` over direct dApp Kit | Supports both wallet and zkLogin auth methods |
| Client-side folder filtering | Backend documents endpoint has no folderId param; filtering a small list client-side is simpler than adding backend query |
| Import `POOL_STATE_LABELS` from shared | Single source of truth for state display names; avoids hardcoded label mismatches |
| `requirementLevel` three-level system | Aligns with shared `ChecklistItem` type: required/recommended/optional |
| Members added after pool TX | `POST /pools` DTO does not include members; separate `POST /pools/:poolId/dataroom/members` calls needed |
