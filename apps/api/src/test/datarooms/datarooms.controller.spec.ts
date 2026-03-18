process.env.DATABASE_URL = 'postgresql://localhost/test';
process.env.REDIS_URL = 'redis://localhost';
process.env.JWT_PRIVATE_KEY = 'dGVzdA==';
process.env.JWT_PUBLIC_KEY = 'dGVzdA==';
process.env.CSRF_SECRET = 'test-csrf-secret-at-least-16-chars';
process.env.SUI_RPC_URL = 'https://rpc.testnet.sui.io';
process.env.SUI_PACKAGE_ID = '0x0';
process.env.PLATFORM_KEYPAIR = 'dGVzdA==';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DataroomsController } from '../../modules/datarooms/datarooms.controller.js';
import type { DataroomsService } from '../../modules/datarooms/datarooms.service.js';

describe('DataroomsController', () => {
  let controller: DataroomsController;
  let dataroomsService: Record<string, any>;

  const poolId = 'pool-001';
  const orgId = 'org-001';
  const memberAddress = '0x' + 'd'.repeat(64);

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
  const mockDataroomResponse = {
    dataroom: { id: 'dr-001', poolId, suiObjectId: '0x' + 'c'.repeat(64) },
    members: [],
  };

  beforeEach(() => {
    dataroomsService = {
      getDataroom: vi.fn().mockResolvedValue(mockDataroomResponse),
      buildAddMember: vi.fn().mockResolvedValue(mockTxResponse),
      buildRemoveMember: vi.fn().mockResolvedValue(mockTxResponse),
      buildUpdateMemberRole: vi.fn().mockResolvedValue(mockTxResponse),
      buildCreateFolder: vi.fn().mockResolvedValue(mockTxResponse),
    };

    controller = new DataroomsController(dataroomsService as unknown as DataroomsService);
  });

  // ─── GET /pools/:poolId/dataroom ──────────────────────────────

  describe('GET /pools/:poolId/dataroom', () => {
    it('calls getDataroom with poolId, user.address, user.orgId', async () => {
      const result = await controller.getDataroom(poolId, mockUser as any);

      expect(dataroomsService.getDataroom).toHaveBeenCalledWith(poolId, mockUser.address, mockUser.orgId);
      expect(result).toEqual(mockDataroomResponse);
    });

    it('passes null orgId when user has no org', async () => {
      const userNoOrg = { ...mockUser, orgId: null };
      await controller.getDataroom(poolId, userNoOrg as any);
      expect(dataroomsService.getDataroom).toHaveBeenCalledWith(poolId, mockUser.address, null);
    });
  });

  // ─── POST /pools/:poolId/dataroom/members ─────────────────────

  describe('POST /pools/:poolId/dataroom/members', () => {
    it('calls buildAddMember with correct args', async () => {
      const dto = {
        adminConfigId: 'cfg-001',
        address: memberAddress,
        role: 2,
        tags: ['investor'],
      };

      const result = await controller.addMember(poolId, mockUser as any, dto);

      expect(dataroomsService.buildAddMember).toHaveBeenCalledWith(
        poolId,
        mockUser.address,
        mockUser.orgId,
        dto,
      );
      expect(result).toEqual(mockTxResponse);
    });
  });

  // ─── DELETE /pools/:poolId/dataroom/members/:address ──────────

  describe('DELETE /pools/:poolId/dataroom/members/:address', () => {
    it('calls buildRemoveMember with correct args', async () => {
      const dto = { adminConfigId: 'cfg-001' };

      const result = await controller.removeMember(poolId, memberAddress, mockUser as any, dto);

      expect(dataroomsService.buildRemoveMember).toHaveBeenCalledWith(
        poolId,
        memberAddress,
        mockUser.address,
        mockUser.orgId,
        dto,
      );
      expect(result).toEqual(mockTxResponse);
    });
  });

  // ─── PATCH /pools/:poolId/dataroom/members/:address ───────────

  describe('PATCH /pools/:poolId/dataroom/members/:address', () => {
    it('calls buildUpdateMemberRole with correct args', async () => {
      const dto = { adminConfigId: 'cfg-001', newRole: 4 };

      const result = await controller.updateMemberRole(poolId, memberAddress, mockUser as any, dto);

      expect(dataroomsService.buildUpdateMemberRole).toHaveBeenCalledWith(
        poolId,
        memberAddress,
        mockUser.address,
        mockUser.orgId,
        dto,
      );
      expect(result).toEqual(mockTxResponse);
    });
  });

  // ─── POST /pools/:poolId/dataroom/folders ─────────────────────

  describe('POST /pools/:poolId/dataroom/folders', () => {
    it('calls buildCreateFolder with correct args', async () => {
      const dto = { adminConfigId: 'cfg-001', name: 'Due Diligence', visibleToRoles: 3 };

      const result = await controller.createFolder(poolId, mockUser as any, dto);

      expect(dataroomsService.buildCreateFolder).toHaveBeenCalledWith(
        poolId,
        mockUser.address,
        mockUser.orgId,
        dto,
      );
      expect(result).toEqual(mockTxResponse);
    });

    it('passes parentId when included in dto', async () => {
      const dto = { adminConfigId: 'cfg-001', name: 'Sub', visibleToRoles: 1, parentId: 3 };

      await controller.createFolder(poolId, mockUser as any, dto);

      expect(dataroomsService.buildCreateFolder).toHaveBeenCalledWith(
        poolId,
        mockUser.address,
        mockUser.orgId,
        dto,
      );
    });
  });

  // ─── Monkey tests ─────────────────────────────────────────────

  describe('monkey tests', () => {
    it('getDataroom propagates NOT_FOUND from service', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      dataroomsService.getDataroom.mockRejectedValue(
        new NotFoundException({ code: 'POOL_NOT_FOUND', message: 'Pool not found' }),
      );
      await expect(controller.getDataroom('nonexistent', mockUser as any)).rejects.toThrow(NotFoundException);
    });

    it('addMember propagates FORBIDDEN from service', async () => {
      const { ForbiddenException } = await import('@nestjs/common');
      dataroomsService.buildAddMember.mockRejectedValue(
        new ForbiddenException({ code: 'NOT_IN_ORG', message: 'Not in org' }),
      );
      await expect(
        controller.addMember(poolId, mockUser as any, {
          adminConfigId: 'cfg',
          address: memberAddress,
          role: 1,
          tags: [],
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('removeMember propagates NOT_FOUND from service', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      dataroomsService.buildRemoveMember.mockRejectedValue(
        new NotFoundException({ code: 'POOL_NOT_FOUND', message: 'Pool not found' }),
      );
      await expect(
        controller.removeMember('nonexistent', memberAddress, mockUser as any, { adminConfigId: 'cfg' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('updateMemberRole propagates FORBIDDEN from service', async () => {
      const { ForbiddenException } = await import('@nestjs/common');
      dataroomsService.buildUpdateMemberRole.mockRejectedValue(
        new ForbiddenException({ code: 'NOT_IN_ORG', message: 'Not in org' }),
      );
      await expect(
        controller.updateMemberRole(poolId, memberAddress, mockUser as any, { adminConfigId: 'cfg', newRole: 2 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('createFolder propagates service errors', async () => {
      dataroomsService.buildCreateFolder.mockRejectedValue(new Error('suiTx RPC error'));
      await expect(
        controller.createFolder(poolId, mockUser as any, { adminConfigId: 'cfg', name: 'X', visibleToRoles: 1 }),
      ).rejects.toThrow('suiTx RPC error');
    });
  });
});
