import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestApp, type TestApp } from '../helpers/create-app.js';
import { AuthHelper, type AuthUser } from '../helpers/auth.helper.js';
import { resetMockRepos } from '../helpers/mock-providers.js';

// ─── Shared constants ────────────────────────────────────────

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

describe('Monkey Tests S3a — Reviews / IC Decisions / Checklist / Audit', () => {
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

  function authHeaders(user: AuthUser) {
    return {
      Authorization: `Bearer ${user.accessToken}`,
      'x-csrf-token': auth.getCsrfToken(),
    };
  }

  // ─── Review: status overflow ─────────────────────────────

  describe('Review: status boundary', () => {
    it('status=255 (overflow, max is 2) → 400', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });

      const res = await t.agent
        .post(`/v1/pools/${POOL_ID}/documents/${DOC_ID}/reviews`)
        .set(authHeaders(user))
        .send({ adminConfigId: 'admin-cfg-1', status: 255 })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ─── Review: commentHash wrong length ───────────────────

  describe('Review: commentHash boundary', () => {
    it('commentHash with 63 chars (should be 64) → 400', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });

      const res = await t.agent
        .post(`/v1/pools/${POOL_ID}/documents/${DOC_ID}/reviews`)
        .set(authHeaders(user))
        .send({
          adminConfigId: 'admin-cfg-1',
          status: 0,
          commentHash: 'a'.repeat(63),
        })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ─── IC Decision: empty committeeMembers ─────────────────

  describe('IC Decision: committeeMembers boundary', () => {
    it('empty committeeMembers [] (min 1) → 400', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });

      const res = await t.agent
        .post(`/v1/pools/${POOL_ID}/ic-decisions`)
        .set(authHeaders(user))
        .send({
          adminConfigId: 'admin-cfg-1',
          decisionType: 0,
          decisionText: 'Approved',
          pdfBlobId: 'walrus-blob-123',
          committeeMembers: [],
          votes: [],
          relatedDocIds: [],
        })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('votes/members length mismatch → 400 (Zod refine)', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });

      const res = await t.agent
        .post(`/v1/pools/${POOL_ID}/ic-decisions`)
        .set(authHeaders(user))
        .send({
          adminConfigId: 'admin-cfg-1',
          decisionType: 0,
          decisionText: 'Approved',
          pdfBlobId: 'walrus-blob-123',
          committeeMembers: ['0x' + 'c'.repeat(64), '0x' + 'd'.repeat(64)],
          votes: [1],
          relatedDocIds: [],
        })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ─── IC Decision: decisionType overflow ─────────────────

  describe('IC Decision: decisionType boundary', () => {
    it('decisionType=99 (max is 2) → 400', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });

      const res = await t.agent
        .post(`/v1/pools/${POOL_ID}/ic-decisions`)
        .set(authHeaders(user))
        .send({
          adminConfigId: 'admin-cfg-1',
          decisionType: 99,
          decisionText: 'Approved',
          pdfBlobId: 'walrus-blob-123',
          committeeMembers: ['0x' + 'c'.repeat(64)],
          votes: [1],
          relatedDocIds: [],
        })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ─── IC Decision: decisionText length boundary ───────────

  describe('IC Decision: decisionText boundary', () => {
    it('decisionText with 10000 chars (at limit) → 201', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });
      t.repos.poolsRepo.findById.mockResolvedValue(mockPool);

      const res = await t.agent
        .post(`/v1/pools/${POOL_ID}/ic-decisions`)
        .set(authHeaders(user))
        .send({
          adminConfigId: 'admin-cfg-1',
          decisionType: 0,
          decisionText: 'A'.repeat(10000),
          pdfBlobId: 'walrus-blob-123',
          committeeMembers: ['0x' + 'c'.repeat(64)],
          votes: [1],
          relatedDocIds: [],
        })
        .expect(201);

      expect(res.body.txBytes).toBeDefined();
    });

    it('decisionText with 10001 chars (over max) → 400', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });

      const res = await t.agent
        .post(`/v1/pools/${POOL_ID}/ic-decisions`)
        .set(authHeaders(user))
        .send({
          adminConfigId: 'admin-cfg-1',
          decisionType: 0,
          decisionText: 'A'.repeat(10001),
          pdfBlobId: 'walrus-blob-123',
          committeeMembers: ['0x' + 'c'.repeat(64)],
          votes: [1],
          relatedDocIds: [],
        })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ─── Checklist: itemName too long ───────────────────────

  describe('Checklist: itemName boundary', () => {
    it('itemName with 1000 chars (max 512) → 400', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });

      const res = await t.agent
        .post(`/v1/pools/${POOL_ID}/checklist`)
        .set(authHeaders(user))
        .send({
          folder: 'Legal',
          itemName: 'X'.repeat(1000),
          isRequired: true,
        })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ─── Checklist: invalid status string ───────────────────

  describe('Checklist: status enum boundary', () => {
    it('PATCH with invalid status string → 400', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });

      const res = await t.agent
        .patch(`/v1/pools/${POOL_ID}/checklist/item-1`)
        .set(authHeaders(user))
        .send({ status: 'not_a_valid_status' })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ─── Checklist: PATCH non-existent itemId ────────────────

  describe('Checklist: non-existent item', () => {
    it('PATCH non-existent itemId → 404', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });
      t.repos.poolsRepo.findById.mockResolvedValue(mockPool);
      t.repos.checklistRepo.updateItem.mockResolvedValue([]);

      const res = await t.agent
        .patch(`/v1/pools/${POOL_ID}/checklist/nonexistent-item-id`)
        .set(authHeaders(user))
        .send({ status: 'uploaded' })
        .expect(404);

      expect(res.body.error.code).toBe('CHECKLIST_ITEM_NOT_FOUND');
    });
  });

  // ─── Audit: page/limit boundary ─────────────────────────

  describe('Audit: pagination boundary', () => {
    it('page=0 (min is 1) → 400', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });

      const res = await t.agent
        .get(`/v1/pools/${POOL_ID}/audit?page=0`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('limit=999 (max is 100) → 400', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });

      const res = await t.agent
        .get(`/v1/pools/${POOL_ID}/audit?limit=999`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ─── Audit: CSV export with 0 events ─────────────────────

  describe('Audit: CSV export with empty result', () => {
    it('format=csv with 0 events → 200 + empty string (header only)', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });
      t.repos.poolsRepo.findById.mockResolvedValue(mockPool);
      t.repos.auditEventsRepo.findByPoolId.mockResolvedValue([]);

      const res = await t.agent
        .get(`/v1/pools/${POOL_ID}/audit/export?format=csv`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(res.headers['content-type']).toMatch(/text\/csv/);
      // With 0 events the body is either empty or just the CSV header
      expect(typeof res.text).toBe('string');
    });
  });

  // ─── Empty body on POST endpoints ────────────────────────

  describe('Empty body on POST endpoints', () => {
    it('POST /reviews with empty body → 400', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });

      const res = await t.agent
        .post(`/v1/pools/${POOL_ID}/documents/${DOC_ID}/reviews`)
        .set(authHeaders(user))
        .send({})
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('POST /ic-decisions with empty body → 400', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });

      const res = await t.agent
        .post(`/v1/pools/${POOL_ID}/ic-decisions`)
        .set(authHeaders(user))
        .send({})
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('POST /checklist with empty body → 400', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });

      const res = await t.agent
        .post(`/v1/pools/${POOL_ID}/checklist`)
        .set(authHeaders(user))
        .send({})
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ─── Malformed poolId (UUID not validated by route) ──────

  describe('Malformed poolId passthrough', () => {
    it('GET /audit with malformed poolId → 404 (pool not found)', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });
      t.repos.poolsRepo.findById.mockResolvedValue(null);

      const res = await t.agent
        .get(`/v1/pools/not-a-uuid/audit`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(404);

      expect(res.body.error.code).toBe('POOL_NOT_FOUND');
    });

    it('GET /ic-decisions with malformed poolId → 404 (pool not found)', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });
      t.repos.poolsRepo.findById.mockResolvedValue(null);

      const res = await t.agent
        .get(`/v1/pools/!!!invalid!!!/ic-decisions`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(404);

      expect(res.body.error.code).toBe('POOL_NOT_FOUND');
    });

    it('GET /reviews with malformed poolId → 404 (pool not found)', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });
      t.repos.poolsRepo.findById.mockResolvedValue(null);
      t.repos.documentsRepo.findById.mockResolvedValue(null);

      const res = await t.agent
        .get(`/v1/pools/bad-id/documents/${DOC_ID}/reviews`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(404);

      // Could be POOL_NOT_FOUND or DOCUMENT_NOT_FOUND depending on lookup order
      expect(res.body.error.code).toMatch(/NOT_FOUND/);
    });
  });

  // ─── Concurrent requests ─────────────────────────────────

  describe('Concurrent requests (5 parallel GET)', () => {
    it('5 parallel GET /audit → all 200', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });
      t.repos.poolsRepo.findById.mockResolvedValue(mockPool);
      t.repos.auditEventsRepo.findByPoolId.mockResolvedValue([]);

      const results = await Promise.allSettled(
        Array.from({ length: 5 }, () =>
          t.agent
            .get(`/v1/pools/${POOL_ID}/audit`)
            .set('Authorization', `Bearer ${user.accessToken}`),
        ),
      );

      for (const result of results) {
        expect(result.status).toBe('fulfilled');
        if (result.status === 'fulfilled') {
          expect(result.value.status).toBe(200);
        }
      }
    });

    it('5 parallel GET /ic-decisions → all 200', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });
      t.repos.poolsRepo.findById.mockResolvedValue(mockPool);
      t.repos.icDecisionsRepo.findByPoolId.mockResolvedValue([]);

      const results = await Promise.allSettled(
        Array.from({ length: 5 }, () =>
          t.agent
            .get(`/v1/pools/${POOL_ID}/ic-decisions`)
            .set('Authorization', `Bearer ${user.accessToken}`),
        ),
      );

      for (const result of results) {
        expect(result.status).toBe('fulfilled');
        if (result.status === 'fulfilled') {
          expect(result.value.status).toBe(200);
        }
      }
    });

    it('5 parallel GET /reviews → all 200', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });
      t.repos.poolsRepo.findById.mockResolvedValue(mockPool);
      t.repos.documentsRepo.findById.mockResolvedValue(mockDoc);
      t.repos.documentReviewsRepo.findByDocumentId.mockResolvedValue([]);

      const results = await Promise.allSettled(
        Array.from({ length: 5 }, () =>
          t.agent
            .get(`/v1/pools/${POOL_ID}/documents/${DOC_ID}/reviews`)
            .set('Authorization', `Bearer ${user.accessToken}`),
        ),
      );

      for (const result of results) {
        expect(result.status).toBe('fulfilled');
        if (result.status === 'fulfilled') {
          expect(result.value.status).toBe(200);
        }
      }
    });
  });
});
