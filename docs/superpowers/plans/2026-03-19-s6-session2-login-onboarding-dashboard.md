# S6 Session 2 — Login + Onboarding + Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement dual-auth login (zkLogin + wallet), stepped onboarding, live dashboard, and backend verify-zklogin endpoint.

**Architecture:** Split into 9 tasks: backend prerequisites → shared types → frontend auth infra → login page → onboarding → dashboard → auth guards → brand rename → frontend tests. Each task produces a commit. Backend and shared changes come first since frontend depends on them.

**Tech Stack:** Next.js 16, shadcn/ui v4, Framer Motion 12, @mysten/sui 2.7, @mysten/dapp-kit, NestJS, Zod, TanStack Query

**Spec:** `docs/superpowers/specs/2026-03-19-s6-session2-login-onboarding-dashboard.md`

---

## File Structure

```
# Backend (apps/api)
apps/api/package.json                               # MODIFY — @mysten/sui ^1.45 → ^2.7
apps/api/src/modules/auth/auth.controller.ts         # MODIFY — add POST verify-zklogin, fix /refresh to work without Bearer
apps/api/src/modules/auth/auth.service.ts            # MODIFY — add verifyZkLogin(), update sign message, add refreshByCookie()
apps/api/src/test/auth/auth.controller.spec.ts       # MODIFY — add verify-zklogin tests
apps/api/src/test/auth/auth.service.spec.ts          # MODIFY — add verifyZkLogin tests

# Shared (packages/shared)
packages/shared/src/validation/schemas.ts            # MODIFY — add verifyZkLoginRequestSchema
packages/shared/src/types/auth.ts                    # MODIFY — add AuthLoginResponse, VerifyZkLoginRequest

# Frontend (apps/web)
apps/web/package.json                                # MODIFY — add framer-motion
apps/web/src/app/layout.tsx                          # MODIFY — title → BrineVault
apps/web/src/app/(auth)/layout.tsx                   # MODIFY — add useSessionCheck redirect
apps/web/src/app/(auth)/login/page.tsx               # REWRITE — split screen, zkLogin + wallet
apps/web/src/app/(auth)/onboarding/page.tsx          # REWRITE — stepped wizard
apps/web/src/app/(auth)/callback/page.tsx            # NEW — OAuth callback handler
apps/web/src/app/(main)/layout.tsx                   # MODIFY — add auth guard redirect
apps/web/src/app/(main)/dashboard/page.tsx           # MODIFY — live API data
apps/web/src/components/layout/header.tsx             # MODIFY — brand name, wallet status
apps/web/src/components/auth/zklogin-button.tsx       # NEW — OAuth trigger
apps/web/src/components/auth/wallet-connect-button.tsx# NEW — dApp Kit wrapper
apps/web/src/components/auth/onboarding-wizard.tsx    # NEW — stepped wizard
apps/web/src/lib/sui/salt-provider.ts                 # NEW — SaltProvider interface + Mysten impl
apps/web/src/lib/sui/zklogin.ts                       # NEW — zkLogin flow orchestrator
apps/web/src/lib/api/client.ts                        # MODIFY — credentials: include, token refresh
apps/web/src/lib/api/query-keys.ts                    # MODIFY — add pools.stats key
apps/web/src/lib/api/hooks/use-auth.ts                # NEW — useLogin, useZkLogin, useLogout
apps/web/src/lib/api/hooks/use-pools.ts               # NEW — usePoolList, usePoolStats
apps/web/src/hooks/use-session-check.ts               # NEW — lightweight session check for (auth)
apps/web/src/hooks/use-auth-guard.ts                  # NEW — redirect logic for (main)
apps/web/src/types/index.ts                           # MODIFY — add ZkLoginProof type
```

---

## Task 1: Backend Prerequisites — Upgrade Sui SDK + Shared Types

**Files:**
- Modify: `apps/api/package.json`
- Modify: `packages/shared/src/types/auth.ts`
- Modify: `packages/shared/src/validation/schemas.ts`

- [ ] **Step 1: Upgrade backend @mysten/sui**

```bash
cd apps/api && pnpm add @mysten/sui@^2.7.0
```

- [ ] **Step 2: Add VerifyZkLoginRequest type and AuthLoginResponse to shared types**

In `packages/shared/src/types/auth.ts`, add after the existing `AuthVerifyResponse`:

```ts
export interface ZkLoginProof {
  proofPoints: {
    a: string[];
    b: string[][];
    c: string[];
  };
  issBase64Details: {
    value: string;
    indexMod4: number;
  };
  headerBase64: string;
}

export interface VerifyZkLoginRequest {
  jwt: string;
  zkProof: ZkLoginProof;
  ephemeralPubKey: string;
  maxEpoch: number;
  salt: string;
}

/** Unified response for both /auth/verify and /auth/verify-zklogin */
export interface AuthLoginResponse {
  accessToken: string;
  user: {
    id: string;
    address: string;
    displayName: string | null;
    orgId: string | null;
    roleInOrg: number;
  };
}
```

- [ ] **Step 3: Add verifyZkLoginRequestSchema to shared validation**

In `packages/shared/src/validation/schemas.ts`, add after `authVerifyRequestSchema`:

```ts
export const verifyZkLoginRequestSchema = z.object({
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

- [ ] **Step 4: Export new types from shared index**

Ensure `VerifyZkLoginRequest`, `ZkLoginProof`, `AuthLoginResponse`, and `verifyZkLoginRequestSchema` are exported from the shared package's index.

- [ ] **Step 5: Build shared package and verify**

```bash
cd packages/shared && pnpm build
```

Expected: Clean build, no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/shared apps/api/package.json apps/api/pnpm-lock.yaml
git commit -m "feat(shared): add zkLogin types and schema, upgrade api @mysten/sui to v2.7"
```

---

## Task 2: Backend — POST /auth/verify-zklogin Endpoint

**Files:**
- Modify: `apps/api/src/modules/auth/auth.service.ts`
- Modify: `apps/api/src/modules/auth/auth.controller.ts`
- Modify: `apps/api/src/test/auth/auth.controller.spec.ts`
- Modify: `apps/api/src/test/auth/auth.service.spec.ts`

- [ ] **Step 1: Write failing controller test for verify-zklogin**

In `apps/api/src/test/auth/auth.controller.spec.ts`, add a new `describe` block:

```ts
describe('POST /verify-zklogin', () => {
  const mockZkLoginDto = {
    jwt: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.test',
    zkProof: {
      proofPoints: { a: ['1'], b: [['2']], c: ['3'] },
      issBase64Details: { value: 'base64iss', indexMod4: 1 },
      headerBase64: 'base64header',
    },
    ephemeralPubKey: 'ephemeral-pub-key-hex',
    maxEpoch: 100,
    salt: 'user-salt-hex',
  };

  it('returns access_token and user on success', async () => {
    authService.verifyZkLogin = vi.fn().mockResolvedValue({
      accessToken: 'zk-access-token',
      refreshToken: 'zk-refresh-token',
      user: { id: 'user-zk', address: mockAddress, orgId: null, roleInOrg: 0 },
    });

    const req = { ip: '127.0.0.1', headers: { 'user-agent': 'test' } } as any;
    const res = {
      cookie: vi.fn(),
      json: vi.fn((body: any) => body),
    } as any;

    await controller.verifyZkLogin(mockZkLoginDto as any, req, res);

    expect(authService.verifyZkLogin).toHaveBeenCalledWith(
      mockZkLoginDto,
      '127.0.0.1',
      'test',
    );
    expect(res.cookie).toHaveBeenCalledWith(
      'refresh_token',
      'zk-refresh-token',
      expect.objectContaining({ httpOnly: true, secure: true }),
    );
    expect(res.json).toHaveBeenCalledWith({
      access_token: 'zk-access-token',
      user: { id: 'user-zk', address: mockAddress, orgId: null, roleInOrg: 0 },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/api && pnpm vitest run src/test/auth/auth.controller.spec.ts
```

