import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PoolsRepository, DataroomsRepository, MembersRepository } from '@rwa-dataroom/db';
import { SUI_TX_SERVICE } from '../../common/constants.js';
import type { SuiTxService } from '../../infra/sui/sui-tx.service.js';
import type { AddMemberDto, RemoveMemberDto, UpdateMemberRoleDto, CreateFolderDto } from './datarooms.schemas.js';

@Injectable()
export class DataroomsService {
  constructor(
    @Inject(PoolsRepository) private readonly poolsRepo: PoolsRepository,
    @Inject(DataroomsRepository) private readonly dataroomsRepo: DataroomsRepository,
    @Inject(MembersRepository) private readonly membersRepo: MembersRepository,
    @Inject(SUI_TX_SERVICE) private readonly suiTx: SuiTxService,
  ) {}

  async getDataroom(poolId: string, userAddress: string, userOrgId: string | null) {
    const pool = await this.poolsRepo.findById(poolId);
    if (!pool) {
      throw new NotFoundException({ code: 'POOL_NOT_FOUND', message: 'Pool not found' });
    }
    if (userOrgId !== pool.orgId) {
      throw new ForbiddenException({ code: 'NOT_IN_ORG', message: 'Not a member of this organization' });
    }
    const dataroom = await this.dataroomsRepo.findByPoolId(poolId);
    if (!dataroom) {
      throw new NotFoundException({ code: 'DATAROOM_NOT_FOUND', message: 'Dataroom not found' });
    }
    const members = await this.membersRepo.findActiveByPoolId(poolId);
    return { dataroom, members };
  }

  async buildAddMember(
    poolId: string,
    senderAddress: string,
    userOrgId: string | null,
    dto: AddMemberDto,
  ) {
    const pool = await this.poolsRepo.findById(poolId);
    if (!pool) {
      throw new NotFoundException({ code: 'POOL_NOT_FOUND', message: 'Pool not found' });
    }
    if (userOrgId !== pool.orgId) {
      throw new ForbiddenException({ code: 'NOT_IN_ORG', message: 'Not a member of this organization' });
    }
    return this.suiTx.buildAddMemberTx({
      senderAddress,
      adminConfigId: dto.adminConfigId,
      poolObjectId: pool.suiObjectId,
      memberAddress: dto.address,
      role: dto.role,
      tags: dto.tags,
    });
  }

  async buildRemoveMember(
    poolId: string,
    memberAddress: string,
    senderAddress: string,
    userOrgId: string | null,
    dto: RemoveMemberDto,
  ) {
    const pool = await this.poolsRepo.findById(poolId);
    if (!pool) {
      throw new NotFoundException({ code: 'POOL_NOT_FOUND', message: 'Pool not found' });
    }
    if (userOrgId !== pool.orgId) {
      throw new ForbiddenException({ code: 'NOT_IN_ORG', message: 'Not a member of this organization' });
    }
    return this.suiTx.buildRemoveMemberTx({
      senderAddress,
      adminConfigId: dto.adminConfigId,
      poolObjectId: pool.suiObjectId,
      memberAddress,
    });
  }

  async buildUpdateMemberRole(
    poolId: string,
    memberAddress: string,
    senderAddress: string,
    userOrgId: string | null,
    dto: UpdateMemberRoleDto,
  ) {
    const pool = await this.poolsRepo.findById(poolId);
    if (!pool) {
      throw new NotFoundException({ code: 'POOL_NOT_FOUND', message: 'Pool not found' });
    }
    if (userOrgId !== pool.orgId) {
      throw new ForbiddenException({ code: 'NOT_IN_ORG', message: 'Not a member of this organization' });
    }
    return this.suiTx.buildUpdateMemberRoleTx({
      senderAddress,
      adminConfigId: dto.adminConfigId,
      poolObjectId: pool.suiObjectId,
      memberAddress,
      newRole: dto.newRole,
    });
  }

  async buildCreateFolder(
    poolId: string,
    senderAddress: string,
    userOrgId: string | null,
    dto: CreateFolderDto,
  ) {
    const pool = await this.poolsRepo.findById(poolId);
    if (!pool) {
      throw new NotFoundException({ code: 'POOL_NOT_FOUND', message: 'Pool not found' });
    }
    if (userOrgId !== pool.orgId) {
      throw new ForbiddenException({ code: 'NOT_IN_ORG', message: 'Not a member of this organization' });
    }
    return this.suiTx.buildCreateFolderTx({
      senderAddress,
      adminConfigId: dto.adminConfigId,
      poolObjectId: pool.suiObjectId,
      name: dto.name,
      parentId: dto.parentId,
      visibleToRoles: dto.visibleToRoles,
    });
  }
}
