# S6 Session 2 — Login + Onboarding + Dashboard

**Date:** 2026-03-19
**Scope:** Implement dual-auth login (zkLogin + wallet), stepped onboarding wizard, live dashboard, and backend verify-zklogin endpoint.
**Brand:** BrineVault — Institutional-grade data vault for Real-World Assets.

---

## 1. Design System Integration

### UI Library Stack (4-Layer Architecture)

| Layer | Library | Role |
|-------|---------|------|
| Foundation | shadcn/ui + Radix + Tailwind v4 | All structural components |
| Accessibility | React Aria (4 components only) | Table, DatePicker, DnD, ComboBox |
| Motion | Magic UI + Framer Motion | Number animations, shimmer, page transitions |
| Visual Polish | Aceternity + React Bits (curated) | Login background, timeline, bento grid |

### Conflict Rules

1. **Radix vs React Aria:** One per component. Default to shadcn/Radix; swap to React Aria only for Table, DatePicker, DnD, ComboBox.
2. **Framer Motion:** Magic UI + Aceternity share a single pinned version.
3. **Performance:** 3D/Shader effects login page only. No WebGL on dashboard or data pages.
4. **Animation principles:** Duration ≤ 300ms, easing: ease-out, skeleton loading for data fetches, toast 3–5s fade-out.

### Design Tokens (from UI設計書)

Reference hex values from UI設計書. Actual oklch values are as implemented in `apps/web/src/app/globals.css` (source of truth for oklch mappings — do not duplicate here).

| Token | Hex (UI設計書) | Usage |
|-------|---------------|-------|
| `--primary` | `#007BFF` | Trust Blue — CTAs, selected states |
| `--background` | `#FAFAFC` | Page background |
| `--card` | `#FFFFFF` | Card / modal background |
| `--foreground` | `#1A1C29` | Primary text, headings |
| `--muted-foreground` | `#64748B` | Secondary text |
| `--border` | `#E2E8F0` | Borders |
| `--success` | `#10B981` | Approved |
| `--warning` | `#F59E0B` | Pending / Warning |
| `--destructive` | `#EF4444` | Rejected / Error |

### Typography

- Primary: `Inter`
- Monospace: `JetBrains Mono`
- Financial numbers: `font-variant-numeric: tabular-nums`
- Body: 14–16px, line-height 1.5

### Materials

- Card/modal: `border-radius: 12px`, shadow `0 4px 24px rgba(0,0,0,0.06)`
- Smaller elements (badges, inputs, buttons): `border-radius: 8px`
- Glassmorphism: Reserved for signing modals and critical confirmations only
- Focus ring: `#007BFF` 2px outline (WCAG AA)

---

## 2. Login Page

### Layout

Split-screen centered card (820px max-width), centred on `#FAFAFC` background with Magic UI dot pattern.

- **Left panel (360px):** Light blue gradient (`#f0f7ff → #dbeafe`), BrineVault logo + tagline + three trust badges with icons:
  - Zero-Trust Client-Side Encryption (lock icon, blue)
  - On-Chain Immutable Audit Trail (check-circle icon, green)
  - Compliance-Grade Access Control (shield icon, purple)
- **Right panel:** Login form
- **Responsive:** Below 768px, stack vertically (left panel collapses to logo + one-line tagline)

### Login Methods

**Primary — zkLogin (Google, Apple):**

```
"Continue with Google" button
"Continue with Apple" button
```

- Full-width, white background, `#E2E8F0` border, soft shadow
- Hover: border transitions to `#007BFF`, shadow `rgba(0,123,255,0.12)`, 150ms ease-out
- Each shows provider's official logo (SVG)

**Secondary — Wallet Connect:**

```
─── or ───
"Connect Wallet" button
```

- `#FAFAFC` background, muted text `#64748B`
- Hover: border `#007BFF`, background `#FFFFFF`
- Triggers Sui dApp Kit wallet modal

**Footer:** "Powered by Sui Network" in `#94a3b8`

### zkLogin Flow

