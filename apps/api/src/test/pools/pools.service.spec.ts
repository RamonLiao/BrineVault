process.env.DATABASE_URL = 'postgresql://localhost/test';
process.env.REDIS_URL = 'redis://localhost';
process.env.JWT_PRIVATE_KEY = 'dGVzdA==';
process.env.JWT_PUBLIC_KEY = 'dGVzdA==';
process.env.CSRF_SECRET = 'test-csrf-secret-at-least-16-chars';
process.env.SUI_RPC_URL = 'https://rpc.testnet.sui.io';
process.env.SUI_PACKAGE_ID = '0x0';
process.env.PLATFORM_KEYPAIR = 'dGVzdA==';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PoolsService } from '../../modules/pools/pools.service.js';

describe('PoolsService', () => {
  let service: PoolsService;
  let poolsRepo: any;
  let dataroomsRepo: any;
  let membersRepo: any;
  let suiTx: any;

  const poolId = 'pool-001';
  const orgId = 'org-001';
  const userAddress = '0x' + 'a'.repeat(64);

  const mockPool = (overrides: any = {}) => ({
    id: poolId,
    orgId,
    suiObjectId: '0x' + 'b'.repeat(64),
    name: 'Test Pool',
    status: 'draft',
    currency: 'USD',
    targetNotional: '1000000',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const mockDataroom = (overrides: any = {}) => ({
    id: 'dr-001',
    poolId,
    suiObjectId: '0x' + 'c'.repeat(64),
    createdAt: new Date(),
    ...overrides,
  });

  const mockMembership = (overrides: any = {}) => ({
    id: 'mem-001',
    dataroomId: 'dr-001',
    memberAddress: userAddress,
    isActive: true,
    role: 1,
    createdAt: new Date(),
    ...overrides,
  });

  const validCreateDto = {
    name: 'Test Pool',
    adminConfigId: 'admin-cfg-001',
    orgIdHash: 'a'.repeat(64),
    borrowerNameHash: 'b'.repeat(64),
    currency: 'USD',
    targetNotional: '1000000',
    expectedMaturityDate: 1800000000,
    encryptionScheme: 0,
    tags: [],
  };

  beforeEach(() => {
    poolsRepo = {
      findById: vi.fn(),
      findBySuiObjectId: vi.fn(),
      findByOrgId: vi.fn(),
      countByOrgId: vi.fn(),
    };
    dataroomsRepo = {
      findByPoolId: vi.fn(),
    };
    membersRepo = {
      findByDataroomAndAddress: vi.fn(),
    };
    suiTx = {
      buildCreatePoolTx: vi.fn().mockResolvedValue({ txBytes: 'base64txbytes' }),
      buildStateTransitionTx: vi.fn().mockResolvedValue({ txBytes: 'base64txbytes' }),
      buildCancelPoolTx: vi.fn().mockResolvedValue({ txBytes: 'base64txbytes' }),
      submitSignedTx: vi.fn().mockResolvedValue({ digest: 'tx-digest-001' }),
    };

    service = new PoolsService(poolsRepo, dataroomsRepo, membersRepo, suiTx);
  });

  // ─── buildCreatePool ────────────────────────────────────

  describe('buildCreatePool', () => {
    it('delegates to suiTx.buildCreatePoolTx with correct args', async () => {
      const result = await service.buildCreatePool(userAddress, validCreateDto);

      expect(suiTx.buildCreatePoolTx).toHaveBeenCalledWith({
        senderAddress: userAddress,
        adminConfigId: validCreateDto.adminConfigId,
        orgIdHash: validCreateDto.orgIdHash,
        name: validCreateDto.name,
        borrowerNameHash: validCreateDto.borrowerNameHash,
        currency: validCreateDto.currency,
        targetNotional: validCreateDto.targetNotional,
        expectedMaturityDate: validCreateDto.expectedMaturityDate,
        encryptionScheme: validCreateDto.encryptionScheme,
        tags: validCreateDto.tags,
      });
      expect(result).toEqual({ txBytes: 'base64txbytes' });
    });

    it('passes tags array correctly', async () => {
      const dtoWithTags = { ...validCreateDto, tags: ['real-estate', 'tokenized'] };
      await service.buildCreatePool(userAddress, dtoWithTags);
      expect(suiTx.buildCreatePoolTx).toHaveBeenCalledWith(
        expect.objectContaining({ tags: ['real-estate', 'tokenized'] }),
      );
    });
  });

  // ─── listPools ──────────────────────────────────────────

  describe('listPools', () => {
    it('returns paginated pools for org member', async () => {
      const pools = [mockPool()];
      poolsRepo.findByOrgId.mockResolvedValue(pools);
      poolsRepo.countByOrgId.mockResolvedValue(1);

      const result = await service.listPools(orgId, orgId, { page: 1, limit: 10 });

      expect(result.data).toEqual(pools);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(poolsRepo.findByOrgId).toHaveBeenCalledWith(orgId, { limit: 10, offset: 0 });
    });

    it('computes offset correctly for page 2', async () => {
      poolsRepo.findByOrgId.mockResolvedValue([]);
      poolsRepo.countByOrgId.mockResolvedValue(0);

      await service.listPools(orgId, orgId, { page: 2, limit: 10 });

      expect(poolsRepo.findByOrgId).toHaveBeenCalledWith(orgId, { limit: 10, offset: 10 });
    });

    it('throws FORBIDDEN if user not in org', async () => {
      await expect(service.listPools(orgId, 'other-org', { page: 1, limit: 10 })).rejects.toThrow(
        ForbiddenException,
      );
      try {
        await service.listPools(orgId, 'other-org', { page: 1, limit: 10 });
      } catch (err: any) {
        expect(err.getResponse()).toMatchObject({ code: 'NOT_IN_ORG' });
      }
    });

    it('throws FORBIDDEN if userOrgId is null', async () => {
      await expect(service.listPools(orgId, null, { page: 1, limit: 10 })).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ─── getPool ────────────────────────────────────────────

  describe('getPool', () => {
    it('returns pool when user is in org and dataroom member', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      dataroomsRepo.findByPoolId.mockResolvedValue(mockDataroom());
      membersRepo.findByDataroomAndAddress.mockResolvedValue(mockMembership());

      const result = await service.getPool(poolId, userAddress, orgId);

      expect(result.id).toBe(poolId);
      expect(dataroomsRepo.findByPoolId).toHaveBeenCalledWith(poolId);
      expect(membersRepo.findByDataroomAndAddress).toHaveBeenCalledWith('dr-001', userAddress);
    });

    it('returns pool when no dataroom exists (no membership check)', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      dataroomsRepo.findByPoolId.mockResolvedValue(null);

      const result = await service.getPool(poolId, userAddress, orgId);

      expect(result.id).toBe(poolId);
      expect(membersRepo.findByDataroomAndAddress).not.toHaveBeenCalled();
    });

    it('throws NOT_FOUND if pool missing', async () => {
      poolsRepo.findById.mockResolvedValue(null);

      await expect(service.getPool(poolId, userAddress, orgId)).rejects.toThrow(NotFoundException);
      try {
        await service.getPool(poolId, userAddress, orgId);
      } catch (err: any) {
        expect(err.getResponse()).toMatchObject({ code: 'POOL_NOT_FOUND' });
      }
    });

    it('throws FORBIDDEN if user not in org', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool({ orgId: 'other-org' }));

      await expect(service.getPool(poolId, userAddress, orgId)).rejects.toThrow(ForbiddenException);
      try {
        await service.getPool(poolId, userAddress, orgId);
      } catch (err: any) {
        expect(err.getResponse()).toMatchObject({ code: 'NOT_IN_ORG' });
      }
    });

    it('throws FORBIDDEN if user not a dataroom member', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      dataroomsRepo.findByPoolId.mockResolvedValue(mockDataroom());
      membersRepo.findByDataroomAndAddress.mockResolvedValue(null);

      await expect(service.getPool(poolId, userAddress, orgId)).rejects.toThrow(ForbiddenException);
      try {
        await service.getPool(poolId, userAddress, orgId);
      } catch (err: any) {
        expect(err.getResponse()).toMatchObject({ code: 'NOT_DATAROOM_MEMBER' });
      }
    });

    it('throws FORBIDDEN if dataroom membership is inactive', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      dataroomsRepo.findByPoolId.mockResolvedValue(mockDataroom());
      membersRepo.findByDataroomAndAddress.mockResolvedValue(mockMembership({ isActive: false }));

      await expect(service.getPool(poolId, userAddress, orgId)).rejects.toThrow(ForbiddenException);
      try {
        await service.getPool(poolId, userAddress, orgId);
      } catch (err: any) {
        expect(err.getResponse()).toMatchObject({ code: 'NOT_DATAROOM_MEMBER' });
      }
    });
  });

  // ─── buildTransition ────────────────────────────────────

  describe('buildTransition', () => {
    const transitionDto = {
      adminConfigId: 'admin-cfg-001',
      targetFunction: 'progress_to_dd' as const,
    };

    it('delegates to suiTx.buildStateTransitionTx', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());

      const result = await service.buildTransition(poolId, userAddress, orgId, transitionDto);

      expect(suiTx.buildStateTransitionTx).toHaveBeenCalledWith({
        senderAddress: userAddress,
        adminConfigId: transitionDto.adminConfigId,
        poolObjectId: mockPool().suiObjectId,
        targetFunction: transitionDto.targetFunction,
        extraArgs: undefined,
      });
      expect(result).toEqual({ txBytes: 'base64txbytes' });
    });

    it('passes extraArgs when provided', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      const dtoWithExtra = { ...transitionDto, extraArgs: ['arg1', 'arg2'] };

      await service.buildTransition(poolId, userAddress, orgId, dtoWithExtra);

      expect(suiTx.buildStateTransitionTx).toHaveBeenCalledWith(
        expect.objectContaining({ extraArgs: ['arg1', 'arg2'] }),
      );
    });

    it('throws NOT_FOUND if pool missing', async () => {
      poolsRepo.findById.mockResolvedValue(null);

      await expect(service.buildTransition(poolId, userAddress, orgId, transitionDto)).rejects.toThrow(
        NotFoundException,
      );
      try {
        await service.buildTransition(poolId, userAddress, orgId, transitionDto);
      } catch (err: any) {
        expect(err.getResponse()).toMatchObject({ code: 'POOL_NOT_FOUND' });
      }
    });

    it('throws FORBIDDEN if user not in org', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool({ orgId: 'other-org' }));

      await expect(service.buildTransition(poolId, userAddress, orgId, transitionDto)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ─── buildCancel ────────────────────────────────────────

  describe('buildCancel', () => {
    const cancelDto = { adminConfigId: 'admin-cfg-001' };

    it('delegates to suiTx.buildCancelPoolTx', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());

      const result = await service.buildCancel(poolId, userAddress, orgId, cancelDto);

      expect(suiTx.buildCancelPoolTx).toHaveBeenCalledWith({
        senderAddress: userAddress,
        adminConfigId: cancelDto.adminConfigId,
        poolObjectId: mockPool().suiObjectId,
      });
      expect(result).toEqual({ txBytes: 'base64txbytes' });
    });

    it('throws NOT_FOUND if pool missing', async () => {
      poolsRepo.findById.mockResolvedValue(null);

      await expect(service.buildCancel(poolId, userAddress, orgId, cancelDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws FORBIDDEN if user not in org', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool({ orgId: 'other-org' }));

      await expect(service.buildCancel(poolId, userAddress, orgId, cancelDto)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ─── submitSignedTx ─────────────────────────────────────

  describe('submitSignedTx', () => {
    it('forwards to suiTx.submitSignedTx', async () => {
      const dto = { txBytes: 'base64bytes', signature: 'sig001' };
      const result = await service.submitSignedTx(dto);

      expect(suiTx.submitSignedTx).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ digest: 'tx-digest-001' });
    });
  });

  // ─── Monkey / Edge-case tests ───────────────────────────

  describe('monkey tests', () => {
    it('listPools page=1000 computes correct offset', async () => {
      poolsRepo.findByOrgId.mockResolvedValue([]);
      poolsRepo.countByOrgId.mockResolvedValue(0);

      await service.listPools(orgId, orgId, { page: 1000, limit: 50 });
      expect(poolsRepo.findByOrgId).toHaveBeenCalledWith(orgId, { limit: 50, offset: 49950 });
    });

    it('getPool — pool orgId null never matches user orgId', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool({ orgId: null }));

      await expect(service.getPool(poolId, userAddress, orgId)).rejects.toThrow(ForbiddenException);
    });

    it('getPool — user orgId null never matches pool orgId', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());

      await expect(service.getPool(poolId, userAddress, null)).rejects.toThrow(ForbiddenException);
    });

    it('buildTransition with all targetFunction variants', async () => {
      const functions = [
        'progress_to_dd',
        'progress_to_ic_review',
        'progress_to_ready_to_issue',
        'reopen_rejected_pool',
      ] as const;

      for (const fn of functions) {
        poolsRepo.findById.mockResolvedValue(mockPool());
        suiTx.buildStateTransitionTx.mockResolvedValue({ txBytes: `bytes-${fn}` });
        const result = await service.buildTransition(poolId, userAddress, orgId, {
          adminConfigId: 'cfg',
          targetFunction: fn,
        });
        expect(result).toEqual({ txBytes: `bytes-${fn}` });
      }
    });

    it('buildCreatePool with max 20 tags', async () => {
      const maxTags = Array.from({ length: 20 }, (_, i) => `tag${i}`);
      await service.buildCreatePool(userAddress, { ...validCreateDto, tags: maxTags });
      expect(suiTx.buildCreatePoolTx).toHaveBeenCalledWith(
        expect.objectContaining({ tags: maxTags }),
      );
    });

    it('submitSignedTx propagates suiTx errors', async () => {
      suiTx.submitSignedTx.mockRejectedValue(new Error('Network error'));
      await expect(service.submitSignedTx({ txBytes: 'bad', signature: 'sig' })).rejects.toThrow(
        'Network error',
      );
    });
  });
});
