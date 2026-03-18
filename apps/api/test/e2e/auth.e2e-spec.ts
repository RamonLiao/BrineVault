import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { createTestApp, type TestApp } from '../helpers/create-app.js';
import { AuthHelper } from '../helpers/auth.helper.js';
import { resetMockRepos } from '../helpers/mock-providers.js';

// Mock Sui signature verification — E2E tests focus on HTTP layer, not crypto.
let mockRecoveredAddress = '0x' + 'a'.repeat(64);

vi.mock('@mysten/sui/verify', () => ({
  verifyPersonalMessageSignature: vi.fn().mockImplementation(async () => ({
    toSuiAddress: () => mockRecoveredAddress,
  })),
}));

describe('Auth E2E', () => {
  let t: TestApp;
  let auth: AuthHelper;

  const testAddress = '0x' + 'a'.repeat(64);
  const testUserId = 'user-001';

  beforeAll(async () => {
    t = await createTestApp();
    auth = new AuthHelper(t.app);
  });

  afterAll(async () => {
    await t.app.close();
  });

  beforeEach(async () => {
    resetMockRepos(t.repos);
    await t.redis.flushall();
    mockRecoveredAddress = testAddress;
  });

  // ─── GET /v1/auth/challenge ──────────────────────────────

  describe('GET /v1/auth/challenge', () => {
    it('returns nonce, timestamp, expiresAt', async () => {
      const res = await t.agent.get('/v1/auth/challenge').expect(200);

      expect(res.body.nonce).toHaveLength(24); // 12 bytes hex
      expect(res.body.timestamp).toBeTypeOf('number');
      expect(res.body.expiresAt).toBeGreaterThan(res.body.timestamp);
    });

    it('stores challenge in Redis', async () => {
      const res = await t.agent.get('/v1/auth/challenge').expect(200);
      const stored = await t.redis.get(`auth:challenge:${res.body.nonce}`);
      expect(stored).not.toBeNull();

      const data = JSON.parse(stored!);
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('ip');
    });

    it('is accessible without authentication', async () => {
      const res = await t.agent.get('/v1/auth/challenge');
      expect(res.status).toBe(200);
    });
  });

  // ─── POST /v1/auth/verify ───────────────────────────────

  describe('POST /v1/auth/verify', () => {
    it('returns access_token, user, and sets refresh_token cookie', async () => {
      // Arrange: get challenge, then configure mock
      const challenge = await t.agent.get('/v1/auth/challenge');
      const nonce = challenge.body.nonce;

      t.repos.usersRepo.upsertByWallet.mockResolvedValue([
        { id: testUserId, orgId: null, roleInOrg: 0 },
      ]);

      // Act
      const res = await t.agent
        .post('/v1/auth/verify')
        .send({ address: testAddress, signature: 'fake-sig', nonce })
        .expect(201);

      // Assert response
      expect(res.body.access_token).toBeTypeOf('string');
      expect(res.body.user).toEqual({
        id: testUserId,
        address: testAddress,
        orgId: null,
        roleInOrg: 0,
      });

      // Assert refresh_token cookie
      const cookies = res.headers['set-cookie'] as string[];
      expect(cookies).toBeDefined();
      const refreshCookie = (Array.isArray(cookies) ? cookies : [cookies]).find(
        (c: string) => c.startsWith('refresh_token='),
      );
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie).toContain('HttpOnly');
      expect(refreshCookie).toContain('Path=/v1/auth');
    });

    it('rejects invalid/expired nonce', async () => {
      const res = await t.agent
        .post('/v1/auth/verify')
        .send({ address: testAddress, signature: 'sig', nonce: 'nonexistent' })
        .expect(401);

      expect(res.body.error.code).toBe('INVALID_NONCE');
    });

    it('rejects mismatched address', async () => {
      const challenge = await t.agent.get('/v1/auth/challenge');
      // Mock returns different address than what client claims
      mockRecoveredAddress = '0x' + 'b'.repeat(64);

      const res = await t.agent
        .post('/v1/auth/verify')
        .send({ address: testAddress, signature: 'sig', nonce: challenge.body.nonce })
        .expect(401);

      expect(res.body.error.code).toBe('INVALID_SIGNATURE');
    });

    it('rejects missing fields (validation)', async () => {
      const res = await t.agent.post('/v1/auth/verify').send({}).expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('prevents nonce replay', async () => {
      const challenge = await t.agent.get('/v1/auth/challenge');
      const nonce = challenge.body.nonce;

      t.repos.usersRepo.upsertByWallet.mockResolvedValue([
        { id: testUserId, orgId: null, roleInOrg: 0 },
      ]);

      // First use — succeeds
      await t.agent
        .post('/v1/auth/verify')
        .send({ address: testAddress, signature: 'sig', nonce })
        .expect(201);

      // Second use — nonce consumed
      const res = await t.agent
        .post('/v1/auth/verify')
        .send({ address: testAddress, signature: 'sig', nonce })
        .expect(401);

      expect(res.body.error.code).toBe('INVALID_NONCE');
    });
  });

  // ─── POST /v1/auth/refresh ──────────────────────────────

  describe('POST /v1/auth/refresh', () => {
    it('returns new access_token and rotates refresh_token', async () => {
      const user = await auth.createAuthenticatedUser({ sub: testUserId });

      const res = await t.agent
        .post('/v1/auth/refresh')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .set('Cookie', `refresh_token=${user.refreshToken}`)
        .expect(201);

      expect(res.body.access_token).toBeTypeOf('string');
      expect(res.body.access_token).not.toBe(user.accessToken);

      // New refresh_token cookie set
      const cookies = res.headers['set-cookie'] as string[];
      const refreshCookie = (Array.isArray(cookies) ? cookies : [cookies]).find(
        (c: string) => c.startsWith('refresh_token='),
      );
      expect(refreshCookie).toBeDefined();
    });

    it('rejects missing refresh_token cookie', async () => {
      const user = await auth.createAuthenticatedUser();

      const res = await t.agent
        .post('/v1/auth/refresh')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(401);

      expect(res.body.error.code).toBe('MISSING_REFRESH_TOKEN');
    });

    it('rejects missing Authorization header', async () => {
      const res = await t.agent
        .post('/v1/auth/refresh')
        .set('Cookie', 'refresh_token=some-token')
        .expect(401);

      expect(res.body.error.code).toBe('MISSING_TOKEN');
    });

    it('detects refresh token reuse and destroys session', async () => {
      const user = await auth.createAuthenticatedUser({ sub: testUserId });

      // First refresh — succeeds, rotates token
      await t.agent
        .post('/v1/auth/refresh')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .set('Cookie', `refresh_token=${user.refreshToken}`)
        .expect(201);

      // Replay old refresh token — should fail (token reuse detection)
      const res = await t.agent
        .post('/v1/auth/refresh')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .set('Cookie', `refresh_token=${user.refreshToken}`)
        .expect(401);

      expect(res.body.error.code).toBe('TOKEN_REUSE_DETECTED');

      // Session should be destroyed
      const session = await t.redis.get(`session:${user.sid}`);
      expect(session).toBeNull();
    });
  });

  // ─── POST /v1/auth/logout ──────────────────────────────

  describe('POST /v1/auth/logout', () => {
    it('clears cookie and blacklists token', async () => {
      const user = await auth.createAuthenticatedUser();
      const csrf = auth.getCsrfToken();

      const res = await t.agent
        .post('/v1/auth/logout')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .set('x-csrf-token', csrf)
        .expect(204);

      // Cookie cleared
      const cookies = res.headers['set-cookie'] as string[];
      const clearCookie = (Array.isArray(cookies) ? cookies : [cookies]).find(
        (c: string) => c.includes('refresh_token=;') || c.includes('refresh_token='),
      );
      expect(clearCookie).toBeDefined();

      // Session destroyed
      const session = await t.redis.get(`session:${user.sid}`);
      expect(session).toBeNull();
    });

    it('rejects unauthenticated request', async () => {
      const res = await t.agent.post('/v1/auth/logout').expect(401);
      expect(res.body.error.code).toBe('MISSING_TOKEN');
    });
  });

  // ─── GET /v1/auth/csrf-token ───────────────────────────

  describe('GET /v1/auth/csrf-token', () => {
    it('returns a valid CSRF token', async () => {
      const res = await t.agent.get('/v1/auth/csrf-token').expect(200);

      expect(res.body.token).toBeTypeOf('string');
      expect(res.body.token).toContain('.'); // format: random.hmac
      expect(res.body.token.split('.')).toHaveLength(2);
    });

    it('is accessible without authentication', async () => {
      const res = await t.agent.get('/v1/auth/csrf-token');
      expect(res.status).toBe(200);
    });
  });
});