```
1. User clicks "Continue with Google/Apple"
2. Generate ephemeral Ed25519 keypair → store in sessionStorage
3. Build OAuth URL with:
   - nonce = hash(ephemeralPubKey, maxEpoch, randomness)
   - redirect_uri = /callback (Next.js route: app/(auth)/callback/page.tsx)
4. Redirect to Google/Apple OAuth
5. OAuth callback returns id_token (JWT)
6. SaltProvider.getSalt(jwt) → user_salt
7. POST to Mysten proving service → zkProof
8. Derive Sui address: hash(iss + sub + salt)
9. POST /auth/verify-zklogin { jwt, zkProof, ephemeralPubKey, maxEpoch, salt }
10. Backend verifies → returns { access_token, user }
11. AuthProvider.login(user, token, 'zklogin', org)
12. Redirect based on user.orgId
```

### Salt Provider (Strategy Pattern)

```ts
// lib/sui/salt-provider.ts
interface SaltProvider {
  getSalt(jwt: string): Promise<string>;
}

class MystenSaltProvider implements SaltProvider {
  async getSalt(jwt: string): Promise<string> {
    const res = await fetch('https://salt.api.mystenlabs.com/get_salt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: jwt }),
    });
    const { salt } = await res.json();
    return salt;
  }
}

// Future: SelfHostedSaltProvider for production
```

Configuration via environment variable:

```
NEXT_PUBLIC_SALT_PROVIDER=mysten  # or 'self-hosted' later
```

### Wallet Connect Flow

```
1. User clicks "Connect Wallet"
2. Sui dApp Kit modal opens → user selects wallet
3. GET /auth/challenge → { nonce, timestamp, expiresAt }
4. Build message: "Sign in to BrineVault\nNonce: {nonce}\nTimestamp: {timestamp}"
5. Wallet signs message → signature
6. POST /auth/verify { address, signature, nonce }
7. Backend verifies → returns { access_token, refreshToken (httpOnly cookie), user }
8. AuthProvider.login(user, token, 'wallet', org)
9. Redirect based on user.orgId
```

### Post-Login Routing

```
user.orgId exists → /dashboard
user.orgId null   → /onboarding
```

### Auth Callback Page

New route: `app/(auth)/callback/page.tsx`

- Shows a loading spinner with "Completing sign-in..." text
- Extracts `id_token` from URL fragment/params
- Runs zkLogin steps 6–12 automatically
- On error: redirects to `/login` with error toast
- User-facing error messages: "Authentication service temporarily unavailable. Please try wallet connect or try again later." for salt/proving service failures

### Token Refresh

Implement the TODO in `lib/api/client.ts`:

```
401 response →
  POST /auth/refresh (with expired Bearer + httpOnly refresh cookie) →
  Note: fetch must use credentials: 'include' to send httpOnly cookie cross-origin →
  Success: update tokenRef, retry original request (once) →
  Failure: AuthProvider.logout() → redirect /login
```

### Security

- JWT stored in React ref only (never localStorage)
- Refresh token via httpOnly cookie (already implemented in backend)
- Ephemeral keypair (zkLogin) in sessionStorage only
- ZK proof expiry: ~1 epoch (~24h on testnet). Background refresh deferred to Session 7.
- CSRF token from `GET /auth/csrf-token` attached to state-changing requests

---

## 3. Onboarding Page

### Layout

Stepped wizard, centred card (max-width 520px), same `#FAFAFC` background as login.

### Step 1 — Choose Path

Two large cards side by side (on mobile: stacked):

```
┌──────────────────────┐  ┌──────────────────────┐
│  🏢                   │  │  🔗                   │
│  Create Organisation  │  │  Join with Invite Code │
│                       │  │                       │
│  Set up a new org     │  │  Enter your code to   │
│  and invite your team │  │  join an existing org  │
└──────────────────────┘  └──────────────────────┘
```

- Cards: `#FFFFFF` background, `#E2E8F0` border, 12px radius, soft shadow
- Selected card: `#007BFF` border, `rgba(0,123,255,0.04)` background
- Click transitions to Step 2 with Blur Fade (Magic UI, 300ms)

### Step 2a — Create Organisation

```
Organisation Name *    [________________]
Legal Name             [________________]  (optional)

                              [Create Organisation →]
```

