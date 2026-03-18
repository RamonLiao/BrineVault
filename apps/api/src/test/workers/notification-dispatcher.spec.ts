process.env.DATABASE_URL = 'postgresql://localhost/test';
process.env.REDIS_URL = 'redis://localhost';
process.env.JWT_PRIVATE_KEY = 'dGVzdA==';
process.env.JWT_PUBLIC_KEY = 'dGVzdA==';
process.env.CSRF_SECRET = 'test-csrf-secret-at-least-16-chars';
process.env.SUI_RPC_URL = 'https://rpc.testnet.sui.io';
process.env.SUI_PACKAGE_ID = '0x0';
process.env.PLATFORM_KEYPAIR = 'dGVzdA==';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationDispatcherService } from '../../workers/notification-dispatcher.service.js';

describe('NotificationDispatcherService', () => {
  let dispatcher: NotificationDispatcherService;
  let notifRepo: any;
  let prefsRepo: any;

  beforeEach(() => {
    notifRepo = { create: vi.fn().mockResolvedValue({ id: 'notif-001' }) };
    prefsRepo = { findByUserId: vi.fn() };
    dispatcher = new NotificationDispatcherService(notifRepo, prefsRepo);
  });

  describe('dispatch', () => {
    it('creates notification for each recipient', async () => {
      prefsRepo.findByUserId.mockResolvedValue(null);
      await dispatcher.dispatch({
        type: 'pool_state_changed', title: 'Pool moved to REVIEW',
        body: 'Pool X moved to REVIEW state',
        recipientUserIds: ['user-1', 'user-2'], relatedPoolId: 'pool-001',
      });
      expect(notifRepo.create).toHaveBeenCalledTimes(2);
      expect(notifRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', type: 'pool_state_changed', title: 'Pool moved to REVIEW' }),
      );
    });

    it('skips dispatch if user has disabled in_app for this type', async () => {
      prefsRepo.findByUserId.mockResolvedValue({
        inAppEnabled: true, preferences: { pool_state_changed: { in_app: false } },
      });
      await dispatcher.dispatch({ type: 'pool_state_changed', title: 'test', recipientUserIds: ['user-1'] });
      expect(notifRepo.create).not.toHaveBeenCalled();
    });

    it('skips dispatch if user has globally disabled in_app', async () => {
      prefsRepo.findByUserId.mockResolvedValue({ inAppEnabled: false, preferences: {} });
      await dispatcher.dispatch({ type: 'pool_state_changed', title: 'test', recipientUserIds: ['user-1'] });
      expect(notifRepo.create).not.toHaveBeenCalled();
    });

    it('still dispatches if no preferences exist (defaults enabled)', async () => {
      prefsRepo.findByUserId.mockResolvedValue(null);
      await dispatcher.dispatch({ type: 'member_added', title: 'Welcome', recipientUserIds: ['user-1'] });
      expect(notifRepo.create).toHaveBeenCalledTimes(1);
    });

    it('handles empty recipientUserIds gracefully', async () => {
      await dispatcher.dispatch({ type: 'test', title: 'test', recipientUserIds: [] });
      expect(notifRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('monkey tests', () => {
    it('does not throw if create fails for one recipient', async () => {
      prefsRepo.findByUserId.mockResolvedValue(null);
      notifRepo.create
        .mockResolvedValueOnce({ id: 'n1' })
        .mockRejectedValueOnce(new Error('DB error'))
        .mockResolvedValueOnce({ id: 'n3' });
      await expect(
        dispatcher.dispatch({ type: 'test', title: 'test', recipientUserIds: ['u1', 'u2', 'u3'] }),
      ).resolves.not.toThrow();
      expect(notifRepo.create).toHaveBeenCalledTimes(3);
    });

    it('subscription notifications cannot be disabled', async () => {
      prefsRepo.findByUserId.mockResolvedValue({
        inAppEnabled: false, preferences: { subscription_expiring: { in_app: false } },
      });
      await dispatcher.dispatch({
        type: 'subscription_expiring', title: 'Sub expiring', recipientUserIds: ['user-1'],
      });
      expect(notifRepo.create).toHaveBeenCalledTimes(1);
    });
  });
});
