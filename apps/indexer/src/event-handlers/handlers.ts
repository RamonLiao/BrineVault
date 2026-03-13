import {
  PoolsRepository,
  DataroomsRepository,
  MembersRepository,
  DocumentsRepository,
  DocumentVersionsRepository,
  DocumentReviewsRepository,
  ICDecisionsRepository,
  AuditEventsRepository,
} from "@rwa-dataroom/db";
import type { EventContext } from "./types.js";

// Helper to extract parsedJson fields safely
function fields(ctx: EventContext): Record<string, unknown> {
  return (ctx.event.parsedJson as Record<string, unknown>) ?? {};
}

// ========== Pool Events ==========

export async function handlePoolCreated(ctx: EventContext): Promise<void> {
  const f = fields(ctx);
  const repo = new PoolsRepository(ctx.db);
  const auditRepo = new AuditEventsRepository(ctx.db);

  // We need an org_id but PoolCreated only has org_id_hash.
  // The org mapping must be done by the API layer. For now, we skip
  // org_id and let it be updated later, or require the API to pre-create.
  // Actually per schema, org_id is NOT NULL, so we need a placeholder approach.
  // The API should create the pool row with org_id before the TX,
  // then the indexer updates it. But per spec, indexer is the sole writer.
  // For now, use a sentinel org_id that the API ensures exists.
  await repo.insertFromEvent({
    suiObjectId: f.pool_id as string,
    orgId: "00000000-0000-0000-0000-000000000000", // Placeholder, updated by API reconciliation
    name: f.name as string,
    currentState: 0,
    encryptionScheme: Number(f.encryption_scheme ?? 0),
    createdByAddress: f.created_by as string,
    suiTxDigest: ctx.txDigest,
  });

  await auditRepo.insertFromEvent({
    poolId: undefined, // Will be linked after pool ID resolution
    eventType: "PoolCreated",
    actorAddress: f.created_by as string,
    targetId: f.pool_id as string,
    metadata: { name: f.name, encryption_scheme: f.encryption_scheme },
    suiTxDigest: ctx.txDigest,
    suiEventSeq: ctx.eventSeq,
  });

  await ctx.cache.invalidatePool(f.pool_id as string);
}

export async function handlePoolStateChanged(ctx: EventContext): Promise<void> {
  const f = fields(ctx);
  const repo = new PoolsRepository(ctx.db);
  const auditRepo = new AuditEventsRepository(ctx.db);

  await repo.updateStateFromEvent(
    f.pool_id as string,
    Number(f.to_state),
    ctx.txDigest,
  );

  await auditRepo.insertFromEvent({
    eventType: "PoolStateChanged",
    actorAddress: f.actor as string,
    targetId: f.pool_id as string,
    metadata: { from_state: f.from_state, to_state: f.to_state },
    suiTxDigest: ctx.txDigest,
    suiEventSeq: ctx.eventSeq,
  });

  await ctx.cache.invalidatePool(f.pool_id as string);
}

// ========== DataRoom Events ==========

export async function handleDataRoomCreated(ctx: EventContext): Promise<void> {
  const f = fields(ctx);
  const repo = new DataroomsRepository(ctx.db);
  const auditRepo = new AuditEventsRepository(ctx.db);

  // Find pool by sui_object_id to get internal pool UUID
  const poolRepo = new PoolsRepository(ctx.db);
  const pool = await poolRepo.findBySuiObjectId(f.pool_id as string);

  await repo.insertFromEvent({
    suiObjectId: f.dataroom_id as string,
    poolId: pool?.id ?? "00000000-0000-0000-0000-000000000000",
    ownerAddress: f.owner as string,
  });

  await auditRepo.insertFromEvent({
    poolId: pool?.id,
    eventType: "DataRoomCreated",
    actorAddress: f.owner as string,
    targetId: f.dataroom_id as string,
    suiTxDigest: ctx.txDigest,
    suiEventSeq: ctx.eventSeq,
  });
}

// ========== Member Events ==========

