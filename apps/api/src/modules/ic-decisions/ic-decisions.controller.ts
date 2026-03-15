import { Controller, Get, Post, Param, Body, ParseIntPipe } from '@nestjs/common';
import { ICDecisionsService } from './ic-decisions.service.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { submitIcDecisionSchema } from './ic-decisions.schemas.js';

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

@Controller('pools/:poolId/ic-decisions')
export class ICDecisionsController {
  constructor(private readonly icDecisionsService: ICDecisionsService) {}

  @Post()
  async submit(
    @Param('poolId') poolId: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(submitIcDecisionSchema)) dto: any,
  ) {
    return this.icDecisionsService.buildSubmitDecision(poolId, user.address, user.orgId, dto);
  }

  @Get()
  async list(@Param('poolId') poolId: string, @CurrentUser() user: JwtPayload) {
    return this.icDecisionsService.listDecisions(poolId, user.orgId);
  }

  @Get(':index')
  async findOne(
    @Param('poolId') poolId: string,
    @Param('index', ParseIntPipe) index: number,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.icDecisionsService.getDecision(poolId, index, user.orgId);
  }
}
