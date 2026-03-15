import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PoolsRepository, ICDecisionsRepository } from '@rwa-dataroom/db';
import { IC_DECISION_TYPES } from '@rwa-dataroom/shared';
import { SUI_TX_SERVICE } from '../../common/constants.js';
import type { SuiTxService } from '../../infra/sui/sui-tx.service.js';
import type { SubmitIcDecisionDto } from './ic-decisions.schemas.js';

@Injectable()
export class ICDecisionsService {
  constructor(
    @Inject(PoolsRepository) private readonly poolsRepo: PoolsRepository,
    @Inject(ICDecisionsRepository)
    private readonly icDecisionsRepo: ICDecisionsRepository,
    @Inject(SUI_TX_SERVICE) private readonly suiTx: SuiTxService,
  ) {}

  async buildSubmitDecision(
    poolId: string,
    senderAddress: string,
    userOrgId: string | null,
    dto: SubmitIcDecisionDto,
  ) {
    const pool = await this.poolsRepo.findById(poolId);
    if (!pool)
      throw new NotFoundException({ code: 'POOL_NOT_FOUND', message: 'Pool not found' });
    if (userOrgId !== pool.orgId)
      throw new ForbiddenException({
        code: 'NOT_IN_ORG',
        message: 'Not a member of this organization',
      });

    const txParams = {
      senderAddress,
      adminConfigId: dto.adminConfigId,
      poolObjectId: pool.suiObjectId,
      decisionText: dto.decisionText,
      pdfBlobId: dto.pdfBlobId,
      committeeMembers: dto.committeeMembers,
      votes: dto.votes,
      relatedDocIds: dto.relatedDocIds,
    };

    switch (dto.decisionType) {
      case IC_DECISION_TYPES.APPROVE:
        return this.suiTx.buildRecordIcApprovalTx(txParams);
      case IC_DECISION_TYPES.REJECT:
        return this.suiTx.buildRecordIcRejectionTx(txParams);
      case IC_DECISION_TYPES.REQUEST_CHANGES:
        return this.suiTx.buildRecordIcRequestChangesTx(txParams);
      default:
        throw new Error(`Unknown decision type: ${dto.decisionType}`);
    }
  }

  async listDecisions(poolId: string, userOrgId: string | null) {
    const pool = await this.poolsRepo.findById(poolId);
    if (!pool)
      throw new NotFoundException({ code: 'POOL_NOT_FOUND', message: 'Pool not found' });
    if (userOrgId !== pool.orgId)
      throw new ForbiddenException({
        code: 'NOT_IN_ORG',
        message: 'Not a member of this organization',
      });

    return this.icDecisionsRepo.findByPoolId(poolId);
  }

  async getDecision(poolId: string, index: number, userOrgId: string | null) {
    const pool = await this.poolsRepo.findById(poolId);
    if (!pool)
      throw new NotFoundException({ code: 'POOL_NOT_FOUND', message: 'Pool not found' });
    if (userOrgId !== pool.orgId)
      throw new ForbiddenException({
        code: 'NOT_IN_ORG',
        message: 'Not a member of this organization',
      });

    const decision = await this.icDecisionsRepo.findByPoolAndIndex(poolId, index);
    if (!decision)
      throw new NotFoundException({
        code: 'IC_DECISION_NOT_FOUND',
        message: 'IC decision not found',
      });

    return decision;
  }
}
