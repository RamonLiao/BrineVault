import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestApp, type TestApp } from '../helpers/create-app.js';
import { AuthHelper, type AuthUser } from '../helpers/auth.helper.js';
import { resetMockRepos } from '../helpers/mock-providers.js';

// ─── Shared test data ────────────────────────────────────────

const ORG_ID = 'org-001';
const POOL_ID = 'pool-1';
const MEMBER_ADDR = '0x' + 'c'.repeat(64);

const mockPool = {
  id: POOL_ID,
  suiObjectId: '0x' + 'p'.repeat(64),
  orgId: ORG_ID,
  name: 'Test Pool',
  currentState: 0,
};

const mockDataroom = {
  id: 'dr-1',
  suiObjectId: '0x' + 'd'.repeat(64),
  poolId: POOL_ID,
  ownerAddress: '0x' + 'a'.repeat(64),
  memberCount: 1,
};

const mockMember = {
  id: 'm-1',
  dataroomId: 'dr-1',
  poolId: POOL_ID,
  memberAddress: MEMBER_ADDR,
  role: 8,
  isActive: true,
  addedByAddress: '0x' + 'a'.repeat(64),
};

describe('DataRooms E2E', () => {
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

  // ─── GET /v1/pools/:poolId/dataroom ──────────────────────

  describe('GET /v1/pools/:poolId/dataroom', () => {
    it('org member → 200 + { dataroom, members }', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 1 });
      t.repos.poolsRepo.findById.mockResolvedValue(mockPool);
      t.repos.dataroomsRepo.findByPoolId.mockResolvedValue(mockDataroom);
      t.repos.membersRepo.findActiveByPoolId.mockResolvedValue([mockMember]);

      const res = await t.agent
        .get(`/v1/pools/${POOL_ID}/dataroom`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(res.body.dataroom.id).toBe('dr-1');
      expect(res.body.members).toHaveLength(1);
    });

    it('wrong org → 403', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: 'other-org', orgRole: 1 });
      t.repos.poolsRepo.findById.mockResolvedValue(mockPool);

      const res = await t.agent
        .get(`/v1/pools/${POOL_ID}/dataroom`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(403);

      expect(res.body.error.code).toBe('NOT_IN_ORG');
    });

    it('pool not found → 404', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 1 });
      t.repos.poolsRepo.findById.mockResolvedValue(null);

      const res = await t.agent
        .get(`/v1/pools/${POOL_ID}/dataroom`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(404);

      expect(res.body.error.code).toBe('POOL_NOT_FOUND');
    });
  });

  // ─── POST /v1/pools/:poolId/dataroom/members ─────────────

  describe('POST /v1/pools/:poolId/dataroom/members', () => {
    it('valid → 201 + { txBytes }', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });
      t.repos.poolsRepo.findById.mockResolvedValue(mockPool);

      const res = await t.agent
        .post(`/v1/pools/${POOL_ID}/dataroom/members`)
        .set(authHeaders(user))
        .send({
          adminConfigId: 'admin-cfg-1',
          address: MEMBER_ADDR,
          role: 8,
        })
        .expect(201);

      expect(res.body.txBytes).toBe('mock-tx-bytes');
    });

    it('invalid address (no 0x prefix) → 400', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });

      const res = await t.agent
        .post(`/v1/pools/${POOL_ID}/dataroom/members`)
        .set(authHeaders(user))
        .send({
          adminConfigId: 'admin-cfg-1',
          address: 'c'.repeat(64),
          role: 8,
        })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ─── DELETE /v1/pools/:poolId/dataroom/members/:address ──

  describe('DELETE /v1/pools/:poolId/dataroom/members/:address', () => {
    it('valid → 200 + { txBytes }', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });
      t.repos.poolsRepo.findById.mockResolvedValue(mockPool);

      const res = await t.agent
        .delete(`/v1/pools/${POOL_ID}/dataroom/members/${MEMBER_ADDR}`)
        .set(authHeaders(user))
        .send({ adminConfigId: 'admin-cfg-1' })
        .expect(200);

      expect(res.body.txBytes).toBe('mock-tx-bytes');
    });
  });

  // ─── PATCH /v1/pools/:poolId/dataroom/members/:address ───

  describe('PATCH /v1/pools/:poolId/dataroom/members/:address', () => {
    it('valid → 200 + { txBytes }', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });
      t.repos.poolsRepo.findById.mockResolvedValue(mockPool);

      const res = await t.agent
        .patch(`/v1/pools/${POOL_ID}/dataroom/members/${MEMBER_ADDR}`)
        .set(authHeaders(user))
        .send({ adminConfigId: 'admin-cfg-1', newRole: 16 })
        .expect(200);

      expect(res.body.txBytes).toBe('mock-tx-bytes');
    });

    it('invalid role (0) → 400', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });

      const res = await t.agent
        .patch(`/v1/pools/${POOL_ID}/dataroom/members/${MEMBER_ADDR}`)
        .set(authHeaders(user))
        .send({ adminConfigId: 'admin-cfg-1', newRole: 0 })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ─── POST /v1/pools/:poolId/dataroom/folders ─────────────

  describe('POST /v1/pools/:poolId/dataroom/folders', () => {
    it('valid → 201 + { txBytes }', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });
      t.repos.poolsRepo.findById.mockResolvedValue(mockPool);

      const res = await t.agent
        .post(`/v1/pools/${POOL_ID}/dataroom/folders`)
        .set(authHeaders(user))
        .send({
          adminConfigId: 'admin-cfg-1',
          name: 'Due Diligence',
          visibleToRoles: 8,
        })
        .expect(201);

      expect(res.body.txBytes).toBe('mock-tx-bytes');
    });
  });
});
