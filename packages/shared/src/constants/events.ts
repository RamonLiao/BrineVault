// ========== Move Event Type Strings ==========
// Must match contracts/rwa_dataroom/sources/events.move struct names exactly.
// PACKAGE_ID is injected at runtime from config.

export const EVENT_TYPES = {
  POOL_CREATED: "PoolCreated",
  POOL_STATE_CHANGED: "PoolStateChanged",
  POOL_CANCELLED: "PoolCancelled",
  DATAROOM_CREATED: "DataRoomCreated",
  MEMBER_ADDED: "MemberAdded",
  MEMBER_REMOVED: "MemberRemoved",
  MEMBER_ROLE_UPDATED: "MemberRoleUpdated",
  DOCUMENT_CREATED: "DocumentCreated",
  DOCUMENT_VERSION_ADDED: "DocumentVersionAdded",
  DOCUMENT_REVIEWED: "DocumentReviewed",
  DOCUMENT_ARCHIVED: "DocumentArchived",
  IC_DECISION_CREATED: "ICDecisionCreated",
  FOLDER_CREATED: "FolderCreated",
  FOLDER_KEY_STORED: "FolderKeyStored",
  ADMIN_PAUSE_TOGGLED: "AdminPauseToggled",
  AUDIT_EVENT: "AuditEvent",
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];

/**
 * Build a fully qualified Sui event type string.
 * e.g. `0x1234::events::PoolCreated`
 */
export function suiEventType(packageId: string, eventName: EventType): string {
  return `${packageId}::events::${eventName}`;
}

/**
 * Build a map of all event type strings for a given package ID.
 */
export function allSuiEventTypes(
  packageId: string,
): Record<EventType, string> {
  const result = {} as Record<EventType, string>;
  for (const key of Object.keys(EVENT_TYPES) as (keyof typeof EVENT_TYPES)[]) {
    result[EVENT_TYPES[key]] = suiEventType(packageId, EVENT_TYPES[key]);
  }
  return result;
}
