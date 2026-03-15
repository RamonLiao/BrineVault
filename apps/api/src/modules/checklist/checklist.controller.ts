import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { ChecklistService } from './checklist.service.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { createChecklistItemSchema, updateChecklistItemSchema } from './checklist.schemas.js';

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

@Controller()
export class ChecklistController {
  constructor(private readonly checklistService: ChecklistService) {}

  @Get('pools/:poolId/checklist')
  async get(
    @Param('poolId') poolId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.checklistService.getChecklist(poolId, user.orgId);
  }

  @Post('pools/:poolId/checklist')
  async add(
    @Param('poolId') poolId: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(createChecklistItemSchema)) dto: any,
  ) {
    return this.checklistService.addItem(poolId, user.orgId, dto);
  }

  @Patch('pools/:poolId/checklist/:itemId')
  async update(
    @Param('poolId') poolId: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(updateChecklistItemSchema)) dto: any,
  ) {
    return this.checklistService.updateItem(poolId, itemId, user.orgId, dto);
  }

  @Delete('pools/:poolId/checklist/:itemId')
  async remove(
    @Param('poolId') poolId: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.checklistService.deleteItem(poolId, itemId, user.orgId);
  }

  @Get('checklist-templates')
  async templates() {
    return this.checklistService.listTemplates();
  }
}
