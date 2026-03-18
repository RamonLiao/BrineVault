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
import { DataroomsService } from '../../modules/datarooms/datarooms.service.js';

describe('DataroomsService', () => {
  let service: DataroomsService;
  let poolsRepo: any;
  let dataroomsRepo: any;
  let membersRepo: any;
  let suiTx: any;

  const poolId = 'pool-001';
  const orgId = 'org-001';
  const userAddress = '0x' + 'a'.repeat(64);
  const memberAddress = '0x' + 'd'.repeat(64);

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
    ownerAddress: userAddress,
    memberCount: 1,
    createdAt: new Date(),
    ...overrides,
  });

  const mockMember = (overrides: any = {}) => ({
    id: 'mem-001',
    dataroomId: 'dr-001',
    poolId,
    memberAddress: userAddress,
    role: 1,
    addedByAddress: userAddress,
    addedAt: new Date(),
    isActive: true,
    revokedAt: null,
    ...overrides,
  });

  beforeEach(() => {
    poolsRepo = {
      findById: vi.fn(),
    };
    dataroomsRepo = {
      findByPoolId: vi.fn(),
    };
    membersRepo = {
      findByDataroomAndAddress: vi.fn(),
      findActiveByPoolId: vi.fn(),
    };
    suiTx = {
      buildAddMemberTx: vi.fn().mockResolvedValue({ txBytes: 'base64txbytes' }),
      buildRemoveMemberTx: vi.fn().mockResolvedValue({ txBytes: 'base64txbytes' }),
      buildUpdateMemberRoleTx: vi.fn().mockResolvedValue({ txBytes: 'base64txbytes' }),
      buildCreateFolderTx: vi.fn().mockResolvedValue({ txBytes: 'base64txbytes' }),
    };

    service = new DataroomsService(poolsRepo, dataroomsRepo, membersRepo, suiTx);
  });

  // ─── getDataroom ──────────────────────────────────────────────

  describe('getDataroom', () => {
    it('returns dataroom with members when user in org', async () => {
      const pool = mockPool();
      const dataroom = mockDataroom();
      const members = [mockMember()];

      poolsRepo.findById.mockResolvedValue(pool);
      dataroomsRepo.findByPoolId.mockResolvedValue(dataroom);
      membersRepo.findActiveByPoolId.mockResolvedValue(members);

      const result = await service.getDataroom(poolId, userAddress, orgId);

      expect(result.dataroom).toEqual(dataroom);
      expect(result.members).toEqual(members);
      expect(poolsRepo.findById).toHaveBeenCalledWith(poolId);
      expect(dataroomsRepo.findByPoolId).toHaveBeenCalledWith(poolId);
      expect(membersRepo.findActiveByPoolId).toHaveBeenCalledWith(poolId);
    });

    it('throws NOT_FOUND if pool missing', async () => {
      poolsRepo.findById.mockResolvedValue(null);

      await expect(service.getDataroom(poolId, userAddress, orgId)).rejects.toThrow(NotFoundException);
      try {
        await service.getDataroom(poolId, userAddress, orgId);
      } catch (err: any) {
        expect(err.getResponse()).toMatchObject({ code: 'POOL_NOT_FOUND' });
      }
    });

    it('throws FORBIDDEN if user not in org', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool({ orgId: 'other-org' }));

      await expect(service.getDataroom(poolId, userAddress, orgId)).rejects.toThrow(ForbiddenException);
      try {
        await service.getDataroom(poolId, userAddress, orgId);
      } catch (err: any) {
        expect(err.getResponse()).toMatchObject({ code: 'NOT_IN_ORG' });
      }
    });

    it('throws NOT_FOUND if no dataroom for pool', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      dataroomsRepo.findByPoolId.mockResolvedValue(null);

      await expect(service.getDataroom(poolId, userAddress, orgId)).rejects.toThrow(NotFoundException);
      try {
        await service.getDataroom(poolId, userAddress, orgId);
      } catch (err: any) {
        expect(err.getResponse()).toMatchObject({ code: 'DATAROOM_NOT_FOUND' });
      }
    });
  });

  // ─── buildAddMember ───────────────────────────────────────────

  describe('buildAddMember', () => {
    const addMemberDto = {
      adminConfigId: 'admin-cfg-001',
      address: memberAddress,
      role: 2,
      tags: ['investor'],
    };

    it('delegates to suiTx.buildAddMemberTx with correct params', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());

      const result = await service.buildAddMember(poolId, userAddress, orgId, addMemberDto);

      expect(suiTx.buildAddMemberTx).toHaveBeenCalledWith({
        senderAddress: userAddress,
        adminConfigId: addMemberDto.adminConfigId,
        poolObjectId: mockPool().suiObjectId,
        memberAddress: addMemberDto.address,
        role: addMemberDto.role,
        tags: addMemberDto.tags,
      });
      expect(result).toEqual({ txBytes: 'base64txbytes' });
    });

    it('throws NOT_FOUND if pool missing', async () => {
      poolsRepo.findById.mockResolvedValue(null);

      await expect(service.buildAddMember(poolId, userAddress, orgId, addMemberDto)).rejects.toThrow(
        NotFoundException,
      );
      try {
        await service.buildAddMember(poolId, userAddress, orgId, addMemberDto);
      } catch (err: any) {
        expect(err.getResponse()).toMatchObject({ code: 'POOL_NOT_FOUND' });
      }
    });

    it('throws FORBIDDEN if user not in org', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool({ orgId: 'other-org' }));

      await expect(service.buildAddMember(poolId, userAddress, orgId, addMemberDto)).rejects.toThrow(
        ForbiddenException,
      );
      try {
        await service.buildAddMember(poolId, userAddress, orgId, addMemberDto);
      } catch (err: any) {
        expect(err.getResponse()).toMatchObject({ code: 'NOT_IN_ORG' });
      }
    });
  });

  // ─── buildRemoveMember ────────────────────────────────────────

  describe('buildRemoveMember', () => {
    const removeMemberDto = { adminConfigId: 'admin-cfg-001' };

    it('delegates to suiTx.buildRemoveMemberTx with correct params', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());

      const result = await service.buildRemoveMember(poolId, memberAddress, userAddress, orgId, removeMemberDto);

      expect(suiTx.buildRemoveMemberTx).toHaveBeenCalledWith({
        senderAddress: userAddress,
        adminConfigId: removeMemberDto.adminConfigId,
        poolObjectId: mockPool().suiObjectId,
        memberAddress,
      });
      expect(result).toEqual({ txBytes: 'base64txbytes' });
    });

    it('throws NOT_FOUND if pool missing', async () => {
      poolsRepo.findById.mockResolvedValue(null);

      await expect(
        service.buildRemoveMember(poolId, memberAddress, userAddress, orgId, removeMemberDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws FORBIDDEN if user not in org', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool({ orgId: 'other-org' }));

      await expect(
        service.buildRemoveMember(poolId, memberAddress, userAddress, orgId, removeMemberDto),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── buildUpdateMemberRole ────────────────────────────────────

  describe('buildUpdateMemberRole', () => {
    const updateRoleDto = { adminConfigId: 'admin-cfg-001', newRole: 4 };

    it('delegates to suiTx.buildUpdateMemberRoleTx with correct params', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());

      const result = await service.buildUpdateMemberRole(poolId, memberAddress, userAddress, orgId, updateRoleDto);

      expect(suiTx.buildUpdateMemberRoleTx).toHaveBeenCalledWith({
        senderAddress: userAddress,
        adminConfigId: updateRoleDto.adminConfigId,
        poolObjectId: mockPool().suiObjectId,
        memberAddress,
        newRole: updateRoleDto.newRole,
      });
      expect(result).toEqual({ txBytes: 'base64txbytes' });
    });

    it('throws NOT_FOUND if pool missing', async () => {
      poolsRepo.findById.mockResolvedValue(null);

      await expect(
        service.buildUpdateMemberRole(poolId, memberAddress, userAddress, orgId, updateRoleDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws FORBIDDEN if user not in org', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool({ orgId: 'other-org' }));

      await expect(
        service.buildUpdateMemberRole(poolId, memberAddress, userAddress, orgId, updateRoleDto),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── buildCreateFolder ────────────────────────────────────────

  describe('buildCreateFolder', () => {
    const createFolderDto = {
      adminConfigId: 'admin-cfg-001',
      name: 'Due Diligence',
      visibleToRoles: 3,
    };

    it('delegates to suiTx.buildCreateFolderTx with correct params', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());

      const result = await service.buildCreateFolder(poolId, userAddress, orgId, createFolderDto);

      expect(suiTx.buildCreateFolderTx).toHaveBeenCalledWith({
        senderAddress: userAddress,
        adminConfigId: createFolderDto.adminConfigId,
        poolObjectId: mockPool().suiObjectId,
        name: createFolderDto.name,
        parentId: undefined,
        visibleToRoles: createFolderDto.visibleToRoles,
      });
      expect(result).toEqual({ txBytes: 'base64txbytes' });
    });

    it('passes parentId when provided', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      const dtoWithParent = { ...createFolderDto, parentId: 5 };

      await service.buildCreateFolder(poolId, userAddress, orgId, dtoWithParent);

      expect(suiTx.buildCreateFolderTx).toHaveBeenCalledWith(
        expect.objectContaining({ parentId: 5 }),
      );
    });

    it('throws NOT_FOUND if pool missing', async () => {
      poolsRepo.findById.mockResolvedValue(null);

      await expect(service.buildCreateFolder(poolId, userAddress, orgId, createFolderDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws FORBIDDEN if user not in org', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool({ orgId: 'other-org' }));

      await expect(service.buildCreateFolder(poolId, userAddress, orgId, createFolderDto)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ─── Monkey / Edge-case tests ─────────────────────────────────

  describe('monkey tests', () => {
    it('getDataroom — null orgId never matches pool orgId', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());

      await expect(service.getDataroom(poolId, userAddress, null)).rejects.toThrow(ForbiddenException);
    });

    it('getDataroom — returns empty members array when no active members', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      dataroomsRepo.findByPoolId.mockResolvedValue(mockDataroom());
      membersRepo.findActiveByPoolId.mockResolvedValue([]);

      const result = await service.getDataroom(poolId, userAddress, orgId);
      expect(result.members).toEqual([]);
    });

    it('buildAddMember with empty tags array', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      const dto = { adminConfigId: 'cfg', address: memberAddress, role: 1, tags: [] };

      await service.buildAddMember(poolId, userAddress, orgId, dto);
      expect(suiTx.buildAddMemberTx).toHaveBeenCalledWith(expect.objectContaining({ tags: [] }));
    });

    it('buildAddMember with max 20 tags', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      const maxTags = Array.from({ length: 20 }, (_, i) => `tag${i}`);
      const dto = { adminConfigId: 'cfg', address: memberAddress, role: 1, tags: maxTags };

      await service.buildAddMember(poolId, userAddress, orgId, dto);
      expect(suiTx.buildAddMemberTx).toHaveBeenCalledWith(expect.objectContaining({ tags: maxTags }));
    });

    it('buildUpdateMemberRole with min role=1', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      const dto = { adminConfigId: 'cfg', newRole: 1 };

      await service.buildUpdateMemberRole(poolId, memberAddress, userAddress, orgId, dto);
      expect(suiTx.buildUpdateMemberRoleTx).toHaveBeenCalledWith(expect.objectContaining({ newRole: 1 }));
    });

    it('buildUpdateMemberRole with max role=63', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      const dto = { adminConfigId: 'cfg', newRole: 63 };

      await service.buildUpdateMemberRole(poolId, memberAddress, userAddress, orgId, dto);
      expect(suiTx.buildUpdateMemberRoleTx).toHaveBeenCalledWith(expect.objectContaining({ newRole: 63 }));
    });

    it('buildCreateFolder with parentId=0', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      const dto = { adminConfigId: 'cfg', name: 'Root', visibleToRoles: 1, parentId: 0 };

      await service.buildCreateFolder(poolId, userAddress, orgId, dto);
      expect(suiTx.buildCreateFolderTx).toHaveBeenCalledWith(expect.objectContaining({ parentId: 0 }));
    });

    it('suiTx errors propagate from buildAddMember', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      suiTx.buildAddMemberTx.mockRejectedValue(new Error('Network error'));

      const dto = { adminConfigId: 'cfg', address: memberAddress, role: 1, tags: [] };
      await expect(service.buildAddMember(poolId, userAddress, orgId, dto)).rejects.toThrow('Network error');
    });

    it('suiTx errors propagate from buildCreateFolder', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      suiTx.buildCreateFolderTx.mockRejectedValue(new Error('RPC timeout'));

      const dto = { adminConfigId: 'cfg', name: 'Folder', visibleToRoles: 1 };
      await expect(service.buildCreateFolder(poolId, userAddress, orgId, dto)).rejects.toThrow('RPC timeout');
    });
  });
});
