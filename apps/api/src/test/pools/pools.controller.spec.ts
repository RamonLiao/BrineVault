process.env.DATABASE_URL = 'postgresql://localhost/test';
process.env.REDIS_URL = 'redis://localhost';
process.env.JWT_PRIVATE_KEY = 'dGVzdA==';
process.env.JWT_PUBLIC_KEY = 'dGVzdA==';
process.env.CSRF_SECRET = 'test-csrf-secret-at-least-16-chars';
process.env.SUI_RPC_URL = 'https://rpc.testnet.sui.io';
process.env.SUI_PACKAGE_ID = '0x0';
process.env.PLATFORM_KEYPAIR = 'dGVzdA==';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PoolsController } from '../../modules/pools/pools.controller.js';
import type { PoolsService } from '../../modules/pools/pools.service.js';

describe('PoolsController', () => {
  let controller: PoolsController;
  let poolsService: Record<string, any>;

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
  const mockPool = {
    id: poolId,
    orgId,
    name: 'Test Pool',
    status: 'draft',
    createdAt: new Date(),
  };

  beforeEach(() => {
    poolsService = {
      buildCreatePool: vi.fn().mockResolvedValue(mockTxResponse),
      listPools: vi.fn().mockResolvedValue({ data: [mockPool], total: 1, page: 1, limit: 10 }),
      getPool: vi.fn().mockResolvedValue(mockPool),
      submitSignedTx: vi.fn().mockResolvedValue({ digest: 'tx-digest' }),
      buildTransition: vi.fn().mockResolvedValue(mockTxResponse),
      buildCancel: vi.fn().mockResolvedValue(mockTxResponse),
    };

    controller = new PoolsController(poolsService as unknown as PoolsService);
  });

  // ─── POST /pools ─────────────────────────────────────────

  describe('POST /pools', () => {
    it('calls buildCreatePool with user.address and dto', async () => {
      const dto = {
        name: 'My Pool',
        adminConfigId: 'cfg-001',
        orgIdHash: 'a'.repeat(64),
        borrowerNameHash: 'b'.repeat(64),
        currency: 'USD',
        targetNotional: '1000000',
        expectedMaturityDate: 1800000000,
        encryptionScheme: 0,
        tags: [],
      };

      const result = await controller.create(mockUser as any, dto);

      expect(poolsService.buildCreatePool).toHaveBeenCalledWith(mockUser.address, dto);
      expect(result).toEqual(mockTxResponse);
    });
  });

  // ─── GET /pools/org/:orgId ───────────────────────────────

  describe('GET /pools/org/:orgId', () => {
    it('calls listPools with correct args', async () => {
      const query = { page: 1, limit: 10 };
      const result = await controller.list(orgId, mockUser as any, query);

      expect(poolsService.listPools).toHaveBeenCalledWith(orgId, mockUser.orgId, query);
      expect(result.data).toEqual([mockPool]);
      expect(result.total).toBe(1);
    });

    it('passes user.orgId (which may be null)', async () => {
      const userNoOrg = { ...mockUser, orgId: null };
      await controller.list(orgId, userNoOrg as any, { page: 1, limit: 10 });
      expect(poolsService.listPools).toHaveBeenCalledWith(orgId, null, { page: 1, limit: 10 });
    });
  });

  // ─── GET /pools/:poolId ──────────────────────────────────

  describe('GET /pools/:poolId', () => {
    it('calls getPool with correct args', async () => {
      const result = await controller.findOne(poolId, mockUser as any);

      expect(poolsService.getPool).toHaveBeenCalledWith(poolId, mockUser.address, mockUser.orgId);
      expect(result.id).toBe(poolId);
    });
  });

  // ─── POST /pools/:poolId/sign ────────────────────────────

  describe('POST /pools/:poolId/sign', () => {
    it('calls submitSignedTx and returns result', async () => {
      const dto = { txBytes: 'base64bytes', signature: 'sig001' };
      const result = await controller.submitSigned(dto);

      expect(poolsService.submitSignedTx).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ digest: 'tx-digest' });
    });
  });

  // ─── POST /pools/:poolId/transitions ────────────────────

  describe('POST /pools/:poolId/transitions', () => {
    it('calls buildTransition with correct args', async () => {
      const dto = { adminConfigId: 'cfg-001', targetFunction: 'progress_to_dd' as const };
      const result = await controller.transition(poolId, mockUser as any, dto);

      expect(poolsService.buildTransition).toHaveBeenCalledWith(
        poolId,
        mockUser.address,
        mockUser.orgId,
        dto,
      );
      expect(result).toEqual(mockTxResponse);
    });
  });

  // ─── DELETE /pools/:poolId ───────────────────────────────

  describe('DELETE /pools/:poolId', () => {
    it('calls buildCancel with correct args', async () => {
      const dto = { adminConfigId: 'cfg-001' };
      const result = await controller.cancel(poolId, mockUser as any, dto);

      expect(poolsService.buildCancel).toHaveBeenCalledWith(
        poolId,
        mockUser.address,
        mockUser.orgId,
        dto,
      );
      expect(result).toEqual(mockTxResponse);
    });
  });

  // ─── Monkey tests ────────────────────────────────────────

  describe('monkey tests', () => {
    it('create propagates service errors', async () => {
      poolsService.buildCreatePool.mockRejectedValue(new Error('suiTx error'));
      await expect(
        controller.create(mockUser as any, {
          name: 'X',
          adminConfigId: 'cfg',
          orgIdHash: 'a'.repeat(64),
          borrowerNameHash: 'b'.repeat(64),
          currency: 'USD',
          targetNotional: '1',
          expectedMaturityDate: 1,
          encryptionScheme: 0,
          tags: [],
        }),
      ).rejects.toThrow('suiTx error');
    });

    it('transition propagates NOT_FOUND from service', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      poolsService.buildTransition.mockRejectedValue(
        new NotFoundException({ code: 'POOL_NOT_FOUND', message: 'Pool not found' }),
      );
      await expect(
        controller.transition('nonexistent', mockUser as any, {
          adminConfigId: 'cfg',
          targetFunction: 'progress_to_dd',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('cancel propagates FORBIDDEN from service', async () => {
      const { ForbiddenException } = await import('@nestjs/common');
      poolsService.buildCancel.mockRejectedValue(
        new ForbiddenException({ code: 'NOT_IN_ORG', message: 'Not in org' }),
      );
      await expect(
        controller.cancel(poolId, mockUser as any, { adminConfigId: 'cfg' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
