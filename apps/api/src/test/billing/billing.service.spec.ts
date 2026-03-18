process.env.DATABASE_URL = 'postgresql://localhost/test';
process.env.REDIS_URL = 'redis://localhost';
process.env.JWT_PRIVATE_KEY = 'dGVzdA==';
process.env.JWT_PUBLIC_KEY = 'dGVzdA==';
process.env.CSRF_SECRET = 'test-csrf-secret-at-least-16-chars';
process.env.SUI_RPC_URL = 'https://rpc.testnet.sui.io';
process.env.SUI_PACKAGE_ID = '0x0';
process.env.PLATFORM_KEYPAIR = 'dGVzdA==';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { BillingService } from '../../modules/billing/billing.service.js';

describe('BillingService', () => {
  let service: BillingService;
  let subsRepo: any;
  let orgsRepo: any;

  const orgId = 'org-001';
  const userOrgId = 'org-001';

  const mockSub = (overrides: any = {}) => ({
    id: 'sub-001', orgId, plan: 'pro', status: 'active',
    trialStartAt: null, trialEndAt: null,
    currentPeriodStart: new Date('2026-01-01'), currentPeriodEnd: new Date('2027-01-01'),
    gracePeriodEnd: null, penaltyRate: '1.30', amount: '1200.00', currency: 'SGD',
    createdAt: new Date(), updatedAt: new Date(), ...overrides,
  });

  const mockInvoice = (overrides: any = {}) => ({
    id: 'inv-001', orgId, subscriptionId: 'sub-001', amount: '1200.00', currency: 'SGD',
    status: 'pending', penaltyApplied: false, issuedAt: new Date(),
    dueAt: new Date('2026-04-01'), paidAt: null, ...overrides,
  });

  beforeEach(() => {
    subsRepo = {
      findByOrgId: vi.fn(), create: vi.fn(), update: vi.fn(),
      findInvoicesByOrgId: vi.fn(), findInvoiceById: vi.fn(),
      createInvoice: vi.fn(), updateInvoice: vi.fn(),
    };
    orgsRepo = { findById: vi.fn() };
    service = new BillingService(subsRepo, orgsRepo);
  });

  describe('getSubscription', () => {
    it('returns subscription for org', async () => {
      subsRepo.findByOrgId.mockResolvedValue(mockSub());
      const result = await service.getSubscription(orgId, userOrgId);
      expect(result).toEqual(mockSub());
      expect(subsRepo.findByOrgId).toHaveBeenCalledWith(orgId);
    });
    it('throws NOT_FOUND if no subscription', async () => {
      subsRepo.findByOrgId.mockResolvedValue(null);
      await expect(service.getSubscription(orgId, userOrgId)).rejects.toThrow(NotFoundException);
    });
    it('throws FORBIDDEN if user is not in org', async () => {
      subsRepo.findByOrgId.mockResolvedValue(mockSub());
      await expect(service.getSubscription(orgId, 'other-org')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('renewSubscription', () => {
    it('creates subscription + invoice for renewal', async () => {
      subsRepo.findByOrgId.mockResolvedValue(mockSub());
      subsRepo.update.mockResolvedValue([mockSub({ status: 'active' })]);
      subsRepo.createInvoice.mockResolvedValue(mockInvoice());
      const result = await service.renewSubscription(orgId, userOrgId, { plan: 'pro', durationMonths: 12 });
      expect(subsRepo.update).toHaveBeenCalled();
      expect(subsRepo.createInvoice).toHaveBeenCalled();
      expect(result).toHaveProperty('invoice');
      expect(result).toHaveProperty('subscription');
    });
    it('creates new subscription if none exists', async () => {
      subsRepo.findByOrgId.mockResolvedValue(null);
      subsRepo.create.mockResolvedValue(mockSub());
      subsRepo.createInvoice.mockResolvedValue(mockInvoice());
      const result = await service.renewSubscription(orgId, userOrgId, { plan: 'pro', durationMonths: 12 });
      expect(subsRepo.create).toHaveBeenCalled();
    });
    it('throws FORBIDDEN if user is not in org', async () => {
      await expect(service.renewSubscription(orgId, 'other-org', { plan: 'pro', durationMonths: 12 })).rejects.toThrow(ForbiddenException);
    });
  });

  describe('listInvoices', () => {
    it('returns paginated invoices', async () => {
      subsRepo.findInvoicesByOrgId.mockResolvedValue([mockInvoice()]);
      const result = await service.listInvoices(orgId, userOrgId, { page: 1, limit: 20 });
      expect(result.data).toEqual([mockInvoice()]);
      expect(result.page).toBe(1);
    });
    it('throws FORBIDDEN if user is not in org', async () => {
      await expect(service.listInvoices(orgId, 'other-org', { page: 1, limit: 20 })).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getInvoice', () => {
    it('returns single invoice', async () => {
      subsRepo.findInvoiceById.mockResolvedValue(mockInvoice());
      const result = await service.getInvoice(orgId, 'inv-001', userOrgId);
      expect(result).toEqual(mockInvoice());
    });
    it('throws NOT_FOUND for missing invoice', async () => {
      subsRepo.findInvoiceById.mockResolvedValue(null);
      await expect(service.getInvoice(orgId, 'inv-999', userOrgId)).rejects.toThrow(NotFoundException);
    });
    it('throws FORBIDDEN if invoice belongs to different org', async () => {
      subsRepo.findInvoiceById.mockResolvedValue(mockInvoice({ orgId: 'other-org' }));
      await expect(service.getInvoice(orgId, 'inv-001', userOrgId)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('payInvoice', () => {
    it('marks invoice as paid', async () => {
      subsRepo.findInvoiceById.mockResolvedValue(mockInvoice({ orgId }));
      subsRepo.updateInvoice.mockResolvedValue([mockInvoice({ status: 'paid', paidAt: new Date() })]);
      const result = await service.payInvoice(orgId, 'inv-001', userOrgId);
      expect(subsRepo.updateInvoice).toHaveBeenCalledWith('inv-001', expect.objectContaining({ status: 'paid' }));
    });
    it('throws BAD_REQUEST if invoice already paid', async () => {
      subsRepo.findInvoiceById.mockResolvedValue(mockInvoice({ orgId, status: 'paid' }));
      await expect(service.payInvoice(orgId, 'inv-001', userOrgId)).rejects.toThrow(BadRequestException);
    });
    it('throws NOT_FOUND if invoice not found', async () => {
      subsRepo.findInvoiceById.mockResolvedValue(null);
      await expect(service.payInvoice(orgId, 'inv-999', userOrgId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('monkey tests', () => {
    it('getSubscription — null userOrgId never matches', async () => {
      subsRepo.findByOrgId.mockResolvedValue(mockSub());
      await expect(service.getSubscription(orgId, null as any)).rejects.toThrow(ForbiddenException);
    });
    it('renewSubscription — 36 months is max, accepted', async () => {
      subsRepo.findByOrgId.mockResolvedValue(null);
      subsRepo.create.mockResolvedValue(mockSub());
      subsRepo.createInvoice.mockResolvedValue(mockInvoice());
      await expect(service.renewSubscription(orgId, userOrgId, { plan: 'enterprise', durationMonths: 36 })).resolves.not.toThrow();
    });
    it('payInvoice — cancelled invoice throws BAD_REQUEST', async () => {
      subsRepo.findInvoiceById.mockResolvedValue(mockInvoice({ orgId, status: 'cancelled' }));
      await expect(service.payInvoice(orgId, 'inv-001', userOrgId)).rejects.toThrow(BadRequestException);
    });
    it('listInvoices — page 50 computes offset 980', async () => {
      subsRepo.findInvoicesByOrgId.mockResolvedValue([]);
      await service.listInvoices(orgId, userOrgId, { page: 50, limit: 20 });
      expect(subsRepo.findInvoicesByOrgId).toHaveBeenCalledWith(orgId, { limit: 20, offset: 980 });
    });
  });
});
