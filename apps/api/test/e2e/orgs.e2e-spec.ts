import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestApp, type TestApp } from '../helpers/create-app.js';
import { AuthHelper, type AuthUser } from '../helpers/auth.helper.js';
import { resetMockRepos } from '../helpers/mock-providers.js';
import { ROLES } from '@rwa-dataroom/shared';

describe('Orgs E2E', () => {
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

  // ─── Helpers ───────────────────────────────────────────

  function authHeaders(user: AuthUser) {
    return {
      Authorization: `Bearer ${user.accessToken}`,
      'x-csrf-token': csrf,
    };
  }

  // ─── POST /v1/orgs ────────────────────────────────────

  describe('POST /v1/orgs', () => {
    it('creates org and promotes user to ORG_ADMIN', async () => {
      const user = await auth.createAuthenticatedUser();
      t.repos.usersRepo.findById.mockResolvedValue({ id: user.userId, orgId: null });
      t.repos.orgsRepo.create.mockResolvedValue({
        id: 'org-new',
        name: 'Acme Corp',
        legalName: 'Acme Corp Ltd',
        createdByUserId: user.userId,
      });
      t.repos.usersRepo.update.mockResolvedValue([]);

      const res = await t.agent
        .post('/v1/orgs')
        .set(authHeaders(user))
        .send({ name: 'Acme Corp', legalName: 'Acme Corp Ltd' })
        .expect(201);

      expect(res.body.name).toBe('Acme Corp');
      expect(t.repos.usersRepo.update).toHaveBeenCalledWith(user.userId, {
        orgId: 'org-new',
        roleInOrg: ROLES.ORG_ADMIN,
      });
    });

    it('rejects if user already in org → 409', async () => {
      const user = await auth.createAuthenticatedUser();
      t.repos.usersRepo.findById.mockResolvedValue({ id: user.userId, orgId: 'existing-org' });

      const res = await t.agent
        .post('/v1/orgs')
        .set(authHeaders(user))
        .send({ name: 'New Org' })
        .expect(409);

      expect(res.body.error.code).toBe('ALREADY_IN_ORG');
    });

    it('rejects missing name → 400', async () => {
      const user = await auth.createAuthenticatedUser();

      const res = await t.agent
        .post('/v1/orgs')
        .set(authHeaders(user))
        .send({})
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects empty name → 400', async () => {
      const user = await auth.createAuthenticatedUser();

      const res = await t.agent
        .post('/v1/orgs')
        .set(authHeaders(user))
        .send({ name: '' })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ─── GET /v1/orgs/:orgId ──────────────────────────────

  describe('GET /v1/orgs/:orgId', () => {
    it('returns org for member', async () => {
      const orgId = 'org-001';
      const user = await auth.createAuthenticatedUser({ orgId, orgRole: ROLES.VIEWER });
      t.repos.orgsRepo.findById.mockResolvedValue({ id: orgId, name: 'My Org' });

      const res = await t.agent
        .get(`/v1/orgs/${orgId}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(res.body.id).toBe(orgId);
      expect(res.body.name).toBe('My Org');
    });

    it('rejects non-member → 403', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: 'other-org', orgRole: 1 });

      const res = await t.agent
        .get('/v1/orgs/org-001')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(403);

      expect(res.body.error.code).toBe('NOT_IN_ORG');
    });

    it('returns 404 for non-existent org', async () => {
      const orgId = 'org-ghost';
      const user = await auth.createAuthenticatedUser({ orgId, orgRole: 1 });
      t.repos.orgsRepo.findById.mockResolvedValue(null);

      const res = await t.agent
        .get(`/v1/orgs/${orgId}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(404);

      expect(res.body.error.code).toBe('ORG_NOT_FOUND');
    });
  });

  // ─── PATCH /v1/orgs/:orgId ────────────────────────────

  describe('PATCH /v1/orgs/:orgId', () => {
    it('updates org for ORG_ADMIN', async () => {
      const orgId = 'org-001';
      const user = await auth.createAuthenticatedUser({ orgId, orgRole: ROLES.ORG_ADMIN });
      t.repos.orgsRepo.update.mockResolvedValue([{ id: orgId, name: 'Updated Name' }]);

      const res = await t.agent
        .patch(`/v1/orgs/${orgId}`)
        .set(authHeaders(user))
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(res.body.name).toBe('Updated Name');
    });

    it('rejects non-admin → 403 INSUFFICIENT_ROLE', async () => {
      const orgId = 'org-001';
      const user = await auth.createAuthenticatedUser({ orgId, orgRole: ROLES.VIEWER });

      const res = await t.agent
        .patch(`/v1/orgs/${orgId}`)
        .set(authHeaders(user))
        .send({ name: 'No Way' })
        .expect(403);

      expect(res.body.error.code).toBe('INSUFFICIENT_ROLE');
    });

    it('rejects non-member → 403 NOT_IN_ORG', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: 'other', orgRole: ROLES.ORG_ADMIN });

      const res = await t.agent
        .patch('/v1/orgs/org-001')
        .set(authHeaders(user))
        .send({ name: 'Nope' })
        .expect(403);

      expect(res.body.error.code).toBe('NOT_IN_ORG');
    });
  });

  // ─── POST /v1/orgs/:orgId/invite ──────────────────────

  describe('POST /v1/orgs/:orgId/invite', () => {
    it('generates invite code for admin', async () => {
      const orgId = 'org-001';
      const user = await auth.createAuthenticatedUser({ orgId, orgRole: ROLES.ORG_ADMIN });
      t.repos.orgsRepo.findById.mockResolvedValue({ id: orgId, name: 'Acme' });
      t.repos.inviteCodesRepo.create.mockResolvedValue({});

      const res = await t.agent
        .post(`/v1/orgs/${orgId}/invite`)
        .set(authHeaders(user))
        .send({})
        .expect(201);

      expect(res.body.inviteCode).toMatch(/^[A-Z0-9]{5}-[A-F0-9]{4}-[A-F0-9]{4}$/);
      expect(res.body.maxUses).toBe(5);
      expect(res.body.usedCount).toBe(0);
    });

    it('rejects non-admin → 403', async () => {
      const orgId = 'org-001';
      const user = await auth.createAuthenticatedUser({ orgId, orgRole: ROLES.VIEWER });

      const res = await t.agent
        .post(`/v1/orgs/${orgId}/invite`)
        .set(authHeaders(user))
        .send({})
        .expect(403);

      expect(res.body.error.code).toBe('INSUFFICIENT_ROLE');
    });

    it('accepts custom maxUses and expiresInHours', async () => {
      const orgId = 'org-001';
      const user = await auth.createAuthenticatedUser({ orgId, orgRole: ROLES.ORG_ADMIN });
      t.repos.orgsRepo.findById.mockResolvedValue({ id: orgId, name: 'Acme' });
      t.repos.inviteCodesRepo.create.mockResolvedValue({});

      const res = await t.agent
        .post(`/v1/orgs/${orgId}/invite`)
        .set(authHeaders(user))
        .send({ maxUses: 10, expiresInHours: 48 })
        .expect(201);

      expect(res.body.maxUses).toBe(10);
    });
  });

  // ─── POST /v1/orgs/join ───────────────────────────────

  describe('POST /v1/orgs/join', () => {
    it('joins org with valid invite', async () => {
      const user = await auth.createAuthenticatedUser();
      t.repos.usersRepo.findById.mockResolvedValue({ id: user.userId, orgId: null });
      t.repos.inviteCodesRepo.findByCode.mockResolvedValue({
        id: 'invite-1',
        orgId: 'org-001',
        code: 'ACMEX-1A2B-3C4D',
        expiresAt: new Date(Date.now() + 86400_000),
        maxUses: 5,
        currentUses: 0,
      });
      t.repos.usersRepo.update.mockResolvedValue([]);
      t.repos.inviteCodesRepo.incrementUses.mockResolvedValue([]);
      t.repos.orgsRepo.findById.mockResolvedValue({ id: 'org-001', name: 'Acme' });

      const res = await t.agent
        .post('/v1/orgs/join')
        .set(authHeaders(user))
        .send({ inviteCode: 'ACMEX-1A2B-3C4D' })
        .expect(201);

      expect(res.body.orgId).toBe('org-001');
      expect(res.body.orgName).toBe('Acme');
      expect(res.body.role).toBe(ROLES.VIEWER);
      expect(res.body.joinedAt).toBeTypeOf('string');
    });

    it('rejects if already in org → 409', async () => {
      const user = await auth.createAuthenticatedUser();
      t.repos.usersRepo.findById.mockResolvedValue({ id: user.userId, orgId: 'existing' });

      const res = await t.agent
        .post('/v1/orgs/join')
        .set(authHeaders(user))
        .send({ inviteCode: 'XXXXX-0000-0000' })
        .expect(409);

      expect(res.body.error.code).toBe('ALREADY_IN_ORG');
    });

    it('rejects invalid invite code → 404', async () => {
      const user = await auth.createAuthenticatedUser();
      t.repos.usersRepo.findById.mockResolvedValue({ id: user.userId, orgId: null });
      t.repos.inviteCodesRepo.findByCode.mockResolvedValue(null);

      const res = await t.agent
        .post('/v1/orgs/join')
        .set(authHeaders(user))
        .send({ inviteCode: 'NOPE-0000-0000' })
        .expect(404);

      expect(res.body.error.code).toBe('INVALID_INVITE_CODE');
    });

    it('rejects expired invite → 404', async () => {
      const user = await auth.createAuthenticatedUser();
      t.repos.usersRepo.findById.mockResolvedValue({ id: user.userId, orgId: null });
      t.repos.inviteCodesRepo.findByCode.mockResolvedValue({
        id: 'inv-1',
        orgId: 'org-1',
        expiresAt: new Date(Date.now() - 1000), // already expired
        maxUses: 5,
        currentUses: 0,
      });

      const res = await t.agent
        .post('/v1/orgs/join')
        .set(authHeaders(user))
        .send({ inviteCode: 'EXPRD-0000-0000' })
        .expect(404);

      expect(res.body.error.code).toBe('INVITE_CODE_EXPIRED');
    });

    it('rejects exhausted invite → 404', async () => {
      const user = await auth.createAuthenticatedUser();
      t.repos.usersRepo.findById.mockResolvedValue({ id: user.userId, orgId: null });
      t.repos.inviteCodesRepo.findByCode.mockResolvedValue({
        id: 'inv-1',
        orgId: 'org-1',
        expiresAt: new Date(Date.now() + 86400_000),
        maxUses: 5,
        currentUses: 5, // fully used
      });

      const res = await t.agent
        .post('/v1/orgs/join')
        .set(authHeaders(user))
        .send({ inviteCode: 'USEDUP-0000-0000' })
        .expect(404);

      expect(res.body.error.code).toBe('INVITE_CODE_EXPIRED');
    });
  });

  // ─── GET /v1/orgs/:orgId/members ──────────────────────

  describe('GET /v1/orgs/:orgId/members', () => {
    it('lists members for org member', async () => {
      const orgId = 'org-001';
      const user = await auth.createAuthenticatedUser({ orgId, orgRole: ROLES.VIEWER });

      const mockMembers = [
        { id: 'u1', primaryWalletAddress: '0xaaa', displayName: 'Alice', email: null, roleInOrg: 32, createdAt: new Date().toISOString() },
        { id: 'u2', primaryWalletAddress: '0xbbb', displayName: 'Bob', email: null, roleInOrg: 1, createdAt: new Date().toISOString() },
      ];
      t.db.select.mockReturnValue(
        // Proxy-based chainable that resolves to mockMembers
        (() => {
          function chain(val: any): any {
            return new Proxy(() => {}, {
              get(_, p) {
                if (p === 'then') return (r: any) => r(val);
                return () => chain(val);
              },
            });
          }
          return chain(mockMembers);
        })(),
      );

      const res = await t.agent
        .get(`/v1/orgs/${orgId}/members?page=1&limit=20`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(res.body.data).toHaveLength(2);
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(20);
    });

    it('rejects non-member → 403', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: 'other', orgRole: 1 });

      const res = await t.agent
        .get('/v1/orgs/org-001/members?page=1&limit=20')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(403);

      expect(res.body.error.code).toBe('NOT_IN_ORG');
    });
  });
});
