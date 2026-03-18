import { Injectable } from '@nestjs/common';
import { SuiClient, type SuiTransactionBlockResponse } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';

export interface SuiTxConfig {
  rpcUrl: string;
  packageId: string;
  platformKeypair: any;
}

// Pool TX params
export interface BuildCreatePoolParams {
  senderAddress: string;
  adminConfigId: string;
  orgIdHash: string;
  name: string;
  borrowerNameHash: string;
  currency: string;
  targetNotional: string;
  expectedMaturityDate: number;
  encryptionScheme: number;
  tags: string[];
}

export interface BuildStateTransitionParams {
  senderAddress: string;
  adminConfigId: string;
  poolObjectId: string;
  targetFunction: string;
  extraArgs?: any[];
}

export interface BuildCancelPoolParams {
  senderAddress: string;
  adminConfigId: string;
  poolObjectId: string;
}

// DataRoom TX params
export interface BuildAddMemberParams {
  senderAddress: string;
  adminConfigId: string;
  poolObjectId: string;
  memberAddress: string;
  role: number;
  tags: string[];
}

export interface BuildRemoveMemberParams {
  senderAddress: string;
  adminConfigId: string;
  poolObjectId: string;
  memberAddress: string;
}

export interface BuildUpdateMemberRoleParams {
  senderAddress: string;
  adminConfigId: string;
  poolObjectId: string;
  memberAddress: string;
  newRole: number;
}

export interface BuildCreateFolderParams {
  senderAddress: string;
  adminConfigId: string;
  poolObjectId: string;
  name: string;
  parentId?: number;
  visibleToRoles: number;
}

// Document TX params
export interface BuildCreateDocumentParams {
  senderAddress: string;
  adminConfigId: string;
  poolObjectId: string;
  folderId: number;
  docType: number;
  title: string;
  requiredFlag: boolean;
  visibleToRoles: number;
  walrusBlobId: string;
  contentHash: string;
  sizeBytes: number;
  changeLog: string;
  tags: string[];
}

export interface BuildAddVersionParams {
  senderAddress: string;
  adminConfigId: string;
  poolObjectId: string;
  docObjectId: string;
  walrusBlobId: string;
  contentHash: string;
  sizeBytes: number;
  changeLog: string;
}

export interface BuildArchiveDocumentParams {
  senderAddress: string;
  adminConfigId: string;
  poolObjectId: string;
  docObjectId: string;
}

// Review TX params
export interface BuildSubmitReviewParams {
  senderAddress: string;
  adminConfigId: string;
  poolObjectId: string;
  docObjectId: string;
  status: number;
  commentHash?: string; // 64-char hex, optional
}

// IC Decision TX params (shared shape for all 3 variants)
export interface BuildRecordIcDecisionParams {
  senderAddress: string;
  adminConfigId: string;
  poolObjectId: string;
  decisionText: string;
  pdfBlobId: string;
  committeeMembers: string[];
  votes: number[];
  relatedDocIds: string[];
}

export interface SubmitSignedTxParams {
  txBytes: string;
  signature: string;
}

@Injectable()
export class SuiTxService {
  private client: SuiClient;
  private packageId: string;
  private platformKeypair: any;

  constructor(config: SuiTxConfig) {
    this.client = new SuiClient({ url: config.rpcUrl });
    this.packageId = config.packageId;
    this.platformKeypair = config.platformKeypair;
  }

  // ─── Pool TXs ─────────────────────────────────────────────────

  async buildCreatePoolTx(params: BuildCreatePoolParams) {
    const tx = new Transaction();
    tx.setSender(params.senderAddress);

    tx.moveCall({
      target: `${this.packageId}::pool::create_pool`,
      arguments: [
        tx.object(params.adminConfigId),
        tx.pure.vector('u8', this.hexToBytes(params.orgIdHash)),
        tx.pure.string(params.name),
        tx.pure.vector('u8', this.hexToBytes(params.borrowerNameHash)),
        tx.pure.string(params.currency),
        tx.pure.u64(BigInt(params.targetNotional)),
        tx.pure.u64(BigInt(params.expectedMaturityDate)),
        tx.pure.u8(params.encryptionScheme),
        tx.pure.vector('string', params.tags),
        tx.object('0x6'), // Clock
      ],
    });

    const txBytes = await tx.build({ client: this.client });
    return { txBytes: Buffer.from(txBytes).toString('base64') };
  }

