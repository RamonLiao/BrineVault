process.env.DATABASE_URL = 'postgresql://localhost/test';
process.env.REDIS_URL = 'redis://localhost';
process.env.JWT_PRIVATE_KEY = 'dGVzdA==';
process.env.JWT_PUBLIC_KEY = 'dGVzdA==';
process.env.CSRF_SECRET = 'test-csrf-secret-at-least-16-chars';
process.env.SUI_RPC_URL = 'https://rpc.testnet.sui.io';
process.env.SUI_PACKAGE_ID = '0x0';
process.env.PLATFORM_KEYPAIR = 'dGVzdA==';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { OrgsService } from '../../modules/orgs/orgs.service.js';

describe('OrgsService', () => {
  let service: OrgsService;
  let orgsRepo: any;
  let usersRepo: any;
  let inviteCodesRepo: any;
  let db: any;

  const userId = 'user-001';
  const orgId = 'org-001';

  const mockUser = (overrides: any = {}) => ({
    id: userId,
    primaryWalletAddress: '0x' + 'a'.repeat(64),
    orgId: null,
    roleInOrg: 1,
    ...overrides,
  });

  const mockOrg = (overrides: any = {}) => ({
    id: orgId,
    name: 'Maple Corp',
    legalName: 'Maple Corp Inc.',
    billingPlan: 'free_trial',
    createdByUserId: userId,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    orgsRepo = {
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    };
    usersRepo = {
      findById: vi.fn(),
      update: vi.fn(),
    };
    inviteCodesRepo = {
      findByCode: vi.fn(),
      findByOrgId: vi.fn(),
      create: vi.fn(),
      incrementUses: vi.fn(),
    };
    db = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockResolvedValue([]),
    };

    service = new OrgsService(orgsRepo, usersRepo, inviteCodesRepo, db);
  });

  // ─── createOrg ──────────────────────────────────────────

  describe('createOrg', () => {
    it('happy path: creates org and promotes user to ORG_ADMIN', async () => {
      usersRepo.findById.mockResolvedValue(mockUser());
      const org = mockOrg();
      orgsRepo.create.mockResolvedValue(org);
      usersRepo.update.mockResolvedValue([mockUser({ orgId: org.id, roleInOrg: 32 })]);

      const result = await service.createOrg(userId, { name: 'Maple Corp', legalName: 'Maple Corp Inc.' });

      expect(result.id).toBe(orgId);
      expect(orgsRepo.create).toHaveBeenCalledWith({
        name: 'Maple Corp',
        legalName: 'Maple Corp Inc.',
        createdByUserId: userId,
      });
      expect(usersRepo.update).toHaveBeenCalledWith(userId, { orgId: orgId, roleInOrg: 32 });
    });

    it('throws 409 when user already in org', async () => {
      usersRepo.findById.mockResolvedValue(mockUser({ orgId: 'existing-org' }));

      await expect(service.createOrg(userId, { name: 'Test' })).rejects.toThrow(ConflictException);
      try {
        await service.createOrg(userId, { name: 'Test' });
      } catch (err: any) {
        expect(err.getResponse()).toMatchObject({ code: 'ALREADY_IN_ORG' });
      }
    });

    it('throws 404 when user not found', async () => {
      usersRepo.findById.mockResolvedValue(null);
      await expect(service.createOrg(userId, { name: 'Test' })).rejects.toThrow(NotFoundException);
    });

    it('creates org without legalName', async () => {
      usersRepo.findById.mockResolvedValue(mockUser());
      orgsRepo.create.mockResolvedValue(mockOrg({ legalName: null }));
      usersRepo.update.mockResolvedValue([]);

      const result = await service.createOrg(userId, { name: 'NoLegal' });
      expect(orgsRepo.create).toHaveBeenCalledWith({
        name: 'NoLegal',
        legalName: null,
        createdByUserId: userId,
      });
      expect(result).toBeTruthy();
    });
  });

  // ─── getOrg ─────────────────────────────────────────────

  describe('getOrg', () => {
    it('returns org when user is member', async () => {
      orgsRepo.findById.mockResolvedValue(mockOrg());
      const result = await service.getOrg(orgId, orgId);
      expect(result.id).toBe(orgId);
    });

    it('throws 403 when user not in org', async () => {
      await expect(service.getOrg(orgId, 'other-org')).rejects.toThrow(ForbiddenException);
      try {
        await service.getOrg(orgId, 'other-org');
      } catch (err: any) {
        expect(err.getResponse()).toMatchObject({ code: 'NOT_IN_ORG' });
      }
    });

    it('throws 403 when userOrgId is null', async () => {
      await expect(service.getOrg(orgId, null)).rejects.toThrow(ForbiddenException);
    });

    it('throws 404 when org not found', async () => {
      orgsRepo.findById.mockResolvedValue(null);
      await expect(service.getOrg(orgId, orgId)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── updateOrg ──────────────────────────────────────────

  describe('updateOrg', () => {
    it('updates when user is ORG_ADMIN', async () => {
      orgsRepo.update.mockResolvedValue([mockOrg({ name: 'New Name' })]);

      const result = await service.updateOrg(orgId, orgId, 32, { name: 'New Name' });
      expect(result?.name).toBe('New Name');
      expect(orgsRepo.update).toHaveBeenCalledWith(orgId, { name: 'New Name' });
    });

    it('throws 403 when not in org', async () => {
      await expect(service.updateOrg(orgId, 'other', 32, { name: 'X' })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws 403 when non-admin (VIEWER=1)', async () => {
      try {
        await service.updateOrg(orgId, orgId, 1, { name: 'X' });
      } catch (err: any) {
        expect(err).toBeInstanceOf(ForbiddenException);
        expect(err.getResponse()).toMatchObject({ code: 'INSUFFICIENT_ROLE' });
      }
    });

    it('allows user with combined roles including ORG_ADMIN (33 = VIEWER | ORG_ADMIN)', async () => {
      orgsRepo.update.mockResolvedValue([mockOrg({ name: 'Updated' })]);
      const result = await service.updateOrg(orgId, orgId, 33, { name: 'Updated' });
      expect(result?.name).toBe('Updated');
    });
  });

  // ─── generateInvite ─────────────────────────────────────

  describe('generateInvite', () => {
    it('generates invite code in correct format', async () => {
      orgsRepo.findById.mockResolvedValue(mockOrg());
      inviteCodesRepo.create.mockResolvedValue({});

      const result = await service.generateInvite(orgId, userId, orgId, 32, {
        role: 1,
        maxUses: 5,
        expiresInHours: 72,
      });

      expect(result.inviteCode).toMatch(/^[A-Z0-9]{5}-[A-F0-9]{4}-[A-F0-9]{4}$/);
      expect(result.inviteCode.startsWith('MAPLE')).toBe(true);
      expect(result.maxUses).toBe(5);
      expect(result.usedCount).toBe(0);
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('throws 403 when not admin', async () => {
      await expect(
        service.generateInvite(orgId, userId, orgId, 1, { role: 1, maxUses: 5, expiresInHours: 72 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws 403 when not in org', async () => {
      await expect(
        service.generateInvite(orgId, userId, 'other', 32, { role: 1, maxUses: 5, expiresInHours: 72 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws 404 when org not found', async () => {
      orgsRepo.findById.mockResolvedValue(null);
      await expect(
        service.generateInvite(orgId, userId, orgId, 32, { role: 1, maxUses: 5, expiresInHours: 72 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── joinOrg ────────────────────────────────────────────

  describe('joinOrg', () => {
    const futureDate = new Date(Date.now() + 3600000);
    const mockInvite = {
      id: 'inv-001',
      orgId,
      code: 'MAPLE-A3X9-K2M7',
      maxUses: 5,
      currentUses: 0,
      expiresAt: futureDate,
    };

    it('happy path: joins org and increments uses', async () => {
      usersRepo.findById.mockResolvedValue(mockUser());
      inviteCodesRepo.findByCode.mockResolvedValue(mockInvite);
      usersRepo.update.mockResolvedValue([]);
      inviteCodesRepo.incrementUses.mockResolvedValue([]);
      orgsRepo.findById.mockResolvedValue(mockOrg());

      const result = await service.joinOrg(userId, { inviteCode: 'MAPLE-A3X9-K2M7' });

      expect(result.orgId).toBe(orgId);
      expect(result.orgName).toBe('Maple Corp');
      expect(result.role).toBe(1);
      expect(result.joinedAt).toBeTruthy();
      expect(usersRepo.update).toHaveBeenCalledWith(userId, { orgId, roleInOrg: 1 });
      expect(inviteCodesRepo.incrementUses).toHaveBeenCalledWith('inv-001');
    });

    it('throws 409 when user already in org', async () => {
      usersRepo.findById.mockResolvedValue(mockUser({ orgId: 'existing-org' }));

      await expect(service.joinOrg(userId, { inviteCode: 'MAPLE-A3X9-K2M7' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws 404 when invite code not found', async () => {
      usersRepo.findById.mockResolvedValue(mockUser());
      inviteCodesRepo.findByCode.mockResolvedValue(null);

      try {
        await service.joinOrg(userId, { inviteCode: 'NONEXIST-CODE' });
      } catch (err: any) {
        expect(err).toBeInstanceOf(NotFoundException);
        expect(err.getResponse()).toMatchObject({ code: 'INVALID_INVITE_CODE' });
      }
    });

    it('throws 404 when invite code expired', async () => {
      usersRepo.findById.mockResolvedValue(mockUser());
      inviteCodesRepo.findByCode.mockResolvedValue({
        ...mockInvite,
        expiresAt: new Date(Date.now() - 1000),
      });

      try {
        await service.joinOrg(userId, { inviteCode: 'MAPLE-A3X9-K2M7' });
      } catch (err: any) {
        expect(err).toBeInstanceOf(NotFoundException);
        expect(err.getResponse()).toMatchObject({ code: 'INVITE_CODE_EXPIRED' });
      }
    });

    it('throws 404 when invite code exhausted', async () => {
      usersRepo.findById.mockResolvedValue(mockUser());
      inviteCodesRepo.findByCode.mockResolvedValue({
        ...mockInvite,
        currentUses: 5,
        maxUses: 5,
      });

      try {
        await service.joinOrg(userId, { inviteCode: 'MAPLE-A3X9-K2M7' });
      } catch (err: any) {
        expect(err).toBeInstanceOf(NotFoundException);
        expect(err.getResponse()).toMatchObject({ code: 'INVITE_CODE_EXPIRED' });
      }
    });

    it('throws 404 when user not found', async () => {
      usersRepo.findById.mockResolvedValue(null);
      await expect(service.joinOrg(userId, { inviteCode: 'ABC' })).rejects.toThrow(NotFoundException);
    });
  });

  // ─── listMembers ────────────────────────────────────────

  describe('listMembers', () => {
    it('returns members when user is in org', async () => {
      const result = await service.listMembers(orgId, orgId, { page: 1, limit: 20 });
      expect(result.data).toEqual([]);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('throws 403 when user not in org', async () => {
      await expect(service.listMembers(orgId, 'other', { page: 1, limit: 20 })).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ─── buildInviteCode ────────────────────────────────────

  describe('buildInviteCode', () => {
    it('generates correct format', () => {
      const code = service.buildInviteCode('Maple Corp');
      expect(code).toMatch(/^MAPLE-[A-F0-9]{4}-[A-F0-9]{4}$/);
    });

    it('pads short names', () => {
      const code = service.buildInviteCode('AB');
      expect(code).toMatch(/^ABXXX-[A-F0-9]{4}-[A-F0-9]{4}$/);
    });

    it('truncates long names', () => {
      const code = service.buildInviteCode('VeryLongOrganizationName');
      expect(code).toMatch(/^VERYL-[A-F0-9]{4}-[A-F0-9]{4}$/);
    });

    it('strips non-alphanumeric chars', () => {
      const code = service.buildInviteCode('A-B!C@D#');
      expect(code).toMatch(/^ABCDX-[A-F0-9]{4}-[A-F0-9]{4}$/);
    });

    it('handles empty name', () => {
      const code = service.buildInviteCode('');
      expect(code).toMatch(/^XXXXX-[A-F0-9]{4}-[A-F0-9]{4}$/);
    });
  });

  // ─── Monkey / Edge-case tests ───────────────────────────

  describe('monkey tests', () => {
    it('concurrent invite use — second join fails when uses exhausted', async () => {
      const invite = {
        id: 'inv-race',
        orgId,
        code: 'RACE1-AAAA-BBBB',
        maxUses: 1,
        currentUses: 0,
        expiresAt: new Date(Date.now() + 3600000),
      };
      const invite2 = { ...invite, currentUses: 1 };

      // First join succeeds
      usersRepo.findById.mockResolvedValueOnce(mockUser({ id: 'u1' }));
      inviteCodesRepo.findByCode.mockResolvedValueOnce(invite);
      usersRepo.update.mockResolvedValueOnce([]);
      inviteCodesRepo.incrementUses.mockResolvedValueOnce([]);
      orgsRepo.findById.mockResolvedValueOnce(mockOrg());

      const r1 = await service.joinOrg('u1', { inviteCode: 'RACE1-AAAA-BBBB' });
      expect(r1.orgId).toBe(orgId);

      // Second join should fail — uses exhausted
      usersRepo.findById.mockResolvedValueOnce(mockUser({ id: 'u2' }));
      inviteCodesRepo.findByCode.mockResolvedValueOnce(invite2);

      try {
        await service.joinOrg('u2', { inviteCode: 'RACE1-AAAA-BBBB' });
        expect.unreachable('should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(NotFoundException);
        expect(err.getResponse()).toMatchObject({ code: 'INVITE_CODE_EXPIRED' });
      }
    });

    it('join with just-expired code (1ms ago)', async () => {
      usersRepo.findById.mockResolvedValue(mockUser());
      inviteCodesRepo.findByCode.mockResolvedValue({
        id: 'inv-edge',
        orgId,
        code: 'EDGE0-1111-2222',
        maxUses: 10,
        currentUses: 0,
        expiresAt: new Date(Date.now() - 1),
      });

      await expect(service.joinOrg(userId, { inviteCode: 'EDGE0-1111-2222' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('very long org name in invite prefix — only first 5 chars used', () => {
      const longName = 'A'.repeat(1000);
      const code = service.buildInviteCode(longName);
      expect(code).toMatch(/^AAAAA-[A-F0-9]{4}-[A-F0-9]{4}$/);
    });

    it('org name with only special chars', () => {
      const code = service.buildInviteCode('!@#$%');
      expect(code).toMatch(/^XXXXX-[A-F0-9]{4}-[A-F0-9]{4}$/);
    });

    it('unicode org name is stripped', () => {
      const code = service.buildInviteCode('日本語テスト');
      expect(code).toMatch(/^XXXXX-[A-F0-9]{4}-[A-F0-9]{4}$/);
    });

    it('createOrg then immediately get — user needs correct orgId', async () => {
      usersRepo.findById.mockResolvedValue(mockUser());
      const org = mockOrg();
      orgsRepo.create.mockResolvedValue(org);
      usersRepo.update.mockResolvedValue([]);

      await service.createOrg(userId, { name: 'Test' });

      // Now getOrg with old user orgId (null) should fail
      await expect(service.getOrg(orgId, null)).rejects.toThrow(ForbiddenException);
    });

    it('updateOrg with empty dto', async () => {
      orgsRepo.update.mockResolvedValue([mockOrg()]);
      const result = await service.updateOrg(orgId, orgId, 32, {});
      expect(result).toBeTruthy();
    });
  });
});
