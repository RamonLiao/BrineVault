process.env.DATABASE_URL = 'postgresql://localhost/test';
process.env.REDIS_URL = 'redis://localhost';
process.env.JWT_PRIVATE_KEY = 'dGVzdA==';
process.env.JWT_PUBLIC_KEY = 'dGVzdA==';
process.env.CSRF_SECRET = 'test-csrf-secret-at-least-16-chars';
process.env.SUI_RPC_URL = 'https://rpc.testnet.sui.io';
process.env.SUI_PACKAGE_ID = '0x0';
process.env.PLATFORM_KEYPAIR = 'dGVzdA==';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BillingController } from '../../modules/billing/billing.controller.js';
import type { BillingService } from '../../modules/billing/billing.service.js';

describe('BillingController', () => {
  let controller: BillingController;
  let billingService: Record<string, any>;

  const orgId = 'org-001';
  const mockUser = {
    sub: 'user-001', address: '0x' + 'a'.repeat(64), orgId, orgRole: 32,
    sid: 'sid-1', jti: 'jti-1', iat: 1700000000, exp: 1700001000,
  };

  const mockSub = { id: 'sub-001', orgId, plan: 'pro', status: 'active' };
  const mockInvoice = { id: 'inv-001', orgId, amount: '1200.00', status: 'pending' };

  beforeEach(() => {
    billingService = {
      getSubscription: vi.fn().mockResolvedValue(mockSub),
      renewSubscription: vi.fn().mockResolvedValue({ subscription: mockSub, invoice: mockInvoice }),
      listInvoices: vi.fn().mockResolvedValue({ data: [mockInvoice], page: 1, limit: 20 }),
      getInvoice: vi.fn().mockResolvedValue(mockInvoice),
      payInvoice: vi.fn().mockResolvedValue({ ...mockInvoice, status: 'paid' }),
    };
    controller = new BillingController(billingService as unknown as BillingService);
  });

  describe('GET /orgs/:orgId/subscription', () => {
    it('delegates to billingService.getSubscription', async () => {
      const result = await controller.getSubscription(orgId, mockUser as any);
      expect(billingService.getSubscription).toHaveBeenCalledWith(orgId, mockUser.orgId);
      expect(result).toEqual(mockSub);
    });
  });

  describe('POST /orgs/:orgId/subscription/renew', () => {
    it('delegates to billingService.renewSubscription', async () => {
      const dto = { plan: 'pro' as const, durationMonths: 12 };
      const result = await controller.renewSubscription(orgId, mockUser as any, dto);
      expect(billingService.renewSubscription).toHaveBeenCalledWith(orgId, mockUser.orgId, dto);
      expect(result).toHaveProperty('subscription');
      expect(result).toHaveProperty('invoice');
    });
  });

  describe('GET /orgs/:orgId/invoices', () => {
    it('delegates to billingService.listInvoices', async () => {
      const query = { page: 1, limit: 20 };
      const result = await controller.listInvoices(orgId, mockUser as any, query);
      expect(billingService.listInvoices).toHaveBeenCalledWith(orgId, mockUser.orgId, query);
    });
  });

  describe('GET /orgs/:orgId/invoices/:id', () => {
    it('delegates to billingService.getInvoice', async () => {
      const result = await controller.getInvoice(orgId, 'inv-001', mockUser as any);
      expect(billingService.getInvoice).toHaveBeenCalledWith(orgId, 'inv-001', mockUser.orgId);
    });
  });

  describe('POST /orgs/:orgId/invoices/:id/pay', () => {
    it('delegates to billingService.payInvoice', async () => {
      const result = await controller.payInvoice(orgId, 'inv-001', mockUser as any);
      expect(billingService.payInvoice).toHaveBeenCalledWith(orgId, 'inv-001', mockUser.orgId);
    });
  });

  describe('monkey tests', () => {
    it('all methods propagate service errors', async () => {
      const err = new Error('DB failed');
      billingService.getSubscription.mockRejectedValue(err);
      billingService.renewSubscription.mockRejectedValue(err);
      billingService.listInvoices.mockRejectedValue(err);
      billingService.getInvoice.mockRejectedValue(err);
      billingService.payInvoice.mockRejectedValue(err);

      await expect(controller.getSubscription(orgId, mockUser as any)).rejects.toThrow('DB failed');
      await expect(controller.renewSubscription(orgId, mockUser as any, { plan: 'pro', durationMonths: 12 })).rejects.toThrow('DB failed');
      await expect(controller.listInvoices(orgId, mockUser as any, { page: 1, limit: 20 })).rejects.toThrow('DB failed');
      await expect(controller.getInvoice(orgId, 'inv-001', mockUser as any)).rejects.toThrow('DB failed');
      await expect(controller.payInvoice(orgId, 'inv-001', mockUser as any)).rejects.toThrow('DB failed');
    });
  });
});
