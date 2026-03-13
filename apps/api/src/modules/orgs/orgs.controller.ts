import { Controller, Get, Post, Patch, Param, Body, Query } from '@nestjs/common';
import { OrgsService } from './orgs.service.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import {
  createOrgSchema,
  updateOrgSchema,
  generateInviteSchema,
  joinOrgSchema,
} from './orgs.schemas.js';
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

@Controller('orgs')
export class OrgsController {
  constructor(private readonly orgsService: OrgsService) {}

  @Post()
  async create(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(createOrgSchema)) dto: any,
  ) {
    return this.orgsService.createOrg(user.sub, dto);
  }

  @Get(':orgId')
  async findOne(@Param('orgId') orgId: string, @CurrentUser() user: JwtPayload) {
    return this.orgsService.getOrg(orgId, user.orgId);
  }

  @Patch(':orgId')
  async update(
    @Param('orgId') orgId: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(updateOrgSchema)) dto: any,
  ) {
    return this.orgsService.updateOrg(orgId, user.orgId, user.orgRole, dto);
  }

  @Post(':orgId/invite')
  async invite(
    @Param('orgId') orgId: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(generateInviteSchema)) dto: any,
  ) {
    return this.orgsService.generateInvite(orgId, user.sub, user.orgId, user.orgRole, dto);
  }

  @Post('join')
  async join(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(joinOrgSchema)) dto: any,
  ) {
    return this.orgsService.joinOrg(user.sub, dto);
  }

  @Get(':orgId/members')
  async listMembers(
    @Param('orgId') orgId: string,
    @CurrentUser() user: JwtPayload,
    @Query(new ZodValidationPipe(paginationParamsSchema)) query: any,
  ) {
    return this.orgsService.listMembers(orgId, user.orgId, query);
  }
}
