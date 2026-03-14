import { Controller, Get, Post, Delete, Param, Body, Query } from '@nestjs/common';
import { PoolsService } from './pools.service.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { createPoolSchema, submitSignedTxSchema, transitionPoolSchema, cancelPoolSchema } from './pools.schemas.js';
import { paginationParamsSchema } from '@rwa-dataroom/shared';

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

@Controller('pools')
export class PoolsController {
  constructor(private readonly poolsService: PoolsService) {}

  @Post()
  async create(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(createPoolSchema)) dto: any,
  ) {
    return this.poolsService.buildCreatePool(user.address, dto);
  }

  @Get('org/:orgId')
  async list(
    @Param('orgId') orgId: string,
    @CurrentUser() user: JwtPayload,
    @Query(new ZodValidationPipe(paginationParamsSchema)) query: any,
  ) {
    return this.poolsService.listPools(orgId, user.orgId, query);
  }

  @Get(':poolId')
  async findOne(@Param('poolId') poolId: string, @CurrentUser() user: JwtPayload) {
    return this.poolsService.getPool(poolId, user.address, user.orgId);
  }

  @Post(':poolId/sign')
  async submitSigned(
    @Body(new ZodValidationPipe(submitSignedTxSchema)) dto: any,
  ) {
    return this.poolsService.submitSignedTx(dto);
  }

  @Post(':poolId/transitions')
  async transition(
    @Param('poolId') poolId: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(transitionPoolSchema)) dto: any,
  ) {
    return this.poolsService.buildTransition(poolId, user.address, user.orgId, dto);
  }

  @Delete(':poolId')
  async cancel(
    @Param('poolId') poolId: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(cancelPoolSchema)) dto: any,
  ) {
    return this.poolsService.buildCancel(poolId, user.address, user.orgId, dto);
  }
}
