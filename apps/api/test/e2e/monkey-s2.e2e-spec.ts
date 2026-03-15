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
  suiObjectId: '0x' + 'e'.repeat(64),
  poolId: POOL_ID,
  dataroomId: 'dr-1',
  title: 'Test Doc',
  currentVersion: 1,
};

const BASE_POOL_BODY = {
  adminConfigId: 'admin-cfg-1',
  orgIdHash: 'a'.repeat(64),
  borrowerNameHash: 'b'.repeat(64),
  currency: 'USD',
  targetNotional: '1000000',
  expectedMaturityDate: 1893456000,
  encryptionScheme: 0,
};

describe('Monkey Tests S2 — Pool / DataRoom / Document', () => {
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

  // ─── Pool Name Boundary ──────────────────────────────────

  describe('Pool name boundary', () => {
    it('name with 256 chars (max) → 201', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });

      const res = await t.agent
        .post('/v1/pools')
        .set(authHeaders(user))
        .send({ ...BASE_POOL_BODY, name: 'A'.repeat(256) })
        .expect(201);

      expect(res.body.txBytes).toBeDefined();
    });

    it('name with 257 chars → 400', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });

      const res = await t.agent
        .post('/v1/pools')
        .set(authHeaders(user))
        .send({ ...BASE_POOL_BODY, name: 'A'.repeat(257) })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ─── Pool Tags Boundary ──────────────────────────────────

  describe('Pool tags boundary', () => {
    it('empty tags [] → 201', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });

      const res = await t.agent
        .post('/v1/pools')
        .set(authHeaders(user))
        .send({ ...BASE_POOL_BODY, name: 'Pool', tags: [] })
        .expect(201);

      expect(res.body.txBytes).toBeDefined();
    });

    it('20 tags (max) → 201', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });
      const tags = Array.from({ length: 20 }, (_, i) => `tag-${i}`);

      const res = await t.agent
        .post('/v1/pools')
        .set(authHeaders(user))
        .send({ ...BASE_POOL_BODY, name: 'Pool', tags })
        .expect(201);

      expect(res.body.txBytes).toBeDefined();
    });

    it('21 tags → 400', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });
      const tags = Array.from({ length: 21 }, (_, i) => `tag-${i}`);

      const res = await t.agent
        .post('/v1/pools')
        .set(authHeaders(user))
        .send({ ...BASE_POOL_BODY, name: 'Pool', tags })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ─── Pool targetNotional Boundary ───────────────────────

  describe('targetNotional boundary', () => {
    it('very large numeric string → 201', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });

      const res = await t.agent
        .post('/v1/pools')
        .set(authHeaders(user))
        .send({ ...BASE_POOL_BODY, name: 'Pool', targetNotional: '99999999999999999999' })
        .expect(201);

      expect(res.body.txBytes).toBeDefined();
    });

    it('negative string "-1" → 400', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });

      const res = await t.agent
        .post('/v1/pools')
        .set(authHeaders(user))
        .send({ ...BASE_POOL_BODY, name: 'Pool', targetNotional: '-1' })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('non-numeric string "abc" → 400', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });

      const res = await t.agent
        .post('/v1/pools')
        .set(authHeaders(user))
        .send({ ...BASE_POOL_BODY, name: 'Pool', targetNotional: 'abc' })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ─── Pool encryptionScheme Boundary ──────────────────────

  describe('encryptionScheme boundary', () => {
    it('encryptionScheme 2 → 400', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });

      const res = await t.agent
        .post('/v1/pools')
        .set(authHeaders(user))
        .send({ ...BASE_POOL_BODY, name: 'Pool', encryptionScheme: 2 })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ─── Pool transition unknown function ────────────────────

  describe('Pool transition boundary', () => {
    it('unknown targetFunction → 400', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });
      t.repos.poolsRepo.findById.mockResolvedValue(mockPool);

      const res = await t.agent
        .post(`/v1/pools/${POOL_ID}/transitions`)
        .set(authHeaders(user))
        .send({ adminConfigId: 'admin-cfg-1', targetFunction: 'do_something_evil' })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ─── Member address boundary ────────────────────────────

  describe('Member address boundary', () => {
    it('address without 0x prefix → 400', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });

      const res = await t.agent
        .post(`/v1/pools/${POOL_ID}/dataroom/members`)
        .set(authHeaders(user))
        .send({ adminConfigId: 'admin-cfg-1', address: 'c'.repeat(64), role: 8 })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('address with only 63 hex chars after 0x → 400', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });

      const res = await t.agent
        .post(`/v1/pools/${POOL_ID}/dataroom/members`)
        .set(authHeaders(user))
        .send({ adminConfigId: 'admin-cfg-1', address: '0x' + 'c'.repeat(63), role: 8 })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ─── Member role boundary ───────────────────────────────

  describe('Member role boundary', () => {
    it('role 0 → 400', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });

      const res = await t.agent
        .post(`/v1/pools/${POOL_ID}/dataroom/members`)
        .set(authHeaders(user))
        .send({ adminConfigId: 'admin-cfg-1', address: '0x' + 'c'.repeat(64), role: 0 })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('role 64 → 400', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });

      const res = await t.agent
        .post(`/v1/pools/${POOL_ID}/dataroom/members`)
        .set(authHeaders(user))
        .send({ adminConfigId: 'admin-cfg-1', address: '0x' + 'c'.repeat(64), role: 64 })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ─── Document contentHash boundary ──────────────────────

  describe('Document contentHash boundary', () => {
    it('contentHash with 63 chars → 400', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });

      const res = await t.agent
        .post(`/v1/pools/${POOL_ID}/documents`)
        .set(authHeaders(user))
        .send({
          adminConfigId: 'admin-cfg-1',
          folderId: 0,
          docType: 1,
          title: 'Doc',
          visibleToRoles: 8,
          walrusBlobId: 'blob-1',
          contentHash: 'a'.repeat(63),
          sizeBytes: 1024,
        })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ─── Document sizeBytes boundary ─────────────────────────

  describe('Document sizeBytes boundary', () => {
    it('sizeBytes 0 → 400', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });

      const res = await t.agent
        .post(`/v1/pools/${POOL_ID}/documents`)
        .set(authHeaders(user))
        .send({
          adminConfigId: 'admin-cfg-1',
          folderId: 0,
          docType: 1,
          title: 'Doc',
          visibleToRoles: 8,
          walrusBlobId: 'blob-1',
          contentHash: 'a'.repeat(64),
          sizeBytes: 0,
        })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ─── Injection / XSS no-crash tests ─────────────────────

  describe('Injection & special character safety', () => {
    it('SQL injection in pool name → no crash (201)', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });

      const res = await t.agent
        .post('/v1/pools')
        .set(authHeaders(user))
        .send({ ...BASE_POOL_BODY, name: "'; DROP TABLE pools; --" })
        .expect(201);

      expect(res.body.txBytes).toBeDefined();
    });

    it('XSS in document title → no crash (201)', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });
      t.repos.poolsRepo.findById.mockResolvedValue(mockPool);

      const res = await t.agent
        .post(`/v1/pools/${POOL_ID}/documents`)
        .set(authHeaders(user))
        .send({
          adminConfigId: 'admin-cfg-1',
          folderId: 0,
          docType: 1,
          title: '<script>alert("xss")</script>',
          visibleToRoles: 8,
          walrusBlobId: 'blob-1',
          contentHash: 'a'.repeat(64),
          sizeBytes: 1024,
        })
        .expect(201);

      expect(res.body.txBytes).toBeDefined();
    });

    it('Unicode emoji in folder name → 201', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });
      t.repos.poolsRepo.findById.mockResolvedValue(mockPool);

      const res = await t.agent
        .post(`/v1/pools/${POOL_ID}/dataroom/folders`)
        .set(authHeaders(user))
        .send({
          adminConfigId: 'admin-cfg-1',
          name: '📁 Due Diligence 文件',
          visibleToRoles: 8,
        })
        .expect(201);

      expect(res.body.txBytes).toBeDefined();
    });
  });

  // ─── Empty body ──────────────────────────────────────────

  describe('Empty body', () => {
    it('empty body on POST /v1/pools → 400', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });

      const res = await t.agent
        .post('/v1/pools')
        .set(authHeaders(user))
        .send({})
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('empty body on POST /v1/pools/:poolId/dataroom/members → 400', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });

      const res = await t.agent
        .post(`/v1/pools/${POOL_ID}/dataroom/members`)
        .set(authHeaders(user))
        .send({})
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('empty body on POST /v1/pools/:poolId/documents → 400', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 32 });

      const res = await t.agent
        .post(`/v1/pools/${POOL_ID}/documents`)
        .set(authHeaders(user))
        .send({})
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