- Form validation: org name required, min 2 chars
- Submit: `POST /orgs { name, legalName }` → response includes org object
- On success: `AuthProvider.setOrg(org)` → redirect `/dashboard`
- Button: primary blue, loading spinner during API call

### Step 2b — Join with Invite Code

```
Invite Code *          [________________]

                              [Join Organisation →]
```

- Input: monospace font (`JetBrains Mono`), uppercase auto-transform
- Submit: `POST /orgs/join { inviteCode }` → response includes org object
- On success: `AuthProvider.setOrg(org)` → redirect `/dashboard`
- Error states: "Invalid code", "Code expired", "Code already used"

### Navigation

- Back arrow in top-left (Step 2 → Step 1)
- Step indicator: `Step 1 of 2` / `Step 2 of 2` text (minimal, not a full progress bar)

---

## 4. Dashboard

### Layout

Replace mock data with live API data. Keep existing layout structure (stats cards + pool list), enhance with motion.

### Data Fetching

```ts
// lib/api/hooks/use-pools.ts
function usePoolList(orgId: string) {
  return useQuery({
    queryKey: queryKeys.pools.list(orgId),
    queryFn: () => apiClient.get<Pool[]>('/pools'),
    staleTime: 30_000,
  });
}

// Stats derived client-side from pool list — no dedicated /pools/stats endpoint needed.
function usePoolStats(pools: Pool[] | undefined) {
  return useMemo(() => {
    if (!pools) return null;
    return {
      totalPools: pools.length,
      totalAssetValue: pools.reduce((sum, p) => sum + parseFloat(p.targetSize || '0'), 0),
      pendingICReviews: pools.filter(p => p.currentState === 'ic_review').length,
    };
  }, [pools]);
}
```

Note: add `stats: (orgId: string) => ['pools', 'stats', orgId] as const` to `queryKeys.pools` in `query-keys.ts` for future use if a backend stats endpoint is added.

### Stats Cards

Three cards at the top (existing design, enhanced):

| Card | Data Source | Enhancement |
|------|-----------|-------------|
| Total Pools | `pools.length` | Magic UI Number Ticker on mount |
| Total Asset Value | Sum of `pool.targetSize` | Number Ticker + `tabular-nums` |
| Pending IC Reviews | Count where `currentState === 'ic_review'` | Warning border if > 0 |

### Pool List

- Replace `MOCK_POOLS` with `usePoolList()` data
- Skeleton loading (shadcn Skeleton) while fetching
- Empty state: illustration + "Create your first pool" CTA
- Error state: ErrorBoundary with retry button
- Pool cards: existing design, add Blur Fade stagger on mount (50ms per card)

### Brand Text Updates

- Page title: "Dashboard" (keep)
- Subtitle: "Overview of your pools and pending actions." (was "...RWA DataRoom pools...")
- Create button: "Create New Pool" (keep)

---

## 5. Backend — POST /auth/verify-zklogin

### Prerequisites

1. **Upgrade `@mysten/sui` in `apps/api`:** Currently `^1.45.0`, needs `^2.7.0` to match frontend and access `@mysten/sui/zklogin` subpath exports (`jwtToAddress`, `getZkLoginSignature`).
2. **Update backend sign message:** Change `"Sign in to RWA Data Room"` to `"Sign in to BrineVault"` in `auth.service.ts` line 41.
3. **Unify auth response type:** Create `AuthLoginResponse` in `packages/shared` with `{ id, address, orgId, roleInOrg, displayName }` — used by both `/auth/verify` and `/auth/verify-zklogin`.

### Endpoint

```
POST /v1/auth/verify-zklogin
Content-Type: application/json
```

### Request Schema

```ts
// packages/shared/src/validation/schemas.ts — add alongside existing authVerifyRequestSchema
const verifyZkLoginRequestSchema = z.object({
  jwt: z.string().min(1),
  zkProof: z.object({
    proofPoints: z.object({
      a: z.array(z.string()),
      b: z.array(z.array(z.string())),
      c: z.array(z.string()),
    }),
    issBase64Details: z.object({
      value: z.string(),
      indexMod4: z.number(),
    }),
    headerBase64: z.string(),
  }),
  ephemeralPubKey: z.string().min(1),
  maxEpoch: z.number().int().positive(),
  salt: z.string().min(1),
});
```

