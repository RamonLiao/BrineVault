import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PoolsRepository, DataroomsRepository, MembersRepository } from '@rwa-dataroom/db';
import { SUI_TX_SERVICE } from '../../common/constants.js';
import type { SuiTxService } from '../../infra/sui/sui-tx.service.js';
import type { CreatePoolDto, TransitionPoolDto, CancelPoolDto, SubmitSignedTxDto } from './pools.schemas.js';

@Injectable()
export class PoolsService {
  constructor(
    @Inject(PoolsRepository) private readonly poolsRepo: PoolsRepository,
    @Inject(DataroomsRepository) private readonly dataroomsRepo: DataroomsRepository,
    @Inject(MembersRepository) private readonly membersRepo: MembersRepository,
    @Inject(SUI_TX_SERVICE) private readonly suiTx: SuiTxService,
  ) {}

  async buildCreatePool(senderAddress: string, dto: CreatePoolDto) {
    return this.suiTx.buildCreatePoolTx({
      senderAddress,
      adminConfigId: dto.adminConfigId,
      orgIdHash: dto.orgIdHash,
      name: dto.name,
      borrowerNameHash: dto.borrowerNameHash,
      currency: dto.currency,
      targetNotional: dto.targetNotional,
      expectedMaturityDate: dto.expectedMaturityDate,
      encryptionScheme: dto.encryptionScheme,
      tags: dto.tags,
    });
  }

  async listPools(orgId: string, userOrgId: string | null, query: { page: number; limit: number }) {
    if (userOrgId !== orgId) {
      throw new ForbiddenException({ code: 'NOT_IN_ORG', message: 'Not a member of this organization' });
    }
    const offset = (query.page - 1) * query.limit;
    const [data, total] = await Promise.all([
      this.poolsRepo.findByOrgId(orgId, { limit: query.limit, offset }),
      this.poolsRepo.countByOrgId(orgId),
    ]);
    return { data, total, page: query.page, limit: query.limit };
  }

  async getPool(poolId: string, userAddress: string, userOrgId: string | null) {
    const pool = await this.poolsRepo.findById(poolId);
    if (!pool) {
      throw new NotFoundException({ code: 'POOL_NOT_FOUND', message: 'Pool not found' });
    }
    if (userOrgId !== pool.orgId) {
      throw new ForbiddenException({ code: 'NOT_IN_ORG', message: 'Not a member of this organization' });
    }
    const dataroom = await this.dataroomsRepo.findByPoolId(poolId);
    if (dataroom) {
      const membership = await this.membersRepo.findByDataroomAndAddress(dataroom.id, userAddress);
      if (!membership || !membership.isActive) {
        throw new ForbiddenException({ code: 'NOT_DATAROOM_MEMBER', message: 'Not a member of this dataroom' });
      }
    }
    return pool;
  }

  async buildTransition(poolId: string, senderAddress: string, userOrgId: string | null, dto: TransitionPoolDto) {
    const pool = await this.poolsRepo.findById(poolId);
    if (!pool) {
      throw new NotFoundException({ code: 'POOL_NOT_FOUND', message: 'Pool not found' });
    }
    if (userOrgId !== pool.orgId) {
      throw new ForbiddenException({ code: 'NOT_IN_ORG', message: 'Not a member of this organization' });
    }
    return this.suiTx.buildStateTransitionTx({
      senderAddress,
      adminConfigId: dto.adminConfigId,
      poolObjectId: pool.suiObjectId,
      targetFunction: dto.targetFunction,
      extraArgs: dto.extraArgs,
    });
  }

  async buildCancel(poolId: string, senderAddress: string, userOrgId: string | null, dto: CancelPoolDto) {
    const pool = await this.poolsRepo.findById(poolId);
    if (!pool) {
      throw new NotFoundException({ code: 'POOL_NOT_FOUND', message: 'Pool not found' });
    }
    if (userOrgId !== pool.orgId) {
      throw new ForbiddenException({ code: 'NOT_IN_ORG', message: 'Not a member of this organization' });
    }
    return this.suiTx.buildCancelPoolTx({
      senderAddress,
      adminConfigId: dto.adminConfigId,
      poolObjectId: pool.suiObjectId,
    });
  }

  async submitSignedTx(dto: SubmitSignedTxDto) {
    return this.suiTx.submitSignedTx(dto);
  }
}