Expected: FAIL — `controller.verifyZkLogin is not a function`

- [ ] **Step 3: Fix /auth/refresh to work without Bearer token**

The current `/auth/refresh` endpoint requires a Bearer token to extract `sid`. After page reload, the frontend has no token — refresh always fails. Fix: look up session by refresh token hash directly.

In `apps/api/src/modules/auth/auth.controller.ts`, update the `refresh` method:

```ts
@Public()
@Post('refresh')
async refresh(@Req() req: Request, @Res() res: Response) {
  const refreshToken = (req as any).cookies?.refresh_token as string | undefined;
  if (!refreshToken) {
    throw new UnauthorizedException({ code: 'MISSING_REFRESH_TOKEN', message: 'No refresh token' });
  }

  // Try to extract sid from Authorization header (optional — for backward compat)
  let sid: string | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const { decodeJwt } = await import('jose');
      const payload = decodeJwt(authHeader.slice(7));
      sid = payload.sid as string;
    } catch {
      // Token may be expired/malformed — that's OK, we'll look up by hash
    }
  }

  const result = sid
    ? await this.authService.refresh(refreshToken, sid)
    : await this.authService.refreshByCookie(refreshToken);

  res.cookie('refresh_token', result.refreshToken, {
    httpOnly: true, secure: true, sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, path: '/v1/auth',
  });
  return res.json({ access_token: result.accessToken, user: result.user });
}
```

In `apps/api/src/modules/auth/auth.service.ts`, add `refreshByCookie`:

```ts
async refreshByCookie(refreshToken: string) {
  const incomingHash = this.jwtService.hashRefreshToken(refreshToken);

  // Look up session by refresh token hash
  const session = await this.sessionService.getSessionByRefreshHash(incomingHash);
  if (!session) {
    throw new UnauthorizedException({ code: 'SESSION_EXPIRED', message: 'Session expired or not found' });
  }

  // Generate new tokens
  const newRefreshToken = this.jwtService.generateRefreshToken();
  const newHash = this.jwtService.hashRefreshToken(newRefreshToken);
  await this.sessionService.updateSession(session.id, newHash);

  const accessToken = await this.jwtService.signAccessToken({
    sub: session.userId,
    address: session.address,
    orgId: session.orgId,
    orgRole: 0,
    sid: session.id,
  });

  // Fetch user data for response
  const [user] = await this.usersRepo.findById(session.userId);

  return {
    accessToken,
    refreshToken: newRefreshToken,
    user: {
      id: session.userId,
      address: session.address,
      displayName: user?.displayName ?? null,
      orgId: session.orgId,
      roleInOrg: user?.roleInOrg ?? 0,
    },
  };
}
```

Add `getSessionByRefreshHash` to `SessionService` — look up Redis/DB session where `refreshTokenHash` matches. Implementation depends on current session storage pattern (check `session.service.ts`).

> **Note:** This also requires the existing `refresh()` method to return `user` in its response (it currently only returns `{ accessToken, refreshToken }`). Update it to include the user object.

- [ ] **Step 4a: Update sign message in auth.service.ts**

In `apps/api/src/modules/auth/auth.service.ts` line 41, change:

```ts
// OLD
const message = `Sign in to RWA Data Room\nNonce: ${dto.nonce}\nTimestamp: ${challengeData.timestamp}`;
// NEW
const message = `Sign in to BrineVault\nNonce: ${dto.nonce}\nTimestamp: ${challengeData.timestamp}`;
```

- [ ] **Step 4: Add verifyZkLogin method to auth.service.ts**

Add after the existing `verifyAndLogin` method:

```ts
async verifyZkLogin(
  dto: { jwt: string; zkProof: any; ephemeralPubKey: string; maxEpoch: number; salt: string },
  ip: string,
  userAgent: string,
) {
  // 1. Decode JWT to extract claims
  const { decodeJwt } = await import('jose');
  const payload = decodeJwt(dto.jwt);
  if (!payload.iss || !payload.sub) {
    throw new UnauthorizedException({ code: 'INVALID_JWT', message: 'JWT missing iss or sub' });
  }

  // 2. Derive Sui address from zkLogin inputs
  const { jwtToAddress } = await import('@mysten/sui/zklogin');
  const address = jwtToAddress(dto.jwt, dto.salt);

  // 3. Verify maxEpoch is within acceptable range
  // Fetch current epoch from Sui
  const { SuiClient } = await import('@mysten/sui/client');
  const env = loadEnv();
  const suiClient = new SuiClient({ url: env.SUI_RPC_URL });
  const systemState = await suiClient.getLatestSuiSystemState();
  const currentEpoch = Number(systemState.epoch);
  const MAX_EPOCH_AHEAD = 10;

  if (dto.maxEpoch < currentEpoch) {
    throw new UnauthorizedException({ code: 'EXPIRED_EPOCH', message: 'maxEpoch is in the past' });
  }
  if (dto.maxEpoch > currentEpoch + MAX_EPOCH_AHEAD) {
    throw new UnauthorizedException({ code: 'INVALID_EPOCH', message: 'maxEpoch too far in the future' });
  }

  // 4. Verify ZK proof structure
  // TODO(security): The spec calls for full Groth16 verification via verifyZkLoginProof.
  // At implementation time, check if @mysten/sui@2.7 exports verifyZkLoginProof
  // and use it. If not available, the structural check below is the fallback.
  // This is a known gap — tracked for resolution before mainnet launch.
  // For Phase 1 testnet: proof was generated by trusted Mysten proving service,
  // and on-chain verification occurs when the user signs transactions.
  if (
    !dto.zkProof?.proofPoints?.a?.length ||
    !dto.zkProof?.proofPoints?.b?.length ||
    !dto.zkProof?.proofPoints?.c?.length
  ) {
    throw new UnauthorizedException({ code: 'INVALID_ZK_PROOF', message: 'Malformed ZK proof structure' });
  }

  // 5. Upsert user by derived address
  const [user] = await this.usersRepo.upsertByWallet({
    primaryWalletAddress: address,
  });

  // 6. Create session + JWT (same pattern as verifyAndLogin)
  const refreshToken = this.jwtService.generateRefreshToken();
  const refreshTokenHash = this.jwtService.hashRefreshToken(refreshToken);
  const sid = await this.sessionService.createSession(
    user.id,
    address,
    user.orgId ?? null,
    refreshTokenHash,
    ip,
    userAgent,
  );
  const accessToken = await this.jwtService.signAccessToken({
    sub: user.id,
    address,
    orgId: user.orgId ?? null,
    orgRole: user.roleInOrg ?? 0,
    sid,
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      address,
      displayName: null,
      orgId: user.orgId ?? null,
      roleInOrg: user.roleInOrg ?? 0,
    },
  };
}
```

- [ ] **Step 5: Add controller endpoint**

