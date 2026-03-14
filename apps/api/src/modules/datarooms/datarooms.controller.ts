import { Controller, Get, Post, Delete, Patch, Param, Body } from '@nestjs/common';
import { DataroomsService } from './datarooms.service.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import {
  addMemberSchema,
  removeMemberSchema,
  updateMemberRoleSchema,
  createFolderSchema,
} from './datarooms.schemas.js';

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

@Controller('pools/:poolId/dataroom')
export class DataroomsController {
  constructor(private readonly dataroomsService: DataroomsService) {}

  @Get()
  async getDataroom(@Param('poolId') poolId: string, @CurrentUser() user: JwtPayload) {
    return this.dataroomsService.getDataroom(poolId, user.address, user.orgId);
  }

  @Post('members')
  async addMember(
    @Param('poolId') poolId: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(addMemberSchema)) dto: any,
  ) {
    return this.dataroomsService.buildAddMember(poolId, user.address, user.orgId, dto);
  }

  @Delete('members/:address')
  async removeMember(
    @Param('poolId') poolId: string,
    @Param('address') address: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(removeMemberSchema)) dto: any,
  ) {
    return this.dataroomsService.buildRemoveMember(poolId, address, user.address, user.orgId, dto);
  }

  @Patch('members/:address')
  async updateMemberRole(
    @Param('poolId') poolId: string,
    @Param('address') address: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(updateMemberRoleSchema)) dto: any,
  ) {
    return this.dataroomsService.buildUpdateMemberRole(poolId, address, user.address, user.orgId, dto);
  }

  @Post('folders')
  async createFolder(
    @Param('poolId') poolId: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(createFolderSchema)) dto: any,
  ) {
    return this.dataroomsService.buildCreateFolder(poolId, user.address, user.orgId, dto);
  }
}
