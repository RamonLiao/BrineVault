import { Controller, Get, Post, Param, Query, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { BillingService } from './billing.service.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { renewSubscriptionSchema, invoicesQuerySchema } from './billing.schemas.js';

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
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('orgs/:orgId/subscription')
  async getSubscription(@Param('orgId') orgId: string, @CurrentUser() user: JwtPayload) {
    return this.billingService.getSubscription(orgId, user.orgId);
  }

  @Post('orgs/:orgId/subscription/renew')
  async renewSubscription(
    @Param('orgId') orgId: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(renewSubscriptionSchema)) dto: any,
  ) {
    return this.billingService.renewSubscription(orgId, user.orgId, dto);
  }

  @Get('orgs/:orgId/invoices')
  async listInvoices(
    @Param('orgId') orgId: string,
    @CurrentUser() user: JwtPayload,
    @Query(new ZodValidationPipe(invoicesQuerySchema)) query: any,
  ) {
    return this.billingService.listInvoices(orgId, user.orgId, query);
  }

  @Get('orgs/:orgId/invoices/:id')
  async getInvoice(
    @Param('orgId') orgId: string,
    @Param('id') invoiceId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.billingService.getInvoice(orgId, invoiceId, user.orgId);
  }

  @Post('orgs/:orgId/invoices/:id/pay')
  @HttpCode(HttpStatus.OK)
  async payInvoice(
    @Param('orgId') orgId: string,
    @Param('id') invoiceId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.billingService.payInvoice(orgId, invoiceId, user.orgId);
  }
}
