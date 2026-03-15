process.env.DATABASE_URL = 'postgresql://localhost/test';
process.env.REDIS_URL = 'redis://localhost';
process.env.JWT_PRIVATE_KEY = 'dGVzdA==';
process.env.JWT_PUBLIC_KEY = 'dGVzdA==';
process.env.CSRF_SECRET = 'test-csrf-secret-at-least-16-chars';
process.env.SUI_RPC_URL = 'https://rpc.testnet.sui.io';
process.env.SUI_PACKAGE_ID = '0x0';
process.env.PLATFORM_KEYPAIR = 'dGVzdA==';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuditController } from '../../modules/audit/audit.controller.js';
import type { AuditService } from '../../modules/audit/audit.service.js';

describe('AuditController', () => {
  let controller: AuditController;
  let auditService: Record<string, any>;

  const poolId = 'pool-001';
  const orgId = 'org-001';
  const userAddress = '0x' + 'a'.repeat(64);

  const mockUser = {
    sub: 'user-001',
    address: userAddress,
    orgId,
    orgRole: 32,
    sid: 'sid-1',
    jti: 'jti-1',
    iat: 1700000000,
    exp: 1700001000,
  };

  const mockEvents = [
    { id: 'evt-001', poolId, eventType: 'PoolCreated', actorAddress: userAddress, timestamp: new Date() },
  ];

  const mockPaginatedResult = { data: mockEvents, page: 1, limit: 50 };

  beforeEach(() => {
    auditService = {
      getPoolAudit: vi.fn().mockResolvedValue(mockPaginatedResult),
      exportPoolAudit: vi.fn().mockResolvedValue(mockEvents),
      getMyActivity: vi.fn().mockResolvedValue(mockPaginatedResult),
    };

    controller = new AuditController(auditService as unknown as AuditService);
  });

  // ─── GET /pools/:poolId/audit ────────────────────────────

  describe('GET /pools/:poolId/audit', () => {
    it('delegates to auditService.getPoolAudit with correct args', async () => {
      const query = { page: 1, limit: 50, format: 'json' };
      const result = await controller.getPoolAudit(poolId, mockUser as any, query);

      expect(auditService.getPoolAudit).toHaveBeenCalledWith(poolId, mockUser.orgId, query);
      expect(result).toEqual(mockPaginatedResult);
    });

    it('passes user.orgId which may be null', async () => {
      const userNoOrg = { ...mockUser, orgId: null };
      const query = { page: 1, limit: 50, format: 'json' };

      await controller.getPoolAudit(poolId, userNoOrg as any, query);

      expect(auditService.getPoolAudit).toHaveBeenCalledWith(poolId, null, query);
    });
  });

  // ─── GET /pools/:poolId/audit/export ─────────────────────

  describe('GET /pools/:poolId/audit/export', () => {
    it('delegates with format=json, no headers set', async () => {
      const mockRes = { setHeader: vi.fn() } as any;
      auditService.exportPoolAudit.mockResolvedValue(mockEvents);

      const result = await controller.exportPoolAudit(poolId, mockUser as any, 'json', mockRes);

      expect(auditService.exportPoolAudit).toHaveBeenCalledWith(poolId, mockUser.orgId, 'json');
      expect(mockRes.setHeader).not.toHaveBeenCalled();
      expect(result).toEqual(mockEvents);
    });

    it('delegates with format=csv, sets response headers', async () => {
      const csvContent = 'id,poolId,eventType\nevt-001,pool-001,PoolCreated';
      auditService.exportPoolAudit.mockResolvedValue(csvContent);
      const mockRes = { setHeader: vi.fn() } as any;

      const result = await controller.exportPoolAudit(poolId, mockUser as any, 'csv', mockRes);

      expect(auditService.exportPoolAudit).toHaveBeenCalledWith(poolId, mockUser.orgId, 'csv');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        `attachment; filename="audit-${poolId}.csv"`,
      );
      expect(result).toBe(csvContent);
    });

    it('defaults to json format if format param not provided', async () => {
      const mockRes = { setHeader: vi.fn() } as any;

      await controller.exportPoolAudit(poolId, mockUser as any, undefined as any, mockRes);

      expect(auditService.exportPoolAudit).toHaveBeenCalledWith(poolId, mockUser.orgId, 'json');
    });

    it('passes user.orgId (null case)', async () => {
      const userNoOrg = { ...mockUser, orgId: null };
      const mockRes = { setHeader: vi.fn() } as any;

      await controller.exportPoolAudit(poolId, userNoOrg as any, 'json', mockRes);

      expect(auditService.exportPoolAudit).toHaveBeenCalledWith(poolId, null, 'json');
    });
  });

  // ─── GET /audit/me ───────────────────────────────────────

  describe('GET /audit/me', () => {
    it('delegates to auditService.getMyActivity with user.address', async () => {
      const query = { page: 1, limit: 20 };
      const result = await controller.getMyActivity(mockUser as any, query);

      expect(auditService.getMyActivity).toHaveBeenCalledWith(mockUser.address, query);
      expect(result).toEqual(mockPaginatedResult);
    });

    it('passes user address correctly', async () => {
      const query = { page: 2, limit: 10 };
      await controller.getMyActivity(mockUser as any, query);

      expect(auditService.getMyActivity).toHaveBeenCalledWith(userAddress, query);
    });
  });

  // ─── Monkey tests ─────────────────────────────────────────

  describe('monkey tests', () => {
    it('getPoolAudit propagates NotFoundException from service', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      auditService.getPoolAudit.mockRejectedValue(
        new NotFoundException({ code: 'POOL_NOT_FOUND', message: 'Pool not found' }),
      );

      await expect(
        controller.getPoolAudit('nonexistent', mockUser as any, { page: 1, limit: 50, format: 'json' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('getPoolAudit propagates ForbiddenException from service', async () => {
      const { ForbiddenException } = await import('@nestjs/common');
      auditService.getPoolAudit.mockRejectedValue(
        new ForbiddenException({ code: 'NOT_IN_ORG', message: 'Not in org' }),
      );

      await expect(
        controller.getPoolAudit(poolId, { ...mockUser, orgId: 'wrong' } as any, { page: 1, limit: 50, format: 'json' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('exportPoolAudit propagates NotFoundException from service', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      auditService.exportPoolAudit.mockRejectedValue(
        new NotFoundException({ code: 'POOL_NOT_FOUND', message: 'Pool not found' }),
      );
      const mockRes = { setHeader: vi.fn() } as any;

      await expect(
        controller.exportPoolAudit('nonexistent', mockUser as any, 'json', mockRes),
      ).rejects.toThrow(NotFoundException);
    });

    it('getMyActivity propagates service errors', async () => {
      auditService.getMyActivity.mockRejectedValue(new Error('DB connection failed'));

      await expect(
        controller.getMyActivity(mockUser as any, { page: 1, limit: 10 }),
      ).rejects.toThrow('DB connection failed');
    });

    it('unknown format treated as json (no headers set)', async () => {
      const mockRes = { setHeader: vi.fn() } as any;

      await controller.exportPoolAudit(poolId, mockUser as any, 'xml', mockRes);

      expect(auditService.exportPoolAudit).toHaveBeenCalledWith(poolId, mockUser.orgId, 'json');
      expect(mockRes.setHeader).not.toHaveBeenCalled();
    });
  });
});
