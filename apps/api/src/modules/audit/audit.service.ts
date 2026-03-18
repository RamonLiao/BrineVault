import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PoolsRepository, AuditEventsRepository } from '@rwa-dataroom/db';
import type { AuditQueryDto } from './audit.schemas.js';

@Injectable()
export class AuditService {
  constructor(
    @Inject(PoolsRepository) private readonly poolsRepo: PoolsRepository,
    @Inject(AuditEventsRepository) private readonly auditRepo: AuditEventsRepository,
  ) {}

  async getPoolAudit(poolId: string, userOrgId: string | null, query: AuditQueryDto) {
    const pool = await this.poolsRepo.findById(poolId);
    if (!pool) throw new NotFoundException({ code: 'POOL_NOT_FOUND', message: 'Pool not found' });
    if (userOrgId !== pool.orgId) throw new ForbiddenException({ code: 'NOT_IN_ORG', message: 'Not a member of this organization' });

    const offset = (query.page - 1) * query.limit;
    const events = await this.auditRepo.findByPoolId(poolId, { limit: query.limit, offset });
    return { data: events, page: query.page, limit: query.limit };
  }

  async exportPoolAudit(poolId: string, userOrgId: string | null, format: 'json' | 'csv') {
    const pool = await this.poolsRepo.findById(poolId);
    if (!pool) throw new NotFoundException({ code: 'POOL_NOT_FOUND', message: 'Pool not found' });
    if (userOrgId !== pool.orgId) throw new ForbiddenException({ code: 'NOT_IN_ORG', message: 'Not a member of this organization' });

    const events = await this.auditRepo.findByPoolId(poolId, { limit: 10000, offset: 0 });

    if (format === 'csv') {
      return this.toCsv(events);
    }
    return events;
  }

  async getMyActivity(userAddress: string, query: { page: number; limit: number }) {
    const offset = (query.page - 1) * query.limit;
    const events = await this.auditRepo.findByActorAddress(userAddress, { limit: query.limit, offset });
    return { data: events, page: query.page, limit: query.limit };
  }

  private toCsv(events: any[]): string {
    if (events.length === 0) return '';
    const headers = ['id', 'poolId', 'eventType', 'actorAddress', 'targetId', 'timestamp', 'suiTxDigest'];
    const rows = events.map((e) =>
      headers.map((h) => {
        const val = e[h];
        if (val === null || val === undefined) return '';
        const str = String(val);
        return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(','),
    );
    return [headers.join(','), ...rows].join('\n');
  }
}
