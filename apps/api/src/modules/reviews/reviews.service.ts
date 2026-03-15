import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import {
  PoolsRepository,
  DocumentsRepository,
  DocumentReviewsRepository,
} from '@rwa-dataroom/db';
import { SUI_TX_SERVICE } from '../../common/constants.js';
import type { SuiTxService } from '../../infra/sui/sui-tx.service.js';
import type { SubmitReviewDto } from './reviews.schemas.js';

@Injectable()
export class ReviewsService {
  constructor(
    @Inject(PoolsRepository) private readonly poolsRepo: PoolsRepository,
    @Inject(DocumentsRepository) private readonly documentsRepo: DocumentsRepository,
    @Inject(DocumentReviewsRepository) private readonly reviewsRepo: DocumentReviewsRepository,
    @Inject(SUI_TX_SERVICE) private readonly suiTx: SuiTxService,
  ) {}

  async buildSubmitReview(
    poolId: string,
    docId: string,
    senderAddress: string,
    userOrgId: string | null,
    dto: SubmitReviewDto,
  ) {
    const pool = await this.poolsRepo.findById(poolId);
    if (!pool) throw new NotFoundException({ code: 'POOL_NOT_FOUND', message: 'Pool not found' });
    if (userOrgId !== pool.orgId) throw new ForbiddenException({ code: 'NOT_IN_ORG', message: 'Not a member of this organization' });

    const doc = await this.documentsRepo.findById(docId);
    if (!doc) throw new NotFoundException({ code: 'DOCUMENT_NOT_FOUND', message: 'Document not found' });
    if (doc.poolId !== poolId) throw new NotFoundException({ code: 'DOCUMENT_NOT_FOUND', message: 'Document not found' });

    return this.suiTx.buildSubmitReviewTx({
      senderAddress,
      adminConfigId: dto.adminConfigId,
      poolObjectId: pool.suiObjectId,
      docObjectId: doc.suiObjectId,
      status: dto.status,
      commentHash: dto.commentHash,
    });
  }

  async listReviews(poolId: string, docId: string, userOrgId: string | null) {
    const pool = await this.poolsRepo.findById(poolId);
    if (!pool) throw new NotFoundException({ code: 'POOL_NOT_FOUND', message: 'Pool not found' });
    if (userOrgId !== pool.orgId) throw new ForbiddenException({ code: 'NOT_IN_ORG', message: 'Not a member of this organization' });

    const doc = await this.documentsRepo.findById(docId);
    if (!doc) throw new NotFoundException({ code: 'DOCUMENT_NOT_FOUND', message: 'Document not found' });

    return this.reviewsRepo.findByDocumentId(docId);
  }

  async getReviewSummary(poolId: string, docId: string, userOrgId: string | null) {
    const pool = await this.poolsRepo.findById(poolId);
    if (!pool) throw new NotFoundException({ code: 'POOL_NOT_FOUND', message: 'Pool not found' });
    if (userOrgId !== pool.orgId) throw new ForbiddenException({ code: 'NOT_IN_ORG', message: 'Not a member of this organization' });

    const doc = await this.documentsRepo.findById(docId);
    if (!doc) throw new NotFoundException({ code: 'DOCUMENT_NOT_FOUND', message: 'Document not found' });

    const reviews = await this.reviewsRepo.findByDocumentId(docId);
    const total = reviews.length;
    const approved = reviews.filter((r) => r.status === 0).length;
    const needsRevision = reviews.filter((r) => r.status === 1).length;
    const rejected = reviews.filter((r) => r.status === 2).length;

    return { total, approved, needsRevision, rejected };
  }
}
