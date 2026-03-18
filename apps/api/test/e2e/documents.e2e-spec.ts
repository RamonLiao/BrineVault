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
  suiObjectId: '0x' + 'e'.repeat(64),
  poolId: POOL_ID,
  dataroomId: 'dr-1',
  title: 'Test Doc',
  currentVersion: 1,
};

const mockVersion = {
  id: 'v-1',
  documentId: DOC_ID,
  version: 1,
  walrusBlobId: 'blob-1',
  contentHash: 'a'.repeat(64),
  sizeBytes: '1024',
  uploadedByAddress: '0x' + 'a'.repeat(64),
};

const VALID_CREATE_DOC_BODY = {
  adminConfigId: 'admin-cfg-1',
  folderId: 0,
  docType: 1,
  title: 'Test Document',
  visibleToRoles: 8,
  walrusBlobId: 'blob-abc',
  contentHash: 'a'.repeat(64),
  sizeBytes: 1024,
};

describe('Documents E2E', () => {
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

  // ─── GET /v1/pools/:poolId/documents ─────────────────────

  describe('GET /v1/pools/:poolId/documents', () => {
    it('list → 200 + paginated', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 1 });
      t.repos.poolsRepo.findById.mockResolvedValue(mockPool);
      t.repos.documentsRepo.findByPoolId.mockResolvedValue([mockDoc]);
      t.repos.documentsRepo.countByPoolId.mockResolvedValue(1);

      const res = await t.agent
        .get(`/v1/pools/${POOL_ID}/documents?page=1&limit=20`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.total).toBe(1);
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(20);
    });

    it('wrong org → 403', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: 'other-org', orgRole: 1 });
      t.repos.poolsRepo.findById.mockResolvedValue(mockPool);

      const res = await t.agent
        .get(`/v1/pools/${POOL_ID}/documents?page=1&limit=20`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(403);

      expect(res.body.error.code).toBe('NOT_IN_ORG');
    });
  });

  // ─── POST /v1/pools/:poolId/documents ────────────────────

  describe('POST /v1/pools/:poolId/documents', () => {
    it('valid → 201 + { txBytes }', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });
      t.repos.poolsRepo.findById.mockResolvedValue(mockPool);

      const res = await t.agent
        .post(`/v1/pools/${POOL_ID}/documents`)
        .set(authHeaders(user))
        .send(VALID_CREATE_DOC_BODY)
        .expect(201);

      expect(res.body.txBytes).toBe('mock-tx-bytes');
    });

    it('missing title → 400', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });
      const { title: _title, ...bodyWithoutTitle } = VALID_CREATE_DOC_BODY;

      const res = await t.agent
        .post(`/v1/pools/${POOL_ID}/documents`)
        .set(authHeaders(user))
        .send(bodyWithoutTitle)
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ─── GET /v1/pools/:poolId/documents/:docId ──────────────

  describe('GET /v1/pools/:poolId/documents/:docId', () => {
    it('found → 200', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 1 });
      t.repos.poolsRepo.findById.mockResolvedValue(mockPool);
      t.repos.documentsRepo.findById.mockResolvedValue(mockDoc);

      const res = await t.agent
        .get(`/v1/pools/${POOL_ID}/documents/${DOC_ID}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(res.body.id).toBe(DOC_ID);
    });

    it('not found → 404', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 1 });
      t.repos.poolsRepo.findById.mockResolvedValue(mockPool);
      t.repos.documentsRepo.findById.mockResolvedValue(null);

      const res = await t.agent
        .get(`/v1/pools/${POOL_ID}/documents/${DOC_ID}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(404);

      expect(res.body.error.code).toBe('DOCUMENT_NOT_FOUND');
    });
  });

  // ─── POST /v1/pools/:poolId/documents/:docId/versions ────

  describe('POST /v1/pools/:poolId/documents/:docId/versions', () => {
    it('valid → 201 + { txBytes }', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });
      t.repos.poolsRepo.findById.mockResolvedValue(mockPool);
      t.repos.documentsRepo.findById.mockResolvedValue(mockDoc);

      const res = await t.agent
        .post(`/v1/pools/${POOL_ID}/documents/${DOC_ID}/versions`)
        .set(authHeaders(user))
        .send({
          adminConfigId: 'admin-cfg-1',
          walrusBlobId: 'blob-v2',
          contentHash: 'b'.repeat(64),
          sizeBytes: 2048,
        })
        .expect(201);

      expect(res.body.txBytes).toBe('mock-tx-bytes');
    });
  });

  // ─── DELETE /v1/pools/:poolId/documents/:docId ───────────

  describe('DELETE /v1/pools/:poolId/documents/:docId', () => {
    it('valid → 200 + { txBytes }', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });
      t.repos.poolsRepo.findById.mockResolvedValue(mockPool);
      t.repos.documentsRepo.findById.mockResolvedValue(mockDoc);

      const res = await t.agent
        .delete(`/v1/pools/${POOL_ID}/documents/${DOC_ID}`)
        .set(authHeaders(user))
        .send({ adminConfigId: 'admin-cfg-1' })
        .expect(200);

      expect(res.body.txBytes).toBe('mock-tx-bytes');
    });
  });

  // ─── GET /v1/pools/:poolId/documents/:docId/versions ─────

  describe('GET /v1/pools/:poolId/documents/:docId/versions', () => {
    it('list versions → 200', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 1 });
      t.repos.poolsRepo.findById.mockResolvedValue(mockPool);
      t.repos.documentsRepo.findById.mockResolvedValue(mockDoc);
      t.repos.documentVersionsRepo.findByDocumentId.mockResolvedValue([mockVersion]);

      const res = await t.agent
        .get(`/v1/pools/${POOL_ID}/documents/${DOC_ID}/versions`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
    });
  });

  // ─── GET /v1/pools/:poolId/documents/:docId/versions/:ver ─

  describe('GET /v1/pools/:poolId/documents/:docId/versions/:version', () => {
    it('found → 200', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 1 });
      t.repos.poolsRepo.findById.mockResolvedValue(mockPool);
      t.repos.documentsRepo.findById.mockResolvedValue(mockDoc);
      t.repos.documentVersionsRepo.findByDocumentAndVersion.mockResolvedValue(mockVersion);

      const res = await t.agent
        .get(`/v1/pools/${POOL_ID}/documents/${DOC_ID}/versions/1`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(res.body.version).toBe(1);
    });

    it('not found → 404', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 1 });
      t.repos.poolsRepo.findById.mockResolvedValue(mockPool);
      t.repos.documentsRepo.findById.mockResolvedValue(mockDoc);
      t.repos.documentVersionsRepo.findByDocumentAndVersion.mockResolvedValue(null);

      const res = await t.agent
        .get(`/v1/pools/${POOL_ID}/documents/${DOC_ID}/versions/99`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(404);

      expect(res.body.error.code).toBe('VERSION_NOT_FOUND');
    });
  });
});