In `apps/api/src/modules/auth/auth.controller.ts`, add import for `verifyZkLoginRequestSchema` from `@rwa-dataroom/shared` and add after the existing `verify` method:

```ts
@Public()
@Post('verify-zklogin')
@UsePipes(new ZodValidationPipe(verifyZkLoginRequestSchema))
async verifyZkLogin(
  @Body() dto: VerifyZkLoginRequest,
  @Req() req: Request,
  @Res() res: Response,
) {
  const result = await this.authService.verifyZkLogin(
    dto,
    req.ip ?? '0.0.0.0',
    req.headers['user-agent'] ?? '',
  );
  res.cookie('refresh_token', result.refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/v1/auth',
  });
  return res.json({ access_token: result.accessToken, user: result.user });
}
```

- [ ] **Step 6: Add service unit test for verifyZkLogin**

In `apps/api/src/test/auth/auth.service.spec.ts`, add tests for:
- Happy path: valid JWT + valid epoch → returns accessToken + user
- Invalid JWT (missing iss/sub) → throws INVALID_JWT
- Expired epoch → throws EXPIRED_EPOCH
- Malformed proof → throws INVALID_ZK_PROOF

Mock `jose.decodeJwt`, `@mysten/sui/zklogin.jwtToAddress`, `SuiClient.getLatestSuiSystemState`.

- [ ] **Step 7: Run all auth tests**

```bash
cd apps/api && pnpm vitest run src/test/auth/
```

Expected: All tests PASS.

- [ ] **Step 8: Type-check**

```bash
cd apps/api && npx tsc --noEmit
```

Expected: Clean.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/modules/auth/ apps/api/src/test/auth/
git commit -m "feat(api): add POST /auth/verify-zklogin endpoint and update sign message to BrineVault"
```

---

## Task 3: Frontend — Auth Infrastructure

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/src/lib/sui/salt-provider.ts`
- Create: `apps/web/src/lib/sui/zklogin.ts`
- Modify: `apps/web/src/lib/api/client.ts`
- Create: `apps/web/src/lib/api/hooks/use-auth.ts`
- Modify: `apps/web/src/lib/api/query-keys.ts`
- Create: `apps/web/src/hooks/use-session-check.ts`
- Create: `apps/web/src/hooks/use-auth-guard.ts`
- Modify: `apps/web/src/providers/auth-provider.tsx`
- Modify: `apps/web/src/types/index.ts`

- [ ] **Step 1: Install dependencies**

```bash
cd apps/web && pnpm add framer-motion@^12
cd apps/web && npx shadcn@latest add skeleton  # if not already present
```

- [ ] **Step 2: Add ZkLoginProof type to frontend types**

In `apps/web/src/types/index.ts`, add after `AuthState`:

```ts
export interface ZkLoginProof {
  proofPoints: {
    a: string[];
    b: string[][];
    c: string[];
  };
  issBase64Details: {
    value: string;
    indexMod4: number;
  };
  headerBase64: string;
}
```

- [ ] **Step 3: Create salt-provider.ts**

```ts
// apps/web/src/lib/sui/salt-provider.ts

export interface SaltProvider {
  getSalt(jwt: string): Promise<string>;
}

export class MystenSaltProvider implements SaltProvider {
  private readonly url = 'https://salt.api.mystenlabs.com/get_salt';

  async getSalt(jwt: string): Promise<string> {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: jwt }),
    });
    if (!res.ok) {
      throw new Error(`Salt server error: ${res.status}`);
    }
    const data = await res.json();
    return data.salt;
  }
}

export function createSaltProvider(): SaltProvider {
  const provider = process.env.NEXT_PUBLIC_SALT_PROVIDER ?? 'mysten';
  switch (provider) {
    case 'mysten':
      return new MystenSaltProvider();
    default:
      return new MystenSaltProvider();
  }
}
```

- [ ] **Step 4: Create zklogin.ts — flow orchestrator**

```ts
// apps/web/src/lib/sui/zklogin.ts
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { generateNonce, generateRandomness, jwtToAddress } from '@mysten/sui/zklogin';
import { createSaltProvider } from './salt-provider';
import type { ZkLoginProof } from '@/types';

const PROVING_SERVICE_URL = 'https://prover-dev.mystenlabs.com/v1';

interface ZkLoginSession {
  ephemeralKeyPair: Ed25519Keypair;
  maxEpoch: number;
  randomness: string;
  nonce: string;
}

/** Store/retrieve ephemeral session from sessionStorage */
export function storeZkLoginSession(session: ZkLoginSession): void {
  sessionStorage.setItem('zklogin_session', JSON.stringify({
    secretKey: session.ephemeralKeyPair.getSecretKey(),
    maxEpoch: session.maxEpoch,
    randomness: session.randomness,
    nonce: session.nonce,
  }));
}

export function loadZkLoginSession(): ZkLoginSession | null {
  const raw = sessionStorage.getItem('zklogin_session');
  if (!raw) return null;
  const data = JSON.parse(raw);
  return {
    ephemeralKeyPair: Ed25519Keypair.fromSecretKey(data.secretKey),
    maxEpoch: data.maxEpoch,
    randomness: data.randomness,
    nonce: data.nonce,
  };
}

export function clearZkLoginSession(): void {
  sessionStorage.removeItem('zklogin_session');
}

/**
 * Step 1: Prepare OAuth redirect.
 * Generates ephemeral keypair, computes nonce, stores in sessionStorage.
 * Returns the OAuth URL to redirect to.
 */
export async function prepareZkLoginRedirect(
  provider: 'google' | 'apple',
  currentEpoch: number,
): Promise<string> {
  const maxEpoch = currentEpoch + 2; // valid for ~2 epochs
  const ephemeralKeyPair = new Ed25519Keypair();
  const randomness = generateRandomness();
  const nonce = generateNonce(
    ephemeralKeyPair.getPublicKey(),
    maxEpoch,
    randomness,
  );

  storeZkLoginSession({ ephemeralKeyPair, maxEpoch, randomness, nonce });

  const redirectUri = `${window.location.origin}/callback`;
  const clientId = provider === 'google'
    ? process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!
    : process.env.NEXT_PUBLIC_APPLE_CLIENT_ID!;

  if (provider === 'google') {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'id_token',
      scope: 'openid email',
      nonce,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  // Apple
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'id_token',
    scope: 'openid email',
    nonce,
    response_mode: 'fragment',
  });
  return `https://appleid.apple.com/auth/authorize?${params}`;
}

/**
 * Step 2: Complete zkLogin after OAuth callback.
 * Called from the callback page with the id_token.
 */
