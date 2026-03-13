process.env.DATABASE_URL = 'postgresql://localhost/test';
process.env.REDIS_URL = 'redis://localhost';
process.env.JWT_PRIVATE_KEY = 'dGVzdA==';
process.env.JWT_PUBLIC_KEY = 'dGVzdA==';
process.env.CSRF_SECRET = 'test-csrf-secret-at-least-16-chars';
process.env.SUI_RPC_URL = 'https://rpc.testnet.sui.io';
process.env.SUI_PACKAGE_ID = '0x0';
process.env.PLATFORM_KEYPAIR = 'dGVzdA==';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrgsController } from '../../modules/orgs/orgs.controller.js';
import type { OrgsService } from '../../modules/orgs/orgs.service.js';

describe('OrgsController', () => {
  let controller: OrgsController;
  let orgsService: Record<string, any>;

  const orgId = 'org-001';
  const mockUser = {
    sub: 'user-001',
    address: '0x' + 'a'.repeat(64),
    orgId: orgId,
    orgRole: 32,
    sid: 'sid-1',
    jti: 'jti-1',
    iat: 1700000000,
    exp: 1700001000,
  };

  const mockOrg = {
    id: orgId,
    name: 'Maple Corp',
    legalName: 'Maple Corp Inc.',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    orgsService = {
      createOrg: vi.fn().mockResolvedValue(mockOrg),
      getOrg: vi.fn().mockResolvedValue(mockOrg),
      updateOrg: vi.fn().mockResolvedValue(mockOrg),
      generateInvite: vi.fn().mockResolvedValue({
        inviteCode: 'MAPLE-A3X9-K2M7',
        expiresAt: new Date(),
        maxUses: 5,
        usedCount: 0,
        role: 1,
      }),
      joinOrg: vi.fn().mockResolvedValue({
        orgId,
        orgName: 'Maple Corp',
        role: 1,
        joinedAt: new Date().toISOString(),
      }),
      listMembers: vi.fn().mockResolvedValue({
        data: [],
        page: 1,
        limit: 20,
      }),
    };

    controller = new OrgsController(orgsService as unknown as OrgsService);
  });

  // ─── POST /orgs ─────────────────────────────────────────

  describe('POST /orgs', () => {
    it('calls createOrg and returns org', async () => {
      const result = await controller.create(mockUser as any, { name: 'Maple Corp' });
      expect(result.id).toBe(orgId);
      expect(orgsService.createOrg).toHaveBeenCalledWith('user-001', { name: 'Maple Corp' });
    });
  });

  // ─── GET /orgs/:orgId ───────────────────────────────────

  describe('GET /orgs/:orgId', () => {
    it('returns org', async () => {
      const result = await controller.findOne(orgId, mockUser as any);
      expect(result.id).toBe(orgId);
      expect(orgsService.getOrg).toHaveBeenCalledWith(orgId, orgId);
    });
  });

  // ─── PATCH /orgs/:orgId ─────────────────────────────────

  describe('PATCH /orgs/:orgId', () => {
    it('calls updateOrg', async () => {
      const result = await controller.update(orgId, mockUser as any, { name: 'New Name' });
      expect(result.id).toBe(orgId);
      expect(orgsService.updateOrg).toHaveBeenCalledWith(orgId, orgId, 32, { name: 'New Name' });
    });
  });

  // ─── POST /orgs/:orgId/invite ───────────────────────────

  describe('POST /orgs/:orgId/invite', () => {
    it('returns invite code', async () => {
      const dto = { role: 1, maxUses: 5, expiresInHours: 72 };
      const result = await controller.invite(orgId, mockUser as any, dto);

      expect(result.inviteCode).toBe('MAPLE-A3X9-K2M7');
      expect(orgsService.generateInvite).toHaveBeenCalledWith(orgId, 'user-001', orgId, 32, dto);
    });
  });

  // ─── POST /orgs/join ────────────────────────────────────

  describe('POST /orgs/join', () => {
    it('returns join result', async () => {
      const userWithoutOrg = { ...mockUser, orgId: null, orgRole: 0 };
      const result = await controller.join(userWithoutOrg as any, { inviteCode: 'MAPLE-A3X9-K2M7' });

      expect(result.orgId).toBe(orgId);
      expect(result.orgName).toBe('Maple Corp');
      expect(orgsService.joinOrg).toHaveBeenCalledWith('user-001', { inviteCode: 'MAPLE-A3X9-K2M7' });
    });
  });

  // ─── GET /orgs/:orgId/members ───────────────────────────

  describe('GET /orgs/:orgId/members', () => {
    it('returns paginated members', async () => {
      const result = await controller.listMembers(orgId, mockUser as any, { page: 1, limit: 20 });
      expect(result.data).toEqual([]);
      expect(orgsService.listMembers).toHaveBeenCalledWith(orgId, orgId, { page: 1, limit: 20 });
    });
  });
});