export async function handleMemberAdded(ctx: EventContext): Promise<void> {
  const f = fields(ctx);
  const repo = new MembersRepository(ctx.db);
  const dataroomRepo = new DataroomsRepository(ctx.db);
  const auditRepo = new AuditEventsRepository(ctx.db);

  const dataroom = await dataroomRepo.findBySuiObjectId(f.dataroom_id as string);
  if (!dataroom) return;

  await repo.upsertFromEvent({
    dataroomId: dataroom.id,
    poolId: dataroom.poolId,
    memberAddress: f.member as string,
    role: Number(f.role),
    addedByAddress: f.added_by as string,
  });

  await auditRepo.insertFromEvent({
    poolId: dataroom.poolId,
    eventType: "MemberAdded",
    actorAddress: f.added_by as string,
    targetId: f.member as string,
    metadata: { role: f.role, dataroom_id: f.dataroom_id },
    suiTxDigest: ctx.txDigest,
    suiEventSeq: ctx.eventSeq,
  });

  await ctx.cache.invalidateMembers(dataroom.poolId);
}

export async function handleMemberRemoved(ctx: EventContext): Promise<void> {
  const f = fields(ctx);
  const repo = new MembersRepository(ctx.db);
  const dataroomRepo = new DataroomsRepository(ctx.db);
  const auditRepo = new AuditEventsRepository(ctx.db);

  const dataroom = await dataroomRepo.findBySuiObjectId(f.dataroom_id as string);
  if (!dataroom) return;

  await repo.deactivate(dataroom.id, f.member as string);

  await auditRepo.insertFromEvent({
    poolId: dataroom.poolId,
    eventType: "MemberRemoved",
    actorAddress: f.removed_by as string,
    targetId: f.member as string,
    metadata: { dataroom_id: f.dataroom_id },
    suiTxDigest: ctx.txDigest,
    suiEventSeq: ctx.eventSeq,
  });

  await ctx.cache.invalidateMembers(dataroom.poolId);
}

export async function handleMemberRoleUpdated(ctx: EventContext): Promise<void> {
  const f = fields(ctx);
  const repo = new MembersRepository(ctx.db);
  const dataroomRepo = new DataroomsRepository(ctx.db);
  const auditRepo = new AuditEventsRepository(ctx.db);

  const dataroom = await dataroomRepo.findBySuiObjectId(f.dataroom_id as string);
  if (!dataroom) return;

  await repo.updateRole(dataroom.id, f.member as string, Number(f.new_role));

  await auditRepo.insertFromEvent({
    poolId: dataroom.poolId,
    eventType: "MemberRoleUpdated",
    actorAddress: f.actor as string,
    targetId: f.member as string,
    metadata: { old_role: f.old_role, new_role: f.new_role },
    suiTxDigest: ctx.txDigest,
    suiEventSeq: ctx.eventSeq,
  });

  await ctx.cache.invalidateMembers(dataroom.poolId);
}

// ========== Document Events ==========

export async function handleDocumentCreated(ctx: EventContext): Promise<void> {
  const f = fields(ctx);
  const docRepo = new DocumentsRepository(ctx.db);
  const versionRepo = new DocumentVersionsRepository(ctx.db);
  const poolRepo = new PoolsRepository(ctx.db);
  const dataroomRepo = new DataroomsRepository(ctx.db);
  const auditRepo = new AuditEventsRepository(ctx.db);

  const pool = await poolRepo.findBySuiObjectId(f.pool_id as string);
  if (!pool) return;

  const dataroom = await dataroomRepo.findByPoolId(pool.id);
  if (!dataroom) return;

  const doc = await docRepo.insertFromEvent({
    suiObjectId: f.doc_id as string,
    poolId: pool.id,
    dataroomId: dataroom.id,
    folderId: BigInt(f.folder_id as string),
    docType: Number(f.doc_type ?? 0),
    title: f.title as string,
    currentVersion: Number(f.version ?? 1),
    versionCount: 1,
    encryptionScheme: pool.encryptionScheme,
  });

  if (doc) {
    await versionRepo.insertFromEvent({
      documentId: doc.id,
      version: Number(f.version ?? 1),
      walrusBlobId: f.blob_id as string,
      contentHash: f.content_hash as string,
      uploadedByAddress: f.uploader as string,
    });
  }

  await auditRepo.insertFromEvent({
    poolId: pool.id,
    eventType: "DocumentCreated",
    actorAddress: f.uploader as string,
    targetId: f.doc_id as string,
    metadata: { title: f.title, folder_id: f.folder_id },
    suiTxDigest: ctx.txDigest,
    suiEventSeq: ctx.eventSeq,
  });

  await ctx.cache.invalidatePool(pool.id);
}

