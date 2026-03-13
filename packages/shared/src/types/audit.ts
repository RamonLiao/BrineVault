// ========== Action Types ==========
// Must match contracts/rwa_dataroom/sources/types.move exactly

export const ACTION_TYPES = {
  POOL_CREATED: 0,
  STATE_CHANGED: 1,
  MEMBER_ADDED: 2,
  MEMBER_REMOVED: 3,
  MEMBER_ROLE_UPDATED: 4,
  DOC_CREATED: 5,
  DOC_VERSION_ADDED: 6,
  DOC_REVIEWED: 7,
  DOC_ARCHIVED: 8,
  IC_DECISION: 9,
  FOLDER_CREATED: 10,
  POOL_CANCELLED: 11,
  PAUSE_TOGGLED: 12,
} as const;

export type ActionType = (typeof ACTION_TYPES)[keyof typeof ACTION_TYPES];

export const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  [ACTION_TYPES.POOL_CREATED]: "Pool Created",
  [ACTION_TYPES.STATE_CHANGED]: "State Changed",
  [ACTION_TYPES.MEMBER_ADDED]: "Member Added",
  [ACTION_TYPES.MEMBER_REMOVED]: "Member Removed",
  [ACTION_TYPES.MEMBER_ROLE_UPDATED]: "Member Role Updated",
  [ACTION_TYPES.DOC_CREATED]: "Document Created",
  [ACTION_TYPES.DOC_VERSION_ADDED]: "Document Version Added",
  [ACTION_TYPES.DOC_REVIEWED]: "Document Reviewed",
  [ACTION_TYPES.DOC_ARCHIVED]: "Document Archived",
  [ACTION_TYPES.IC_DECISION]: "IC Decision",
  [ACTION_TYPES.FOLDER_CREATED]: "Folder Created",
  [ACTION_TYPES.POOL_CANCELLED]: "Pool Cancelled",
  [ACTION_TYPES.PAUSE_TOGGLED]: "Pause Toggled",
};

export interface AuditEvent {
  poolId: string;
  actor: string;
  actionType: ActionType;
  targetId: string | null;
  timestamp: number;
  metadataHash: string | null;
}
