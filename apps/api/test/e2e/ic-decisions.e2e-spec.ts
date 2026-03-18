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

const VALID_IC_BODY = {
  adminConfigId: 'admin-cfg-1',
  decisionType: 0,
  decisionText: 'Approved by IC committee',
  pdfBlobId: 'walrus-blob-123',
  committeeMembers: ['0x' + 'c'.repeat(64), '0x' + 'd'.repeat(64)],
  votes: [1, 1],
  relatedDocIds: [],
};

const mockDecision = {
  id: 'ic-1',
  poolId: POOL_ID,
  decisionType: 0,
  decisionText: 'Approved by IC committee',
  pdfBlobId: 'walrus-blob-123',
  index: 0,
};

describe('IC Decisions E2E', () => {
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

  // ─── POST /v1/pools/:poolId/ic-decisions ─────────────────

  describe('POST /v1/pools/:poolId/ic-decisions', () => {
    it('decisionType=0 (approval) → 201 + txBytes', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 1 });
      t.repos.poolsRepo.findById.mockResolvedValue(mockPool);

      const res = await t.agent
        .post(`/v1/pools/${POOL_ID}/ic-decisions`)
        .set(authHeaders(user))
        .send({ ...VALID_IC_BODY, decisionType: 0 })
        .expect(201);

      expect(res.body.txBytes).toBe('mock-tx-bytes');
      expect(t.suiTxService.buildRecordIcApprovalTx).toHaveBeenCalled();
    });

    it('decisionType=1 (rejection) → 201 + txBytes', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 1 });
      t.repos.poolsRepo.findById.mockResolvedValue(mockPool);

      const res = await t.agent
        .post(`/v1/pools/${POOL_ID}/ic-decisions`)
        .set(authHeaders(user))
        .send({ ...VALID_IC_BODY, decisionType: 1 })
        .expect(201);

      expect(res.body.txBytes).toBe('mock-tx-bytes');
      expect(t.suiTxService.buildRecordIcRejectionTx).toHaveBeenCalled();
    });

    it('decisionType=2 (request_changes) → 201 + txBytes', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 1 });
      t.repos.poolsRepo.findById.mockResolvedValue(mockPool);

      const res = await t.agent
        .post(`/v1/pools/${POOL_ID}/ic-decisions`)
        .set(authHeaders(user))
        .send({ ...VALID_IC_BODY, decisionType: 2 })
        .expect(201);

      expect(res.body.txBytes).toBe('mock-tx-bytes');
      expect(t.suiTxService.buildRecordIcRequestChangesTx).toHaveBeenCalled();
    });

    it('committeeMembers.length !== votes.length → 400', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 1 });

      const res = await t.agent
        .post(`/v1/pools/${POOL_ID}/ic-decisions`)
        .set(authHeaders(user))
        .send({ ...VALID_IC_BODY, committeeMembers: ['0x' + 'c'.repeat(64)], votes: [1, 0] })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('no auth → 401', async () => {
      await t.agent
        .post(`/v1/pools/${POOL_ID}/ic-decisions`)
        .send(VALID_IC_BODY)
        .expect(401);
    });

    it('pool not found → 404', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 1 });
      t.repos.poolsRepo.findById.mockResolvedValue(null);

      const res = await t.agent
        .post(`/v1/pools/${POOL_ID}/ic-decisions`)
        .set(authHeaders(user))
        .send(VALID_IC_BODY)
        .expect(404);

      expect(res.body.error.code).toBe('POOL_NOT_FOUND');
    });
  });

  // ─── GET /v1/pools/:poolId/ic-decisions ──────────────────

  describe('GET /v1/pools/:poolId/ic-decisions', () => {
    it('list → 200 + array', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 1 });
      t.repos.poolsRepo.findById.mockResolvedValue(mockPool);
      t.repos.icDecisionsRepo.findByPoolId.mockResolvedValue([mockDecision]);

      const res = await t.agent
        .get(`/v1/pools/${POOL_ID}/ic-decisions`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
    });

    it('no auth → 401', async () => {
      await t.agent
        .get(`/v1/pools/${POOL_ID}/ic-decisions`)
        .expect(401);
    });
  });

  // ─── GET /v1/pools/:poolId/ic-decisions/:index ───────────

  describe('GET /v1/pools/:poolId/ic-decisions/:index', () => {
    it('found → 200 + decision', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 1 });
      t.repos.poolsRepo.findById.mockResolvedValue(mockPool);
      t.repos.icDecisionsRepo.findByPoolAndIndex.mockResolvedValue(mockDecision);

      const res = await t.agent
        .get(`/v1/pools/${POOL_ID}/ic-decisions/0`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(res.body.id).toBe('ic-1');
      expect(res.body.index).toBe(0);
    });

    it('not found → 404', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 1 });
      t.repos.poolsRepo.findById.mockResolvedValue(mockPool);
      t.repos.icDecisionsRepo.findByPoolAndIndex.mockResolvedValue(null);

      const res = await t.agent
        .get(`/v1/pools/${POOL_ID}/ic-decisions/99`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(404);

      expect(res.body.error.code).toBe('IC_DECISION_NOT_FOUND');
    });

    it('no auth → 401', async () => {
      await t.agent
        .get(`/v1/pools/${POOL_ID}/ic-decisions/0`)
        .expect(401);
    });
  });
});