  async buildStateTransitionTx(params: BuildStateTransitionParams) {
    const tx = new Transaction();
    tx.setSender(params.senderAddress);

    const args = [
      tx.object(params.adminConfigId),
      tx.object(params.poolObjectId),
      ...(params.extraArgs ?? []),
      tx.object('0x6'),
    ];

    tx.moveCall({
      target: `${this.packageId}::pool_entry::${params.targetFunction}`,
      arguments: args,
    });

    const txBytes = await tx.build({ client: this.client });
    return { txBytes: Buffer.from(txBytes).toString('base64') };
  }

  async buildCancelPoolTx(params: BuildCancelPoolParams) {
    return this.buildStateTransitionTx({
      senderAddress: params.senderAddress,
      adminConfigId: params.adminConfigId,
      poolObjectId: params.poolObjectId,
      targetFunction: 'cancel_pool',
    });
  }

  // ─── DataRoom TXs ─────────────────────────────────────────────

  async buildAddMemberTx(params: BuildAddMemberParams) {
    const tx = new Transaction();
    tx.setSender(params.senderAddress);

    tx.moveCall({
      target: `${this.packageId}::dataroom_entry::add_member`,
      arguments: [
        tx.object(params.adminConfigId),
        tx.object(params.poolObjectId),
        tx.pure.address(params.memberAddress),
        tx.pure.u8(params.role),
        tx.pure.vector('string', params.tags),
        tx.object('0x6'),
      ],
    });

    const txBytes = await tx.build({ client: this.client });
    return { txBytes: Buffer.from(txBytes).toString('base64') };
  }

  async buildRemoveMemberTx(params: BuildRemoveMemberParams) {
    const tx = new Transaction();
    tx.setSender(params.senderAddress);

    tx.moveCall({
      target: `${this.packageId}::dataroom_entry::remove_member`,
      arguments: [
        tx.object(params.adminConfigId),
        tx.object(params.poolObjectId),
        tx.pure.address(params.memberAddress),
        tx.object('0x6'),
      ],
    });

    const txBytes = await tx.build({ client: this.client });
    return { txBytes: Buffer.from(txBytes).toString('base64') };
  }

  async buildUpdateMemberRoleTx(params: BuildUpdateMemberRoleParams) {
    const tx = new Transaction();
    tx.setSender(params.senderAddress);

    tx.moveCall({
      target: `${this.packageId}::dataroom_entry::update_member_role`,
      arguments: [
        tx.object(params.adminConfigId),
        tx.object(params.poolObjectId),
        tx.pure.address(params.memberAddress),
        tx.pure.u8(params.newRole),
        tx.object('0x6'),
      ],
    });

    const txBytes = await tx.build({ client: this.client });
    return { txBytes: Buffer.from(txBytes).toString('base64') };
  }

  async buildCreateFolderTx(params: BuildCreateFolderParams) {
    const tx = new Transaction();
    tx.setSender(params.senderAddress);

    const parentArg =
      params.parentId !== undefined
        ? tx.pure.option('u64', BigInt(params.parentId))
        : tx.pure.option('u64', null);

    tx.moveCall({
      target: `${this.packageId}::dataroom_entry::create_custom_folder`,
      arguments: [
        tx.object(params.adminConfigId),
        tx.object(params.poolObjectId),
        tx.pure.string(params.name),
        parentArg,
        tx.pure.u8(params.visibleToRoles),
        tx.object('0x6'),
      ],
    });

    const txBytes = await tx.build({ client: this.client });
    return { txBytes: Buffer.from(txBytes).toString('base64') };
  }

  // ─── Document TXs ─────────────────────────────────────────────

  async buildCreateDocumentTx(params: BuildCreateDocumentParams) {
    const tx = new Transaction();
    tx.setSender(params.senderAddress);

    tx.moveCall({
      target: `${this.packageId}::document_entry::create_document`,
      arguments: [
        tx.object(params.adminConfigId),
        tx.object(params.poolObjectId),
        tx.pure.u64(BigInt(params.folderId)),
        tx.pure.u8(params.docType),
        tx.pure.string(params.title),
        tx.pure.bool(params.requiredFlag),
        tx.pure.u8(params.visibleToRoles),
        tx.pure.string(params.walrusBlobId),
        tx.pure.vector('u8', this.hexToBytes(params.contentHash)),
        tx.pure.u64(BigInt(params.sizeBytes)),
        tx.pure.string(params.changeLog),
        tx.pure.vector('string', params.tags),
        tx.object('0x6'),
      ],
    });

    const txBytes = await tx.build({ client: this.client });
    return { txBytes: Buffer.from(txBytes).toString('base64') };
  }

