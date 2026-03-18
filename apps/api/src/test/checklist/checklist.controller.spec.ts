process.env.DATABASE_URL = 'postgresql://localhost/test';
process.env.REDIS_URL = 'redis://localhost';
process.env.JWT_PRIVATE_KEY = 'dGVzdA==';
process.env.JWT_PUBLIC_KEY = 'dGVzdA==';
process.env.CSRF_SECRET = 'test-csrf-secret-at-least-16-chars';
process.env.SUI_RPC_URL = 'https://rpc.testnet.sui.io';
process.env.SUI_PACKAGE_ID = '0x0';
process.env.PLATFORM_KEYPAIR = 'dGVzdA==';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { ChecklistController } from '../../modules/checklist/checklist.controller.js';
import type { ChecklistService } from '../../modules/checklist/checklist.service.js';

describe('ChecklistController', () => {
  let controller: ChecklistController;
  let checklistService: Record<string, any>;

  const poolId = 'pool-001';
  const itemId = 'item-001';
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

  const mockItem = {
    id: itemId,
    poolId,
    folder: 'Legal',
    itemName: 'Articles of Incorporation',
    isRequired: false,
    status: 'missing',
    linkedDocumentId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    checklistService = {
      getChecklist: vi.fn().mockResolvedValue([mockItem]),
      addItem: vi.fn().mockResolvedValue(mockItem),
      updateItem: vi.fn().mockResolvedValue(mockItem),
      deleteItem: vi.fn().mockResolvedValue({ rowCount: 1 }),
      listTemplates: vi.fn().mockResolvedValue([]),
    };

    controller = new ChecklistController(checklistService as unknown as ChecklistService);
  });

  // ─── GET pools/:poolId/checklist ─────────────────────────

  describe('GET pools/:poolId/checklist', () => {
    it('calls getChecklist with poolId and user.orgId', async () => {
      const result = await controller.get(poolId, mockUser as any);

      expect(checklistService.getChecklist).toHaveBeenCalledWith(poolId, mockUser.orgId);
      expect(result).toEqual([mockItem]);
    });

    it('passes null orgId when user has no org', async () => {
      const userNoOrg = { ...mockUser, orgId: null };
      await controller.get(poolId, userNoOrg as any);
      expect(checklistService.getChecklist).toHaveBeenCalledWith(poolId, null);
    });
  });

  // ─── POST pools/:poolId/checklist ────────────────────────

  describe('POST pools/:poolId/checklist', () => {
    it('calls addItem with poolId, user.orgId, and dto', async () => {
      const dto = { folder: 'Legal', itemName: 'Articles of Incorporation', isRequired: true };

      const result = await controller.add(poolId, mockUser as any, dto);

      expect(checklistService.addItem).toHaveBeenCalledWith(poolId, mockUser.orgId, dto);
      expect(result).toEqual(mockItem);
    });
  });

  // ─── PATCH pools/:poolId/checklist/:itemId ───────────────

  describe('PATCH pools/:poolId/checklist/:itemId', () => {
    it('calls updateItem with correct args', async () => {
      const dto = { isRequired: true };

      const result = await controller.update(poolId, itemId, mockUser as any, dto);

      expect(checklistService.updateItem).toHaveBeenCalledWith(poolId, itemId, mockUser.orgId, dto);
      expect(result).toEqual(mockItem);
    });
  });

  // ─── DELETE pools/:poolId/checklist/:itemId ──────────────

  describe('DELETE pools/:poolId/checklist/:itemId', () => {
    it('calls deleteItem with correct args', async () => {
      const result = await controller.remove(poolId, itemId, mockUser as any);

      expect(checklistService.deleteItem).toHaveBeenCalledWith(poolId, itemId, mockUser.orgId);
      expect(result).toEqual({ rowCount: 1 });
    });
  });

  // ─── GET /checklist-templates ────────────────────────────

  describe('GET /checklist-templates', () => {
    it('calls listTemplates and returns result', async () => {
      const templates = [{ id: 'tpl-1', name: 'Standard DD' }];
      checklistService.listTemplates.mockResolvedValue(templates);

      const result = await controller.templates();

      expect(checklistService.listTemplates).toHaveBeenCalled();
      expect(result).toEqual(templates);
    });
  });

  // ─── Monkey tests ────────────────────────────────────────

  describe('monkey tests', () => {
    it('get propagates NotFoundException from service', async () => {
      checklistService.getChecklist.mockRejectedValue(
        new NotFoundException({ code: 'POOL_NOT_FOUND', message: 'Pool not found' }),
      );
      await expect(controller.get(poolId, mockUser as any)).rejects.toThrow(NotFoundException);
    });

    it('get propagates ForbiddenException from service', async () => {
      checklistService.getChecklist.mockRejectedValue(
        new ForbiddenException({ code: 'NOT_IN_ORG', message: 'Not in org' }),
      );
      await expect(controller.get(poolId, mockUser as any)).rejects.toThrow(ForbiddenException);
    });

    it('add propagates NotFoundException from service', async () => {
      checklistService.addItem.mockRejectedValue(
        new NotFoundException({ code: 'POOL_NOT_FOUND', message: 'Pool not found' }),
      );
      await expect(
        controller.add(poolId, mockUser as any, { folder: 'X', itemName: 'Y', isRequired: false }),
      ).rejects.toThrow(NotFoundException);
    });

    it('update propagates NotFoundException when item not found', async () => {
      checklistService.updateItem.mockRejectedValue(
        new NotFoundException({ code: 'CHECKLIST_ITEM_NOT_FOUND', message: 'Item not found' }),
      );
      await expect(
        controller.update(poolId, 'nonexistent', mockUser as any, { isRequired: true }),
      ).rejects.toThrow(NotFoundException);
    });

    it('remove propagates ForbiddenException from service', async () => {
      checklistService.deleteItem.mockRejectedValue(
        new ForbiddenException({ code: 'NOT_IN_ORG', message: 'Not in org' }),
      );
      await expect(controller.remove(poolId, itemId, mockUser as any)).rejects.toThrow(ForbiddenException);
    });

    it('templates propagates service errors', async () => {
      checklistService.listTemplates.mockRejectedValue(new Error('DB error'));
      await expect(controller.templates()).rejects.toThrow('DB error');
    });
  });
});