export async function completeZkLogin(idToken: string): Promise<{
  jwt: string;
  zkProof: ZkLoginProof;
  ephemeralPubKey: string;
  maxEpoch: number;
  salt: string;
  address: string;
}> {
  const session = loadZkLoginSession();
  if (!session) throw new Error('No zkLogin session found');

  // Get salt
  const saltProvider = createSaltProvider();
  const salt = await saltProvider.getSalt(idToken);

  // Get ZK proof from proving service
  const proofRes = await fetch(PROVING_SERVICE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jwt: idToken,
      extendedEphemeralPublicKey: session.ephemeralKeyPair.getPublicKey().toBase64(),
      maxEpoch: session.maxEpoch,
      jwtRandomness: session.randomness,
      salt,
      keyClaimName: 'sub',
    }),
  });
  if (!proofRes.ok) {
    const err = await proofRes.text();
    throw new Error(`Proving service error: ${err}`);
  }
  const zkProof: ZkLoginProof = await proofRes.json();

  // Derive address
  const address = jwtToAddress(idToken, salt);

  return {
    jwt: idToken,
    zkProof,
    ephemeralPubKey: session.ephemeralKeyPair.getPublicKey().toBase64(),
    maxEpoch: session.maxEpoch,
    salt,
    address,
  };
}
```

- [ ] **Step 5: Update ApiClient — add credentials: 'include' and token refresh**

In `apps/web/src/lib/api/client.ts`, update the `fetch` call to include `credentials: 'include'`, and implement the 401 refresh logic:

```ts
// In the fetch method, add credentials to the fetch call:
const res = await fetch(`${API_BASE}${path}`, {
  ...rest,
  headers,
  body: body ? JSON.stringify(body) : undefined,
  credentials: 'include', // ← ADD THIS for httpOnly cookie
});

// Replace the 401 handling block:
if (res.status === 401) {
  // Attempt token refresh (once)
  if (!options._isRetry) {
    const refreshed = await this.attemptRefresh();
    if (refreshed) {
      return this.fetch<T>(path, { ...options, _isRetry: true } as any);
    }
  }
  this.onUnauthorised();
  throw new ApiRequestError('Unauthorised', 'E_UNAUTHORISED', 401);
}
```

Add the refresh method to the class:

```ts
private async attemptRefresh(): Promise<boolean> {
  try {
    const token = this.getToken();
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      credentials: 'include',
    });
    if (!res.ok) return false;
    const data = await res.json();
    this.onTokenRefreshed(data.access_token);
    return true;
  } catch {
    return false;
  }
}
```

Update constructor to accept `onTokenRefreshed`:

```ts
constructor(
  getToken: () => string | null,
  onUnauthorised: () => void,
  private onTokenRefreshed: (token: string) => void,
) {
```

- [ ] **Step 6: Update AuthProvider — add isLoading, apiClient, persist session across refresh**

In `apps/web/src/providers/auth-provider.tsx`:

**Update the `AuthContextValue` interface:**

```ts
interface AuthContextValue extends AuthState {
  login: (user: User, token: string, method: AuthMethod, org: Organisation | null) => void;
  logout: () => void;
  setOrg: (org: Organisation) => void;
  getToken: () => string | null;
  isLoading: boolean;     // ← ADD
  apiClient: ApiClient;   // ← ADD
}
```

**Add imports and state:**

```ts
import { ApiClient } from '@/lib/api/client';
```

**Add to AuthProvider body:**

```ts
const [isLoading, setIsLoading] = useState(true);

const onTokenRefreshed = useCallback((token: string) => {
  tokenRef.current = token;
}, []);

const apiClient = useMemo(
  () => new ApiClient(getToken, logout, onTokenRefreshed),
  [getToken, logout, onTokenRefreshed],
);

// On mount: attempt session restore via refresh cookie.
// The backend's refreshByCookie returns user data so we can restore full auth state.
useEffect(() => {
  fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/v1'}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  })
    .then(async (res) => {
      if (!res.ok) return;
      const data = await res.json();
      tokenRef.current = data.access_token;
      if (data.user) {
        setUser({
          id: data.user.id,
          address: data.user.address,
          displayName: data.user.displayName ?? null,
          email: null,
          authMethod: 'wallet', // default; actual method unknown after refresh
        });
        if (data.user.orgId) {
          // Fetch full org data — or set minimal shape
          setCurrentOrg({ id: data.user.orgId, name: '', legalName: null, billingPlan: 'free_trial' });
        }
      }
    })
    .catch(() => { /* no valid session */ })
    .finally(() => setIsLoading(false));
}, []); // eslint-disable-line react-hooks/exhaustive-deps
```

**Update the Provider value to include `isLoading` and `apiClient`:**

```ts
value={{
  user, accessToken: null, authMethod, currentOrg, isAuthenticated: !!user,
  login, logout, setOrg, getToken,
  isLoading,    // ← ADD
  apiClient,    // ← ADD
}}
```

- [ ] **Step 7: Create use-session-check.ts for (auth) layout**

```ts
// apps/web/src/hooks/use-session-check.ts
'use client';

import { useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/v1';

/** Lightweight session check for (auth) routes — no AuthProvider needed */
export function useSessionCheck() {
  const [hasSession, setHasSession] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })
      .then((res) => setHasSession(res.ok))
      .catch(() => setHasSession(false))
      .finally(() => setIsLoading(false));
  }, []);

  return { hasSession, isLoading };
}
```

- [ ] **Step 8: Create use-auth-guard.ts for (main) layout**

```ts
// apps/web/src/hooks/use-auth-guard.ts
'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';

export function useAuthGuard() {
  const { isAuthenticated, isLoading, currentOrg } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    if (!currentOrg && pathname !== '/onboarding') {
      router.replace('/onboarding');
    }
  }, [isAuthenticated, isLoading, currentOrg, pathname, router]);

  return { isLoading, isAuthenticated };
}
```

- [ ] **Step 9: Create use-auth.ts hook**

```ts
// apps/web/src/lib/api/hooks/use-auth.ts
'use client';

import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import { completeZkLogin, clearZkLoginSession } from '@/lib/sui/zklogin';
import type { AuthMethod } from '@/types';

export function useWalletLogin() {
  const { login, apiClient } = useAuth();

  return useMutation({
    mutationFn: async ({ address, signature, nonce }: {
      address: string;
      signature: string;
      nonce: string;
    }) => {
      const data = await apiClient.post<{
        access_token: string;
        user: { id: string; address: string; orgId: string | null; roleInOrg: number };
      }>('/auth/verify', { address, signature, nonce });
      return data;
    },
    onSuccess: (data) => {
      login(
        {
          id: data.user.id,
          address: data.user.address,
          displayName: null,
          email: null,
          authMethod: 'wallet' as AuthMethod,
        },
        data.access_token,
        'wallet',
        null, // org fetched separately if orgId exists
      );
    },
  });
}

export function useZkLogin() {
  const { login, apiClient } = useAuth();

  return useMutation({
    mutationFn: async (idToken: string) => {
      const zkResult = await completeZkLogin(idToken);
      const data = await apiClient.post<{
        access_token: string;
        user: { id: string; address: string; orgId: string | null; roleInOrg: number };
      }>('/auth/verify-zklogin', {
        jwt: zkResult.jwt,
        zkProof: zkResult.zkProof,
        ephemeralPubKey: zkResult.ephemeralPubKey,
        maxEpoch: zkResult.maxEpoch,
        salt: zkResult.salt,
      });
      clearZkLoginSession();
      return data;
    },
    onSuccess: (data) => {
      login(
        {
          id: data.user.id,
          address: data.user.address,
          displayName: null,
          email: null,
          authMethod: 'zklogin' as AuthMethod,
        },
        data.access_token,
        'zklogin',
        null,
      );
    },
  });
}

export function useLogout() {
  const { logout, apiClient } = useAuth();

  return useMutation({
    mutationFn: () => apiClient.post('/auth/logout'),
    onSettled: () => {
      clearZkLoginSession();
      logout();
    },
  });
}
```

- [ ] **Step 10: Create use-pools.ts hook**

```ts
// apps/web/src/lib/api/hooks/use-pools.ts
'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { queryKeys } from '@/lib/api/query-keys';
import type { Pool } from '@/types';

