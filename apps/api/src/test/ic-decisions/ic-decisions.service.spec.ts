process.env.DATABASE_URL = 'postgresql://localhost/test';
process.env.REDIS_URL = 'redis://localhost';
process.env.JWT_PRIVATE_KEY = 'dGVzdA==';
process.env.JWT_PUBLIC_KEY = 'dGVzdA==';
process.env.CSRF_SECRET = 'test-csrf-secret-at-least-16-chars';
process.env.SUI_RPC_URL = 'https://rpc.testnet.sui.io';
process.env.SUI_PACKAGE_ID = '0x0';
process.env.PLATFORM_KEYPAIR = 'dGVzdA==';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ICDecisionsService } from '../../modules/ic-decisions/ic-decisions.service.js';

describe('ICDecisionsService', () => {
  let service: ICDecisionsService;
  let poolsRepo: any;
  let icDecisionsRepo: any;
  let suiTx: any;

  const poolId = 'pool-001';
  const orgId = 'org-001';
  const userAddress = '0x' + 'a'.repeat(64);

  const mockPool = (overrides: any = {}) => ({
    id: poolId,
    orgId,
    suiObjectId: '0x' + 'b'.repeat(64),
    name: 'Test Pool',
    status: 'ic_review',
    currency: 'USD',
    targetNotional: '1000000',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const mockDecision = (overrides: any = {}) => ({
    id: 'icd-001',
    poolId,
    decisionIndex: 0,
    decisionType: 0,
    decisionText: 'Approved after thorough review',
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
    decisionText: 'Approved after thorough review',
    pdfBlobId: 'blob-001',
    committeeMembers: ['0x' + 'c'.repeat(64)],
    votes: [0],
    relatedDocIds: [],
  };

  beforeEach(() => {
    poolsRepo = {
      findById: vi.fn(),
    };
    icDecisionsRepo = {
      findByPoolId: vi.fn(),
      findByPoolAndIndex: vi.fn(),
    };
    suiTx = {
      buildRecordIcApprovalTx: vi.fn().mockResolvedValue({ txBytes: 'approval-tx' }),
      buildRecordIcRejectionTx: vi.fn().mockResolvedValue({ txBytes: 'rejection-tx' }),
      buildRecordIcRequestChangesTx: vi.fn().mockResolvedValue({ txBytes: 'changes-tx' }),
    };

    service = new ICDecisionsService(poolsRepo, icDecisionsRepo, suiTx);
  });

  // ─── buildSubmitDecision ─────────────────────────────────

  describe('buildSubmitDecision', () => {
    it('decisionType=0 (APPROVE) → calls buildRecordIcApprovalTx', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      const dto = { ...validDto, decisionType: 0 };

      const result = await service.buildSubmitDecision(poolId, userAddress, orgId, dto as any);

      expect(suiTx.buildRecordIcApprovalTx).toHaveBeenCalledWith({
        senderAddress: userAddress,
        adminConfigId: dto.adminConfigId,
        poolObjectId: mockPool().suiObjectId,
        decisionText: dto.decisionText,
        pdfBlobId: dto.pdfBlobId,
        committeeMembers: dto.committeeMembers,
        votes: dto.votes,
        relatedDocIds: dto.relatedDocIds,
      });
      expect(suiTx.buildRecordIcRejectionTx).not.toHaveBeenCalled();
      expect(suiTx.buildRecordIcRequestChangesTx).not.toHaveBeenCalled();
      expect(result).toEqual({ txBytes: 'approval-tx' });
    });

    it('decisionType=1 (REJECT) → calls buildRecordIcRejectionTx', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      const dto = { ...validDto, decisionType: 1 };

      const result = await service.buildSubmitDecision(poolId, userAddress, orgId, dto as any);

      expect(suiTx.buildRecordIcRejectionTx).toHaveBeenCalledWith(
        expect.objectContaining({ senderAddress: userAddress }),
      );
      expect(suiTx.buildRecordIcApprovalTx).not.toHaveBeenCalled();
      expect(result).toEqual({ txBytes: 'rejection-tx' });
    });

    it('decisionType=2 (REQUEST_CHANGES) → calls buildRecordIcRequestChangesTx', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      const dto = { ...validDto, decisionType: 2 };

      const result = await service.buildSubmitDecision(poolId, userAddress, orgId, dto as any);

      expect(suiTx.buildRecordIcRequestChangesTx).toHaveBeenCalledWith(
        expect.objectContaining({ senderAddress: userAddress }),
      );
      expect(suiTx.buildRecordIcApprovalTx).not.toHaveBeenCalled();
      expect(suiTx.buildRecordIcRejectionTx).not.toHaveBeenCalled();
      expect(result).toEqual({ txBytes: 'changes-tx' });
    });

    it('passes relatedDocIds correctly', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      const dto = { ...validDto, relatedDocIds: ['doc-001', 'doc-002'] };

      await service.buildSubmitDecision(poolId, userAddress, orgId, dto as any);

      expect(suiTx.buildRecordIcApprovalTx).toHaveBeenCalledWith(
        expect.objectContaining({ relatedDocIds: ['doc-001', 'doc-002'] }),
      );
    });

    it('throws POOL_NOT_FOUND if pool missing', async () => {
      poolsRepo.findById.mockResolvedValue(null);

      await expect(
        service.buildSubmitDecision(poolId, userAddress, orgId, validDto as any),
      ).rejects.toThrow(NotFoundException);
      try {
        await service.buildSubmitDecision(poolId, userAddress, orgId, validDto as any);
      } catch (err: any) {
        expect(err.getResponse()).toMatchObject({ code: 'POOL_NOT_FOUND' });
      }
    });

    it('throws NOT_IN_ORG if user not in org', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool({ orgId: 'other-org' }));

      await expect(
        service.buildSubmitDecision(poolId, userAddress, orgId, validDto as any),
      ).rejects.toThrow(ForbiddenException);
      try {
        await service.buildSubmitDecision(poolId, userAddress, orgId, validDto as any);
      } catch (err: any) {
        expect(err.getResponse()).toMatchObject({ code: 'NOT_IN_ORG' });
      }
    });

    it('throws NOT_IN_ORG if userOrgId is null', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());

      await expect(
        service.buildSubmitDecision(poolId, userAddress, null, validDto as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException with INVALID_DECISION_TYPE for unknown decisionType', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      const dto = { ...validDto, decisionType: 99 };

      await expect(
        service.buildSubmitDecision(poolId, userAddress, orgId, dto as any),
      ).rejects.toThrow(BadRequestException);
      try {
        await service.buildSubmitDecision(poolId, userAddress, orgId, dto as any);
      } catch (err: any) {
        expect(err.getResponse()).toMatchObject({ code: 'INVALID_DECISION_TYPE' });
      }
    });
  });

  // ─── listDecisions ───────────────────────────────────────

  describe('listDecisions', () => {
    it('returns array from repo', async () => {
      const decisions = [mockDecision(), mockDecision({ decisionIndex: 1 })];
      poolsRepo.findById.mockResolvedValue(mockPool());
      icDecisionsRepo.findByPoolId.mockResolvedValue(decisions);

      const result = await service.listDecisions(poolId, orgId);

      expect(icDecisionsRepo.findByPoolId).toHaveBeenCalledWith(poolId);
      expect(result).toEqual(decisions);
    });

    it('returns empty array when no decisions', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      icDecisionsRepo.findByPoolId.mockResolvedValue([]);

      const result = await service.listDecisions(poolId, orgId);

      expect(result).toEqual([]);
    });

    it('throws POOL_NOT_FOUND if pool missing', async () => {
      poolsRepo.findById.mockResolvedValue(null);

      await expect(service.listDecisions(poolId, orgId)).rejects.toThrow(NotFoundException);
    });

    it('throws NOT_IN_ORG if user not in org', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool({ orgId: 'other-org' }));

      await expect(service.listDecisions(poolId, orgId)).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── getDecision ─────────────────────────────────────────

  describe('getDecision', () => {
    it('returns single decision', async () => {
      const decision = mockDecision();
      poolsRepo.findById.mockResolvedValue(mockPool());
      icDecisionsRepo.findByPoolAndIndex.mockResolvedValue(decision);

      const result = await service.getDecision(poolId, 0, orgId);

      expect(icDecisionsRepo.findByPoolAndIndex).toHaveBeenCalledWith(poolId, 0);
      expect(result).toEqual(decision);
    });

    it('throws IC_DECISION_NOT_FOUND if decision missing', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      icDecisionsRepo.findByPoolAndIndex.mockResolvedValue(null);

      await expect(service.getDecision(poolId, 99, orgId)).rejects.toThrow(NotFoundException);
      try {
        await service.getDecision(poolId, 99, orgId);
      } catch (err: any) {
        expect(err.getResponse()).toMatchObject({ code: 'IC_DECISION_NOT_FOUND' });
      }
    });

    it('throws POOL_NOT_FOUND if pool missing', async () => {
      poolsRepo.findById.mockResolvedValue(null);

      await expect(service.getDecision(poolId, 0, orgId)).rejects.toThrow(NotFoundException);
    });

    it('throws NOT_IN_ORG if user not in org', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool({ orgId: 'other-org' }));

      await expect(service.getDecision(poolId, 0, orgId)).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── Monkey / Edge-case tests ────────────────────────────

  describe('monkey tests', () => {
    it('buildSubmitDecision with 50 committee members', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      const members = Array.from({ length: 50 }, (_, i) => '0x' + i.toString().padStart(64, '0'));
      const votes = Array.from({ length: 50 }, () => 0);
      const dto = { ...validDto, committeeMembers: members, votes };

      await service.buildSubmitDecision(poolId, userAddress, orgId, dto as any);

      expect(suiTx.buildRecordIcApprovalTx).toHaveBeenCalledWith(
        expect.objectContaining({ committeeMembers: members, votes }),
      );
    });

    it('buildSubmitDecision with max decisionText length (10000 chars)', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      const dto = { ...validDto, decisionText: 'x'.repeat(10000) };

      await service.buildSubmitDecision(poolId, userAddress, orgId, dto as any);

      expect(suiTx.buildRecordIcApprovalTx).toHaveBeenCalledWith(
        expect.objectContaining({ decisionText: 'x'.repeat(10000) }),
      );
    });

    it('suiTx rejection propagates errors', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      suiTx.buildRecordIcApprovalTx.mockRejectedValue(new Error('RPC error'));

      await expect(
        service.buildSubmitDecision(poolId, userAddress, orgId, validDto as any),
      ).rejects.toThrow('RPC error');
    });

    it('getDecision at large index — not found', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      icDecisionsRepo.findByPoolAndIndex.mockResolvedValue(null);

      await expect(service.getDecision(poolId, 999999, orgId)).rejects.toThrow(NotFoundException);
    });

    it('listDecisions when pool.orgId is null — user orgId never matches', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool({ orgId: null }));

      await expect(service.listDecisions(poolId, orgId)).rejects.toThrow(ForbiddenException);
    });

    it('buildSubmitDecision with relatedDocIds empty array', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      const dto = { ...validDto, relatedDocIds: [] };

      await service.buildSubmitDecision(poolId, userAddress, orgId, dto as any);

      expect(suiTx.buildRecordIcApprovalTx).toHaveBeenCalledWith(
        expect.objectContaining({ relatedDocIds: [] }),
      );
    });
  });
});
