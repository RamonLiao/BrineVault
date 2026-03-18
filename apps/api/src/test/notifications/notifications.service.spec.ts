process.env.DATABASE_URL = 'postgresql://localhost/test';
process.env.REDIS_URL = 'redis://localhost';
process.env.JWT_PRIVATE_KEY = 'dGVzdA==';
process.env.JWT_PUBLIC_KEY = 'dGVzdA==';
process.env.CSRF_SECRET = 'test-csrf-secret-at-least-16-chars';
process.env.SUI_RPC_URL = 'https://rpc.testnet.sui.io';
process.env.SUI_PACKAGE_ID = '0x0';
process.env.PLATFORM_KEYPAIR = 'dGVzdA==';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationsService } from '../../modules/notifications/notifications.service.js';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let notifRepo: any;
  let prefsRepo: any;

  const userId = 'user-001';

  const mockNotif = (overrides: any = {}) => ({
    id: 'notif-001', userId, type: 'pool_state_changed',
    title: 'Pool state changed', body: 'Pool moved to REVIEW',
    relatedPoolId: 'pool-001', relatedDocumentId: null,
    isRead: false, createdAt: new Date('2026-03-15'), ...overrides,
  });

  const mockPrefs = (overrides: any = {}) => ({
    id: 'pref-001', userId, emailEnabled: true, inAppEnabled: true, preferences: {}, ...overrides,
  });

  beforeEach(() => {
    notifRepo = {
      findByUserId: vi.fn(), create: vi.fn(),
      markAsRead: vi.fn(), markAsReadForUser: vi.fn(), markAllAsRead: vi.fn(),
    };
    prefsRepo = { findByUserId: vi.fn(), upsert: vi.fn() };
    service = new NotificationsService(notifRepo, prefsRepo);
  });

  describe('listNotifications', () => {
    it('returns paginated notifications for user', async () => {
      const notifs = [mockNotif()];
      notifRepo.findByUserId.mockResolvedValue(notifs);
      const result = await service.listNotifications(userId, { page: 1, limit: 20 });
      expect(result.data).toEqual(notifs);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(notifRepo.findByUserId).toHaveBeenCalledWith(userId, { limit: 20, offset: 0 });
    });

    it('computes correct offset for page 3', async () => {
      notifRepo.findByUserId.mockResolvedValue([]);
      await service.listNotifications(userId, { page: 3, limit: 10 });
      expect(notifRepo.findByUserId).toHaveBeenCalledWith(userId, { limit: 10, offset: 20 });
    });
  });

  describe('markAsRead', () => {
    it('calls repo.markAsReadForUser with id and userId', async () => {
      notifRepo.markAsReadForUser.mockResolvedValue(undefined);
      await service.markAsRead('notif-001', userId);
      expect(notifRepo.markAsReadForUser).toHaveBeenCalledWith('notif-001', userId);
    });
  });

  describe('markAllAsRead', () => {
    it('calls repo.markAllAsRead with userId', async () => {
      notifRepo.markAllAsRead.mockResolvedValue(undefined);
      await service.markAllAsRead(userId);
      expect(notifRepo.markAllAsRead).toHaveBeenCalledWith(userId);
    });
  });

  describe('getPreferences', () => {
    it('returns existing preferences', async () => {
      prefsRepo.findByUserId.mockResolvedValue(mockPrefs());
      const result = await service.getPreferences(userId);
      expect(result).toEqual(mockPrefs());
    });

    it('returns defaults when no preferences exist', async () => {
      prefsRepo.findByUserId.mockResolvedValue(null);
      const result = await service.getPreferences(userId);
      expect(result).toEqual({ userId, emailEnabled: true, inAppEnabled: true, preferences: {} });
    });
  });

  describe('updatePreferences', () => {
    it('upserts preferences with merged JSONB', async () => {
      const existing = mockPrefs({ preferences: { pool_state_changed: { email: true, in_app: true } } });
      prefsRepo.findByUserId.mockResolvedValue(existing);
      prefsRepo.upsert.mockResolvedValue({
        ...existing,
        preferences: {
          pool_state_changed: { email: true, in_app: true },
          member_added: { email: false, in_app: true },
        },
      });
      const result = await service.updatePreferences(userId, {
        preferences: { member_added: { email: false, in_app: true } },
      });
      expect(prefsRepo.upsert).toHaveBeenCalledWith(userId, {
        preferences: {
          pool_state_changed: { email: true, in_app: true },
          member_added: { email: false, in_app: true },
        },
      });
    });

    it('upserts emailEnabled/inAppEnabled without touching preferences', async () => {
      prefsRepo.findByUserId.mockResolvedValue(null);
      prefsRepo.upsert.mockResolvedValue(mockPrefs({ emailEnabled: false }));
      await service.updatePreferences(userId, { emailEnabled: false });
      expect(prefsRepo.upsert).toHaveBeenCalledWith(userId, { emailEnabled: false, preferences: {} });
    });
  });

  describe('monkey tests', () => {
    it('listNotifications page=999 limit=100 → offset 99800', async () => {
      notifRepo.findByUserId.mockResolvedValue([]);
      await service.listNotifications(userId, { page: 999, limit: 100 });
      expect(notifRepo.findByUserId).toHaveBeenCalledWith(userId, { limit: 100, offset: 99800 });
    });

    it('updatePreferences deep-merges nested preferences', async () => {
      const existing = mockPrefs({
        preferences: {
          pool_state_changed: { email: true, in_app: false },
          member_added: { email: true, in_app: true },
        },
      });
      prefsRepo.findByUserId.mockResolvedValue(existing);
      prefsRepo.upsert.mockImplementation((_uid: string, data: any) => Promise.resolve({ ...existing, ...data }));
      await service.updatePreferences(userId, {
        preferences: { pool_state_changed: { email: false } },
      });
      const call = prefsRepo.upsert.mock.calls[0][1];
      expect(call.preferences.pool_state_changed).toEqual({ email: false, in_app: false });
      expect(call.preferences.member_added).toEqual({ email: true, in_app: true });
    });

    it('markAsRead and markAllAsRead do not throw on empty results', async () => {
      notifRepo.markAsReadForUser.mockResolvedValue(undefined);
      notifRepo.markAllAsRead.mockResolvedValue(undefined);
      await expect(service.markAsRead('nonexistent', userId)).resolves.not.toThrow();
      await expect(service.markAllAsRead(userId)).resolves.not.toThrow();
    });
  });
});
