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
import { ChecklistService } from '../../modules/checklist/checklist.service.js';

describe('ChecklistService', () => {
  let service: ChecklistService;
  let poolsRepo: any;
  let checklistRepo: any;

  const poolId = 'pool-001';
  const itemId = 'item-001';
  const orgId = 'org-001';

  const mockPool = (overrides: any = {}) => ({
    id: poolId,
    orgId,
    suiObjectId: '0x' + 'b'.repeat(64),
    name: 'Test Pool',
    status: 'draft',
    ...overrides,
  });

  const mockItem = (overrides: any = {}) => ({
    id: itemId,
    poolId,
    folder: 'Legal',
    itemName: 'Articles of Incorporation',
    isRequired: false,
    status: 'missing',
    linkedDocumentId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    poolsRepo = {
      findById: vi.fn(),
    };
    checklistRepo = {
      findItemsByPoolId: vi.fn(),
      createItem: vi.fn(),
      updateItem: vi.fn(),
      deleteItem: vi.fn(),
      findAllTemplates: vi.fn(),
    };

    service = new ChecklistService(poolsRepo, checklistRepo);
  });

  // ─── getChecklist ────────────────────────────────────────

  describe('getChecklist', () => {
    it('returns items from repo', async () => {
      const items = [mockItem()];
      poolsRepo.findById.mockResolvedValue(mockPool());
      checklistRepo.findItemsByPoolId.mockResolvedValue(items);

      const result = await service.getChecklist(poolId, orgId);

      expect(result).toEqual(items);
      expect(checklistRepo.findItemsByPoolId).toHaveBeenCalledWith(poolId);
    });

    it('returns empty array when no items', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      checklistRepo.findItemsByPoolId.mockResolvedValue([]);

      const result = await service.getChecklist(poolId, orgId);
      expect(result).toHaveLength(0);
    });

    it('throws NotFoundException when pool not found', async () => {
      poolsRepo.findById.mockResolvedValue(null);

      await expect(service.getChecklist(poolId, orgId)).rejects.toThrow(NotFoundException);
      try {
        await service.getChecklist(poolId, orgId);
      } catch (err: any) {
        expect(err.getResponse()).toMatchObject({ code: 'POOL_NOT_FOUND' });
      }
    });

    it('throws ForbiddenException when wrong org', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());

      await expect(service.getChecklist(poolId, 'wrong-org')).rejects.toThrow(ForbiddenException);
      try {
        await service.getChecklist(poolId, 'wrong-org');
      } catch (err: any) {
        expect(err.getResponse()).toMatchObject({ code: 'NOT_IN_ORG' });
      }
    });

    it('throws ForbiddenException when userOrgId is null', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());

      await expect(service.getChecklist(poolId, null)).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── addItem ─────────────────────────────────────────────

  describe('addItem', () => {
    const dto = { folder: 'Legal', itemName: 'Articles of Incorporation', isRequired: true };

    it('creates item with correct poolId', async () => {
      const created = mockItem({ isRequired: true });
      poolsRepo.findById.mockResolvedValue(mockPool());
      checklistRepo.createItem.mockResolvedValue(created);

      const result = await service.addItem(poolId, orgId, dto);

      expect(checklistRepo.createItem).toHaveBeenCalledWith({ poolId, ...dto });
      expect(result).toEqual(created);
    });

    it('throws NotFoundException when pool not found', async () => {
      poolsRepo.findById.mockResolvedValue(null);
      await expect(service.addItem(poolId, orgId, dto)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when wrong org', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      await expect(service.addItem(poolId, 'other-org', dto)).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── updateItem ──────────────────────────────────────────

  describe('updateItem', () => {
    const dto = { isRequired: true };

    it('returns updated item', async () => {
      const updated = mockItem({ isRequired: true });
      poolsRepo.findById.mockResolvedValue(mockPool());
      checklistRepo.updateItem.mockResolvedValue([updated]);

      const result = await service.updateItem(poolId, itemId, orgId, dto);

      expect(checklistRepo.updateItem).toHaveBeenCalledWith(itemId, dto);
      expect(result).toEqual(updated);
    });

    it('throws NotFoundException when item not found (empty rows)', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      checklistRepo.updateItem.mockResolvedValue([]);

      await expect(service.updateItem(poolId, itemId, orgId, dto)).rejects.toThrow(NotFoundException);
      try {
        await service.updateItem(poolId, itemId, orgId, dto);
      } catch (err: any) {
        expect(err.getResponse()).toMatchObject({ code: 'CHECKLIST_ITEM_NOT_FOUND' });
      }
    });

    it('throws NotFoundException when pool not found', async () => {
      poolsRepo.findById.mockResolvedValue(null);
      await expect(service.updateItem(poolId, itemId, orgId, dto)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when wrong org', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      await expect(service.updateItem(poolId, itemId, 'bad-org', dto)).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── deleteItem ──────────────────────────────────────────

  describe('deleteItem', () => {
    it('delegates to repo and returns result', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      checklistRepo.deleteItem.mockResolvedValue({ rowCount: 1 });

      const result = await service.deleteItem(poolId, itemId, orgId);

      expect(checklistRepo.deleteItem).toHaveBeenCalledWith(itemId);
      expect(result).toEqual({ rowCount: 1 });
    });

    it('throws NotFoundException when pool not found', async () => {
      poolsRepo.findById.mockResolvedValue(null);
      await expect(service.deleteItem(poolId, itemId, orgId)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when wrong org', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      await expect(service.deleteItem(poolId, itemId, 'wrong-org')).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── listTemplates ───────────────────────────────────────

  describe('listTemplates', () => {
    it('returns templates from repo', async () => {
      const templates = [{ id: 'tpl-1', name: 'Standard DD', items: [] }];
      checklistRepo.findAllTemplates.mockResolvedValue(templates);

      const result = await service.listTemplates();

      expect(checklistRepo.findAllTemplates).toHaveBeenCalled();
      expect(result).toEqual(templates);
    });

    it('returns empty array when no templates', async () => {
      checklistRepo.findAllTemplates.mockResolvedValue([]);
      const result = await service.listTemplates();
      expect(result).toHaveLength(0);
    });
  });

  // ─── Monkey / Edge-case tests ───────────────────────────

  describe('monkey tests', () => {
    it('addItem — isRequired defaults have no effect on poolId injection', async () => {
      const dto = { folder: 'Finance', itemName: 'Balance Sheet', isRequired: false };
      poolsRepo.findById.mockResolvedValue(mockPool());
      checklistRepo.createItem.mockResolvedValue(mockItem());

      await service.addItem(poolId, orgId, dto);
      expect(checklistRepo.createItem).toHaveBeenCalledWith(expect.objectContaining({ poolId }));
    });

    it('updateItem — updates linkedDocumentId to null', async () => {
      const updated = mockItem({ linkedDocumentId: null });
      poolsRepo.findById.mockResolvedValue(mockPool());
      checklistRepo.updateItem.mockResolvedValue([updated]);

      const result = await service.updateItem(poolId, itemId, orgId, { linkedDocumentId: null });
      expect(result).toEqual(updated);
    });

    it('updateItem — updates all status variants', async () => {
      const statuses = ['missing', 'uploaded', 'reviewed', 'needs_revision'] as const;
      for (const status of statuses) {
        const updated = mockItem({ status });
        poolsRepo.findById.mockResolvedValue(mockPool());
        checklistRepo.updateItem.mockResolvedValue([updated]);

        const result = await service.updateItem(poolId, itemId, orgId, { status });
        expect(result.status).toBe(status);
      }
    });

    it('pool orgId null never matches userOrgId', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool({ orgId: null }));
      await expect(service.getChecklist(poolId, orgId)).rejects.toThrow(ForbiddenException);
    });

    it('user orgId null never matches pool orgId', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      await expect(service.getChecklist(poolId, null)).rejects.toThrow(ForbiddenException);
    });

    it('listTemplates propagates repo errors', async () => {
      checklistRepo.findAllTemplates.mockRejectedValue(new Error('DB error'));
      await expect(service.listTemplates()).rejects.toThrow('DB error');
    });

    it('deleteItem does not throw when item not found (repo returns empty)', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      checklistRepo.deleteItem.mockResolvedValue({ rowCount: 0 });

      // deleteItem does not check existence — no throw expected
      await expect(service.deleteItem(poolId, itemId, orgId)).resolves.toEqual({ rowCount: 0 });
    });
  });
});
