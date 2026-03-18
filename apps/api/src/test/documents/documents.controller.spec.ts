process.env.DATABASE_URL = 'postgresql://localhost/test';
process.env.REDIS_URL = 'redis://localhost';
process.env.JWT_PRIVATE_KEY = 'dGVzdA==';
process.env.JWT_PUBLIC_KEY = 'dGVzdA==';
process.env.CSRF_SECRET = 'test-csrf-secret-at-least-16-chars';
process.env.SUI_RPC_URL = 'https://rpc.testnet.sui.io';
process.env.SUI_PACKAGE_ID = '0x0';
process.env.PLATFORM_KEYPAIR = 'dGVzdA==';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocumentsController } from '../../modules/documents/documents.controller.js';
import type { DocumentsService } from '../../modules/documents/documents.service.js';

describe('DocumentsController', () => {
  let controller: DocumentsController;
  let documentsService: Record<string, any>;

  const poolId = 'pool-001';
  const docId = 'doc-001';
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
  const mockDoc = {
    id: docId,
    suiObjectId: '0x' + 'c'.repeat(64),
    poolId,
    title: 'Test Document',
    docType: 1,
    currentVersion: 1,
  };
  const mockPaginatedDocs = { data: [mockDoc], total: 1, page: 1, limit: 10 };
  const mockVersions = [{ id: 'ver-001', documentId: docId, version: 1 }];
  const mockVersion = { id: 'ver-001', documentId: docId, version: 1 };

  beforeEach(() => {
    documentsService = {
      listDocuments: vi.fn().mockResolvedValue(mockPaginatedDocs),
      getDocument: vi.fn().mockResolvedValue(mockDoc),
      getDocumentVersions: vi.fn().mockResolvedValue(mockVersions),
      getDocumentVersion: vi.fn().mockResolvedValue(mockVersion),
      buildCreateDocument: vi.fn().mockResolvedValue(mockTxResponse),
      buildAddVersion: vi.fn().mockResolvedValue(mockTxResponse),
      buildArchiveDocument: vi.fn().mockResolvedValue(mockTxResponse),
    };

    controller = new DocumentsController(documentsService as unknown as DocumentsService);
  });

  // ─── GET /pools/:poolId/documents ─────────────────────────────

  describe('GET /pools/:poolId/documents', () => {
    it('calls listDocuments with poolId, user.orgId, query', async () => {
      const query = { page: 1, limit: 10 };
      const result = await controller.list(poolId, mockUser as any, query);

      expect(documentsService.listDocuments).toHaveBeenCalledWith(poolId, mockUser.orgId, query);
      expect(result).toEqual(mockPaginatedDocs);
    });

    it('passes null orgId when user has no org', async () => {
      const userNoOrg = { ...mockUser, orgId: null };
      await controller.list(poolId, userNoOrg as any, { page: 1, limit: 10 });
      expect(documentsService.listDocuments).toHaveBeenCalledWith(poolId, null, { page: 1, limit: 10 });
    });
  });

  // ─── POST /pools/:poolId/documents ────────────────────────────

  describe('POST /pools/:poolId/documents', () => {
    it('calls buildCreateDocument with correct args', async () => {
      const dto = {
        adminConfigId: 'cfg-001',
        folderId: 0,
        docType: 1,
        title: 'Annual Report',
        requiredFlag: false,
        visibleToRoles: 3,
        walrusBlobId: 'blob-abc',
        contentHash: 'a'.repeat(64),
        sizeBytes: 2048,
        changeLog: '',
        tags: ['finance'],
      };

      const result = await controller.create(poolId, mockUser as any, dto);

      expect(documentsService.buildCreateDocument).toHaveBeenCalledWith(
        poolId,
        mockUser.address,
        mockUser.orgId,
        dto,
      );
      expect(result).toEqual(mockTxResponse);
    });
  });

  // ─── GET /pools/:poolId/documents/:docId ──────────────────────

  describe('GET /pools/:poolId/documents/:docId', () => {
    it('calls getDocument with correct args', async () => {
      const result = await controller.findOne(poolId, docId, mockUser as any);

      expect(documentsService.getDocument).toHaveBeenCalledWith(poolId, docId, mockUser.orgId);
      expect(result).toEqual(mockDoc);
    });
  });

  // ─── POST /pools/:poolId/documents/:docId/versions ────────────

  describe('POST /pools/:poolId/documents/:docId/versions', () => {
    it('calls buildAddVersion with correct args', async () => {
      const dto = {
        adminConfigId: 'cfg-001',
        walrusBlobId: 'blob-v2',
        contentHash: 'b'.repeat(64),
        sizeBytes: 3000,
        changeLog: 'Updated figures',
      };

      const result = await controller.addVersion(poolId, docId, mockUser as any, dto);

      expect(documentsService.buildAddVersion).toHaveBeenCalledWith(
        poolId,
        docId,
        mockUser.address,
        mockUser.orgId,
        dto,
      );
      expect(result).toEqual(mockTxResponse);
    });
  });

  // ─── DELETE /pools/:poolId/documents/:docId ───────────────────

  describe('DELETE /pools/:poolId/documents/:docId', () => {
    it('calls buildArchiveDocument with correct args', async () => {
      const dto = { adminConfigId: 'cfg-001' };

      const result = await controller.archive(poolId, docId, mockUser as any, dto);

      expect(documentsService.buildArchiveDocument).toHaveBeenCalledWith(
        poolId,
        docId,
        mockUser.address,
        mockUser.orgId,
        dto,
      );
      expect(result).toEqual(mockTxResponse);
    });
  });

  // ─── GET /pools/:poolId/documents/:docId/versions ─────────────

  describe('GET /pools/:poolId/documents/:docId/versions', () => {
    it('calls getDocumentVersions with correct args', async () => {
      const result = await controller.listVersions(poolId, docId, mockUser as any);

      expect(documentsService.getDocumentVersions).toHaveBeenCalledWith(poolId, docId, mockUser.orgId);
      expect(result).toEqual(mockVersions);
    });
  });

  // ─── GET /pools/:poolId/documents/:docId/versions/:version ────

  describe('GET /pools/:poolId/documents/:docId/versions/:version', () => {
    it('calls getDocumentVersion with parsed integer version', async () => {
      const result = await controller.getVersion(poolId, docId, '1', mockUser as any);

      expect(documentsService.getDocumentVersion).toHaveBeenCalledWith(poolId, docId, 1, mockUser.orgId);
      expect(result).toEqual(mockVersion);
    });

    it('correctly parses version string to integer', async () => {
      await controller.getVersion(poolId, docId, '42', mockUser as any);
      expect(documentsService.getDocumentVersion).toHaveBeenCalledWith(poolId, docId, 42, mockUser.orgId);
    });
  });

  // ─── Monkey tests ─────────────────────────────────────────────

  describe('monkey tests', () => {
    it('list propagates NOT_FOUND from service', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      documentsService.listDocuments.mockRejectedValue(
        new NotFoundException({ code: 'POOL_NOT_FOUND', message: 'Pool not found' }),
      );
      await expect(controller.list('nonexistent', mockUser as any, { page: 1, limit: 10 })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('create propagates FORBIDDEN from service', async () => {
      const { ForbiddenException } = await import('@nestjs/common');
      documentsService.buildCreateDocument.mockRejectedValue(
        new ForbiddenException({ code: 'NOT_IN_ORG', message: 'Not in org' }),
      );
      await expect(
        controller.create(poolId, mockUser as any, {
          adminConfigId: 'cfg',
          folderId: 0,
          docType: 1,
          title: 'Doc',
          requiredFlag: false,
          visibleToRoles: 1,
          walrusBlobId: 'blob',
          contentHash: 'a'.repeat(64),
          sizeBytes: 100,
          changeLog: '',
          tags: [],
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('findOne propagates NOT_FOUND from service', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      documentsService.getDocument.mockRejectedValue(
        new NotFoundException({ code: 'DOCUMENT_NOT_FOUND', message: 'Document not found' }),
      );
      await expect(controller.findOne(poolId, 'nonexistent', mockUser as any)).rejects.toThrow(NotFoundException);
    });

    it('addVersion propagates NOT_FOUND from service', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      documentsService.buildAddVersion.mockRejectedValue(
        new NotFoundException({ code: 'DOCUMENT_NOT_FOUND', message: 'Document not found' }),
      );
      await expect(
        controller.addVersion(poolId, 'nonexistent', mockUser as any, {
          adminConfigId: 'cfg',
          walrusBlobId: 'blob',
          contentHash: 'b'.repeat(64),
          sizeBytes: 100,
          changeLog: '',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('archive propagates FORBIDDEN from service', async () => {
      const { ForbiddenException } = await import('@nestjs/common');
      documentsService.buildArchiveDocument.mockRejectedValue(
        new ForbiddenException({ code: 'NOT_IN_ORG', message: 'Not in org' }),
      );
      await expect(controller.archive(poolId, docId, mockUser as any, { adminConfigId: 'cfg' })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('listVersions propagates NOT_FOUND from service', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      documentsService.getDocumentVersions.mockRejectedValue(
        new NotFoundException({ code: 'DOCUMENT_NOT_FOUND', message: 'Document not found' }),
      );
      await expect(controller.listVersions(poolId, 'nonexistent', mockUser as any)).rejects.toThrow(NotFoundException);
    });

    it('getVersion propagates NOT_FOUND from service', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      documentsService.getDocumentVersion.mockRejectedValue(
        new NotFoundException({ code: 'VERSION_NOT_FOUND', message: 'Version not found' }),
      );
      await expect(controller.getVersion(poolId, docId, '999', mockUser as any)).rejects.toThrow(NotFoundException);
    });

    it('getVersion with invalid version string parses to NaN gracefully', async () => {
      await controller.getVersion(poolId, docId, 'abc', mockUser as any);
      expect(documentsService.getDocumentVersion).toHaveBeenCalledWith(poolId, docId, NaN, mockUser.orgId);
    });

    it('list with page=1 and limit=1 returns only first item', async () => {
      documentsService.listDocuments.mockResolvedValue({ data: [mockDoc], total: 100, page: 1, limit: 1 });
      const result = await controller.list(poolId, mockUser as any, { page: 1, limit: 1 });
      expect(result.data).toHaveLength(1);
    });
  });
});
