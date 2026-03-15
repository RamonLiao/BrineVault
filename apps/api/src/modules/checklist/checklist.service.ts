import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PoolsRepository, ChecklistRepository } from '@rwa-dataroom/db';
import type { CreateChecklistItemDto, UpdateChecklistItemDto } from './checklist.schemas.js';

@Injectable()
export class ChecklistService {
  constructor(
    @Inject(PoolsRepository) private readonly poolsRepo: PoolsRepository,
    @Inject(ChecklistRepository) private readonly checklistRepo: ChecklistRepository,
  ) {}

  private async assertPoolAccess(poolId: string, userOrgId: string | null) {
    const pool = await this.poolsRepo.findById(poolId);
    if (!pool) throw new NotFoundException({ code: 'POOL_NOT_FOUND', message: 'Pool not found' });
    if (userOrgId !== pool.orgId) throw new ForbiddenException({ code: 'NOT_IN_ORG', message: 'Not a member of this organization' });
    return pool;
  }

  async getChecklist(poolId: string, userOrgId: string | null) {
    await this.assertPoolAccess(poolId, userOrgId);
    return this.checklistRepo.findItemsByPoolId(poolId);
  }

  async addItem(poolId: string, userOrgId: string | null, dto: CreateChecklistItemDto) {
    await this.assertPoolAccess(poolId, userOrgId);
    return this.checklistRepo.createItem({ poolId, ...dto });
  }

  async updateItem(poolId: string, itemId: string, userOrgId: string | null, dto: UpdateChecklistItemDto) {
    await this.assertPoolAccess(poolId, userOrgId);
    const rows = await this.checklistRepo.updateItem(itemId, dto);
    if (!rows.length) throw new NotFoundException({ code: 'CHECKLIST_ITEM_NOT_FOUND', message: 'Checklist item not found' });
    return rows[0];
  }

  async deleteItem(poolId: string, itemId: string, userOrgId: string | null) {
    await this.assertPoolAccess(poolId, userOrgId);
    return this.checklistRepo.deleteItem(itemId);
  }

  async listTemplates() {
    return this.checklistRepo.findAllTemplates();
  }
}