export async function handleDocumentVersionAdded(ctx: EventContext): Promise<void> {
  const f = fields(ctx);
  const docRepo = new DocumentsRepository(ctx.db);
  const versionRepo = new DocumentVersionsRepository(ctx.db);
  const auditRepo = new AuditEventsRepository(ctx.db);

  const doc = await docRepo.findBySuiObjectId(f.doc_id as string);
  if (!doc) return;

  await versionRepo.insertFromEvent({
    documentId: doc.id,
    version: Number(f.version),
    walrusBlobId: f.blob_id as string,
    contentHash: f.content_hash as string,
    uploadedByAddress: f.uploader as string,
  });

  await docRepo.updateVersionInfo(f.doc_id as string, Number(f.version));

  await auditRepo.insertFromEvent({
    poolId: doc.poolId,
    eventType: "DocumentVersionAdded",
    actorAddress: f.uploader as string,
    targetId: f.doc_id as string,
    metadata: { version: f.version },
    suiTxDigest: ctx.txDigest,
    suiEventSeq: ctx.eventSeq,
  });

  await ctx.cache.invalidatePool(doc.poolId);
}

export async function handleDocumentReviewed(ctx: EventContext): Promise<void> {
  const f = fields(ctx);
  const reviewRepo = new DocumentReviewsRepository(ctx.db);
  const docRepo = new DocumentsRepository(ctx.db);
  const auditRepo = new AuditEventsRepository(ctx.db);

  const doc = await docRepo.findBySuiObjectId(f.doc_id as string);
  if (!doc) return;

  await reviewRepo.upsertFromEvent({
    documentId: doc.id,
    reviewerAddress: f.reviewer as string,
    status: Number(f.status),
  });

  await auditRepo.insertFromEvent({
    poolId: doc.poolId,
    eventType: "DocumentReviewed",
    actorAddress: f.reviewer as string,
    targetId: f.doc_id as string,
    metadata: { status: f.status },
    suiTxDigest: ctx.txDigest,
    suiEventSeq: ctx.eventSeq,
  });
}

// ========== IC Decision Events ==========

export async function handleICDecisionCreated(ctx: EventContext): Promise<void> {
  const f = fields(ctx);
  const icRepo = new ICDecisionsRepository(ctx.db);
  const poolRepo = new PoolsRepository(ctx.db);
  const auditRepo = new AuditEventsRepository(ctx.db);

  const pool = await poolRepo.findBySuiObjectId(f.pool_id as string);
  if (!pool) return;

  await icRepo.insertFromEvent({
    poolId: pool.id,
    decisionIndex: Number(f.decision_index),
    decisionType: Number(f.decision_type),
    createdByAddress: f.created_by as string,
  });

  await auditRepo.insertFromEvent({
    poolId: pool.id,
    eventType: "ICDecisionCreated",
    actorAddress: f.created_by as string,
    metadata: {
      decision_index: f.decision_index,
      decision_type: f.decision_type,
    },
    suiTxDigest: ctx.txDigest,
    suiEventSeq: ctx.eventSeq,
  });

  await ctx.cache.invalidatePool(pool.id);
}

// ========== Audit Event (generic) ==========

export async function handleAuditEvent(ctx: EventContext): Promise<void> {
  const f = fields(ctx);
  const auditRepo = new AuditEventsRepository(ctx.db);
  const poolRepo = new PoolsRepository(ctx.db);

  const pool = await poolRepo.findBySuiObjectId(f.pool_id as string);

  await auditRepo.insertFromEvent({
    poolId: pool?.id,
    eventType: `AuditEvent:${f.action_type}`,
    actorAddress: f.actor as string,
    targetId: f.target_id as string | undefined,
    metadata: { metadata_hash: f.metadata_hash },
    suiTxDigest: ctx.txDigest,
    suiEventSeq: ctx.eventSeq,
  });
}
