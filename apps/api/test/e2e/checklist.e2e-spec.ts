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

const mockChecklistItem = {
  id: 'item-1',
  poolId: POOL_ID,
  folder: 'Legal',
  itemName: 'NDA',
  isRequired: true,
  status: 'missing',
};

const mockTemplate = {
  id: 'tmpl-1',
  folder: 'Legal',
  itemName: 'NDA',
  isRequired: true,
};

const VALID_CREATE_BODY = {
  folder: 'Legal',
  itemName: 'NDA',
  isRequired: true,
};

describe('Checklist E2E', () => {
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

  // ─── GET /v1/pools/:poolId/checklist ─────────────────────

  describe('GET /v1/pools/:poolId/checklist', () => {
    it('list → 200 + array', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 1 });
      t.repos.poolsRepo.findById.mockResolvedValue(mockPool);
      t.repos.checklistRepo.findItemsByPoolId.mockResolvedValue([mockChecklistItem]);

      const res = await t.agent
        .get(`/v1/pools/${POOL_ID}/checklist`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].itemName).toBe('NDA');
    });

    it('no auth → 401', async () => {
      await t.agent
        .get(`/v1/pools/${POOL_ID}/checklist`)
        .expect(401);
    });
  });

  // ─── POST /v1/pools/:poolId/checklist ────────────────────

  describe('POST /v1/pools/:poolId/checklist', () => {
    it('valid → 201 + created item', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 1 });
      t.repos.poolsRepo.findById.mockResolvedValue(mockPool);
      t.repos.checklistRepo.createItem.mockResolvedValue(mockChecklistItem);

      const res = await t.agent
        .post(`/v1/pools/${POOL_ID}/checklist`)
        .set(authHeaders(user))
        .send(VALID_CREATE_BODY)
        .expect(201);

      expect(res.body.itemName).toBe('NDA');
      expect(res.body.folder).toBe('Legal');
    });

    it('empty itemName → 400', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 1 });

      const res = await t.agent
        .post(`/v1/pools/${POOL_ID}/checklist`)
        .set(authHeaders(user))
        .send({ folder: 'Legal', itemName: '', isRequired: false })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('no auth → 401', async () => {
      await t.agent
        .post(`/v1/pools/${POOL_ID}/checklist`)
        .send(VALID_CREATE_BODY)
        .expect(401);
    });
  });

  // ─── PATCH /v1/pools/:poolId/checklist/:id ───────────────

  describe('PATCH /v1/pools/:poolId/checklist/:id', () => {
    it('valid → 200 + updated item', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 1 });
      t.repos.poolsRepo.findById.mockResolvedValue(mockPool);
      t.repos.checklistRepo.updateItem.mockResolvedValue([
        { ...mockChecklistItem, status: 'uploaded' },
      ]);

      const res = await t.agent
        .patch(`/v1/pools/${POOL_ID}/checklist/item-1`)
        .set(authHeaders(user))
        .send({ status: 'uploaded' })
        .expect(200);

      expect(res.body.status).toBe('uploaded');
    });

    it('item not found → 404', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 1 });
      t.repos.poolsRepo.findById.mockResolvedValue(mockPool);
      t.repos.checklistRepo.updateItem.mockResolvedValue([]);

      const res = await t.agent
        .patch(`/v1/pools/${POOL_ID}/checklist/nonexistent`)
        .set(authHeaders(user))
        .send({ status: 'uploaded' })
        .expect(404);

      expect(res.body.error.code).toBe('CHECKLIST_ITEM_NOT_FOUND');
    });

    it('no auth → 401', async () => {
      await t.agent
        .patch(`/v1/pools/${POOL_ID}/checklist/item-1`)
        .send({ status: 'uploaded' })
        .expect(401);
    });
  });

  // ─── DELETE /v1/pools/:poolId/checklist/:id ──────────────

  describe('DELETE /v1/pools/:poolId/checklist/:id', () => {
    it('valid → 200', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 1 });
      t.repos.poolsRepo.findById.mockResolvedValue(mockPool);
      t.repos.checklistRepo.deleteItem.mockResolvedValue(undefined);

      await t.agent
        .delete(`/v1/pools/${POOL_ID}/checklist/item-1`)
        .set(authHeaders(user))
        .expect(200);
    });

    it('no auth → 401', async () => {
      await t.agent
        .delete(`/v1/pools/${POOL_ID}/checklist/item-1`)
        .expect(401);
    });
  });

  // ─── GET /v1/checklist-templates ─────────────────────────

  describe('GET /v1/checklist-templates', () => {
    it('list → 200 + array', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID, orgRole: 1 });
      t.repos.checklistRepo.findAllTemplates.mockResolvedValue([mockTemplate]);

      const res = await t.agent
        .get('/v1/checklist-templates')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].itemName).toBe('NDA');
    });

    it('no auth → 401', async () => {
      await t.agent
        .get('/v1/checklist-templates')
        .expect(401);
    });
  });
});
