import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestApp, type TestApp } from '../helpers/create-app.js';
import { AuthHelper, type AuthUser } from '../helpers/auth.helper.js';
import { resetMockRepos } from '../helpers/mock-providers.js';

// ─── Shared test data ────────────────────────────────────────

const ORG_ID = 'org-001';
const POOL_ID = 'pool-1';

const mockPool = {
  id: POOL_ID,
  suiObjectId: '0x' + 'p'.repeat(64),
  orgId: ORG_ID,
  name: 'Test Pool',
  currentState: 0,
};

const VALID_CREATE_POOL_BODY = {
  name: 'My Pool',
  adminConfigId: 'admin-cfg-1',
  orgIdHash: 'a'.repeat(64),
  borrowerNameHash: 'b'.repeat(64),
  currency: 'USD',
  targetNotional: '1000000',
  expectedMaturityDate: 1893456000,
  encryptionScheme: 0,
  tags: [],
};

describe('Pools E2E', () => {
  let t: TestApp;
  let auth: AuthHelper;
  let csrf: string;

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
    csrf = auth.getCsrfToken();
  });

  function authHeaders(user: AuthUser) {
    return {
      Authorization: `Bearer ${user.accessToken}`,
      'x-csrf-token': csrf,
    };
  }

  // ─── POST /v1/pools ──────────────────────────────────────

  describe('POST /v1/pools', () => {
    it('authenticated user → 201 + { txBytes }', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });

      const res = await t.agent
        .post('/v1/pools')
        .set(authHeaders(user))
        .send(VALID_CREATE_POOL_BODY)
        .expect(201);

      expect(res.body.txBytes).toBe('mock-tx-bytes');
    });

    it('unauthenticated → 401', async () => {
      const res = await t.agent
        .post('/v1/pools')
        .send(VALID_CREATE_POOL_BODY)
        .expect(401);

      expect(res.body.error).toBeDefined();
    });

    it('invalid body (missing name) → 400', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });
      const { name: _name, ...bodyWithoutName } = VALID_CREATE_POOL_BODY;

      const res = await t.agent
        .post('/v1/pools')
        .set(authHeaders(user))
        .send(bodyWithoutName)
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ─── GET /v1/pools/org/:orgId ────────────────────────────

  describe('GET /v1/pools/org/:orgId', () => {
    it('org member → 200 + paginated', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 1 });
      t.repos.poolsRepo.findByOrgId.mockResolvedValue([mockPool]);
      t.repos.poolsRepo.countByOrgId.mockResolvedValue(1);

      const res = await t.agent
        .get(`/v1/pools/org/${ORG_ID}?page=1&limit=20`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.total).toBe(1);
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(20);
    });

    it('wrong org → 403', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: 'other-org', orgRole: 1 });

      const res = await t.agent
        .get(`/v1/pools/org/${ORG_ID}?page=1&limit=20`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(403);

      expect(res.body.error.code).toBe('NOT_IN_ORG');
    });
  });

  // ─── GET /v1/pools/:poolId ───────────────────────────────

  describe('GET /v1/pools/:poolId', () => {
    it('dataroom member → 200', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 1 });
      t.repos.poolsRepo.findById.mockResolvedValue(mockPool);
      t.repos.dataroomsRepo.findByPoolId.mockResolvedValue({
        id: 'dr-1',
        suiObjectId: '0x' + 'd'.repeat(64),
        poolId: POOL_ID,
        ownerAddress: user.address,
        memberCount: 1,
      });
      t.repos.membersRepo.findByDataroomAndAddress.mockResolvedValue({
        id: 'm-1',
        dataroomId: 'dr-1',
        poolId: POOL_ID,
        memberAddress: user.address,
        role: 8,
        isActive: true,
      });

      const res = await t.agent
        .get(`/v1/pools/${POOL_ID}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(res.body.id).toBe(POOL_ID);
    });

    it('non-member (no membership) → 403', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 1 });
      t.repos.poolsRepo.findById.mockResolvedValue(mockPool);
      t.repos.dataroomsRepo.findByPoolId.mockResolvedValue({
        id: 'dr-1',
        suiObjectId: '0x' + 'd'.repeat(64),
        poolId: POOL_ID,
        ownerAddress: '0x' + 'f'.repeat(64),
        memberCount: 0,
      });
      t.repos.membersRepo.findByDataroomAndAddress.mockResolvedValue(null);

      const res = await t.agent
        .get(`/v1/pools/${POOL_ID}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(403);

      expect(res.body.error.code).toBe('NOT_DATAROOM_MEMBER');
    });

    it('not found → 404', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 1 });
      t.repos.poolsRepo.findById.mockResolvedValue(null);

      const res = await t.agent
        .get(`/v1/pools/${POOL_ID}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(404);

      expect(res.body.error.code).toBe('POOL_NOT_FOUND');
    });
  });

  // ─── POST /v1/pools/:poolId/transitions ──────────────────

  describe('POST /v1/pools/:poolId/transitions', () => {
    it('valid → 201 + { txBytes }', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });
      t.repos.poolsRepo.findById.mockResolvedValue(mockPool);

      const res = await t.agent
        .post(`/v1/pools/${POOL_ID}/transitions`)
        .set(authHeaders(user))
        .send({ adminConfigId: 'admin-cfg-1', targetFunction: 'progress_to_dd' })
        .expect(201);

      expect(res.body.txBytes).toBe('mock-tx-bytes');
    });

    it('pool not found → 404', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });
      t.repos.poolsRepo.findById.mockResolvedValue(null);

      const res = await t.agent
        .post(`/v1/pools/${POOL_ID}/transitions`)
        .set(authHeaders(user))
        .send({ adminConfigId: 'admin-cfg-1', targetFunction: 'progress_to_dd' })
        .expect(404);

      expect(res.body.error.code).toBe('POOL_NOT_FOUND');
    });
  });

  // ─── DELETE /v1/pools/:poolId ────────────────────────────

  describe('DELETE /v1/pools/:poolId', () => {
    it('valid → 200 + { txBytes }', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });
      t.repos.poolsRepo.findById.mockResolvedValue(mockPool);

      const res = await t.agent
        .delete(`/v1/pools/${POOL_ID}`)
        .set(authHeaders(user))
        .send({ adminConfigId: 'admin-cfg-1' })
        .expect(200);

      expect(res.body.txBytes).toBe('mock-tx-bytes');
    });
  });

  // ─── POST /v1/pools/:poolId/sign ─────────────────────────

  describe('POST /v1/pools/:poolId/sign', () => {
    it('submit signed TX → 201', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });

      const res = await t.agent
        .post(`/v1/pools/${POOL_ID}/sign`)
        .set(authHeaders(user))
        .send({ txBytes: 'encoded-tx-bytes', signature: 'sig-abc' })
        .expect(201);

      expect(res.body.digest).toBeDefined();
    });
  });
});