### Response

Same shape as `POST /auth/verify`:

```json
{
  "access_token": "eyJ...",
  "user": {
    "id": "uuid",
    "address": "0x...",
    "orgId": "uuid | null",
    "roleInOrg": 0
  }
}
```

Plus `refresh_token` in httpOnly cookie.

### Implementation

```ts
// auth.service.ts — new method
async verifyZkLogin(dto: VerifyZkLoginRequest, ip: string, userAgent: string) {
  // 1. Decode JWT to extract iss, sub
  const { decodeJwt } = await import('jose');
  const payload = decodeJwt(dto.jwt);
  const iss = payload.iss as string;
  const sub = payload.sub as string;

  // 2. Derive Sui address from zkLogin inputs
  const { jwtToAddress } = await import('@mysten/sui/zklogin');
  const address = jwtToAddress(dto.jwt, dto.salt);

  // 3. Verify ZK proof
  //    Use @mysten/sui/zklogin to verify the Groth16 proof against
  //    the JWT claims, ephemeral public key, and epoch bounds.
  //    This is cryptographic verification — not deferred.
  const { verifyZkLoginProof } = await import('@mysten/sui/zklogin');
  const isValid = await verifyZkLoginProof({
    proof: dto.zkProof,
    jwt: dto.jwt,
    ephemeralPubKey: dto.ephemeralPubKey,
    maxEpoch: dto.maxEpoch,
    salt: dto.salt,
  });
  if (!isValid) {
    throw new UnauthorizedException({ code: 'INVALID_ZK_PROOF', message: 'ZK proof verification failed' });
  }
  // Note: exact API may differ in @mysten/sui v2.7 — verify available exports
  // during implementation and adjust accordingly.

  // 4. Verify maxEpoch is within acceptable range
  //    (current epoch <= maxEpoch <= current epoch + MAX_EPOCH_AHEAD)
  //    Fetch current epoch via SuiClient.getLatestSuiSystemState()

  // 5. Upsert user by derived address
  const [user] = await this.usersRepo.upsertByWallet({
    primaryWalletAddress: address,
  });

  // 6. Create session + JWT (same as verifyAndLogin steps 4-7)
  const refreshToken = this.jwtService.generateRefreshToken();
  const refreshTokenHash = this.jwtService.hashRefreshToken(refreshToken);
  const sid = await this.sessionService.createSession(
    user.id, address, user.orgId ?? null,
    refreshTokenHash, ip, userAgent,
  );
  const accessToken = await this.jwtService.signAccessToken({
    sub: user.id, address, orgId: user.orgId ?? null,
    orgRole: user.roleInOrg ?? 0, sid,
  });

  return { accessToken, refreshToken, user: { id: user.id, address, orgId: user.orgId ?? null, roleInOrg: user.roleInOrg ?? 0 } };
}
```

### Controller Addition

```ts
// auth.controller.ts — new endpoint
@Public()
@Post('verify-zklogin')
@UsePipes(new ZodValidationPipe(verifyZkLoginRequestSchema))
async verifyZkLogin(@Body() dto: VerifyZkLoginRequest, @Req() req: Request, @Res() res: Response) {
  const result = await this.authService.verifyZkLogin(dto, req.ip ?? '0.0.0.0', req.headers['user-agent'] ?? '');
  res.cookie('refresh_token', result.refreshToken, {
    httpOnly: true, secure: true, sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, path: '/v1/auth',
  });
  return res.json({ access_token: result.accessToken, user: result.user });
}
```

---

## 6. New Files

