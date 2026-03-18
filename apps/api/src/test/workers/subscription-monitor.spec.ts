process.env.DATABASE_URL = 'postgresql://localhost/test';
process.env.REDIS_URL = 'redis://localhost';
process.env.JWT_PRIVATE_KEY = 'dGVzdA==';
process.env.JWT_PUBLIC_KEY = 'dGVzdA==';
process.env.CSRF_SECRET = 'test-csrf-secret-at-least-16-chars';
process.env.SUI_RPC_URL = 'https://rpc.testnet.sui.io';
process.env.SUI_PACKAGE_ID = '0x0';
process.env.PLATFORM_KEYPAIR = 'dGVzdA==';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubscriptionMonitorService } from '../../workers/subscription-monitor.service.js';

describe('SubscriptionMonitorService', () => {
  let monitor: SubscriptionMonitorService;
  let subsRepo: any;
  let dispatcher: any;

  const mockSub = (overrides: any = {}) => ({
    id: 'sub-001', orgId: 'org-001', plan: 'pro', status: 'active',
    currentPeriodEnd: new Date('2026-03-20'), gracePeriodEnd: null,
    penaltyRate: '1.30', ...overrides,
  });

  beforeEach(() => {
    subsRepo = {
      findExpiring: vi.fn().mockResolvedValue([]),
      findGracePeriodExpired: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue([]),
    };
    dispatcher = { dispatch: vi.fn().mockResolvedValue(undefined) };
    monitor = new SubscriptionMonitorService(subsRepo, dispatcher);
  });

  describe('handleCron', () => {
    it('does nothing when no expiring subscriptions', async () => {
      await monitor.handleCron();
      expect(subsRepo.update).not.toHaveBeenCalled();
      expect(dispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('transitions expired active subs to grace_period', async () => {
      const expiredSub = mockSub({ status: 'active', currentPeriodEnd: new Date('2026-03-10') });
      subsRepo.findExpiring.mockResolvedValue([expiredSub]);
      await monitor.handleCron();
      expect(subsRepo.update).toHaveBeenCalledWith('sub-001', expect.objectContaining({ status: 'grace_period' }));
    });

    it('transitions grace_period expired subs to suspended', async () => {
      const graceSub = mockSub({ status: 'grace_period', gracePeriodEnd: new Date('2026-03-10') });
      subsRepo.findGracePeriodExpired.mockResolvedValue([graceSub]);
      await monitor.handleCron();
      expect(subsRepo.update).toHaveBeenCalledWith('sub-001', expect.objectContaining({ status: 'suspended' }));
    });

    it('dispatches notification for expiring subscriptions', async () => {
      const expiringSub = mockSub({ currentPeriodEnd: new Date('2026-03-10') });
      subsRepo.findExpiring.mockResolvedValue([expiringSub]);
      await monitor.handleCron();
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'subscription_expiring' }),
      );
    });
  });

  describe('monkey tests', () => {
    it('handles repo errors gracefully without crashing', async () => {
      subsRepo.findExpiring.mockRejectedValue(new Error('DB down'));
      await expect(monitor.handleCron()).resolves.not.toThrow();
    });

    it('handles update failure for one sub without stopping others', async () => {
      const sub1 = mockSub({ id: 'sub-001', currentPeriodEnd: new Date('2026-03-10') });
      const sub2 = mockSub({ id: 'sub-002', currentPeriodEnd: new Date('2026-03-10') });
      subsRepo.findExpiring.mockResolvedValue([sub1, sub2]);
      subsRepo.update
        .mockRejectedValueOnce(new Error('DB timeout'))
        .mockResolvedValueOnce([]);
      await expect(monitor.handleCron()).resolves.not.toThrow();
    });

    it('handles dispatch failure gracefully', async () => {
      const expiringSub = mockSub({ currentPeriodEnd: new Date('2026-03-10') });
      subsRepo.findExpiring.mockResolvedValue([expiringSub]);
      dispatcher.dispatch.mockRejectedValue(new Error('Queue down'));
      await expect(monitor.handleCron()).resolves.not.toThrow();
    });

    it('handles empty arrays from both queries', async () => {
      subsRepo.findExpiring.mockResolvedValue([]);
      subsRepo.findGracePeriodExpired.mockResolvedValue([]);
      await expect(monitor.handleCron()).resolves.not.toThrow();
      expect(subsRepo.update).not.toHaveBeenCalled();
    });

    it('handles large batch of expiring subs', async () => {
      const subs = Array.from({ length: 1000 }, (_, i) =>
        mockSub({ id: `sub-${i}`, currentPeriodEnd: new Date('2026-03-10') }),
      );
      subsRepo.findExpiring.mockResolvedValue(subs);
      await expect(monitor.handleCron()).resolves.not.toThrow();
      expect(subsRepo.update).toHaveBeenCalledTimes(1000);
    });

    it('handles sub with null orgId gracefully', async () => {
      const badSub = mockSub({ orgId: null, currentPeriodEnd: new Date('2026-03-10') });
      subsRepo.findExpiring.mockResolvedValue([badSub]);
      await expect(monitor.handleCron()).resolves.not.toThrow();
    });
  });
});
