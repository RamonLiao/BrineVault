import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestApp, type TestApp } from '../helpers/create-app.js';
import { AuthHelper, type AuthUser } from '../helpers/auth.helper.js';
import { resetMockRepos } from '../helpers/mock-providers.js';

// ─── Shared test data ────────────────────────────────────────

const ORG_ID = 'org-001';
const POOL_ID = 'pool-1';
const DOC_ID = 'doc-1';

const mockPool = {
  id: POOL_ID,
  suiObjectId: '0x' + 'p'.repeat(64),
  orgId: ORG_ID,
  name: 'Test Pool',
  currentState: 0,
};

const mockDoc = {
  id: DOC_ID,
  suiObjectId: '0x' + 'd'.repeat(64),
  poolId: POOL_ID,
};

const VALID_REVIEW_BODY = {
  adminConfigId: 'admin-cfg-1',
  status: 0, // approved
};

const mockReview = {
  id: 'rev-1',
  documentId: DOC_ID,
  reviewerAddress: '0x' + 'a'.repeat(64),
  status: 0,
};

describe('Reviews E2E', () => {
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

  // ─── POST /v1/pools/:poolId/documents/:docId/reviews ─────

  describe('POST /v1/pools/:poolId/documents/:docId/reviews', () => {
    it('valid → 201 + txBytes', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 1 });
      t.repos.poolsRepo.findById.mockResolvedValue(mockPool);
      t.repos.documentsRepo.findById.mockResolvedValue(mockDoc);

      const res = await t.agent
        .post(`/v1/pools/${POOL_ID}/documents/${DOC_ID}/reviews`)
        .set(authHeaders(user))
        .send(VALID_REVIEW_BODY)
        .expect(201);

      expect(res.body.txBytes).toBe('mock-tx-bytes');
    });

    it('no auth → 401', async () => {
      await t.agent
        .post(`/v1/pools/${POOL_ID}/documents/${DOC_ID}/reviews`)
        .send(VALID_REVIEW_BODY)
        .expect(401);
    });

    it('invalid status=5 → 400', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 1 });

      const res = await t.agent
        .post(`/v1/pools/${POOL_ID}/documents/${DOC_ID}/reviews`)
        .set(authHeaders(user))
        .send({ ...VALID_REVIEW_BODY, status: 5 })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('pool not found → 404', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 1 });
      t.repos.poolsRepo.findById.mockResolvedValue(null);

      const res = await t.agent
        .post(`/v1/pools/${POOL_ID}/documents/${DOC_ID}/reviews`)
        .set(authHeaders(user))
        .send(VALID_REVIEW_BODY)
        .expect(404);

      expect(res.body.error.code).toBe('POOL_NOT_FOUND');
    });

    it('wrong org → 403', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: 'other-org', orgRole: 1 });
      t.repos.poolsRepo.findById.mockResolvedValue(mockPool);

      const res = await t.agent
        .post(`/v1/pools/${POOL_ID}/documents/${DOC_ID}/reviews`)
        .set(authHeaders(user))
        .send(VALID_REVIEW_BODY)
        .expect(403);

      expect(res.body.error.code).toBe('NOT_IN_ORG');
    });
  });

  // ─── GET /v1/pools/:poolId/documents/:docId/reviews ──────

  describe('GET /v1/pools/:poolId/documents/:docId/reviews', () => {
    it('list → 200 + array', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 1 });
      t.repos.poolsRepo.findById.mockResolvedValue(mockPool);
      t.repos.documentsRepo.findById.mockResolvedValue(mockDoc);
      t.repos.documentReviewsRepo.findByDocumentId.mockResolvedValue([mockReview]);

      const res = await t.agent
        .get(`/v1/pools/${POOL_ID}/documents/${DOC_ID}/reviews`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
    });

    it('no auth → 401', async () => {
      await t.agent
        .get(`/v1/pools/${POOL_ID}/documents/${DOC_ID}/reviews`)
        .expect(401);
    });
  });

  // ─── GET /v1/pools/:poolId/documents/:docId/reviews/summary ─

  describe('GET /v1/pools/:poolId/documents/:docId/reviews/summary', () => {
    it('summary → 200 + { total, approved, needsRevision, rejected }', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 1 });
      t.repos.poolsRepo.findById.mockResolvedValue(mockPool);
      t.repos.documentsRepo.findById.mockResolvedValue(mockDoc);
      t.repos.documentReviewsRepo.findByDocumentId.mockResolvedValue([
        { ...mockReview, status: 0 },
        { ...mockReview, id: 'rev-2', status: 0 },
        { ...mockReview, id: 'rev-3', status: 1 },
        { ...mockReview, id: 'rev-4', status: 2 },
      ]);

      const res = await t.agent
        .get(`/v1/pools/${POOL_ID}/documents/${DOC_ID}/reviews/summary`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(res.body.total).toBe(4);
      expect(res.body.approved).toBe(2);
      expect(res.body.needsRevision).toBe(1);
      expect(res.body.rejected).toBe(1);
    });

    it('empty reviews → summary all zeros', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 1 });
      t.repos.poolsRepo.findById.mockResolvedValue(mockPool);
      t.repos.documentsRepo.findById.mockResolvedValue(mockDoc);
      t.repos.documentReviewsRepo.findByDocumentId.mockResolvedValue([]);

      const res = await t.agent
        .get(`/v1/pools/${POOL_ID}/documents/${DOC_ID}/reviews/summary`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(res.body.total).toBe(0);
      expect(res.body.approved).toBe(0);
      expect(res.body.needsRevision).toBe(0);
      expect(res.body.rejected).toBe(0);
    });

    it('no auth → 401', async () => {
      await t.agent
        .get(`/v1/pools/${POOL_ID}/documents/${DOC_ID}/reviews/summary`)
        .expect(401);
    });
  });
});
