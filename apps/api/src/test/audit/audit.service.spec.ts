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
import { AuditService } from '../../modules/audit/audit.service.js';

describe('AuditService', () => {
  let service: AuditService;
  let poolsRepo: any;
  let auditRepo: any;

  const poolId = 'pool-001';
  const orgId = 'org-001';
  const userAddress = '0x' + 'a'.repeat(64);

  const mockPool = (overrides: any = {}) => ({
    id: poolId,
    orgId,
    suiObjectId: '0x' + 'b'.repeat(64),
    name: 'Test Pool',
    status: 'draft',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const mockEvent = (overrides: any = {}) => ({
    id: 'evt-001',
    poolId,
    eventType: 'PoolCreated',
    actorAddress: userAddress,
    targetId: null,
    timestamp: new Date('2024-01-01'),
    suiTxDigest: 'digest001',
    ...overrides,
  });

  beforeEach(() => {
    poolsRepo = { findById: vi.fn() };
    auditRepo = { findByPoolId: vi.fn(), findByActorAddress: vi.fn() };
    service = new AuditService(poolsRepo, auditRepo);
  });

  // ─── getPoolAudit ────────────────────────────────────────

  describe('getPoolAudit', () => {
    it('returns paginated events { data, page, limit }', async () => {
      const events = [mockEvent()];
      poolsRepo.findById.mockResolvedValue(mockPool());
      auditRepo.findByPoolId.mockResolvedValue(events);

      const result = await service.getPoolAudit(poolId, orgId, { page: 1, limit: 10 });

      expect(result.data).toEqual(events);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(auditRepo.findByPoolId).toHaveBeenCalledWith(poolId, { limit: 10, offset: 0 });
    });

    it('computes correct offset for page 3', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      auditRepo.findByPoolId.mockResolvedValue([]);

      await service.getPoolAudit(poolId, orgId, { page: 3, limit: 20 });

      expect(auditRepo.findByPoolId).toHaveBeenCalledWith(poolId, { limit: 20, offset: 40 });
    });

    it('throws NOT_FOUND if pool does not exist', async () => {
      poolsRepo.findById.mockResolvedValue(null);

      await expect(service.getPoolAudit(poolId, orgId, { page: 1, limit: 10 })).rejects.toThrow(
        NotFoundException,
      );
      try {
        await service.getPoolAudit(poolId, orgId, { page: 1, limit: 10 });
      } catch (err: any) {
        expect(err.getResponse()).toMatchObject({ code: 'POOL_NOT_FOUND' });
      }
    });

    it('throws FORBIDDEN if wrong org', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());

      await expect(service.getPoolAudit(poolId, 'other-org', { page: 1, limit: 10 })).rejects.toThrow(
        ForbiddenException,
      );
      try {
        await service.getPoolAudit(poolId, 'other-org', { page: 1, limit: 10 });
      } catch (err: any) {
        expect(err.getResponse()).toMatchObject({ code: 'NOT_IN_ORG' });
      }
    });

    it('throws FORBIDDEN if userOrgId is null', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());

      await expect(service.getPoolAudit(poolId, null, { page: 1, limit: 10 })).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ─── exportPoolAudit ─────────────────────────────────────

  describe('exportPoolAudit', () => {
    it('format=json returns array of events', async () => {
      const events = [mockEvent(), mockEvent({ id: 'evt-002' })];
      poolsRepo.findById.mockResolvedValue(mockPool());
      auditRepo.findByPoolId.mockResolvedValue(events);

      const result = await service.exportPoolAudit(poolId, orgId, 'json');

      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual(events);
      expect(auditRepo.findByPoolId).toHaveBeenCalledWith(poolId, { limit: 10000, offset: 0 });
    });

    it('format=csv returns CSV string with headers', async () => {
      const events = [mockEvent()];
      poolsRepo.findById.mockResolvedValue(mockPool());
      auditRepo.findByPoolId.mockResolvedValue(events);

      const result = await service.exportPoolAudit(poolId, orgId, 'csv');

      expect(typeof result).toBe('string');
      const lines = (result as string).split('\n');
      expect(lines[0]).toBe('id,poolId,eventType,actorAddress,targetId,timestamp,suiTxDigest');
      expect(lines.length).toBe(2); // header + 1 row
    });

    it('toCsv handles empty array → empty string', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      auditRepo.findByPoolId.mockResolvedValue([]);

      const result = await service.exportPoolAudit(poolId, orgId, 'csv');

      expect(result).toBe('');
    });

    it('toCsv escapes commas in values', async () => {
      const events = [mockEvent({ eventType: 'hello,world' })];
      poolsRepo.findById.mockResolvedValue(mockPool());
      auditRepo.findByPoolId.mockResolvedValue(events);

      const result = await service.exportPoolAudit(poolId, orgId, 'csv') as string;
      const dataRow = result.split('\n')[1];

      expect(dataRow).toContain('"hello,world"');
    });

    it('toCsv escapes double quotes in values', async () => {
      const events = [mockEvent({ eventType: 'say "hello"' })];
      poolsRepo.findById.mockResolvedValue(mockPool());
      auditRepo.findByPoolId.mockResolvedValue(events);

      const result = await service.exportPoolAudit(poolId, orgId, 'csv') as string;
      const dataRow = result.split('\n')[1];

      expect(dataRow).toContain('"say ""hello"""');
    });

    it('throws NOT_FOUND if pool does not exist', async () => {
      poolsRepo.findById.mockResolvedValue(null);

      await expect(service.exportPoolAudit(poolId, orgId, 'json')).rejects.toThrow(NotFoundException);
    });

    it('throws FORBIDDEN if wrong org', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());

      await expect(service.exportPoolAudit(poolId, 'wrong-org', 'csv')).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── getMyActivity ───────────────────────────────────────

  describe('getMyActivity', () => {
    it('returns paginated events by actor address', async () => {
      const events = [mockEvent()];
      auditRepo.findByActorAddress.mockResolvedValue(events);

      const result = await service.getMyActivity(userAddress, { page: 1, limit: 20 });

      expect(result.data).toEqual(events);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(auditRepo.findByActorAddress).toHaveBeenCalledWith(userAddress, { limit: 20, offset: 0 });
    });

    it('computes correct offset for page 2', async () => {
      auditRepo.findByActorAddress.mockResolvedValue([]);

      await service.getMyActivity(userAddress, { page: 2, limit: 25 });

      expect(auditRepo.findByActorAddress).toHaveBeenCalledWith(userAddress, { limit: 25, offset: 25 });
    });
  });

  // ─── Monkey / Edge-case tests ────────────────────────────

  describe('monkey tests', () => {
    it('getPoolAudit page=1000 computes correct offset', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      auditRepo.findByPoolId.mockResolvedValue([]);

      await service.getPoolAudit(poolId, orgId, { page: 1000, limit: 50 });

      expect(auditRepo.findByPoolId).toHaveBeenCalledWith(poolId, { limit: 50, offset: 49950 });
    });

    it('exportPoolAudit csv with multiple rows all included', async () => {
      const events = Array.from({ length: 5 }, (_, i) => mockEvent({ id: `evt-${i}` }));
      poolsRepo.findById.mockResolvedValue(mockPool());
      auditRepo.findByPoolId.mockResolvedValue(events);

      const result = await service.exportPoolAudit(poolId, orgId, 'csv') as string;
      const lines = result.split('\n');

      expect(lines.length).toBe(6); // header + 5 rows
    });

    it('getMyActivity with null/undefined values in events produces empty string fields in csv', async () => {
      const events = [mockEvent({ targetId: null })];
      poolsRepo.findById.mockResolvedValue(mockPool());
      auditRepo.findByPoolId.mockResolvedValue(events);

      const result = await service.exportPoolAudit(poolId, orgId, 'csv') as string;
      const dataRow = result.split('\n')[1];

      // targetId is null → empty field
      const fields = dataRow.split(',');
      const targetIdIndex = 4; // headers: id,poolId,eventType,actorAddress,targetId,...
      expect(fields[targetIdIndex]).toBe('');
    });

    it('getPoolAudit — pool orgId null never matches user orgId', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool({ orgId: null }));

      await expect(service.getPoolAudit(poolId, orgId, { page: 1, limit: 10 })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('getMyActivity large page computes correct offset', async () => {
      auditRepo.findByActorAddress.mockResolvedValue([]);

      await service.getMyActivity(userAddress, { page: 500, limit: 100 });

      expect(auditRepo.findByActorAddress).toHaveBeenCalledWith(userAddress, { limit: 100, offset: 49900 });
    });
  });
});
