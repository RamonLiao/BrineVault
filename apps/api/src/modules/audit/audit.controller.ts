import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuditService } from './audit.service.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { auditQuerySchema } from './audit.schemas.js';
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

@Controller()
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('pools/:poolId/audit')
  async getPoolAudit(
    @Param('poolId') poolId: string,
    @CurrentUser() user: JwtPayload,
    @Query(new ZodValidationPipe(auditQuerySchema)) query: any,
  ) {
    return this.auditService.getPoolAudit(poolId, user.orgId, query);
  }

  @Get('pools/:poolId/audit/export')
  async exportPoolAudit(
    @Param('poolId') poolId: string,
    @CurrentUser() user: JwtPayload,
    @Query('format') format: string = 'json',
    @Res({ passthrough: true }) res: Response,
  ) {
    const fmt = format === 'csv' ? 'csv' : ('json' as const);
    const result = await this.auditService.exportPoolAudit(poolId, user.orgId, fmt);

    if (fmt === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="audit-${poolId}.csv"`);
      return result;
    }
    return result;
  }

  @Get('audit/me')
  async getMyActivity(
    @CurrentUser() user: JwtPayload,
    @Query(new ZodValidationPipe(paginationParamsSchema)) query: any,
  ) {
    return this.auditService.getMyActivity(user.address, query);
  }
}