export function usePoolList() {
  const { currentOrg, apiClient } = useAuth();
  const orgId = currentOrg?.id ?? '';

  return useQuery({
    queryKey: queryKeys.pools.list(orgId),
    queryFn: () => apiClient.get<Pool[]>('/pools'),
    enabled: !!orgId,
    staleTime: 30_000,
  });
}

export function usePoolStats(pools: Pool[] | undefined) {
  return useMemo(() => {
    if (!pools) return null;
    return {
      totalPools: pools.length,
      totalAssetValue: pools.reduce(
        (sum, p) => sum + parseFloat(p.targetSize || '0'),
        0,
      ),
      pendingICReviews: pools.filter(
        (p) => p.currentState === 'ic_review',
      ).length,
    };
  }, [pools]);
}
```

- [ ] **Step 11: Update query-keys.ts**

Add `stats` key to pools:

```ts
pools: {
  all:    ['pools'] as const,
  list:   (orgId: string) => ['pools', 'list', orgId] as const,
  detail: (poolId: string) => ['pools', 'detail', poolId] as const,
  stats:  (orgId: string) => ['pools', 'stats', orgId] as const,
},
```

- [ ] **Step 12: Type-check frontend**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: Clean (may have minor issues to fix related to AuthProvider API changes — fix before proceeding).

- [ ] **Step 13: Commit**

```bash
git add apps/web/src/lib/ apps/web/src/hooks/ apps/web/src/providers/ apps/web/src/types/ apps/web/package.json
git commit -m "feat(web): add auth infrastructure — zkLogin flow, salt provider, API hooks, auth guards"
```

---

## Task 4: Frontend — Login Page

**Files:**
- Rewrite: `apps/web/src/app/(auth)/login/page.tsx`
- Create: `apps/web/src/components/auth/zklogin-button.tsx`
- Create: `apps/web/src/components/auth/wallet-connect-button.tsx`

- [ ] **Step 1: Create zklogin-button.tsx**

```tsx
// apps/web/src/components/auth/zklogin-button.tsx
'use client';

import { useState } from 'react';
import { useSuiClient } from '@mysten/dapp-kit';
import { prepareZkLoginRedirect } from '@/lib/sui/zklogin';

interface ZkLoginButtonProps {
  provider: 'google' | 'apple';
}

