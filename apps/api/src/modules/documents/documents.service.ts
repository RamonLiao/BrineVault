import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PoolsRepository, DocumentsRepository, DocumentVersionsRepository } from '@rwa-dataroom/db';
import { SUI_TX_SERVICE } from '../../common/constants.js';
import type { SuiTxService } from '../../infra/sui/sui-tx.service.js';
import type { CreateDocumentDto, AddVersionDto, ArchiveDocumentDto } from './documents.schemas.js';

@Injectable()
export class DocumentsService {
  constructor(
    @Inject(PoolsRepository) private readonly poolsRepo: PoolsRepository,
    @Inject(DocumentsRepository) private readonly documentsRepo: DocumentsRepository,
    @Inject(DocumentVersionsRepository) private readonly documentVersionsRepo: DocumentVersionsRepository,
    @Inject(SUI_TX_SERVICE) private readonly suiTx: SuiTxService,
  ) {}

  async listDocuments(poolId: string, userOrgId: string | null, query: { page: number; limit: number }) {
    const pool = await this.poolsRepo.findById(poolId);
    if (!pool) {
      throw new NotFoundException({ code: 'POOL_NOT_FOUND', message: 'Pool not found' });
    }
    if (userOrgId !== pool.orgId) {
      throw new ForbiddenException({ code: 'NOT_IN_ORG', message: 'Not a member of this organization' });
    }
    const offset = (query.page - 1) * query.limit;
    const [data, total] = await Promise.all([
      this.documentsRepo.findByPoolId(poolId, { limit: query.limit, offset }),
      this.documentsRepo.countByPoolId(poolId),
    ]);
    return { data, total, page: query.page, limit: query.limit };
  }

  async getDocument(poolId: string, docId: string, userOrgId: string | null) {
    const pool = await this.poolsRepo.findById(poolId);
    if (!pool) {
      throw new NotFoundException({ code: 'POOL_NOT_FOUND', message: 'Pool not found' });
    }
    if (userOrgId !== pool.orgId) {
      throw new ForbiddenException({ code: 'NOT_IN_ORG', message: 'Not a member of this organization' });
    }
    const doc = await this.documentsRepo.findById(docId);
    if (!doc) {
      throw new NotFoundException({ code: 'DOCUMENT_NOT_FOUND', message: 'Document not found' });
    }
    if (doc.poolId !== poolId) {
      throw new NotFoundException({ code: 'DOCUMENT_NOT_FOUND', message: 'Document not found' });
    }
    return doc;
  }

  async getDocumentVersions(poolId: string, docId: string, userOrgId: string | null) {
    const pool = await this.poolsRepo.findById(poolId);
    if (!pool) {
      throw new NotFoundException({ code: 'POOL_NOT_FOUND', message: 'Pool not found' });
    }
    if (userOrgId !== pool.orgId) {
      throw new ForbiddenException({ code: 'NOT_IN_ORG', message: 'Not a member of this organization' });
    }
    const doc = await this.documentsRepo.findById(docId);
    if (!doc) {
      throw new NotFoundException({ code: 'DOCUMENT_NOT_FOUND', message: 'Document not found' });
    }
    if (doc.poolId !== poolId) {
      throw new NotFoundException({ code: 'DOCUMENT_NOT_FOUND', message: 'Document not found' });
    }
    return this.documentVersionsRepo.findByDocumentId(docId);
  }

  async getDocumentVersion(poolId: string, docId: string, version: number, userOrgId: string | null) {
    const pool = await this.poolsRepo.findById(poolId);
    if (!pool) {
      throw new NotFoundException({ code: 'POOL_NOT_FOUND', message: 'Pool not found' });
    }
    if (userOrgId !== pool.orgId) {
      throw new ForbiddenException({ code: 'NOT_IN_ORG', message: 'Not a member of this organization' });
    }
    const doc = await this.documentsRepo.findById(docId);
    if (!doc) {
      throw new NotFoundException({ code: 'DOCUMENT_NOT_FOUND', message: 'Document not found' });
    }
    if (doc.poolId !== poolId) {
      throw new NotFoundException({ code: 'DOCUMENT_NOT_FOUND', message: 'Document not found' });
    }
    const docVersion = await this.documentVersionsRepo.findByDocumentAndVersion(docId, version);
    if (!docVersion) {
      throw new NotFoundException({ code: 'VERSION_NOT_FOUND', message: 'Document version not found' });
    }
    return docVersion;
  }

