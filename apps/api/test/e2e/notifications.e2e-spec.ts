import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestApp, type TestApp } from '../helpers/create-app.js';
import { AuthHelper, type AuthUser } from '../helpers/auth.helper.js';
import { resetMockRepos } from '../helpers/mock-providers.js';

const mockNotif = (overrides: any = {}) => ({
  id: 'notif-001',
  userId: 'user-001',
  type: 'pool_state_changed',
  title: 'Pool state changed',
  body: 'Pool moved to REVIEW',
  relatedPoolId: 'pool-001',
  relatedDocumentId: null,
  isRead: false,
  createdAt: new Date().toISOString(),
  ...overrides,
});

const mockPrefs = {
  id: 'pref-001',
  userId: 'user-001',
  emailEnabled: true,
  inAppEnabled: true,
  preferences: {},
};

describe('Notifications E2E', () => {
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

  // ─── GET /v1/notifications ───────────────────────────────

  describe('GET /v1/notifications', () => {
    it('200 — returns notifications for authenticated user', async () => {
      const user = await auth.createAuthenticatedUser();
      t.repos.notificationsRepo.findByUserId.mockResolvedValue([mockNotif()]);

      const res = await t.agent
        .get('/v1/notifications')
        .set(authHeaders(user))
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.page).toBe(1);
    });

    it('401 — no token', async () => {
      await t.agent.get('/v1/notifications').expect(401);
    });

    it('200 — pagination params forwarded', async () => {
      const user = await auth.createAuthenticatedUser();
      t.repos.notificationsRepo.findByUserId.mockResolvedValue([]);

      await t.agent
        .get('/v1/notifications?page=2&limit=5')
        .set(authHeaders(user))
        .expect(200);

      expect(t.repos.notificationsRepo.findByUserId).toHaveBeenCalledWith(
        user.userId,
        { limit: 5, offset: 5 },
      );
    });

    it('200 — defaults to page=1, limit=20', async () => {
      const user = await auth.createAuthenticatedUser();
      t.repos.notificationsRepo.findByUserId.mockResolvedValue([]);

      const res = await t.agent
        .get('/v1/notifications')
        .set(authHeaders(user))
        .expect(200);

      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(20);
    });

    it('400 — invalid limit param', async () => {
      const user = await auth.createAuthenticatedUser();

      await t.agent
        .get('/v1/notifications?limit=999')
        .set(authHeaders(user))
        .expect(400);
    });

    it('200 — returns empty array when no notifications', async () => {
      const user = await auth.createAuthenticatedUser();
      t.repos.notificationsRepo.findByUserId.mockResolvedValue([]);

      const res = await t.agent
        .get('/v1/notifications')
        .set(authHeaders(user))
        .expect(200);

      expect(res.body.data).toHaveLength(0);
    });
  });

  // ─── PATCH /v1/notifications/:id/read ────────────────────

  describe('PATCH /v1/notifications/:id/read', () => {
    it('200 — marks notification as read', async () => {
      const user = await auth.createAuthenticatedUser();
      t.repos.notificationsRepo.markAsReadForUser.mockResolvedValue(undefined);

      const res = await t.agent
        .patch('/v1/notifications/notif-001/read')
        .set(authHeaders(user))
        .expect(200);

      expect(res.body).toEqual({ id: 'notif-001', isRead: true });
    });

    it('403 — no CSRF token on mutation', async () => {
      const user = await auth.createAuthenticatedUser();

      await t.agent
        .patch('/v1/notifications/notif-001/read')
        .set({ Authorization: `Bearer ${user.accessToken}` })
        .expect(403);
    });

    it('401 — no auth', async () => {
      await t.agent
        .patch('/v1/notifications/notif-001/read')
        .set({ 'x-csrf-token': csrf })
        .expect(401);
    });

    it('200 — returns correct id in response', async () => {
      const user = await auth.createAuthenticatedUser();
      t.repos.notificationsRepo.markAsReadForUser.mockResolvedValue(undefined);

      const res = await t.agent
        .patch('/v1/notifications/some-other-id/read')
        .set(authHeaders(user))
        .expect(200);

      expect(res.body.id).toBe('some-other-id');
      expect(res.body.isRead).toBe(true);
    });
  });

  // ─── POST /v1/notifications/read-all ─────────────────────

  describe('POST /v1/notifications/read-all', () => {
    it('200 — marks all as read', async () => {
      const user = await auth.createAuthenticatedUser();
      t.repos.notificationsRepo.markAllAsRead.mockResolvedValue(undefined);

      const res = await t.agent
        .post('/v1/notifications/read-all')
        .set(authHeaders(user))
        .expect(200);

      expect(res.body).toEqual({ success: true });
    });

    it('200 — not 201 (explicit @HttpCode(200))', async () => {
      const user = await auth.createAuthenticatedUser();
      t.repos.notificationsRepo.markAllAsRead.mockResolvedValue(undefined);

      const res = await t.agent
        .post('/v1/notifications/read-all')
        .set(authHeaders(user));

      expect(res.status).toBe(200);
    });

    it('403 — no CSRF token', async () => {
      const user = await auth.createAuthenticatedUser();

      await t.agent
        .post('/v1/notifications/read-all')
        .set({ Authorization: `Bearer ${user.accessToken}` })
        .expect(403);
    });

    it('401 — no auth', async () => {
      await t.agent
        .post('/v1/notifications/read-all')
        .set({ 'x-csrf-token': csrf })
        .expect(401);
    });

    it('200 — markAllAsRead called with correct userId', async () => {
      const user = await auth.createAuthenticatedUser();
      t.repos.notificationsRepo.markAllAsRead.mockResolvedValue(undefined);

      await t.agent
        .post('/v1/notifications/read-all')
        .set(authHeaders(user))
        .expect(200);

      expect(t.repos.notificationsRepo.markAllAsRead).toHaveBeenCalledWith(
        user.userId,
      );
    });
  });

  // ─── GET /v1/notification-preferences ────────────────────

  describe('GET /v1/notification-preferences', () => {
    it('200 — returns user preferences', async () => {
      const user = await auth.createAuthenticatedUser();
      t.repos.notificationPrefsRepo.findByUserId.mockResolvedValue(mockPrefs);

      const res = await t.agent
        .get('/v1/notification-preferences')
        .set(authHeaders(user))
        .expect(200);

      expect(res.body).toHaveProperty('emailEnabled');
      expect(res.body).toHaveProperty('inAppEnabled');
      expect(res.body.emailEnabled).toBe(true);
    });

    it('200 — returns defaults when no preferences exist', async () => {
      const user = await auth.createAuthenticatedUser();
      t.repos.notificationPrefsRepo.findByUserId.mockResolvedValue(null);

      const res = await t.agent
        .get('/v1/notification-preferences')
        .set(authHeaders(user))
        .expect(200);

      expect(res.body.emailEnabled).toBe(true);
      expect(res.body.inAppEnabled).toBe(true);
    });

    it('401 — no auth', async () => {
      await t.agent.get('/v1/notification-preferences').expect(401);
    });

    it('200 — default response has preferences object', async () => {
      const user = await auth.createAuthenticatedUser();
      t.repos.notificationPrefsRepo.findByUserId.mockResolvedValue(null);

      const res = await t.agent
        .get('/v1/notification-preferences')
        .set(authHeaders(user))
        .expect(200);

      expect(res.body).toHaveProperty('preferences');
      expect(res.body.preferences).toEqual({});
    });
  });

  // ─── PATCH /v1/notification-preferences ──────────────────

  describe('PATCH /v1/notification-preferences', () => {
    it('200 — updates emailEnabled to false', async () => {
      const user = await auth.createAuthenticatedUser();
      t.repos.notificationPrefsRepo.findByUserId.mockResolvedValue(mockPrefs);
      t.repos.notificationPrefsRepo.upsert.mockResolvedValue({
        ...mockPrefs,
        emailEnabled: false,
      });

      const res = await t.agent
        .patch('/v1/notification-preferences')
        .set(authHeaders(user))
        .send({ emailEnabled: false })
        .expect(200);

      expect(res.body.emailEnabled).toBe(false);
    });

    it('400 — invalid body (emailEnabled not boolean)', async () => {
      const user = await auth.createAuthenticatedUser();

      await t.agent
        .patch('/v1/notification-preferences')
        .set(authHeaders(user))
        .send({ emailEnabled: 'not-a-boolean' })
        .expect(400);
    });

    it('403 — no CSRF token', async () => {
      const user = await auth.createAuthenticatedUser();

      await t.agent
        .patch('/v1/notification-preferences')
        .set({ Authorization: `Bearer ${user.accessToken}` })
        .send({ emailEnabled: false })
        .expect(403);
    });

    it('401 — no auth', async () => {
      await t.agent
        .patch('/v1/notification-preferences')
        .send({ emailEnabled: false })
        .expect(401);
    });

    it('200 — partial update (only inAppEnabled)', async () => {
      const user = await auth.createAuthenticatedUser();
      t.repos.notificationPrefsRepo.findByUserId.mockResolvedValue(mockPrefs);
      t.repos.notificationPrefsRepo.upsert.mockResolvedValue({
        ...mockPrefs,
        inAppEnabled: false,
      });

      const res = await t.agent
        .patch('/v1/notification-preferences')
        .set(authHeaders(user))
        .send({ inAppEnabled: false })
        .expect(200);

      expect(res.body.inAppEnabled).toBe(false);
    });

    it('200 — empty body is valid (all fields optional)', async () => {
      const user = await auth.createAuthenticatedUser();
      t.repos.notificationPrefsRepo.findByUserId.mockResolvedValue(mockPrefs);
      t.repos.notificationPrefsRepo.upsert.mockResolvedValue(mockPrefs);

      const res = await t.agent
        .patch('/v1/notification-preferences')
        .set(authHeaders(user))
        .send({})
        .expect(200);

      expect(res.body).toHaveProperty('emailEnabled');
    });

    it('400 — invalid inAppEnabled type', async () => {
      const user = await auth.createAuthenticatedUser();

      await t.agent
        .patch('/v1/notification-preferences')
        .set(authHeaders(user))
        .send({ inAppEnabled: 'yes' })
        .expect(400);
    });
  });
});
