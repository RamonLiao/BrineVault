// apps/api/test/e2e/monkey-s3b.e2e-spec.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestApp, type TestApp } from '../helpers/create-app.js';
import { AuthHelper, type AuthUser } from '../helpers/auth.helper.js';
import { resetMockRepos } from '../helpers/mock-providers.js';

const ORG_ID = 'org-001';

describe('S3b Monkey E2E', () => {
  let t: TestApp;
  let auth: AuthHelper;
  let csrf: string;

  beforeAll(async () => {
    t = await createTestApp();
    auth = new AuthHelper(t.app);
  });

  afterAll(async () => { await t.app.close(); });

  beforeEach(async () => {
    resetMockRepos(t.repos);
    await t.redis.flushall();
    csrf = auth.getCsrfToken();
  });

  function authHeaders(user: AuthUser) {
    return { Authorization: `Bearer ${user.accessToken}`, 'x-csrf-token': csrf };
  }

  // ─── Notifications ───────────────────────────────────────
  describe('Notifications monkey', () => {
    it('GET /notifications with page=0 → 400 validation error', async () => {
      const user = await auth.createAuthenticatedUser();
      await t.agent.get('/v1/notifications?page=0').set(authHeaders(user)).expect(400);
    });

    it('GET /notifications with limit=999 → 400 (max 100)', async () => {
      const user = await auth.createAuthenticatedUser();
      await t.agent.get('/v1/notifications?limit=999').set(authHeaders(user)).expect(400);
    });

    it('PATCH /notification-preferences with XSS in preferences key → sanitized/accepted', async () => {
      const user = await auth.createAuthenticatedUser();
      t.repos.notificationPrefsRepo.findByUserId.mockResolvedValue(null);
      t.repos.notificationPrefsRepo.upsert.mockImplementation((_uid: string, data: any) =>
        Promise.resolve({ userId: user.userId, emailEnabled: true, inAppEnabled: true, ...data }),
      );
      const res = await t.agent.patch('/v1/notification-preferences').set(authHeaders(user))
        .send({ preferences: { '<script>alert(1)</script>': { email: true } } }).expect(200);
      expect(res.body.preferences).toHaveProperty('<script>alert(1)</script>');
    });

    it('PATCH /notifications/:id/read — SQL injection in id → no crash', async () => {
      const user = await auth.createAuthenticatedUser();
      t.repos.notificationsRepo.markAsReadForUser.mockResolvedValue(undefined);
      await t.agent.patch("/v1/notifications/'; DROP TABLE notifications;--/read")
        .set(authHeaders(user)).expect(200);
    });
  });

  // ─── Billing ─────────────────────────────────────────────
  describe('Billing monkey', () => {
    it('POST /subscription/renew with durationMonths=0 → 400', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID });
      await t.agent.post(`/v1/orgs/${ORG_ID}/subscription/renew`)
        .set(authHeaders(user)).send({ plan: 'pro', durationMonths: 0 }).expect(400);
    });

    it('POST /subscription/renew with durationMonths=37 → 400 (max 36)', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID });
      await t.agent.post(`/v1/orgs/${ORG_ID}/subscription/renew`)
        .set(authHeaders(user)).send({ plan: 'pro', durationMonths: 37 }).expect(400);
    });

    it('GET /subscription with null orgId user → 403', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: null });
      await t.agent.get(`/v1/orgs/${ORG_ID}/subscription`).set(authHeaders(user)).expect(403);
    });

    it('POST /invoices/:id/pay — double pay attempt → 400 on second', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID });
      t.repos.subscriptionsRepo.findInvoiceById.mockResolvedValue({
        id: 'inv-001', orgId: ORG_ID, status: 'paid',
      });
      await t.agent.post(`/v1/orgs/${ORG_ID}/invoices/inv-001/pay`).set(authHeaders(user)).expect(400);
    });

    it('POST /invoices/:id/pay — cancelled invoice → 400', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID });
      t.repos.subscriptionsRepo.findInvoiceById.mockResolvedValue({
        id: 'inv-001', orgId: ORG_ID, status: 'cancelled',
      });
      await t.agent.post(`/v1/orgs/${ORG_ID}/invoices/inv-001/pay`).set(authHeaders(user)).expect(400);
    });

    it('GET /invoices with page=-1 → 400', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID });
      await t.agent.get(`/v1/orgs/${ORG_ID}/invoices?page=-1`).set(authHeaders(user)).expect(400);
    });
  });
});
