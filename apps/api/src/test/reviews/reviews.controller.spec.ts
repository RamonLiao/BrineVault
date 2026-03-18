process.env.DATABASE_URL = 'postgresql://localhost/test';
process.env.REDIS_URL = 'redis://localhost';
process.env.JWT_PRIVATE_KEY = 'dGVzdA==';
process.env.JWT_PUBLIC_KEY = 'dGVzdA==';
process.env.CSRF_SECRET = 'test-csrf-secret-at-least-16-chars';
process.env.SUI_RPC_URL = 'https://rpc.testnet.sui.io';
process.env.SUI_PACKAGE_ID = '0x0';
process.env.PLATFORM_KEYPAIR = 'dGVzdA==';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReviewsController } from '../../modules/reviews/reviews.controller.js';
import type { ReviewsService } from '../../modules/reviews/reviews.service.js';

describe('ReviewsController', () => {
  let controller: ReviewsController;
  let reviewsService: Record<string, any>;

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
  const mockReviews = [
    { documentId: docId, reviewerAddress: '0x1', status: 0 },
    { documentId: docId, reviewerAddress: '0x2', status: 1 },
  ];
  const mockSummary = { total: 2, approved: 1, needsRevision: 1, rejected: 0 };

  beforeEach(() => {
    reviewsService = {
      buildSubmitReview: vi.fn().mockResolvedValue(mockTxResponse),
      listReviews: vi.fn().mockResolvedValue(mockReviews),
      getReviewSummary: vi.fn().mockResolvedValue(mockSummary),
    };

    controller = new ReviewsController(reviewsService as unknown as ReviewsService);
  });

  // ─── POST /pools/:poolId/documents/:docId/reviews ────────

  describe('POST /pools/:poolId/documents/:docId/reviews', () => {
    it('calls buildSubmitReview with correct args and returns txBytes', async () => {
      const dto = { adminConfigId: 'cfg-001', status: 0 };
      const result = await controller.submit(poolId, docId, mockUser as any, dto);

      expect(reviewsService.buildSubmitReview).toHaveBeenCalledWith(
        poolId,
        docId,
        mockUser.address,
        mockUser.orgId,
        dto,
      );
      expect(result).toEqual(mockTxResponse);
    });

    it('passes commentHash when provided', async () => {
      const dto = { adminConfigId: 'cfg-001', status: 1, commentHash: 'a'.repeat(64) };
      await controller.submit(poolId, docId, mockUser as any, dto);

      expect(reviewsService.buildSubmitReview).toHaveBeenCalledWith(
        poolId,
        docId,
        mockUser.address,
        mockUser.orgId,
        dto,
      );
    });

    it('passes user.orgId (which may be null)', async () => {
      const userNoOrg = { ...mockUser, orgId: null };
      const dto = { adminConfigId: 'cfg-001', status: 0 };
      await controller.submit(poolId, docId, userNoOrg as any, dto);

      expect(reviewsService.buildSubmitReview).toHaveBeenCalledWith(
        poolId,
        docId,
        mockUser.address,
        null,
        dto,
      );
    });
  });

  // ─── GET /pools/:poolId/documents/:docId/reviews ─────────

  describe('GET /pools/:poolId/documents/:docId/reviews', () => {
    it('calls listReviews with correct args and returns reviews', async () => {
      const result = await controller.list(poolId, docId, mockUser as any);

      expect(reviewsService.listReviews).toHaveBeenCalledWith(poolId, docId, mockUser.orgId);
      expect(result).toEqual(mockReviews);
    });

    it('passes user.orgId (which may be null)', async () => {
      const userNoOrg = { ...mockUser, orgId: null };
      await controller.list(poolId, docId, userNoOrg as any);

      expect(reviewsService.listReviews).toHaveBeenCalledWith(poolId, docId, null);
    });
  });

  // ─── GET /pools/:poolId/documents/:docId/reviews/summary ─

  describe('GET /pools/:poolId/documents/:docId/reviews/summary', () => {
    it('calls getReviewSummary with correct args and returns summary', async () => {
      const result = await controller.summary(poolId, docId, mockUser as any);

      expect(reviewsService.getReviewSummary).toHaveBeenCalledWith(poolId, docId, mockUser.orgId);
      expect(result).toEqual(mockSummary);
    });

    it('passes user.orgId (which may be null)', async () => {
      const userNoOrg = { ...mockUser, orgId: null };
      await controller.summary(poolId, docId, userNoOrg as any);

      expect(reviewsService.getReviewSummary).toHaveBeenCalledWith(poolId, docId, null);
    });
  });

  // ─── Monkey tests ─────────────────────────────────────────

  describe('monkey tests', () => {
    it('submit propagates NotFoundException from service', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      reviewsService.buildSubmitReview.mockRejectedValue(
        new NotFoundException({ code: 'POOL_NOT_FOUND', message: 'Pool not found' }),
      );
      await expect(
        controller.submit(poolId, docId, mockUser as any, { adminConfigId: 'cfg', status: 0 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('submit propagates ForbiddenException from service', async () => {
      const { ForbiddenException } = await import('@nestjs/common');
      reviewsService.buildSubmitReview.mockRejectedValue(
        new ForbiddenException({ code: 'NOT_IN_ORG', message: 'Not in org' }),
      );
      await expect(
        controller.submit(poolId, docId, mockUser as any, { adminConfigId: 'cfg', status: 0 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('list propagates NotFoundException when pool not found', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      reviewsService.listReviews.mockRejectedValue(
        new NotFoundException({ code: 'POOL_NOT_FOUND', message: 'Pool not found' }),
      );
      await expect(
        controller.list('nonexistent-pool', docId, mockUser as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('summary propagates ForbiddenException from service', async () => {
      const { ForbiddenException } = await import('@nestjs/common');
      reviewsService.getReviewSummary.mockRejectedValue(
        new ForbiddenException({ code: 'NOT_IN_ORG', message: 'Not in org' }),
      );
      await expect(
        controller.summary(poolId, docId, mockUser as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('submit propagates generic errors', async () => {
      reviewsService.buildSubmitReview.mockRejectedValue(new Error('suiTx network error'));
      await expect(
        controller.submit(poolId, docId, mockUser as any, { adminConfigId: 'cfg', status: 2 }),
      ).rejects.toThrow('suiTx network error');
    });

    it('list with empty docId still delegates to service', async () => {
      reviewsService.listReviews.mockResolvedValue([]);
      const result = await controller.list(poolId, '', mockUser as any);
      expect(reviewsService.listReviews).toHaveBeenCalledWith(poolId, '', mockUser.orgId);
      expect(result).toEqual([]);
    });
  });
});