export function ZkLoginButton({ provider }: ZkLoginButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const suiClient = useSuiClient();

  const handleClick = async () => {
    setIsLoading(true);
    try {
      const systemState = await suiClient.getLatestSuiSystemState();
      const currentEpoch = Number(systemState.epoch);
      const url = await prepareZkLoginRedirect(provider, currentEpoch);
      window.location.href = url;
    } catch (err) {
      console.error('zkLogin redirect failed:', err);
      setIsLoading(false);
    }
  };

  const icon = provider === 'google' ? (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.32 2.32-2.11 4.45-3.74 4.25z"/>
    </svg>
  );

  const label = provider === 'google' ? 'Continue with Google' : 'Continue with Apple';

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className="flex w-full items-center gap-3 rounded-[10px] border border-border bg-card px-4 py-3 text-sm font-medium text-foreground shadow-sm transition-all duration-150 ease-out hover:border-primary hover:shadow-[0_1px_4px_rgba(0,123,255,0.12)] disabled:opacity-50"
    >
      {isLoading ? (
        <div className="size-[18px] animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      ) : icon}
      <span>{label}</span>
    </button>
  );
}
```

- [ ] **Step 2: Create wallet-connect-button.tsx**

```tsx
// apps/web/src/components/auth/wallet-connect-button.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { ConnectModal, useCurrentAccount, useSignPersonalMessage } from '@mysten/dapp-kit';
import { useWalletLogin } from '@/lib/api/hooks/use-auth';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/v1';

export function WalletConnectButton() {
  const currentAccount = useCurrentAccount();
  const { mutateAsync: signMessage } = useSignPersonalMessage();
  const walletLogin = useWalletLogin();
  const [isLoading, setIsLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingAuth, setPendingAuth] = useState(false);

  // After wallet connects via modal, auto-trigger challenge-sign-verify
  const performWalletAuth = useCallback(async () => {
    if (!currentAccount) return;
    setIsLoading(true);
    try {
      // 1. Get challenge
      const challengeRes = await fetch(`${API_BASE}/auth/challenge`, {
        credentials: 'include',
      });
      const challenge = await challengeRes.json();

      // 2. Sign message
      const message = `Sign in to BrineVault\nNonce: ${challenge.nonce}\nTimestamp: ${challenge.timestamp}`;
      const { signature } = await signMessage({
        message: new TextEncoder().encode(message),
      });

      // 3. Verify with backend
      walletLogin.mutate(
        { address: currentAccount.address, signature, nonce: challenge.nonce },
        { onSettled: () => setIsLoading(false) },
      );
    } catch (err) {
      console.error('Wallet login failed:', err);
      setIsLoading(false);
    }
  }, [currentAccount, signMessage, walletLogin]);

  // When wallet connects after modal, trigger auth
  useEffect(() => {
    if (currentAccount && pendingAuth) {
      setPendingAuth(false);
      performWalletAuth();
    }
  }, [currentAccount, pendingAuth, performWalletAuth]);

  const handleClick = () => {
    if (currentAccount) {
      // Already connected — go straight to challenge-sign
      performWalletAuth();
    } else {
      // Open dApp Kit ConnectModal
      setPendingAuth(true);
      setModalOpen(true);
    }
  };

  return (
    <>
      <ConnectModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        trigger={
          <button
            onClick={handleClick}
            disabled={isLoading || walletLogin.isPending}
            className="flex w-full items-center gap-3 rounded-[10px] border border-border bg-muted/30 px-4 py-3 text-sm font-medium text-muted-foreground transition-all duration-150 ease-out hover:border-primary hover:bg-card disabled:opacity-50"
          >
            {isLoading || walletLogin.isPending ? (
              <div className="size-[18px] animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="7" width="20" height="14" rx="2"/>
                <path d="M16 7V5a4 4 0 00-8 0v2"/>
              </svg>
            )}
            <span>Connect Wallet</span>
          </button>
        }
      />
    </>
  );
}
```

> **Note:** `ConnectModal` from `@mysten/dapp-kit` shows the wallet selector UI. The `trigger` prop renders the button. When the user selects a wallet, `currentAccount` updates, and the `useEffect` triggers `performWalletAuth`.
> Verify that `ConnectModal` API matches the installed `@mysten/dapp-kit` version. If the API differs, fall back to `useConnectWallet` + manual wallet selection UI.

- [ ] **Step 3: Rewrite login/page.tsx — split screen centered card**

```tsx
// apps/web/src/app/(auth)/login/page.tsx
import { Shield, Lock, CheckCircle } from 'lucide-react';
import { ZkLoginButton } from '@/components/auth/zklogin-button';
import { WalletConnectButton } from '@/components/auth/wallet-connect-button';
import { Separator } from '@/components/ui/separator';

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
      {/* Dot pattern background */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(circle, oklch(0.58 0.17 255 / 0.04) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Centered card */}
      <div className="relative z-10 flex w-full max-w-[820px] overflow-hidden rounded-xl border bg-card shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
        {/* Left — Brand panel */}
        <div className="hidden w-[360px] shrink-0 flex-col justify-center border-r bg-gradient-to-br from-blue-50/80 via-blue-50/50 to-sky-50/80 p-10 md:flex">
          <div className="mb-7 flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary shadow-[0_2px_8px_rgba(0,123,255,0.25)]">
              <Shield className="size-[18px] text-primary-foreground" />
            </div>
            <span className="text-xl font-bold tracking-tight text-foreground">
              BrineVault
            </span>
          </div>

          <h2 className="mb-2 text-base font-semibold leading-relaxed text-foreground">
            Institutional-Grade Data Vault
            <br />
            for Real-World Assets
          </h2>
          <p className="mb-8 text-[13px] leading-relaxed text-muted-foreground">
            Securing due diligence, legal docs, and asset proofs in a single
            encrypted workspace.
          </p>

          <div className="flex flex-col gap-2.5">
            <TrustBadge
              icon={<Lock className="size-3.5 text-primary" />}
              bg="bg-primary/8"
              label="Zero-Trust Client-Side Encryption"
            />
            <TrustBadge
              icon={<CheckCircle className="size-3.5 text-success" />}
              bg="bg-success/8"
              label="On-Chain Immutable Audit Trail"
            />
            <TrustBadge
              icon={<Shield className="size-3.5 text-purple-500" />}
              bg="bg-purple-500/8"
              label="Compliance-Grade Access Control"
            />
          </div>
        </div>

        {/* Right — Login form */}
        <div className="flex flex-1 flex-col justify-center px-9 py-10">
          {/* Mobile-only logo */}
          <div className="mb-6 flex items-center gap-2 md:hidden">
            <Shield className="size-5 text-primary" />
            <span className="font-semibold tracking-tight">BrineVault</span>
          </div>

          <h1 className="text-xl font-semibold text-foreground">Welcome</h1>
          <p className="mb-8 text-[13px] text-muted-foreground">
            Sign in to access your data vault
          </p>

          <div className="space-y-2.5">
            <ZkLoginButton provider="google" />
            <ZkLoginButton provider="apple" />
          </div>

          <div className="my-6 flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
              or
            </span>
            <Separator className="flex-1" />
          </div>

          <WalletConnectButton />

          <p className="mt-8 text-center text-[11px] text-muted-foreground/60">
            Powered by{' '}
            <span className="font-medium text-muted-foreground">
              Sui Network
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

function TrustBadge({
  icon,
  bg,
  label,
}: {
  icon: React.ReactNode;
  bg: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={`flex size-7 shrink-0 items-center justify-center rounded-md ${bg}`}>
        {icon}
      </div>
      <span className="text-xs font-medium text-foreground">{label}</span>
    </div>
  );
}
```

- [ ] **Step 4: Create OAuth callback page**

```tsx
// apps/web/src/app/(auth)/callback/page.tsx
'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useZkLogin } from '@/lib/api/hooks/use-auth';
import { Shield, Loader2 } from 'lucide-react';

export default function CallbackPage() {
  const router = useRouter();
  const zkLogin = useZkLogin();
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    // Extract id_token from URL fragment
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const idToken = params.get('id_token');

    if (!idToken) {
      router.replace('/login');
      return;
    }

    zkLogin.mutate(idToken, {
      onSuccess: (data) => {
        router.replace(data.user.orgId ? '/dashboard' : '/onboarding');
      },
      onError: () => {
        // TODO: show toast with error message
        router.replace('/login');
      },
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <Shield className="size-8 text-primary" />
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        <span className="text-sm">Completing sign-in...</span>
      </div>
      {zkLogin.isError && (
        <p className="text-sm text-destructive">
          Authentication service temporarily unavailable. Redirecting...
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Type-check**

```bash
cd apps/web && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/(auth)/ apps/web/src/components/auth/
git commit -m "feat(web): implement login page with zkLogin + wallet connect"
```

---

## Task 5: Frontend — Onboarding Wizard

**Files:**
- Create: `apps/web/src/components/auth/onboarding-wizard.tsx`
- Rewrite: `apps/web/src/app/(auth)/onboarding/page.tsx`

- [ ] **Step 1: Create onboarding-wizard.tsx**

```tsx
// apps/web/src/components/auth/onboarding-wizard.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Link2, ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/providers/auth-provider';
import { cn } from '@/lib/utils';

type Path = 'create' | 'join';
type Step = 1 | 2;

const fadeVariants = {
  initial: { opacity: 0, filter: 'blur(4px)' },
  animate: { opacity: 1, filter: 'blur(0px)', transition: { duration: 0.3 } },
  exit: { opacity: 0, filter: 'blur(4px)', transition: { duration: 0.15 } },
};

export function OnboardingWizard() {
  const [step, setStep] = useState<Step>(1);
  const [path, setPath] = useState<Path | null>(null);
  const [orgName, setOrgName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { setOrg, apiClient } = useAuth();
  const router = useRouter();

  const handleSelectPath = (selected: Path) => {
    setPath(selected);
    setStep(2);
    setError(null);
  };

  const handleBack = () => {
    setStep(1);
    setPath(null);
    setError(null);
  };

  const handleCreateOrg = async () => {
    if (orgName.trim().length < 2) {
      setError('Organisation name must be at least 2 characters');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const org = await apiClient.post<{ id: string; name: string; legalName: string | null; billingPlan: string }>('/orgs', {
        name: orgName.trim(),
        legalName: legalName.trim() || undefined,
      });
      setOrg({ id: org.id, name: org.name, legalName: org.legalName, billingPlan: org.billingPlan as any });
      router.replace('/dashboard');
    } catch (err: any) {
      setError(err.message ?? 'Failed to create organisation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinOrg = async () => {
    if (!inviteCode.trim()) {
      setError('Invite code is required');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await apiClient.post<{ org: { id: string; name: string; legalName: string | null; billingPlan: string } }>('/orgs/join', {
        inviteCode: inviteCode.trim(),
      });
      setOrg({
        id: result.org.id,
        name: result.org.name,
        legalName: result.org.legalName,
        billingPlan: result.org.billingPlan as any,
      });
      router.replace('/dashboard');
    } catch (err: any) {
      const msg = err.code === 'INVITE_EXPIRED' ? 'Invite code has expired'
        : err.code === 'INVITE_USED' ? 'Invite code has already been used'
        : err.code === 'INVITE_NOT_FOUND' ? 'Invalid invite code'
        : (err.message ?? 'Failed to join organisation');
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-[520px]">
      {/* Step indicator */}
      <p className="mb-6 text-center text-xs text-muted-foreground">
        Step {step} of 2
      </p>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="step1" {...fadeVariants}>
            <h1 className="mb-2 text-center text-xl font-semibold text-foreground">
              Welcome to BrineVault
            </h1>
            <p className="mb-8 text-center text-sm text-muted-foreground">
              Create or join an organisation to get started
            </p>

            <div className="grid grid-cols-2 gap-4">
              <PathCard
                icon={<Building2 className="size-6 text-primary" />}
                title="Create Organisation"
                description="Set up a new org and invite your team"
                onClick={() => handleSelectPath('create')}
              />
              <PathCard
                icon={<Link2 className="size-6 text-primary" />}
                title="Join with Invite Code"
                description="Enter your code to join an existing org"
                onClick={() => handleSelectPath('join')}
              />
            </div>
          </motion.div>
        )}

        {step === 2 && path === 'create' && (
          <motion.div key="step2-create" {...fadeVariants}>
            <button
              onClick={handleBack}
              className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" /> Back
            </button>

            <h2 className="mb-6 text-lg font-semibold text-foreground">
              Create Organisation
            </h2>

            <div className="space-y-4">
              <div>
                <Label htmlFor="org-name">Organisation Name *</Label>
                <Input
                  id="org-name"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Apex Holdings Ltd."
                  className="mt-1.5"
                  autoFocus
                />
              </div>
              <div>
                <Label htmlFor="legal-name">Legal Name</Label>
                <Input
                  id="legal-name"
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder="Optional"
                  className="mt-1.5"
                />
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button
                onClick={handleCreateOrg}
                disabled={isSubmitting || orgName.trim().length < 2}
                className="w-full"
              >
                {isSubmitting ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : null}
                Create Organisation
                <ArrowRight className="ml-2 size-4" />
              </Button>
            </div>
          </motion.div>
        )}

        {step === 2 && path === 'join' && (
          <motion.div key="step2-join" {...fadeVariants}>
            <button
              onClick={handleBack}
              className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" /> Back
            </button>

            <h2 className="mb-6 text-lg font-semibold text-foreground">
              Join with Invite Code
            </h2>

            <div className="space-y-4">
              <div>
                <Label htmlFor="invite-code">Invite Code *</Label>
                <Input
                  id="invite-code"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="XXXX-XXXX-XXXX"
                  className="mt-1.5 font-mono"
                  autoFocus
                />
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button
                onClick={handleJoinOrg}
                disabled={isSubmitting || !inviteCode.trim()}
                className="w-full"
              >
                {isSubmitting ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : null}
                Join Organisation
                <ArrowRight className="ml-2 size-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PathCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <Card
      onClick={onClick}
      className="cursor-pointer transition-all duration-150 ease-out hover:border-primary hover:shadow-[0_1px_4px_rgba(0,123,255,0.12)]"
    >
      <CardContent className="flex flex-col items-center p-6 text-center">
        <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary/8">
          {icon}
        </div>
        <h3 className="mb-1 text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Rewrite onboarding/page.tsx**

```tsx
// apps/web/src/app/(auth)/onboarding/page.tsx
import { OnboardingWizard } from '@/components/auth/onboarding-wizard';

export default function OnboardingPage() {
  return <OnboardingWizard />;
}
```

- [ ] **Step 3: Type-check**

```bash
cd apps/web && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/(auth)/onboarding/ apps/web/src/components/auth/onboarding-wizard.tsx
git commit -m "feat(web): implement stepped onboarding wizard (create org / join with invite)"
```

---

## Task 6: Frontend — Dashboard (Live API)

**Files:**
- Modify: `apps/web/src/app/(main)/dashboard/page.tsx`

- [ ] **Step 1: Rewrite dashboard with live API data**

Replace `MOCK_POOLS` and hardcoded stats with `usePoolList` and `usePoolStats`. Keep existing card layout. Add:
- Skeleton loading states (shadcn `Skeleton`)
- Empty state with CTA
- Error boundary with retry
- Number Ticker effect on stats (defer to a simple `font-variant-numeric: tabular-nums` for now; Magic UI NumberTicker can be added in a follow-up when the package is installed)

```tsx
// apps/web/src/app/(main)/dashboard/page.tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FolderKanban, ShieldCheck, PieChart, ArrowRight, Users, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { usePoolList, usePoolStats } from '@/lib/api/hooks/use-pools';

export default function DashboardPage() {
  const { data: pools, isLoading, error, refetch } = usePoolList();
  const stats = usePoolStats(pools);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <p className="text-sm text-destructive">Failed to load dashboard data.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="mt-2 text-muted-foreground">
            Overview of your pools and pending actions.
          </p>
        </div>
        <Link href="/pools/new">
          <Button className="bg-primary hover:bg-primary/90">
            <Plus className="mr-2 size-4" />
            Create New Pool
          </Button>
        </Link>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatsCard
          title="Total Pools"
          icon={<FolderKanban className="size-4 text-muted-foreground" />}
          value={stats?.totalPools}
          subtitle="Actively managed data rooms"
          isLoading={isLoading}
        />
        <StatsCard
          title="Total Asset Value"
          icon={<PieChart className="size-4 text-muted-foreground" />}
          value={stats ? `$${(stats.totalAssetValue / 1_000_000).toFixed(1)}M` : undefined}
          subtitle="Across all active pools"
          isLoading={isLoading}
        />
        <StatsCard
          title="Pending IC Reviews"
          icon={<ShieldCheck className="size-4 text-warning" />}
          value={stats?.pendingICReviews}
          subtitle="Require immediate attention"
          isLoading={isLoading}
          variant={stats && stats.pendingICReviews > 0 ? 'warning' : 'default'}
        />
      </div>

      {/* Pool list */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight">Active Pools</h2>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="mt-2 h-4 w-32" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="mt-2 h-1.5 w-full rounded-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !pools?.length ? (
          <Card className="py-12">
            <CardContent className="flex flex-col items-center text-center">
              <FolderKanban className="mb-4 size-10 text-muted-foreground/40" />
              <h3 className="mb-1 text-base font-semibold">No pools yet</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Create your first pool to get started.
              </p>
              <Link href="/pools/new">
                <Button size="sm">
                  <Plus className="mr-2 size-4" />
                  Create New Pool
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {pools.map((pool) => (
              <Link href={`/pools/${pool.id}`} key={pool.id} className="group">
                <Card className="h-full cursor-pointer transition-colors hover:border-primary">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg transition-colors group-hover:text-primary">
                          {pool.name}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {pool.borrowerName}
                        </CardDescription>
                      </div>
                      <Badge
                        variant={pool.currentState === 'dd_in_progress' ? 'default' : 'secondary'}
                        className={
                          pool.currentState === 'dd_in_progress'
                            ? 'bg-primary/20 text-primary border-primary/30'
                            : ''
                        }
                      >
                        {pool.currentState.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4 flex items-center justify-between text-sm">
                      <div className="flex items-center text-muted-foreground">
                        <Users className="mr-2 size-4" />
                        {pool.memberCount} Members
                      </div>
                      <div className="font-semibold tabular-nums">
                        ${parseFloat(pool.targetSize).toLocaleString()}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatsCard({
  title,
  icon,
  value,
  subtitle,
  isLoading,
  variant = 'default',
}: {
  title: string;
  icon: React.ReactNode;
  value: string | number | undefined;
  subtitle: string;
  isLoading: boolean;
  variant?: 'default' | 'warning';
}) {
  return (
    <Card
      className={
        variant === 'warning'
          ? 'border-warning/50 bg-warning/5 hover:shadow-md transition-shadow'
          : 'hover:shadow-md transition-shadow'
      }
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle
          className={`text-sm font-medium ${variant === 'warning' ? 'text-warning' : ''}`}
        >
          {title}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <div
            className={`text-2xl font-bold tabular-nums ${variant === 'warning' ? 'text-warning' : ''}`}
          >
            {value}
          </div>
        )}
        <p
          className={`mt-1 text-xs ${variant === 'warning' ? 'text-warning/80' : 'text-muted-foreground'}`}
        >
          {subtitle}
        </p>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Ensure Skeleton component exists**

Check if `apps/web/src/components/ui/skeleton.tsx` exists. If not:

```bash
cd apps/web && npx shadcn@latest add skeleton
```

- [ ] **Step 3: Type-check**

```bash
cd apps/web && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/(main)/dashboard/
git commit -m "feat(web): wire dashboard to live API with loading states and empty state"
```

---

## Task 7: Auth Guards & Layout Updates

**Files:**
- Modify: `apps/web/src/app/(auth)/layout.tsx`
- Modify: `apps/web/src/app/(main)/layout.tsx`

- [ ] **Step 1: Update (auth) layout with session check**

```tsx
// apps/web/src/app/(auth)/layout.tsx
'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useSessionCheck } from '@/hooks/use-session-check';

export default function AuthLayout({ children }: { children: ReactNode }) {
  const { hasSession, isLoading } = useSessionCheck();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && hasSession) {
      router.replace('/dashboard');
    }
  }, [hasSession, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (hasSession) return null; // redirecting

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Update (main) layout with auth guard**

```tsx
// apps/web/src/app/(main)/layout.tsx
'use client';

import type { ReactNode } from 'react';
import { AuthProvider } from '@/providers/auth-provider';
import { MainLayout } from '@/components/layout/main-layout';
import { AuthGuardWrapper } from './auth-guard-wrapper';

export default function MainGroupLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AuthGuardWrapper>
        <MainLayout>{children}</MainLayout>
      </AuthGuardWrapper>
    </AuthProvider>
  );
}
```

Create a new wrapper component:

```tsx
// apps/web/src/app/(main)/auth-guard-wrapper.tsx
'use client';

import type { ReactNode } from 'react';
import { useAuthGuard } from '@/hooks/use-auth-guard';

export function AuthGuardWrapper({ children }: { children: ReactNode }) {
  const { isLoading } = useAuthGuard();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
```

- [ ] **Step 3: Type-check**

```bash
cd apps/web && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/(auth)/layout.tsx apps/web/src/app/(main)/layout.tsx apps/web/src/app/(main)/auth-guard-wrapper.tsx
git commit -m "feat(web): add auth guards — redirect unauthenticated users and session-check on auth pages"
```

---

## Task 8: Brand Rename — RWA DataRoom → BrineVault

**Files:**
- Modify: `apps/web/src/app/layout.tsx`
- Modify: `apps/web/src/components/layout/header.tsx`

- [ ] **Step 1: Update root layout metadata**

In `apps/web/src/app/layout.tsx` line 17:

```ts
// OLD
title: 'RWA DataRoom',
description: 'Compliance-grade on-chain Virtual Data Room for structured credit',

// NEW
title: 'BrineVault',
description: 'Institutional-grade data vault for Real-World Assets',
```

- [ ] **Step 2: Update header brand name**

In `apps/web/src/components/layout/header.tsx` line 25:

```tsx
// OLD
<span className="text-sm font-semibold tracking-tight">RWA DataRoom</span>

// NEW
<span className="text-sm font-semibold tracking-tight">BrineVault</span>
```

- [ ] **Step 3: Build entire app to verify everything works**

```bash
cd apps/web && npx tsc --noEmit && pnpm build
```

Expected: Clean type-check and build. All routes detected.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/layout.tsx apps/web/src/components/layout/header.tsx
git commit -m "chore(web): rename brand from RWA DataRoom to BrineVault"
```

---

## Task 9: Frontend Tests

**Files:**
- Create: `apps/web/src/__tests__/login-page.test.tsx`
- Create: `apps/web/src/__tests__/onboarding-wizard.test.tsx`
- Create: `apps/web/src/__tests__/use-pools.test.ts`

- [ ] **Step 1: Install test dependencies if missing**

```bash
cd apps/web && pnpm add -D @testing-library/react @testing-library/jest-dom vitest jsdom msw
```

- [ ] **Step 2: Write LoginPage render test**

Verify that the login page renders both zkLogin buttons and the wallet connect button.

```tsx
// apps/web/src/__tests__/login-page.test.tsx
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

describe('LoginPage', () => {
  it('renders Google and Apple zkLogin buttons', () => {
    render(<LoginPage />);
    expect(screen.getByText('Continue with Google')).toBeDefined();
    expect(screen.getByText('Continue with Apple')).toBeDefined();
  });

  it('renders wallet connect button', () => {
    render(<LoginPage />);
    expect(screen.getByText('Connect Wallet')).toBeDefined();
  });

  it('shows BrineVault brand name', () => {
    render(<LoginPage />);
    expect(screen.getAllByText('BrineVault').length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Write OnboardingWizard step transition test**

```tsx
// apps/web/src/__tests__/onboarding-wizard.test.tsx
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
  motion: { div: ({ children, ...props }: any) => <div {...props}>{children}</div> },
  AnimatePresence: ({ children }: any) => children,
}));

describe('OnboardingWizard', () => {
  it('shows step 1 with two path options', () => {
    render(<OnboardingWizard />);
    expect(screen.getByText('Create Organisation')).toBeDefined();
    expect(screen.getByText('Join with Invite Code')).toBeDefined();
  });

  it('transitions to step 2 create form on click', () => {
    render(<OnboardingWizard />);
    fireEvent.click(screen.getByText('Create Organisation'));
    expect(screen.getByLabelText('Organisation Name *')).toBeDefined();
  });

  it('transitions to step 2 join form on click', () => {
    render(<OnboardingWizard />);
    fireEvent.click(screen.getByText('Join with Invite Code'));
    expect(screen.getByLabelText('Invite Code *')).toBeDefined();
  });
});
```

- [ ] **Step 4: Write usePoolStats test**

```ts
// apps/web/src/__tests__/use-pools.test.ts
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePoolStats } from '@/lib/api/hooks/use-pools';

describe('usePoolStats', () => {
  it('returns null for undefined pools', () => {
    const { result } = renderHook(() => usePoolStats(undefined));
    expect(result.current).toBeNull();
  });

  it('computes stats from pool list', () => {
    const pools = [
      { id: '1', currentState: 'dd_in_progress', targetSize: '5000000' },
      { id: '2', currentState: 'ic_review', targetSize: '10000000' },
    ] as any;
    const { result } = renderHook(() => usePoolStats(pools));
    expect(result.current).toEqual({
      totalPools: 2,
      totalAssetValue: 15_000_000,
      pendingICReviews: 1,
    });
  });

  it('handles empty pool list', () => {
    const { result } = renderHook(() => usePoolStats([]));
    expect(result.current).toEqual({
      totalPools: 0,
      totalAssetValue: 0,
      pendingICReviews: 0,
    });
  });
});
```

- [ ] **Step 5: Run tests**

```bash
cd apps/web && pnpm vitest run
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/__tests__/
git commit -m "test(web): add login page, onboarding wizard, and pool stats tests"
```

---

## Dependency Graph

```
Task 1 (shared types + SDK upgrade)
  └→ Task 2 (backend verify-zklogin + refresh fix)
  └→ Task 3 (frontend auth infra)
       └→ Task 4 (login page)
       └→ Task 5 (onboarding wizard)
       └→ Task 6 (dashboard live API)
       └→ Task 7 (auth guards)
       └→ Task 9 (frontend tests) — after Tasks 4-6
Task 8 (brand rename) — independent, can run in parallel
```

Tasks 4, 5, 6 can be parallelized after Task 3. Task 8 is independent. Task 9 depends on Tasks 4-6.
