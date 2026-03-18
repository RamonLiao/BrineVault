import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { SubscriptionsRepository, OrganizationsRepository } from '@rwa-dataroom/db';
import type { RenewSubscriptionDto, InvoicesQueryDto } from './billing.schemas.js';

@Injectable()
export class BillingService {
  constructor(
    @Inject(SubscriptionsRepository) private readonly subsRepo: SubscriptionsRepository,
    @Inject(OrganizationsRepository) private readonly orgsRepo: OrganizationsRepository,
  ) {}

  private assertOrgAccess(orgId: string, userOrgId: string | null) {
    if (userOrgId !== orgId) {
      throw new ForbiddenException({ code: 'NOT_IN_ORG', message: 'Not a member of this organization' });
    }
  }

  async getSubscription(orgId: string, userOrgId: string | null) {
    this.assertOrgAccess(orgId, userOrgId);
    const sub = await this.subsRepo.findByOrgId(orgId);
    if (!sub) throw new NotFoundException({ code: 'SUBSCRIPTION_NOT_FOUND', message: 'No subscription found' });
    return sub;
  }

  async renewSubscription(orgId: string, userOrgId: string | null, dto: RenewSubscriptionDto) {
    this.assertOrgAccess(orgId, userOrgId);
    const now = new Date();
    let sub = await this.subsRepo.findByOrgId(orgId);
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + dto.durationMonths);

    if (!sub) {
      sub = await this.subsRepo.create({
        orgId, plan: dto.plan, status: 'active',
        currentPeriodStart: now, currentPeriodEnd: periodEnd,
        amount: '0', currency: 'SGD',
      });
    } else {
      const rows = await this.subsRepo.update(sub.id, {
        plan: dto.plan, status: 'active',
        currentPeriodStart: now, currentPeriodEnd: periodEnd,
      });
      sub = rows[0] ?? sub;
    }

    const dueAt = new Date(now);
    dueAt.setDate(dueAt.getDate() + 30);
    const invoice = await this.subsRepo.createInvoice({
      orgId, subscriptionId: sub.id,
      amount: sub.amount ?? '0', currency: sub.currency ?? 'SGD',
      status: 'pending', dueAt,
    });
    return { subscription: sub, invoice };
  }

  async listInvoices(orgId: string, userOrgId: string | null, query: InvoicesQueryDto) {
    this.assertOrgAccess(orgId, userOrgId);
    const offset = (query.page - 1) * query.limit;
    const data = await this.subsRepo.findInvoicesByOrgId(orgId, { limit: query.limit, offset });
    return { data, page: query.page, limit: query.limit };
  }

  async getInvoice(orgId: string, invoiceId: string, userOrgId: string | null) {
    this.assertOrgAccess(orgId, userOrgId);
    const invoice = await this.subsRepo.findInvoiceById(invoiceId);
    if (!invoice) throw new NotFoundException({ code: 'INVOICE_NOT_FOUND', message: 'Invoice not found' });
    if (invoice.orgId !== orgId) throw new ForbiddenException({ code: 'NOT_IN_ORG', message: 'Invoice does not belong to this org' });
    return invoice;
  }

  async payInvoice(orgId: string, invoiceId: string, userOrgId: string | null) {
    this.assertOrgAccess(orgId, userOrgId);
    const invoice = await this.subsRepo.findInvoiceById(invoiceId);
    if (!invoice) throw new NotFoundException({ code: 'INVOICE_NOT_FOUND', message: 'Invoice not found' });
    if (invoice.orgId !== orgId) throw new ForbiddenException({ code: 'NOT_IN_ORG', message: 'Invoice does not belong to this org' });
    if (invoice.status === 'paid' || invoice.status === 'cancelled') {
      throw new BadRequestException({ code: 'INVOICE_NOT_PAYABLE', message: `Invoice is already ${invoice.status}` });
    }
    const rows = await this.subsRepo.updateInvoice(invoiceId, { status: 'paid', paidAt: new Date() });
    return rows[0] ?? invoice;
  }
}
