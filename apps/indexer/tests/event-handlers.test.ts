import { describe, it, expect } from "vitest";
import { buildEventHandlerMap } from "../src/event-handlers/index.js";
import { EVENT_TYPES, suiEventType } from "@rwa-dataroom/shared";

const TEST_PACKAGE_ID = "0xdeadbeef";

describe("buildEventHandlerMap", () => {
  const handlerMap = buildEventHandlerMap(TEST_PACKAGE_ID);

  it("registers handlers for all 11 event types", () => {
    expect(handlerMap.size).toBe(11);
  });

  it("maps PoolCreated event type correctly", () => {
    const key = suiEventType(TEST_PACKAGE_ID, EVENT_TYPES.POOL_CREATED);
    expect(key).toBe(`${TEST_PACKAGE_ID}::events::PoolCreated`);
    expect(handlerMap.has(key)).toBe(true);
    expect(typeof handlerMap.get(key)).toBe("function");
  });

  it("maps PoolStateChanged event type correctly", () => {
    const key = suiEventType(TEST_PACKAGE_ID, EVENT_TYPES.POOL_STATE_CHANGED);
    expect(handlerMap.has(key)).toBe(true);
  });

  it("maps DataRoomCreated event type correctly", () => {
    const key = suiEventType(TEST_PACKAGE_ID, EVENT_TYPES.DATAROOM_CREATED);
    expect(handlerMap.has(key)).toBe(true);
  });

  it("maps MemberAdded event type correctly", () => {
    const key = suiEventType(TEST_PACKAGE_ID, EVENT_TYPES.MEMBER_ADDED);
    expect(handlerMap.has(key)).toBe(true);
  });

  it("maps MemberRemoved event type correctly", () => {
    const key = suiEventType(TEST_PACKAGE_ID, EVENT_TYPES.MEMBER_REMOVED);
    expect(handlerMap.has(key)).toBe(true);
  });

  it("maps MemberRoleUpdated event type correctly", () => {
    const key = suiEventType(TEST_PACKAGE_ID, EVENT_TYPES.MEMBER_ROLE_UPDATED);
    expect(handlerMap.has(key)).toBe(true);
  });

  it("maps DocumentCreated event type correctly", () => {
    const key = suiEventType(TEST_PACKAGE_ID, EVENT_TYPES.DOCUMENT_CREATED);
    expect(handlerMap.has(key)).toBe(true);
  });

  it("maps DocumentVersionAdded event type correctly", () => {
    const key = suiEventType(TEST_PACKAGE_ID, EVENT_TYPES.DOCUMENT_VERSION_ADDED);
    expect(handlerMap.has(key)).toBe(true);
  });

  it("maps DocumentReviewed event type correctly", () => {
    const key = suiEventType(TEST_PACKAGE_ID, EVENT_TYPES.DOCUMENT_REVIEWED);
    expect(handlerMap.has(key)).toBe(true);
  });

  it("maps ICDecisionCreated event type correctly", () => {
    const key = suiEventType(TEST_PACKAGE_ID, EVENT_TYPES.IC_DECISION_CREATED);
    expect(handlerMap.has(key)).toBe(true);
  });

  it("maps AuditEvent event type correctly", () => {
    const key = suiEventType(TEST_PACKAGE_ID, EVENT_TYPES.AUDIT_EVENT);
    expect(handlerMap.has(key)).toBe(true);
  });

  it("does NOT register FolderCreated (not in the 11 core handlers)", () => {
    const key = suiEventType(TEST_PACKAGE_ID, EVENT_TYPES.FOLDER_CREATED);
    expect(handlerMap.has(key)).toBe(false);
  });

  it("does NOT register AdminPauseToggled", () => {
    const key = suiEventType(TEST_PACKAGE_ID, EVENT_TYPES.ADMIN_PAUSE_TOGGLED);
    expect(handlerMap.has(key)).toBe(false);
  });

  it("returns null for unknown event types", () => {
    const key = `${TEST_PACKAGE_ID}::events::NonExistentEvent`;
    expect(handlerMap.has(key)).toBe(false);
    expect(handlerMap.get(key)).toBeUndefined();
  });
});

describe("Event type string format", () => {
  it("produces correct fully qualified type strings", () => {
    const pkg = "0xabc123";
    const result = suiEventType(pkg, EVENT_TYPES.POOL_CREATED);
    expect(result).toBe("0xabc123::events::PoolCreated");
  });

  it("handles different package IDs", () => {
    const pkg1 = "0x1111";
    const pkg2 = "0x2222";
    const r1 = suiEventType(pkg1, EVENT_TYPES.MEMBER_ADDED);
    const r2 = suiEventType(pkg2, EVENT_TYPES.MEMBER_ADDED);
    expect(r1).not.toBe(r2);
    expect(r1).toBe("0x1111::events::MemberAdded");
    expect(r2).toBe("0x2222::events::MemberAdded");
  });
});
