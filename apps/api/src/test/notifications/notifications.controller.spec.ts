process.env.DATABASE_URL = 'postgresql://localhost/test';
process.env.REDIS_URL = 'redis://localhost';
process.env.JWT_PRIVATE_KEY = 'dGVzdA==';
process.env.JWT_PUBLIC_KEY = 'dGVzdA==';
process.env.CSRF_SECRET = 'test-csrf-secret-at-least-16-chars';
process.env.SUI_RPC_URL = 'https://rpc.testnet.sui.io';
process.env.SUI_PACKAGE_ID = '0x0';
process.env.PLATFORM_KEYPAIR = 'dGVzdA==';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationsController } from '../../modules/notifications/notifications.controller.js';
import type { NotificationsService } from '../../modules/notifications/notifications.service.js';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let notifService: Record<string, any>;

  const userId = 'user-001';
  const mockUser = {
    sub: userId,
    address: '0x' + 'a'.repeat(64),
    orgId: 'org-001',
    orgRole: 32,
    sid: 'sid-1',
    jti: 'jti-1',
    iat: 1700000000,
    exp: 1700001000,
  };

  const mockPaginated = { data: [], page: 1, limit: 20 };
  const mockPrefs = { userId, emailEnabled: true, inAppEnabled: true, preferences: {} };

  beforeEach(() => {
    notifService = {
      listNotifications: vi.fn().mockResolvedValue(mockPaginated),
      markAsRead: vi.fn().mockResolvedValue({ id: 'notif-001', isRead: true }),
      markAllAsRead: vi.fn().mockResolvedValue({ success: true }),
      getPreferences: vi.fn().mockResolvedValue(mockPrefs),
      updatePreferences: vi.fn().mockResolvedValue(mockPrefs),
    };
    controller = new NotificationsController(notifService as unknown as NotificationsService);
  });

  // ─── GET /notifications ──────────────────────────────────

  describe('GET /notifications', () => {
    it('delegates to service.listNotifications with user.sub', async () => {
      const query = { page: 1, limit: 20 };
      const result = await controller.listNotifications(mockUser as any, query);

      expect(notifService.listNotifications).toHaveBeenCalledWith(userId, query);
      expect(result).toEqual(mockPaginated);
    });
  });

  // ─── PATCH /notifications/:id/read ───────────────────────

  describe('PATCH /notifications/:id/read', () => {
    it('delegates to service.markAsRead', async () => {
      const result = await controller.markAsRead('notif-001', mockUser as any);

      expect(notifService.markAsRead).toHaveBeenCalledWith('notif-001', userId);
      expect(result).toEqual({ id: 'notif-001', isRead: true });
    });
  });

  // ─── POST /notifications/read-all ────────────────────────

  describe('POST /notifications/read-all', () => {
    it('delegates to service.markAllAsRead', async () => {
      const result = await controller.markAllAsRead(mockUser as any);

      expect(notifService.markAllAsRead).toHaveBeenCalledWith(userId);
      expect(result).toEqual({ success: true });
    });
  });

  // ─── GET /notification-preferences ───────────────────────

  describe('GET /notification-preferences', () => {
    it('delegates to service.getPreferences', async () => {
      const result = await controller.getPreferences(mockUser as any);

      expect(notifService.getPreferences).toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockPrefs);
    });
  });

  // ─── PATCH /notification-preferences ─────────────────────

  describe('PATCH /notification-preferences', () => {
    it('delegates to service.updatePreferences', async () => {
      const dto = { emailEnabled: false };
      const result = await controller.updatePreferences(mockUser as any, dto);

      expect(notifService.updatePreferences).toHaveBeenCalledWith(userId, dto);
    });
  });

  // ─── Monkey tests ────────────────────────────────────────

  describe('monkey tests', () => {
    it('listNotifications propagates service errors', async () => {
      notifService.listNotifications.mockRejectedValue(new Error('DB failed'));

      await expect(controller.listNotifications(mockUser as any, { page: 1, limit: 20 })).rejects.toThrow('DB failed');
    });

    it('markAsRead propagates service errors', async () => {
      notifService.markAsRead.mockRejectedValue(new Error('DB failed'));

      await expect(controller.markAsRead('notif-001', mockUser as any)).rejects.toThrow('DB failed');
    });
  });
});
