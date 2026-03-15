import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestApp, type TestApp } from '../helpers/create-app.js';
import { AuthHelper, type AuthUser } from '../helpers/auth.helper.js';
import { resetMockRepos } from '../helpers/mock-providers.js';

// ─── Shared test data ────────────────────────────────────────

const ORG_ID = 'org-001';
const POOL_ID = 'pool-1';
const ACTOR_ADDRESS = '0x' + 'a'.repeat(64);

const mockPool = {
  id: POOL_ID,
  suiObjectId: '0x' + 'p'.repeat(64),
  orgId: ORG_ID,
  name: 'Test Pool',
  currentState: 0,
};

const mockAuditEvent = {
  id: 'evt-1',
  poolId: POOL_ID,
  eventType: 'pool_created',
  actorAddress: ACTOR_ADDRESS,
  targetId: POOL_ID,
  timestamp: new Date(),
  suiTxDigest: '0xdigest1',
};

describe('Audit E2E', () => {
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

  // ─── GET /v1/pools/:poolId/audit ─────────────────────────

  describe('GET /v1/pools/:poolId/audit', () => {
    it('default pagination → 200 + { data, page, limit }', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 1 });
      t.repos.poolsRepo.findById.mockResolvedValue(mockPool);
      t.repos.auditEventsRepo.findByPoolId.mockResolvedValue([mockAuditEvent]);

      const res = await t.agent
        .get(`/v1/pools/${POOL_ID}/audit`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.page).toBeDefined();
      expect(res.body.limit).toBeDefined();
    });

    it('page=2&limit=10 → pagination params passed', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 1 });
      t.repos.poolsRepo.findById.mockResolvedValue(mockPool);
      t.repos.auditEventsRepo.findByPoolId.mockResolvedValue([]);

      const res = await t.agent
        .get(`/v1/pools/${POOL_ID}/audit?page=2&limit=10`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(res.body.page).toBe(2);
      expect(res.body.limit).toBe(10);
    });

    it('no auth → 401', async () => {
      await t.agent
        .get(`/v1/pools/${POOL_ID}/audit`)
        .expect(401);
    });

    it('pool not found → 404', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 1 });
      t.repos.poolsRepo.findById.mockResolvedValue(null);

      const res = await t.agent
        .get(`/v1/pools/${POOL_ID}/audit`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(404);

      expect(res.body.error.code).toBe('POOL_NOT_FOUND');
    });
  });

  // ─── GET /v1/pools/:poolId/audit/export ──────────────────

  describe('GET /v1/pools/:poolId/audit/export', () => {
    it('format=json → 200 + array', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 1 });
      t.repos.poolsRepo.findById.mockResolvedValue(mockPool);
      t.repos.auditEventsRepo.findByPoolId.mockResolvedValue([mockAuditEvent]);

      const res = await t.agent
        .get(`/v1/pools/${POOL_ID}/audit/export?format=json`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
    });

    it('format=csv → 200 + CSV string with Content-Type text/csv', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 1 });
      t.repos.poolsRepo.findById.mockResolvedValue(mockPool);
      t.repos.auditEventsRepo.findByPoolId.mockResolvedValue([mockAuditEvent]);

      const res = await t.agent
        .get(`/v1/pools/${POOL_ID}/audit/export?format=csv`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(typeof res.text).toBe('string');
      expect(res.text).toContain('id,poolId,eventType');
    });

    it('no auth → 401', async () => {
      await t.agent
        .get(`/v1/pools/${POOL_ID}/audit/export?format=json`)
        .expect(401);
    });

    it('pool not found → 404', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 1 });
      t.repos.poolsRepo.findById.mockResolvedValue(null);

      const res = await t.agent
        .get(`/v1/pools/${POOL_ID}/audit/export?format=json`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(404);

      expect(res.body.error.code).toBe('POOL_NOT_FOUND');
    });
  });

  // ─── GET /v1/audit/me ────────────────────────────────────

  describe('GET /v1/audit/me', () => {
    it('returns user events → 200 + { data, page, limit }', async () => {
      const user = await auth.createAuthenticatedUser({
        orgId: ORG_ID,
        orgRole: 1,
        address: ACTOR_ADDRESS,
      });
      t.repos.auditEventsRepo.findByActorAddress.mockResolvedValue([mockAuditEvent]);

      const res = await t.agent
        .get('/v1/audit/me')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.page).toBeDefined();
      expect(res.body.limit).toBeDefined();
    });

    it('no auth → 401', async () => {
      await t.agent
        .get('/v1/audit/me')
        .expect(401);
    });
  });
});
