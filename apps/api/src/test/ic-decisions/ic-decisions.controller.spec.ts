process.env.DATABASE_URL = 'postgresql://localhost/test';
process.env.REDIS_URL = 'redis://localhost';
process.env.JWT_PRIVATE_KEY = 'dGVzdA==';
process.env.JWT_PUBLIC_KEY = 'dGVzdA==';
process.env.CSRF_SECRET = 'test-csrf-secret-at-least-16-chars';
process.env.SUI_RPC_URL = 'https://rpc.testnet.sui.io';
process.env.SUI_PACKAGE_ID = '0x0';
process.env.PLATFORM_KEYPAIR = 'dGVzdA==';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ICDecisionsController } from '../../modules/ic-decisions/ic-decisions.controller.js';
import type { ICDecisionsService } from '../../modules/ic-decisions/ic-decisions.service.js';

describe('ICDecisionsController', () => {
  let controller: ICDecisionsController;
  let icDecisionsService: Record<string, any>;

  const poolId = 'pool-001';
  const orgId = 'org-001';

  const mockUser = {
    sub: 'user-001',
    address: '0x' + 'a'.repeat(64),
    orgId,
    orgRole: 32,
    sid: 'sid-1',
    jti: 'jti-1',
    iat: 1700000000,
    exp: 1700001000,
  };

  const mockTxResponse = { txBytes: 'base64txbytes' };

  const mockDecision = (overrides: any = {}) => ({
    id: 'icd-001',
    poolId,
    decisionIndex: 0,
    decisionType: 0,
    decisionText: 'Approved',
    pdfBlobId: 'blob-001',
    committeeMembers: ['0x' + 'c'.repeat(64)],
    votes: [0],
    relatedDocIds: [],
    createdAt: new Date(),
    ...overrides,
  });

  const validDto = {
    adminConfigId: 'admin-cfg-001',
    decisionType: 0,
    decisionText: 'Approved after review',
    pdfBlobId: 'blob-001',
    committeeMembers: ['0x' + 'c'.repeat(64)],
    votes: [0],
    relatedDocIds: [],
  };

  let mockDecisionInstance: ReturnType<typeof mockDecision>;

  beforeEach(() => {
    mockDecisionInstance = mockDecision();
    icDecisionsService = {
      buildSubmitDecision: vi.fn().mockResolvedValue(mockTxResponse),
      listDecisions: vi.fn().mockResolvedValue([mockDecisionInstance]),
      getDecision: vi.fn().mockResolvedValue(mockDecisionInstance),
    };

    controller = new ICDecisionsController(
      icDecisionsService as unknown as ICDecisionsService,
    );
  });

  // ─── POST /pools/:poolId/ic-decisions ────────────────────

  describe('POST /pools/:poolId/ic-decisions', () => {
    it('calls buildSubmitDecision with correct args', async () => {
      const result = await controller.submit(poolId, mockUser as any, validDto);

      expect(icDecisionsService.buildSubmitDecision).toHaveBeenCalledWith(
        poolId,
        mockUser.address,
        mockUser.orgId,
        validDto,
      );
      expect(result).toEqual(mockTxResponse);
    });

    it('passes user.orgId (which may be null)', async () => {
      const userNoOrg = { ...mockUser, orgId: null };
      await controller.submit(poolId, userNoOrg as any, validDto);

      expect(icDecisionsService.buildSubmitDecision).toHaveBeenCalledWith(
        poolId,
        mockUser.address,
        null,
        validDto,
      );
    });

    it('propagates service errors', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      icDecisionsService.buildSubmitDecision.mockRejectedValue(
        new NotFoundException({ code: 'POOL_NOT_FOUND', message: 'Pool not found' }),
      );

      await expect(controller.submit(poolId, mockUser as any, validDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── GET /pools/:poolId/ic-decisions ─────────────────────

  describe('GET /pools/:poolId/ic-decisions', () => {
    it('calls listDecisions with correct args', async () => {
      const result = await controller.list(poolId, mockUser as any);

      expect(icDecisionsService.listDecisions).toHaveBeenCalledWith(poolId, mockUser.orgId);
      expect(result).toEqual([mockDecisionInstance]);
    });

    it('passes user.orgId (which may be null)', async () => {
      const userNoOrg = { ...mockUser, orgId: null };
      await controller.list(poolId, userNoOrg as any);

      expect(icDecisionsService.listDecisions).toHaveBeenCalledWith(poolId, null);
    });

    it('propagates FORBIDDEN from service', async () => {
      const { ForbiddenException } = await import('@nestjs/common');
      icDecisionsService.listDecisions.mockRejectedValue(
        new ForbiddenException({ code: 'NOT_IN_ORG', message: 'Not in org' }),
      );

      await expect(controller.list(poolId, mockUser as any)).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── GET /pools/:poolId/ic-decisions/:index ───────────────

  describe('GET /pools/:poolId/ic-decisions/:index', () => {
    it('calls getDecision with correct args', async () => {
      const result = await controller.findOne(poolId, 0, mockUser as any);

      expect(icDecisionsService.getDecision).toHaveBeenCalledWith(poolId, 0, mockUser.orgId);
      expect(result).toEqual(mockDecisionInstance);
    });

    it('calls getDecision with correct index', async () => {
      icDecisionsService.getDecision.mockResolvedValue(mockDecision({ decisionIndex: 5 }));

      const result = await controller.findOne(poolId, 5, mockUser as any);

      expect(icDecisionsService.getDecision).toHaveBeenCalledWith(poolId, 5, mockUser.orgId);
      expect(result.decisionIndex).toBe(5);
    });

    it('propagates NOT_FOUND from service', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      icDecisionsService.getDecision.mockRejectedValue(
        new NotFoundException({ code: 'IC_DECISION_NOT_FOUND', message: 'IC decision not found' }),
      );

      await expect(controller.findOne(poolId, 99, mockUser as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── Monkey tests ─────────────────────────────────────────

  describe('monkey tests', () => {
    it('submit with decisionType=2 delegates correctly', async () => {
      const dto = { ...validDto, decisionType: 2 };
      icDecisionsService.buildSubmitDecision.mockResolvedValue({ txBytes: 'changes-tx' });

      const result = await controller.submit(poolId, mockUser as any, dto);

      expect(icDecisionsService.buildSubmitDecision).toHaveBeenCalledWith(
        poolId,
        mockUser.address,
        mockUser.orgId,
        dto,
      );
      expect(result).toEqual({ txBytes: 'changes-tx' });
    });

    it('list returns empty array from service', async () => {
      icDecisionsService.listDecisions.mockResolvedValue([]);

      const result = await controller.list(poolId, mockUser as any);

      expect(result).toEqual([]);
    });

    it('findOne index=0 works correctly', async () => {
      const result = await controller.findOne(poolId, 0, mockUser as any);

      expect(icDecisionsService.getDecision).toHaveBeenCalledWith(poolId, 0, orgId);
      expect(result).toBeDefined();
    });
  });
});
