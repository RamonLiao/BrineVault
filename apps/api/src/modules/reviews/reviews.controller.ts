import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { ReviewsService } from './reviews.service.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { submitReviewSchema } from './reviews.schemas.js';

interface JwtPayload {
  sub: string;
  address: string;
  orgId: string | null;
  orgRole: number;
  sid: string;
  jti: string;
  iat: number;
  exp: number;
}

@Controller('pools/:poolId/documents/:docId/reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  async submit(
    @Param('poolId') poolId: string,
    @Param('docId') docId: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(submitReviewSchema)) dto: any,
  ) {
    return this.reviewsService.buildSubmitReview(poolId, docId, user.address, user.orgId, dto);
  }

  @Get()
  async list(
    @Param('poolId') poolId: string,
    @Param('docId') docId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.reviewsService.listReviews(poolId, docId, user.orgId);
  }

  @Get('summary')
  async summary(
    @Param('poolId') poolId: string,
    @Param('docId') docId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.reviewsService.getReviewSummary(poolId, docId, user.orgId);
  }
}
