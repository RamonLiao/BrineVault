import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestApp, type TestApp } from '../helpers/create-app.js';
import { AuthHelper } from '../helpers/auth.helper.js';

describe('Guards E2E', () => {
  let t: TestApp;
  let auth: AuthHelper;

  beforeAll(async () => {
    t = await createTestApp();
    auth = new AuthHelper(t.app);
  });

  afterAll(async () => {
    await t.app.close();
  });

  beforeEach(async () => {
    await t.redis.flushall();
  });

  // ─── AuthGuard ─────────────────────────────────────────

  describe('AuthGuard', () => {
    // Use GET /v1/orgs/:id (requires auth, no CSRF for GET)
    const protectedUrl = '/v1/orgs/some-org-id';

    it('rejects request without token → 401 MISSING_TOKEN', async () => {
      const res = await t.agent.get(protectedUrl).expect(401);
      expect(res.body.error.code).toBe('MISSING_TOKEN');
    });

    it('rejects malformed token → 401 INVALID_TOKEN', async () => {
      const res = await t.agent
        .get(protectedUrl)
        .set('Authorization', 'Bearer not-a-jwt')
        .expect(401);

      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });

    it('rejects empty Bearer → 401 MISSING_TOKEN', async () => {
      const res = await t.agent
        .get(protectedUrl)
        .set('Authorization', 'Bearer ')
        .expect(401);

      expect(res.body.error.code).toBe('MISSING_TOKEN');
    });

    it('rejects non-Bearer scheme → 401 MISSING_TOKEN', async () => {
      const res = await t.agent
        .get(protectedUrl)
        .set('Authorization', 'Basic abc123')
        .expect(401);

      expect(res.body.error.code).toBe('MISSING_TOKEN');
    });

    it('rejects blacklisted token → 401 TOKEN_REVOKED', async () => {
      const user = await auth.createAuthenticatedUser();

      // Blacklist the token's jti
      const { decodeJwt } = await import('jose');
      const payload = decodeJwt(user.accessToken);
      await t.redis.set(`token:blacklist:${payload.jti}`, '1', 'EX', 300);

      const res = await t.agent
        .get(protectedUrl)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(401);

      expect(res.body.error.code).toBe('TOKEN_REVOKED');
    });

    it('rejects when session is deleted → 401 SESSION_EXPIRED', async () => {
      const user = await auth.createAuthenticatedUser();

      // Delete session from Redis
      await t.redis.del(`session:${user.sid}`);

      const res = await t.agent
        .get(protectedUrl)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(401);

      expect(res.body.error.code).toBe('SESSION_EXPIRED');
    });

    it('allows valid token with active session', async () => {
      const orgId = 'org-001';
      const user = await auth.createAuthenticatedUser({ orgId, orgRole: 1 });

      // Mock orgsRepo to return org data
      t.repos.orgsRepo.findById.mockResolvedValue({
        id: orgId,
        name: 'Test Org',
      });

      const res = await t.agent
        .get(`/v1/orgs/${orgId}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(res.body.name).toBe('Test Org');
    });
  });

  // ─── CsrfGuard ────────────────────────────────────────

  describe('CsrfGuard', () => {
    it('rejects authenticated POST without CSRF token → 403', async () => {
      const user = await auth.createAuthenticatedUser();

      const res = await t.agent
        .post('/v1/orgs')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ name: 'Test' })
        .expect(403);

      expect(res.body.error.code).toBe('CSRF_INVALID');
    });

    it('rejects authenticated PATCH without CSRF token → 403', async () => {
      const user = await auth.createAuthenticatedUser();

      const res = await t.agent
        .patch('/v1/orgs/some-id')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ name: 'Updated' })
        .expect(403);

      expect(res.body.error.code).toBe('CSRF_INVALID');
    });

    it('rejects invalid CSRF token → 403', async () => {
      const user = await auth.createAuthenticatedUser();

      const res = await t.agent
        .post('/v1/orgs')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .set('x-csrf-token', 'invalid.token')
        .send({ name: 'Test' })
        .expect(403);

      expect(res.body.error.code).toBe('CSRF_INVALID');
    });

    it('allows authenticated POST with valid CSRF token', async () => {
      const user = await auth.createAuthenticatedUser();
      const csrf = auth.getCsrfToken();

      t.repos.usersRepo.findById.mockResolvedValue({
        id: user.userId,
        orgId: null,
      });
      t.repos.orgsRepo.create.mockResolvedValue({
        id: 'new-org',
        name: 'Test',
      });
      t.repos.usersRepo.update.mockResolvedValue([]);

      const res = await t.agent
        .post('/v1/orgs')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .set('x-csrf-token', csrf)
        .send({ name: 'Test' })
        .expect(201);

      expect(res.body.name).toBe('Test');
    });

    it('allows GET without CSRF token', async () => {
      const orgId = 'org-001';
      const user = await auth.createAuthenticatedUser({ orgId, orgRole: 1 });

      t.repos.orgsRepo.findById.mockResolvedValue({ id: orgId, name: 'Org' });

      await t.agent
        .get(`/v1/orgs/${orgId}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);
    });

    it('skips CSRF for public routes (POST /auth/verify)', async () => {
      // POST to public route without CSRF — should not get 403
      const res = await t.agent
        .post('/v1/auth/verify')
        .send({ address: 'x', signature: 'y', nonce: 'z' });

      // Should fail with 400 (validation) or 401 (nonce), not 403 (CSRF)
      expect(res.status).not.toBe(403);
      expect(res.body.error.code).not.toBe('CSRF_INVALID');
    });
  });
});
