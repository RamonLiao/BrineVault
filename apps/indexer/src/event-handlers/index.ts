import { EVENT_TYPES, suiEventType } from "@rwa-dataroom/shared";
import type { EventHandler } from "./types.js";
import {
  handlePoolCreated,
  handlePoolStateChanged,
  handleDataRoomCreated,
  handleMemberAdded,
  handleMemberRemoved,
  handleMemberRoleUpdated,
  handleDocumentCreated,
  handleDocumentVersionAdded,
  handleDocumentReviewed,
  handleICDecisionCreated,
  handleAuditEvent,
} from "./handlers.js";

export type { EventContext, EventHandler } from "./types.js";

/**
 * Build an event type -> handler map for a given package ID.
 * 11 event types as specified in the architecture doc.
 */
export function buildEventHandlerMap(
  packageId: string,
): Map<string, EventHandler> {
  const map = new Map<string, EventHandler>();

  const register = (eventName: string, handler: EventHandler) => {
    map.set(suiEventType(packageId, eventName as any), handler);
  };

  register(EVENT_TYPES.POOL_CREATED, handlePoolCreated);
  register(EVENT_TYPES.POOL_STATE_CHANGED, handlePoolStateChanged);
  register(EVENT_TYPES.DATAROOM_CREATED, handleDataRoomCreated);
  register(EVENT_TYPES.MEMBER_ADDED, handleMemberAdded);
  register(EVENT_TYPES.MEMBER_REMOVED, handleMemberRemoved);
  register(EVENT_TYPES.MEMBER_ROLE_UPDATED, handleMemberRoleUpdated);
  register(EVENT_TYPES.DOCUMENT_CREATED, handleDocumentCreated);
  register(EVENT_TYPES.DOCUMENT_VERSION_ADDED, handleDocumentVersionAdded);
  register(EVENT_TYPES.DOCUMENT_REVIEWED, handleDocumentReviewed);
  register(EVENT_TYPES.IC_DECISION_CREATED, handleICDecisionCreated);
  register(EVENT_TYPES.AUDIT_EVENT, handleAuditEvent);

  return map;
}
