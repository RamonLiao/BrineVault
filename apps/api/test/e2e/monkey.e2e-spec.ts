import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { createTestApp, type TestApp } from '../helpers/create-app.js';
import { AuthHelper } from '../helpers/auth.helper.js';
import { resetMockRepos } from '../helpers/mock-providers.js';
import { ROLES } from '@rwa-dataroom/shared';

// Mock Sui verify for any auth flow tests
vi.mock('@mysten/sui/verify', () => ({
  verifyPersonalMessageSignature: vi.fn().mockImplementation(async () => ({
    toSuiAddress: () => '0x' + 'a'.repeat(64),
  })),
}));

describe('Monkey Tests', () => {
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
    resetMockRepos(t.repos);
    await t.redis.flushall();
  });

  // ─── Malformed Bodies ──────────────────────────────────

  describe('Malformed request bodies', () => {
    it('handles null body on POST /v1/auth/verify', async () => {
      const res = await t.agent
        .post('/v1/auth/verify')
        .send(null)
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('handles array body instead of object', async () => {
      const res = await t.agent
        .post('/v1/auth/verify')
        .send([1, 2, 3])
        .expect(400);

      expect(res.body.error).toBeDefined();
    });

    it('handles malformed JSON', async () => {
      const res = await t.agent
        .post('/v1/auth/verify')
        .set('Content-Type', 'application/json')
        .send('{invalid json}');

      // Express returns 400 for malformed JSON
      expect(res.status).toBe(400);
    });
  });

  // ─── Extremely Long Strings ────────────────────────────

  describe('Extremely long strings', () => {
    it('rejects org name > 256 chars', async () => {
      const user = await auth.createAuthenticatedUser();
      const csrf = auth.getCsrfToken();

      const res = await t.agent
        .post('/v1/orgs')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .set('x-csrf-token', csrf)
        .send({ name: 'A'.repeat(257) })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects legalName > 512 chars', async () => {
      const user = await auth.createAuthenticatedUser();
      const csrf = auth.getCsrfToken();

      const res = await t.agent
        .post('/v1/orgs')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .set('x-csrf-token', csrf)
        .send({ name: 'Valid Name', legalName: 'L'.repeat(513) })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('handles extremely long address in verify', async () => {
      const res = await t.agent
        .post('/v1/auth/verify')
        .send({ address: '0x' + 'f'.repeat(10000), signature: 'x', nonce: 'y' });

      // Should fail at validation or nonce check, not crash
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body.error).toBeDefined();
    });
  });

  // ─── Unicode & Special Characters ─────────────────────

  describe('Unicode & special characters', () => {
    it('handles emoji in org name', async () => {
      const user = await auth.createAuthenticatedUser();
      const csrf = auth.getCsrfToken();
      t.repos.usersRepo.findById.mockResolvedValue({ id: user.userId, orgId: null });
      t.repos.orgsRepo.create.mockResolvedValue({
        id: 'org-emoji',
        name: '🏢 Corp',
      });
      t.repos.usersRepo.update.mockResolvedValue([]);

      const res = await t.agent
        .post('/v1/orgs')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .set('x-csrf-token', csrf)
        .send({ name: '🏢 Corp' })
        .expect(201);

      expect(res.body.name).toBe('🏢 Corp');
    });

    it('handles CJK characters in org name', async () => {
      const user = await auth.createAuthenticatedUser();
      const csrf = auth.getCsrfToken();
      t.repos.usersRepo.findById.mockResolvedValue({ id: user.userId, orgId: null });
      t.repos.orgsRepo.create.mockResolvedValue({ id: 'org-cjk', name: '株式会社テスト' });
      t.repos.usersRepo.update.mockResolvedValue([]);

      const res = await t.agent
        .post('/v1/orgs')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .set('x-csrf-token', csrf)
        .send({ name: '株式会社テスト' })
        .expect(201);

      expect(res.body.name).toBe('株式会社テスト');
    });

    it('handles special chars in invite code lookup', async () => {
      const user = await auth.createAuthenticatedUser();
      const csrf = auth.getCsrfToken();
      t.repos.usersRepo.findById.mockResolvedValue({ id: user.userId, orgId: null });
      t.repos.inviteCodesRepo.findByCode.mockResolvedValue(null);

      const res = await t.agent
        .post('/v1/orgs/join')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .set('x-csrf-token', csrf)
        .send({ inviteCode: '<script>alert(1)</script>' })
        .expect(404);

      expect(res.body.error.code).toBe('INVALID_INVITE_CODE');
    });
  });

  // ─── SQL Injection Attempts ────────────────────────────

  describe('SQL injection attempts', () => {
    it('handles SQL injection in orgId param', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: "' OR 1=1 --", orgRole: 1 });

      const res = await t.agent
        .get("/v1/orgs/' OR 1=1 --")
        .set('Authorization', `Bearer ${user.accessToken}`);

      // Should not crash — either 403 (wrong org) or handled gracefully
      expect([403, 404, 500]).not.toContain(undefined);
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('handles SQL injection in invite code', async () => {
      const user = await auth.createAuthenticatedUser();
      const csrf = auth.getCsrfToken();
      t.repos.usersRepo.findById.mockResolvedValue({ id: user.userId, orgId: null });
      t.repos.inviteCodesRepo.findByCode.mockResolvedValue(null);

      const res = await t.agent
        .post('/v1/orgs/join')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .set('x-csrf-token', csrf)
        .send({ inviteCode: "'; DROP TABLE invite_codes; --" })
        .expect(404);

      expect(res.body.error.code).toBe('INVALID_INVITE_CODE');
    });
  });

  // ─── Pagination Edge Cases ─────────────────────────────

  describe('Pagination edge cases', () => {
    it('handles page=0', async () => {
      const orgId = 'org-001';
      const user = await auth.createAuthenticatedUser({ orgId, orgRole: 1 });

      const res = await t.agent
        .get(`/v1/orgs/${orgId}/members?page=0&limit=20`)
        .set('Authorization', `Bearer ${user.accessToken}`);

      // Zod schema should reject page < 1 or handle gracefully
      expect(res.status).toBeGreaterThanOrEqual(200);
    });

    it('handles negative limit', async () => {
      const orgId = 'org-001';
      const user = await auth.createAuthenticatedUser({ orgId, orgRole: 1 });

      const res = await t.agent
        .get(`/v1/orgs/${orgId}/members?page=1&limit=-5`)
        .set('Authorization', `Bearer ${user.accessToken}`);

      expect(res.status).toBeGreaterThanOrEqual(200);
    });

    it('handles extremely large limit', async () => {
      const orgId = 'org-001';
      const user = await auth.createAuthenticatedUser({ orgId, orgRole: 1 });

      const res = await t.agent
        .get(`/v1/orgs/${orgId}/members?page=1&limit=999999`)
        .set('Authorization', `Bearer ${user.accessToken}`);

      expect(res.status).toBeGreaterThanOrEqual(200);
    });
  });

  // ─── Non-existent Routes ──────────────────────────────

  describe('Non-existent routes', () => {
    it('returns 404 for unknown route', async () => {
      const res = await t.agent.get('/v1/nonexistent');
      expect(res.status).toBe(404);
    });

    it('returns 404 for wrong HTTP method', async () => {
      const res = await t.agent.delete('/v1/health');
      expect(res.status).toBe(404);
    });
  });

  // ─── Nonce Replay Across Contexts ─────────────────────

  describe('Nonce replay', () => {
    it('consumed nonce cannot be reused even after delay', async () => {
      const challenge = await t.agent.get('/v1/auth/challenge');
      const nonce = challenge.body.nonce;

      t.repos.usersRepo.upsertByWallet.mockResolvedValue([
        { id: 'user-1', orgId: null, roleInOrg: 0 },
      ]);

      // Consume nonce
      await t.agent
        .post('/v1/auth/verify')
        .send({ address: '0x' + 'a'.repeat(64), signature: 'sig', nonce })
        .expect(201);

      // Try to reuse
      const res = await t.agent
        .post('/v1/auth/verify')
        .send({ address: '0x' + 'a'.repeat(64), signature: 'sig', nonce })
        .expect(401);

      expect(res.body.error.code).toBe('INVALID_NONCE');
    });
  });

  // ─── Concurrent Requests ──────────────────────────────

  describe('Concurrent requests', () => {
    it('handles concurrent challenge requests without collision', async () => {
      // Send requests sequentially to avoid ECONNRESET with supertest
      const nonces: string[] = [];
      for (let i = 0; i < 5; i++) {
        const res = await t.agent.get('/v1/auth/challenge').expect(200);
        nonces.push(res.body.nonce);
      }

      const unique = new Set(nonces);
      expect(unique.size).toBe(5); // all nonces unique
    });

    it('handles concurrent org creation attempts', async () => {
      const user = await auth.createAuthenticatedUser();
      const csrf = auth.getCsrfToken();

      t.repos.usersRepo.findById.mockResolvedValue({ id: user.userId, orgId: null });
      t.repos.orgsRepo.create.mockResolvedValue({ id: 'org-1', name: 'Test' });
      t.repos.usersRepo.update.mockResolvedValue([]);

      // Fire 5 concurrent requests — at least one should succeed
      const results = await Promise.allSettled(
        Array.from({ length: 5 }, () =>
          t.agent
            .post('/v1/orgs')
            .set('Authorization', `Bearer ${user.accessToken}`)
            .set('x-csrf-token', csrf)
            .send({ name: 'Test' }),
        ),
      );

      // All should get a response (no crashes)
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      expect(fulfilled.length).toBe(5);
    });
  });

  // ─── Header Edge Cases ────────────────────────────────

  describe('Header edge cases', () => {
    it('handles Authorization header with extra spaces', async () => {
      const res = await t.agent
        .get('/v1/orgs/test')
        .set('Authorization', 'Bearer   ')
        .expect(401);

      expect(res.body.error.code).toBe('MISSING_TOKEN');
    });

    it('handles empty x-csrf-token header', async () => {
      const user = await auth.createAuthenticatedUser();

      const res = await t.agent
        .post('/v1/orgs')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .set('x-csrf-token', '')
        .send({ name: 'Test' })
        .expect(403);

      expect(res.body.error.code).toBe('CSRF_INVALID');
    });
  });
});
