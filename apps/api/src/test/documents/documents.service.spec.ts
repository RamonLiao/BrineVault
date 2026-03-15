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
import { DocumentsService } from '../../modules/documents/documents.service.js';

describe('DocumentsService', () => {
  let service: DocumentsService;
  let poolsRepo: any;
  let documentsRepo: any;
  let documentVersionsRepo: any;
  let suiTx: any;

  const poolId = 'pool-001';
  const docId = 'doc-001';
  const orgId = 'org-001';
  const userAddress = '0x' + 'a'.repeat(64);
  const poolSuiObjectId = '0x' + 'b'.repeat(64);
  const docSuiObjectId = '0x' + 'c'.repeat(64);

  const mockPool = (overrides: any = {}) => ({
    id: poolId,
    orgId,
    suiObjectId: poolSuiObjectId,
    name: 'Test Pool',
    status: 'draft',
    currency: 'USD',
    targetNotional: '1000000',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const mockDoc = (overrides: any = {}) => ({
    id: docId,
    suiObjectId: docSuiObjectId,
    poolId,
    dataroomId: 'dr-001',
    folderId: 0,
    docType: 1,
    title: 'Test Document',
    tags: [],
    currentVersion: 1,
    versionCount: 1,
    requiredFlag: false,
    encryptionScheme: 0,
    createdAt: new Date(),
    lastUpdatedAt: new Date(),
    ...overrides,
  });

  const mockVersion = (overrides: any = {}) => ({
    id: 'ver-001',
    documentId: docId,
    version: 1,
    walrusBlobId: 'blob-abc',
    contentHash: 'a'.repeat(64),
    sizeBytes: 1024,
    uploadedByAddress: userAddress,
    uploadedAt: new Date(),
    changeLog: 'Initial upload',
    ...overrides,
  });

  beforeEach(() => {
    poolsRepo = {
      findById: vi.fn(),
    };
    documentsRepo = {
      findById: vi.fn(),
      findByPoolId: vi.fn(),
      countByPoolId: vi.fn(),
    };
    documentVersionsRepo = {
      findByDocumentId: vi.fn(),
      findByDocumentAndVersion: vi.fn(),
    };
    suiTx = {
      buildCreateDocumentTx: vi.fn().mockResolvedValue({ txBytes: 'base64txbytes' }),
      buildAddVersionTx: vi.fn().mockResolvedValue({ txBytes: 'base64txbytes' }),
      buildArchiveDocumentTx: vi.fn().mockResolvedValue({ txBytes: 'base64txbytes' }),
    };

    service = new DocumentsService(poolsRepo, documentsRepo, documentVersionsRepo, suiTx);
  });

  // ─── listDocuments ────────────────────────────────────────────

  describe('listDocuments', () => {
    it('returns paginated docs when user in org', async () => {
      const docs = [mockDoc()];
      poolsRepo.findById.mockResolvedValue(mockPool());
      documentsRepo.findByPoolId.mockResolvedValue(docs);
      documentsRepo.countByPoolId.mockResolvedValue(1);

      const result = await service.listDocuments(poolId, orgId, { page: 1, limit: 10 });

      expect(result.data).toEqual(docs);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(documentsRepo.findByPoolId).toHaveBeenCalledWith(poolId, { limit: 10, offset: 0 });
    });

    it('calculates correct offset for page 2', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      documentsRepo.findByPoolId.mockResolvedValue([]);
      documentsRepo.countByPoolId.mockResolvedValue(0);

      await service.listDocuments(poolId, orgId, { page: 2, limit: 10 });

      expect(documentsRepo.findByPoolId).toHaveBeenCalledWith(poolId, { limit: 10, offset: 10 });
    });

    it('throws NOT_FOUND if pool missing', async () => {
      poolsRepo.findById.mockResolvedValue(null);

      await expect(service.listDocuments(poolId, orgId, { page: 1, limit: 10 })).rejects.toThrow(NotFoundException);
      try {
        await service.listDocuments(poolId, orgId, { page: 1, limit: 10 });
      } catch (err: any) {
        expect(err.getResponse()).toMatchObject({ code: 'POOL_NOT_FOUND' });
      }
    });

    it('throws FORBIDDEN if wrong org', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool({ orgId: 'other-org' }));

      await expect(service.listDocuments(poolId, orgId, { page: 1, limit: 10 })).rejects.toThrow(ForbiddenException);
      try {
        await service.listDocuments(poolId, orgId, { page: 1, limit: 10 });
      } catch (err: any) {
        expect(err.getResponse()).toMatchObject({ code: 'NOT_IN_ORG' });
      }
    });
  });

  // ─── getDocument ──────────────────────────────────────────────

  describe('getDocument', () => {
    it('returns doc when valid', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      documentsRepo.findById.mockResolvedValue(mockDoc());

      const result = await service.getDocument(poolId, docId, orgId);

      expect(result).toEqual(mockDoc());
    });

    it('throws NOT_FOUND if pool missing', async () => {
      poolsRepo.findById.mockResolvedValue(null);

      await expect(service.getDocument(poolId, docId, orgId)).rejects.toThrow(NotFoundException);
      try {
        await service.getDocument(poolId, docId, orgId);
      } catch (err: any) {
        expect(err.getResponse()).toMatchObject({ code: 'POOL_NOT_FOUND' });
      }
    });

    it('throws NOT_FOUND if doc missing', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      documentsRepo.findById.mockResolvedValue(null);

      await expect(service.getDocument(poolId, docId, orgId)).rejects.toThrow(NotFoundException);
      try {
        await service.getDocument(poolId, docId, orgId);
      } catch (err: any) {
        expect(err.getResponse()).toMatchObject({ code: 'DOCUMENT_NOT_FOUND' });
      }
    });

    it("throws NOT_FOUND if doc doesn't belong to pool", async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      documentsRepo.findById.mockResolvedValue(mockDoc({ poolId: 'other-pool' }));

      await expect(service.getDocument(poolId, docId, orgId)).rejects.toThrow(NotFoundException);
      try {
        await service.getDocument(poolId, docId, orgId);
      } catch (err: any) {
        expect(err.getResponse()).toMatchObject({ code: 'DOCUMENT_NOT_FOUND' });
      }
    });
  });

  // ─── getDocumentVersions ──────────────────────────────────────

  describe('getDocumentVersions', () => {
    it('returns versions list', async () => {
      const versions = [mockVersion(), mockVersion({ version: 2 })];
      poolsRepo.findById.mockResolvedValue(mockPool());
      documentsRepo.findById.mockResolvedValue(mockDoc());
      documentVersionsRepo.findByDocumentId.mockResolvedValue(versions);

      const result = await service.getDocumentVersions(poolId, docId, orgId);

      expect(result).toEqual(versions);
      expect(documentVersionsRepo.findByDocumentId).toHaveBeenCalledWith(docId);
    });

    it('throws NOT_FOUND if doc missing', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      documentsRepo.findById.mockResolvedValue(null);

      await expect(service.getDocumentVersions(poolId, docId, orgId)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── getDocumentVersion ───────────────────────────────────────

  describe('getDocumentVersion', () => {
    it('returns specific version', async () => {
      const version = mockVersion();
      poolsRepo.findById.mockResolvedValue(mockPool());
      documentsRepo.findById.mockResolvedValue(mockDoc());
      documentVersionsRepo.findByDocumentAndVersion.mockResolvedValue(version);

      const result = await service.getDocumentVersion(poolId, docId, 1, orgId);

      expect(result).toEqual(version);
      expect(documentVersionsRepo.findByDocumentAndVersion).toHaveBeenCalledWith(docId, 1);
    });

    it('throws NOT_FOUND if version missing', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      documentsRepo.findById.mockResolvedValue(mockDoc());
      documentVersionsRepo.findByDocumentAndVersion.mockResolvedValue(null);

      await expect(service.getDocumentVersion(poolId, docId, 99, orgId)).rejects.toThrow(NotFoundException);
      try {
        await service.getDocumentVersion(poolId, docId, 99, orgId);
      } catch (err: any) {
        expect(err.getResponse()).toMatchObject({ code: 'VERSION_NOT_FOUND' });
      }
    });
  });

  // ─── buildCreateDocument ──────────────────────────────────────

  describe('buildCreateDocument', () => {
    const createDto = {
      adminConfigId: 'admin-cfg-001',
      folderId: 0,
      docType: 1,
      title: 'Financial Report',
      requiredFlag: false,
      visibleToRoles: 3,
      walrusBlobId: 'blob-xyz',
      contentHash: 'a'.repeat(64),
      sizeBytes: 2048,
      changeLog: 'Initial upload',
      tags: ['finance'],
    };

    it('delegates to suiTx.buildCreateDocumentTx', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());

      const result = await service.buildCreateDocument(poolId, userAddress, orgId, createDto);

      expect(suiTx.buildCreateDocumentTx).toHaveBeenCalledWith({
        senderAddress: userAddress,
        adminConfigId: createDto.adminConfigId,
        poolObjectId: poolSuiObjectId,
        folderId: createDto.folderId,
        docType: createDto.docType,
        title: createDto.title,
        requiredFlag: createDto.requiredFlag,
        visibleToRoles: createDto.visibleToRoles,
        walrusBlobId: createDto.walrusBlobId,
        contentHash: createDto.contentHash,
        sizeBytes: createDto.sizeBytes,
        changeLog: createDto.changeLog,
        tags: createDto.tags,
      });
      expect(result).toEqual({ txBytes: 'base64txbytes' });
    });

    it('throws NOT_FOUND if pool missing', async () => {
      poolsRepo.findById.mockResolvedValue(null);

      await expect(service.buildCreateDocument(poolId, userAddress, orgId, createDto)).rejects.toThrow(
        NotFoundException,
      );
      try {
        await service.buildCreateDocument(poolId, userAddress, orgId, createDto);
      } catch (err: any) {
        expect(err.getResponse()).toMatchObject({ code: 'POOL_NOT_FOUND' });
      }
    });

    it('throws FORBIDDEN if wrong org', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool({ orgId: 'other-org' }));

      await expect(service.buildCreateDocument(poolId, userAddress, orgId, createDto)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ─── buildAddVersion ──────────────────────────────────────────

  describe('buildAddVersion', () => {
    const addVersionDto = {
      adminConfigId: 'admin-cfg-001',
      walrusBlobId: 'blob-v2',
      contentHash: 'b'.repeat(64),
      sizeBytes: 3000,
      changeLog: 'Updated figures',
    };

    it('delegates to suiTx with doc.suiObjectId', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      documentsRepo.findById.mockResolvedValue(mockDoc());

      const result = await service.buildAddVersion(poolId, docId, userAddress, orgId, addVersionDto);

      expect(suiTx.buildAddVersionTx).toHaveBeenCalledWith({
        senderAddress: userAddress,
        adminConfigId: addVersionDto.adminConfigId,
        poolObjectId: poolSuiObjectId,
        docObjectId: docSuiObjectId,
        walrusBlobId: addVersionDto.walrusBlobId,
        contentHash: addVersionDto.contentHash,
        sizeBytes: addVersionDto.sizeBytes,
        changeLog: addVersionDto.changeLog,
      });
      expect(result).toEqual({ txBytes: 'base64txbytes' });
    });

    it('throws NOT_FOUND if doc missing', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      documentsRepo.findById.mockResolvedValue(null);

      await expect(service.buildAddVersion(poolId, docId, userAddress, orgId, addVersionDto)).rejects.toThrow(
        NotFoundException,
      );
      try {
        await service.buildAddVersion(poolId, docId, userAddress, orgId, addVersionDto);
      } catch (err: any) {
        expect(err.getResponse()).toMatchObject({ code: 'DOCUMENT_NOT_FOUND' });
      }
    });

    it('throws NOT_FOUND if pool missing', async () => {
      poolsRepo.findById.mockResolvedValue(null);

      await expect(service.buildAddVersion(poolId, docId, userAddress, orgId, addVersionDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── buildArchiveDocument ─────────────────────────────────────

  describe('buildArchiveDocument', () => {
    const archiveDto = { adminConfigId: 'admin-cfg-001' };

    it('delegates correctly', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      documentsRepo.findById.mockResolvedValue(mockDoc());

      const result = await service.buildArchiveDocument(poolId, docId, userAddress, orgId, archiveDto);

      expect(suiTx.buildArchiveDocumentTx).toHaveBeenCalledWith({
        senderAddress: userAddress,
        adminConfigId: archiveDto.adminConfigId,
        poolObjectId: poolSuiObjectId,
        docObjectId: docSuiObjectId,
      });
      expect(result).toEqual({ txBytes: 'base64txbytes' });
    });

    it('throws NOT_FOUND if doc missing', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      documentsRepo.findById.mockResolvedValue(null);

      await expect(service.buildArchiveDocument(poolId, docId, userAddress, orgId, archiveDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws FORBIDDEN if wrong org', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool({ orgId: 'other-org' }));

      await expect(service.buildArchiveDocument(poolId, docId, userAddress, orgId, archiveDto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NOT_FOUND if doc belongs to different pool', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      documentsRepo.findById.mockResolvedValue(mockDoc({ poolId: 'other-pool' }));

      await expect(service.buildArchiveDocument(poolId, docId, userAddress, orgId, archiveDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── Monkey / Edge-case tests ─────────────────────────────────

  describe('monkey tests', () => {
    it('listDocuments — null orgId never matches pool orgId', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());

      await expect(service.listDocuments(poolId, null, { page: 1, limit: 10 })).rejects.toThrow(ForbiddenException);
    });

    it('listDocuments — returns empty data when no docs', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      documentsRepo.findByPoolId.mockResolvedValue([]);
      documentsRepo.countByPoolId.mockResolvedValue(0);

      const result = await service.listDocuments(poolId, orgId, { page: 1, limit: 50 });
      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('getDocument — FORBIDDEN before NOT_FOUND for doc', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool({ orgId: 'other-org' }));
      documentsRepo.findById.mockResolvedValue(null);

      await expect(service.getDocument(poolId, docId, orgId)).rejects.toThrow(ForbiddenException);
    });

    it('buildAddVersion — doc from different pool returns NOT_FOUND', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      documentsRepo.findById.mockResolvedValue(mockDoc({ poolId: 'other-pool' }));

      await expect(
        service.buildAddVersion(poolId, docId, userAddress, orgId, {
          adminConfigId: 'cfg',
          walrusBlobId: 'blob',
          contentHash: 'c'.repeat(64),
          sizeBytes: 100,
          changeLog: '',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('getDocumentVersions returns empty array when no versions', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      documentsRepo.findById.mockResolvedValue(mockDoc());
      documentVersionsRepo.findByDocumentId.mockResolvedValue([]);

      const result = await service.getDocumentVersions(poolId, docId, orgId);
      expect(result).toEqual([]);
    });

    it('suiTx errors propagate from buildCreateDocument', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      suiTx.buildCreateDocumentTx.mockRejectedValue(new Error('RPC timeout'));

      await expect(
        service.buildCreateDocument(poolId, userAddress, orgId, {
          adminConfigId: 'cfg',
          folderId: 0,
          docType: 1,
          title: 'Doc',
          requiredFlag: false,
          visibleToRoles: 1,
          walrusBlobId: 'blob',
          contentHash: 'd'.repeat(64),
          sizeBytes: 100,
          changeLog: '',
          tags: [],
        }),
      ).rejects.toThrow('RPC timeout');
    });

    it('suiTx errors propagate from buildAddVersion', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      documentsRepo.findById.mockResolvedValue(mockDoc());
      suiTx.buildAddVersionTx.mockRejectedValue(new Error('Network error'));

      await expect(
        service.buildAddVersion(poolId, docId, userAddress, orgId, {
          adminConfigId: 'cfg',
          walrusBlobId: 'blob',
          contentHash: 'e'.repeat(64),
          sizeBytes: 100,
          changeLog: '',
        }),
      ).rejects.toThrow('Network error');
    });

    it('suiTx errors propagate from buildArchiveDocument', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      documentsRepo.findById.mockResolvedValue(mockDoc());
      suiTx.buildArchiveDocumentTx.mockRejectedValue(new Error('Sui error'));

      await expect(
        service.buildArchiveDocument(poolId, docId, userAddress, orgId, { adminConfigId: 'cfg' }),
      ).rejects.toThrow('Sui error');
    });

    it('listDocuments with large page number produces correct offset', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      documentsRepo.findByPoolId.mockResolvedValue([]);
      documentsRepo.countByPoolId.mockResolvedValue(0);

      await service.listDocuments(poolId, orgId, { page: 100, limit: 50 });
      expect(documentsRepo.findByPoolId).toHaveBeenCalledWith(poolId, { limit: 50, offset: 4950 });
    });

    it('getDocumentVersion with version=0 (boundary) throws NOT_FOUND when missing', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      documentsRepo.findById.mockResolvedValue(mockDoc());
      documentVersionsRepo.findByDocumentAndVersion.mockResolvedValue(null);

      await expect(service.getDocumentVersion(poolId, docId, 0, orgId)).rejects.toThrow(NotFoundException);
    });
  });
});
