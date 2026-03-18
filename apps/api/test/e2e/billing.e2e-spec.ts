import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestApp, type TestApp } from '../helpers/create-app.js';
import { AuthHelper, type AuthUser } from '../helpers/auth.helper.js';
import { resetMockRepos } from '../helpers/mock-providers.js';

const ORG_ID = 'org-001';

const mockSub = (overrides: any = {}) => ({
  id: 'sub-001', orgId: ORG_ID, plan: 'pro', status: 'active',
  currentPeriodStart: new Date().toISOString(),
  currentPeriodEnd: new Date('2027-01-01').toISOString(),
  amount: '1200.00', currency: 'SGD', ...overrides,
});

const mockInvoice = (overrides: any = {}) => ({
  id: 'inv-001', orgId: ORG_ID, subscriptionId: 'sub-001',
  amount: '1200.00', currency: 'SGD', status: 'pending',
  penaltyApplied: false, issuedAt: new Date().toISOString(),
  dueAt: new Date('2026-04-01').toISOString(), paidAt: null, ...overrides,
});

describe('Billing E2E', () => {
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

  // ─── GET /v1/orgs/:orgId/subscription ────────────────────
  describe('GET /v1/orgs/:orgId/subscription', () => {
    it('200 — returns subscription', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID });
      t.repos.subscriptionsRepo.findByOrgId.mockResolvedValue(mockSub());
      const res = await t.agent.get(`/v1/orgs/${ORG_ID}/subscription`).set(authHeaders(user)).expect(200);
      expect(res.body.plan).toBe('pro');
    });

    it('404 — no subscription', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID });
      t.repos.subscriptionsRepo.findByOrgId.mockResolvedValue(null);
      await t.agent.get(`/v1/orgs/${ORG_ID}/subscription`).set(authHeaders(user)).expect(404);
    });

    it('403 — user not in org', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: 'other-org' });
      t.repos.subscriptionsRepo.findByOrgId.mockResolvedValue(mockSub());
      await t.agent.get(`/v1/orgs/${ORG_ID}/subscription`).set(authHeaders(user)).expect(403);
    });

    it('401 — no token', async () => {
      await t.agent.get(`/v1/orgs/${ORG_ID}/subscription`).expect(401);
    });
  });

  // ─── POST /v1/orgs/:orgId/subscription/renew ────────────
  describe('POST /v1/orgs/:orgId/subscription/renew', () => {
    it('201 — creates/renews subscription + invoice', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID });
      t.repos.subscriptionsRepo.findByOrgId.mockResolvedValue(null);
      t.repos.subscriptionsRepo.create.mockResolvedValue(mockSub());
      t.repos.subscriptionsRepo.createInvoice.mockResolvedValue(mockInvoice());
      const res = await t.agent.post(`/v1/orgs/${ORG_ID}/subscription/renew`)
        .set(authHeaders(user)).send({ plan: 'pro', durationMonths: 12 }).expect(201);
      expect(res.body).toHaveProperty('subscription');
      expect(res.body).toHaveProperty('invoice');
    });

    it('403 — wrong org', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: 'other-org' });
      await t.agent.post(`/v1/orgs/${ORG_ID}/subscription/renew`)
        .set(authHeaders(user)).send({ plan: 'pro', durationMonths: 12 }).expect(403);
    });

    it('400 — invalid plan', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID });
      await t.agent.post(`/v1/orgs/${ORG_ID}/subscription/renew`)
        .set(authHeaders(user)).send({ plan: 'invalid_plan', durationMonths: 12 }).expect(400);
    });
  });

  // ─── GET /v1/orgs/:orgId/invoices ────────────────────────
  describe('GET /v1/orgs/:orgId/invoices', () => {
    it('200 — returns invoices', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID });
      t.repos.subscriptionsRepo.findInvoicesByOrgId.mockResolvedValue([mockInvoice()]);
      const res = await t.agent.get(`/v1/orgs/${ORG_ID}/invoices`).set(authHeaders(user)).expect(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('403 — wrong org', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: 'other-org' });
      await t.agent.get(`/v1/orgs/${ORG_ID}/invoices`).set(authHeaders(user)).expect(403);
    });
  });

  // ─── GET /v1/orgs/:orgId/invoices/:id ────────────────────
  describe('GET /v1/orgs/:orgId/invoices/:id', () => {
    it('200 — returns single invoice', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID });
      t.repos.subscriptionsRepo.findInvoiceById.mockResolvedValue(mockInvoice());
      const res = await t.agent.get(`/v1/orgs/${ORG_ID}/invoices/inv-001`).set(authHeaders(user)).expect(200);
      expect(res.body.id).toBe('inv-001');
    });

    it('404 — not found', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID });
      t.repos.subscriptionsRepo.findInvoiceById.mockResolvedValue(null);
      await t.agent.get(`/v1/orgs/${ORG_ID}/invoices/inv-999`).set(authHeaders(user)).expect(404);
    });
  });

  // ─── POST /v1/orgs/:orgId/invoices/:id/pay ──────────────
  describe('POST /v1/orgs/:orgId/invoices/:id/pay', () => {
    it('200 — marks as paid', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID });
      t.repos.subscriptionsRepo.findInvoiceById.mockResolvedValue(mockInvoice());
      t.repos.subscriptionsRepo.updateInvoice.mockResolvedValue([
        mockInvoice({ status: 'paid', paidAt: new Date().toISOString() }),
      ]);
      const res = await t.agent.post(`/v1/orgs/${ORG_ID}/invoices/inv-001/pay`)
        .set(authHeaders(user)).expect(200);
      expect(res.body.status).toBe('paid');
    });

    it('400 — already paid', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID });
      t.repos.subscriptionsRepo.findInvoiceById.mockResolvedValue(
        mockInvoice({ orgId: ORG_ID, status: 'paid' }),
      );
      await t.agent.post(`/v1/orgs/${ORG_ID}/invoices/inv-001/pay`).set(authHeaders(user)).expect(400);
    });

    it('403 — no CSRF', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID });
      await t.agent.post(`/v1/orgs/${ORG_ID}/invoices/inv-001/pay`)
        .set({ Authorization: `Bearer ${user.accessToken}` }).expect(403);
    });
  });
});