  async buildAddVersionTx(params: BuildAddVersionParams) {
    const tx = new Transaction();
    tx.setSender(params.senderAddress);

    tx.moveCall({
      target: `${this.packageId}::document_entry::add_version`,
      arguments: [
        tx.object(params.adminConfigId),
        tx.object(params.poolObjectId),
        tx.pure.id(params.docObjectId),
        tx.pure.string(params.walrusBlobId),
        tx.pure.vector('u8', this.hexToBytes(params.contentHash)),
        tx.pure.u64(BigInt(params.sizeBytes)),
        tx.pure.string(params.changeLog),
        tx.object('0x6'),
      ],
    });

    const txBytes = await tx.build({ client: this.client });
    return { txBytes: Buffer.from(txBytes).toString('base64') };
  }

  async buildArchiveDocumentTx(params: BuildArchiveDocumentParams) {
    const tx = new Transaction();
    tx.setSender(params.senderAddress);

    tx.moveCall({
      target: `${this.packageId}::document_entry::archive_document`,
      arguments: [
        tx.object(params.adminConfigId),
        tx.object(params.poolObjectId),
        tx.pure.id(params.docObjectId),
        tx.object('0x6'),
      ],
    });

    const txBytes = await tx.build({ client: this.client });
    return { txBytes: Buffer.from(txBytes).toString('base64') };
  }

  // ─── Review TXs ──────────────────────────────────────────────

  async buildSubmitReviewTx(params: BuildSubmitReviewParams) {
    const tx = new Transaction();
    tx.setSender(params.senderAddress);

    const commentHashArg = params.commentHash
      ? tx.pure.option('vector<u8>', this.hexToBytes(params.commentHash))
      : tx.pure.option('vector<u8>', null);

    tx.moveCall({
      target: `${this.packageId}::document_entry::submit_review`,
      arguments: [
        tx.object(params.adminConfigId),
        tx.object(params.poolObjectId),
        tx.pure.id(params.docObjectId),
        tx.pure.u8(params.status),
        commentHashArg,
        tx.object('0x6'), // Clock
      ],
    });

    const txBytes = await tx.build({ client: this.client });
    return { txBytes: Buffer.from(txBytes).toString('base64') };
  }

  // ─── IC Decision TXs ────────────────────────────────────────

  private async buildIcDecisionTx(
    targetFunction: string,
    params: BuildRecordIcDecisionParams,
  ) {
    const tx = new Transaction();
    tx.setSender(params.senderAddress);

    tx.moveCall({
      target: `${this.packageId}::pool_entry::${targetFunction}`,
      arguments: [
        tx.object(params.adminConfigId),
        tx.object(params.poolObjectId),
        tx.pure.string(params.decisionText),
        tx.pure.string(params.pdfBlobId),
        tx.pure.vector('address', params.committeeMembers),
        tx.pure.vector('u8', params.votes),
        tx.pure.vector('address', params.relatedDocIds),
        tx.object('0x6'), // Clock
      ],
    });

    const txBytes = await tx.build({ client: this.client });
    return { txBytes: Buffer.from(txBytes).toString('base64') };
  }

  async buildRecordIcApprovalTx(params: BuildRecordIcDecisionParams) {
    return this.buildIcDecisionTx('record_ic_approval', params);
  }

  async buildRecordIcRejectionTx(params: BuildRecordIcDecisionParams) {
    return this.buildIcDecisionTx('record_ic_rejection', params);
  }

  async buildRecordIcRequestChangesTx(params: BuildRecordIcDecisionParams) {
    return this.buildIcDecisionTx('record_ic_request_changes', params);
  }

  // ─── Submit signed TX ─────────────────────────────────────────

  async submitSignedTx(params: SubmitSignedTxParams): Promise<SuiTransactionBlockResponse> {
    return this.client.executeTransactionBlock({
      transactionBlock: params.txBytes,
      signature: params.signature,
      options: { showEffects: true, showEvents: true },
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────

  private hexToBytes(hex: string): number[] {
    const bytes: number[] = [];
    for (let i = 0; i < hex.length; i += 2) {
      bytes.push(parseInt(hex.substring(i, i + 2), 16));
    }
    return bytes;
  }
}