  async buildCreateDocument(
    poolId: string,
    senderAddress: string,
    userOrgId: string | null,
    dto: CreateDocumentDto,
  ) {
    const pool = await this.poolsRepo.findById(poolId);
    if (!pool) {
      throw new NotFoundException({ code: 'POOL_NOT_FOUND', message: 'Pool not found' });
    }
    if (userOrgId !== pool.orgId) {
      throw new ForbiddenException({ code: 'NOT_IN_ORG', message: 'Not a member of this organization' });
    }
    return this.suiTx.buildCreateDocumentTx({
      senderAddress,
      adminConfigId: dto.adminConfigId,
      poolObjectId: pool.suiObjectId,
      folderId: dto.folderId,
      docType: dto.docType,
      title: dto.title,
      requiredFlag: dto.requiredFlag,
      visibleToRoles: dto.visibleToRoles,
      walrusBlobId: dto.walrusBlobId,
      contentHash: dto.contentHash,
      sizeBytes: dto.sizeBytes,
      changeLog: dto.changeLog,
      tags: dto.tags,
    });
  }

  async buildAddVersion(
    poolId: string,
    docId: string,
    senderAddress: string,
    userOrgId: string | null,
    dto: AddVersionDto,
  ) {
    const pool = await this.poolsRepo.findById(poolId);
    if (!pool) {
      throw new NotFoundException({ code: 'POOL_NOT_FOUND', message: 'Pool not found' });
    }
    if (userOrgId !== pool.orgId) {
      throw new ForbiddenException({ code: 'NOT_IN_ORG', message: 'Not a member of this organization' });
    }
    const doc = await this.documentsRepo.findById(docId);
    if (!doc) {
      throw new NotFoundException({ code: 'DOCUMENT_NOT_FOUND', message: 'Document not found' });
    }
    if (doc.poolId !== poolId) {
      throw new NotFoundException({ code: 'DOCUMENT_NOT_FOUND', message: 'Document not found' });
    }
    return this.suiTx.buildAddVersionTx({
      senderAddress,
      adminConfigId: dto.adminConfigId,
      poolObjectId: pool.suiObjectId,
      docObjectId: doc.suiObjectId,
      walrusBlobId: dto.walrusBlobId,
      contentHash: dto.contentHash,
      sizeBytes: dto.sizeBytes,
      changeLog: dto.changeLog,
    });
  }

  async buildArchiveDocument(
    poolId: string,
    docId: string,
    senderAddress: string,
    userOrgId: string | null,
    dto: ArchiveDocumentDto,
  ) {
    const pool = await this.poolsRepo.findById(poolId);
    if (!pool) {
      throw new NotFoundException({ code: 'POOL_NOT_FOUND', message: 'Pool not found' });
    }
    if (userOrgId !== pool.orgId) {
      throw new ForbiddenException({ code: 'NOT_IN_ORG', message: 'Not a member of this organization' });
    }
    const doc = await this.documentsRepo.findById(docId);
    if (!doc) {
      throw new NotFoundException({ code: 'DOCUMENT_NOT_FOUND', message: 'Document not found' });
    }
    if (doc.poolId !== poolId) {
      throw new NotFoundException({ code: 'DOCUMENT_NOT_FOUND', message: 'Document not found' });
    }
    return this.suiTx.buildArchiveDocumentTx({
      senderAddress,
      adminConfigId: dto.adminConfigId,
      poolObjectId: pool.suiObjectId,
      docObjectId: doc.suiObjectId,
    });
  }
}