```
apps/api/
  src/modules/auth/auth.controller.ts   # MODIFY — add verify-zklogin endpoint
  src/modules/auth/auth.service.ts      # MODIFY — add verifyZkLogin method, update sign message to "BrineVault"
  package.json                          # MODIFY — upgrade @mysten/sui ^1.45 → ^2.7

packages/shared/src/
  validation/schemas.ts                 # MODIFY — add verifyZkLoginRequestSchema
  types/auth.ts                         # MODIFY — add AuthLoginResponse (unified response type)

apps/web/src/
  app/layout.tsx                        # MODIFY — title "RWA DataRoom" → "BrineVault"
  app/(auth)/callback/page.tsx          # NEW — OAuth callback handler (route: /callback)
  app/(auth)/login/page.tsx             # MODIFY — split screen, zkLogin + wallet
  app/(auth)/onboarding/page.tsx        # MODIFY — stepped wizard
  app/(main)/dashboard/page.tsx         # MODIFY — live API data
  components/layout/header.tsx          # MODIFY — brand name → "BrineVault"
  components/auth/
    zklogin-button.tsx                  # NEW — OAuth trigger button
    wallet-connect-button.tsx           # NEW — dApp Kit wallet connect wrapper
    onboarding-wizard.tsx               # NEW — stepped wizard component
  lib/sui/
    zklogin.ts                          # NEW — full zkLogin flow orchestrator
    salt-provider.ts                    # NEW — SaltProvider interface + MystenSaltProvider
  lib/api/
    client.ts                           # MODIFY — add credentials: 'include', implement token refresh
    hooks/use-auth.ts                   # NEW — useLogin, useZkLogin, useLogout, useRefresh
    hooks/use-pools.ts                  # NEW — usePoolList, usePoolStats (client-side derived)
    query-keys.ts                       # MODIFY — add pools.stats key
```

Note: `use-sign-and-submit.ts` deferred to Session 3 (pool creation with TX signing).

---

## 7. Auth Guard & Redirect Logic

### Architecture

AuthProvider lives inside `(main)/layout.tsx`. The `(auth)` layout does NOT have AuthProvider. To handle guards in both route groups:

1. **Create `useSessionCheck` hook** — a lightweight hook that attempts `POST /auth/refresh` (with `credentials: 'include'`) to detect an existing session. No full AuthProvider needed. Returns `{ hasSession: boolean, isLoading: boolean }`.
2. **`(main)/layout.tsx`** — uses AuthProvider. If not authenticated after loading, redirect to `/login`.
3. **`(auth)/layout.tsx`** — uses `useSessionCheck`. If session exists, redirect to `/dashboard`.

### (main) Layout Guard

```ts
// hooks/use-auth-guard.ts — used inside (main) layout
// Wraps AuthProvider state with redirect logic
if (!isAuthenticated && !isLoading) {
  redirect('/login');
}
if (isAuthenticated && !currentOrg && pathname !== '/onboarding') {
  redirect('/onboarding');
}
```

### (auth) Layout Guard

```ts
// app/(auth)/layout.tsx — uses lightweight session check
const { hasSession, isLoading } = useSessionCheck();
if (hasSession && !isLoading) {
  redirect('/dashboard');
}
```

---

## 8. Dependencies to Add

**apps/web:**
```json
{
  "framer-motion": "^12.x",
  "motion": "^12.x"
}
```

**apps/api:**
```json
{
  "@mysten/sui": "^2.7.0"  // upgrade from ^1.45.0
}
```

- `@mysten/zklogin` is NOT a separate package — zkLogin utilities are in `@mysten/sui/zklogin` (already installed).
- Magic UI and Aceternity components are copy-paste (no npm package).
- React Aria deferred to later sessions when Table/DatePicker/DnD are needed (Session 3+).
- Dashboard pagination deferred — Phase 1 pool counts are small enough for single-page rendering.

---

## 9. Testing Strategy

### Backend

- Unit test: `verifyZkLogin` service method (mock JWT decode, mock zklogin verify)
- Integration test: `POST /auth/verify-zklogin` happy path + invalid proof + expired epoch

### Frontend

- Component tests: LoginPage renders both methods, OnboardingWizard step transitions
- Hook tests: `useZkLogin` flow with mocked fetch, `usePoolList` with MSW
- E2E (deferred to Session 7): Full login → onboarding → dashboard flow

### Monkey Testing

- zkLogin with malformed JWT / empty salt / garbage zkProof
- Wallet connect with wrong network / disconnected mid-sign
- Onboarding with XSS in org name / empty invite code / expired invite code
- Dashboard with 0 pools / 100+ pools / API timeout
- Rapid login/logout cycles
- Concurrent refresh token requests (race condition)
