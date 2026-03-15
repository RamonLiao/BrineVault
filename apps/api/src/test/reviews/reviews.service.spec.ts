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
import { ReviewsService } from '../../modules/reviews/reviews.service.js';

describe('ReviewsService', () => {
  let service: ReviewsService;
  let poolsRepo: any;
  let documentsRepo: any;
  let reviewsRepo: any;
  let suiTx: any;

  const poolId = 'pool-001';
  const docId = 'doc-001';
  const orgId = 'org-001';
  const userAddress = '0x' + 'a'.repeat(64);

  const mockPool = (overrides: any = {}) => ({
    id: poolId, orgId, suiObjectId: '0x' + 'b'.repeat(64), ...overrides,
  });

  const mockDoc = (overrides: any = {}) => ({
    id: docId, poolId, suiObjectId: '0x' + 'c'.repeat(64), ...overrides,
  });

  beforeEach(() => {
    poolsRepo = { findById: vi.fn() };
    documentsRepo = { findById: vi.fn() };
    reviewsRepo = { findByDocumentId: vi.fn(), findByDocumentAndReviewer: vi.fn() };
    suiTx = { buildSubmitReviewTx: vi.fn().mockResolvedValue({ txBytes: 'mock-tx' }) };

    service = new ReviewsService(poolsRepo, documentsRepo, reviewsRepo, suiTx);
  });

  describe('buildSubmitReview', () => {
    const dto = {
      adminConfigId: 'admin-cfg-1',
      status: 0,
    };

    it('returns txBytes on success — uses pool.suiObjectId + doc.suiObjectId', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      documentsRepo.findById.mockResolvedValue(mockDoc());

      const result = await service.buildSubmitReview(poolId, docId, userAddress, orgId, dto);
      expect(result.txBytes).toBe('mock-tx');
      expect(suiTx.buildSubmitReviewTx).toHaveBeenCalledWith({
        senderAddress: userAddress,
        adminConfigId: dto.adminConfigId,
        poolObjectId: '0x' + 'b'.repeat(64),
        docObjectId: '0x' + 'c'.repeat(64),
        status: 0,
        commentHash: undefined,
      });
    });

    it('throws NotFoundException when pool not found', async () => {
      poolsRepo.findById.mockResolvedValue(null);
      await expect(service.buildSubmitReview(poolId, docId, userAddress, orgId, dto))
        .rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when user not in org', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      await expect(service.buildSubmitReview(poolId, docId, userAddress, 'other-org', dto))
        .rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when document not found', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      documentsRepo.findById.mockResolvedValue(null);
      await expect(service.buildSubmitReview(poolId, docId, userAddress, orgId, dto))
        .rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when doc.poolId does not match poolId', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      documentsRepo.findById.mockResolvedValue(mockDoc({ poolId: 'different-pool' }));
      await expect(service.buildSubmitReview(poolId, docId, userAddress, orgId, dto))
        .rejects.toThrow(NotFoundException);
    });

    it('passes commentHash when provided', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      documentsRepo.findById.mockResolvedValue(mockDoc());
      const dtoWithHash = { ...dto, commentHash: 'a'.repeat(64) };

      await service.buildSubmitReview(poolId, docId, userAddress, orgId, dtoWithHash);
      expect(suiTx.buildSubmitReviewTx).toHaveBeenCalledWith(
        expect.objectContaining({ commentHash: 'a'.repeat(64) }),
      );
    });

    it('handles all status values (0, 1, 2)', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      documentsRepo.findById.mockResolvedValue(mockDoc());

      for (const status of [0, 1, 2]) {
        suiTx.buildSubmitReviewTx.mockResolvedValue({ txBytes: `mock-tx-${status}` });
        const result = await service.buildSubmitReview(poolId, docId, userAddress, orgId, { ...dto, status });
        expect(result.txBytes).toBe(`mock-tx-${status}`);
      }
    });

    it('throws ForbiddenException when user orgId is null', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      await expect(service.buildSubmitReview(poolId, docId, userAddress, null, dto))
        .rejects.toThrow(ForbiddenException);
    });
  });

  describe('listReviews', () => {
    it('returns reviews array', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      documentsRepo.findById.mockResolvedValue(mockDoc());
      reviewsRepo.findByDocumentId.mockResolvedValue([
        { documentId: docId, reviewerAddress: '0x1', status: 0 },
      ]);

      const result = await service.listReviews(poolId, docId, orgId);
      expect(result).toHaveLength(1);
    });

    it('returns empty array when no reviews', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      documentsRepo.findById.mockResolvedValue(mockDoc());
      reviewsRepo.findByDocumentId.mockResolvedValue([]);

      const result = await service.listReviews(poolId, docId, orgId);
      expect(result).toHaveLength(0);
    });

    it('throws NotFoundException when pool not found', async () => {
      poolsRepo.findById.mockResolvedValue(null);
      await expect(service.listReviews(poolId, docId, orgId))
        .rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when user not in org', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      await expect(service.listReviews(poolId, docId, 'wrong-org'))
        .rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when document not found', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      documentsRepo.findById.mockResolvedValue(null);
      await expect(service.listReviews(poolId, docId, orgId))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('getReviewSummary', () => {
    it('returns aggregated counts', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      documentsRepo.findById.mockResolvedValue(mockDoc());
      reviewsRepo.findByDocumentId.mockResolvedValue([
        { status: 0 }, { status: 0 }, { status: 1 }, { status: 2 },
      ]);

      const summary = await service.getReviewSummary(poolId, docId, orgId);
      expect(summary).toEqual({ total: 4, approved: 2, needsRevision: 1, rejected: 1 });
    });

    it('returns all zeros when no reviews', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      documentsRepo.findById.mockResolvedValue(mockDoc());
      reviewsRepo.findByDocumentId.mockResolvedValue([]);

      const summary = await service.getReviewSummary(poolId, docId, orgId);
      expect(summary).toEqual({ total: 0, approved: 0, needsRevision: 0, rejected: 0 });
    });

    it('throws NotFoundException when pool not found', async () => {
      poolsRepo.findById.mockResolvedValue(null);
      await expect(service.getReviewSummary(poolId, docId, orgId))
        .rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when user not in org', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      await expect(service.getReviewSummary(poolId, docId, 'wrong-org'))
        .rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when document not found', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      documentsRepo.findById.mockResolvedValue(null);
      await expect(service.getReviewSummary(poolId, docId, orgId))
        .rejects.toThrow(NotFoundException);
    });

    it('handles large number of reviews correctly', async () => {
      poolsRepo.findById.mockResolvedValue(mockPool());
      documentsRepo.findById.mockResolvedValue(mockDoc());
      const manyReviews = Array.from({ length: 100 }, (_, i) => ({ status: i % 3 }));
      reviewsRepo.findByDocumentId.mockResolvedValue(manyReviews);

      const summary = await service.getReviewSummary(poolId, docId, orgId);
      expect(summary.total).toBe(100);
      expect(summary.approved + summary.needsRevision + summary.rejected).toBe(100);
    });
  });
});
