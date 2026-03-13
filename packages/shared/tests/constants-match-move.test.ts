import { describe, it, expect } from "vitest";
import {
  ROLES,
  ROLE_MASKS,
  hasRole,
  ownerImplies,
  POOL_STATES,
  VALID_TRANSITIONS,
  isValidTransition,
  DOC_TYPES,
  REVIEW_STATUS,
  ENCRYPTION_SCHEMES,
  IC_DECISION_TYPES,
  ACTION_TYPES,
  DEFAULT_FOLDERS,
  CUSTOM_FOLDER_START_ID,
} from "../src/index.js";
import { MOVE_ERRORS } from "../src/constants/errors.js";
import { EVENT_TYPES, suiEventType } from "../src/constants/events.js";

/**
 * S0.4: Verify all TypeScript constants match Move contract values exactly.
 * Cross-references with:
 * - contracts/rwa_dataroom/sources/types.move
 * - contracts/rwa_dataroom/sources/errors.move
 * - contracts/rwa_dataroom/sources/events.move
 * - contracts/rwa_dataroom/sources/dataroom.move
 * - contracts/rwa_dataroom/sources/pool.move
 */
describe("Role bitmask constants match Move types.move", () => {
  it("individual roles", () => {
    expect(ROLES.VIEWER).toBe(1);
    expect(ROLES.REVIEWER).toBe(2);
    expect(ROLES.EDITOR).toBe(4);
    expect(ROLES.OWNER).toBe(8);
    expect(ROLES.AUDITOR).toBe(16);
    expect(ROLES.ORG_ADMIN).toBe(32);
    expect(ROLES.ALL).toBe(63);
  });

  it("composite masks", () => {
    // ROLE_REVIEWER_UP = 42 = REVIEWER(2) | OWNER(8) | ORG_ADMIN(32)
    expect(ROLE_MASKS.REVIEWER_UP).toBe(42);
    expect(ROLE_MASKS.REVIEWER_UP).toBe(
      ROLES.REVIEWER | ROLES.OWNER | ROLES.ORG_ADMIN,
    );

    // ROLE_EDITOR_UP = 12 = EDITOR(4) | OWNER(8)
    expect(ROLE_MASKS.EDITOR_UP).toBe(12);
    expect(ROLE_MASKS.EDITOR_UP).toBe(ROLES.EDITOR | ROLES.OWNER);

    // ROLE_OWNER_UP = 40 = OWNER(8) | ORG_ADMIN(32)
    expect(ROLE_MASKS.OWNER_UP).toBe(40);
    expect(ROLE_MASKS.OWNER_UP).toBe(ROLES.OWNER | ROLES.ORG_ADMIN);
  });

  it("hasRole matches Move (role & required) > 0", () => {
    expect(hasRole(ROLES.OWNER, ROLES.OWNER)).toBe(true);
    expect(hasRole(ROLES.VIEWER, ROLES.OWNER)).toBe(false);
    // OWNER has bit in REVIEWER_UP mask
    expect(hasRole(ROLES.OWNER, ROLE_MASKS.REVIEWER_UP)).toBe(true);
    // EDITOR does NOT have bit in REVIEWER_UP
    expect(hasRole(ROLES.EDITOR, ROLE_MASKS.REVIEWER_UP)).toBe(false);
    // VIEWER does NOT have bit in REVIEWER_UP
    expect(hasRole(ROLES.VIEWER, ROLE_MASKS.REVIEWER_UP)).toBe(false);
  });

  it("ownerImplies expands OWNER to include EDITOR+REVIEWER+VIEWER", () => {
    const expanded = ownerImplies(ROLES.OWNER);
    expect(hasRole(expanded, ROLES.EDITOR)).toBe(true);
    expect(hasRole(expanded, ROLES.REVIEWER)).toBe(true);
    expect(hasRole(expanded, ROLES.VIEWER)).toBe(true);
    // Non-OWNER input unchanged
    expect(ownerImplies(ROLES.VIEWER)).toBe(ROLES.VIEWER);
  });
});

describe("Pool state constants match Move types.move", () => {
  it("state values", () => {
    expect(POOL_STATES.DRAFT).toBe(0);
    expect(POOL_STATES.DD_IN_PROGRESS).toBe(1);
    expect(POOL_STATES.IC_REVIEW).toBe(2);
    expect(POOL_STATES.APPROVED_INTERNAL).toBe(3);
    expect(POOL_STATES.READY_TO_ISSUE).toBe(4);
    expect(POOL_STATES.REJECTED).toBe(5);
    expect(POOL_STATES.CANCELLED).toBe(6);
    expect(POOL_STATES.ISSUED).toBe(7);
    expect(POOL_STATES.CLOSED).toBe(8);
  });

  it("valid transitions match pool.move is_valid_transition()", () => {
    // Draft → DD_IN_PROGRESS, Cancelled
    expect(isValidTransition(POOL_STATES.DRAFT, POOL_STATES.DD_IN_PROGRESS)).toBe(true);
    expect(isValidTransition(POOL_STATES.DRAFT, POOL_STATES.CANCELLED)).toBe(true);
    expect(isValidTransition(POOL_STATES.DRAFT, POOL_STATES.IC_REVIEW)).toBe(false);

    // DD → IC_REVIEW, Cancelled
    expect(isValidTransition(POOL_STATES.DD_IN_PROGRESS, POOL_STATES.IC_REVIEW)).toBe(true);
    expect(isValidTransition(POOL_STATES.DD_IN_PROGRESS, POOL_STATES.CANCELLED)).toBe(true);
    expect(isValidTransition(POOL_STATES.DD_IN_PROGRESS, POOL_STATES.DRAFT)).toBe(false);

    // IC_REVIEW → Approved, Rejected, DD_IN_PROGRESS
    expect(isValidTransition(POOL_STATES.IC_REVIEW, POOL_STATES.APPROVED_INTERNAL)).toBe(true);
    expect(isValidTransition(POOL_STATES.IC_REVIEW, POOL_STATES.REJECTED)).toBe(true);
    expect(isValidTransition(POOL_STATES.IC_REVIEW, POOL_STATES.DD_IN_PROGRESS)).toBe(true);
    expect(isValidTransition(POOL_STATES.IC_REVIEW, POOL_STATES.DRAFT)).toBe(false);

    // Approved → Ready
    expect(isValidTransition(POOL_STATES.APPROVED_INTERNAL, POOL_STATES.READY_TO_ISSUE)).toBe(true);

    // Ready → Issued
    expect(isValidTransition(POOL_STATES.READY_TO_ISSUE, POOL_STATES.ISSUED)).toBe(true);

    // Rejected → Draft
    expect(isValidTransition(POOL_STATES.REJECTED, POOL_STATES.DRAFT)).toBe(true);

    // Issued → Closed
    expect(isValidTransition(POOL_STATES.ISSUED, POOL_STATES.CLOSED)).toBe(true);

    // Terminal states have no transitions
    expect(isValidTransition(POOL_STATES.CANCELLED, POOL_STATES.DRAFT)).toBe(false);
    expect(isValidTransition(POOL_STATES.CLOSED, POOL_STATES.DRAFT)).toBe(false);
  });
});

describe("Document type constants match Move types.move", () => {
  it("doc type values", () => {
    expect(DOC_TYPES.FINANCIAL_STATEMENT).toBe(0);
    expect(DOC_TYPES.LEGAL_AGREEMENT).toBe(1);
    expect(DOC_TYPES.KYC_AML).toBe(2);
    expect(DOC_TYPES.COLLATERAL).toBe(3);
    expect(DOC_TYPES.VALUATION_REPORT).toBe(4);
    expect(DOC_TYPES.INSURANCE).toBe(5);
    expect(DOC_TYPES.CORPORATE_DOC).toBe(6);
    expect(DOC_TYPES.TERM_SHEET).toBe(7);
    expect(DOC_TYPES.IC_MEMO).toBe(8);
    expect(DOC_TYPES.MISC).toBe(9);
  });

  it("review status values", () => {
    expect(REVIEW_STATUS.PENDING).toBe(0);
    expect(REVIEW_STATUS.APPROVED).toBe(1);
    expect(REVIEW_STATUS.NEEDS_REVISION).toBe(2);
  });
});

describe("Encryption scheme constants match Move types.move", () => {
  it("values", () => {
    expect(ENCRYPTION_SCHEMES.AES).toBe(0);
    expect(ENCRYPTION_SCHEMES.SEAL).toBe(1);
  });
});

describe("IC decision type constants match Move types.move", () => {
  it("values", () => {
    expect(IC_DECISION_TYPES.APPROVE).toBe(0);
    expect(IC_DECISION_TYPES.REJECT).toBe(1);
    expect(IC_DECISION_TYPES.REQUEST_CHANGES).toBe(2);
  });
});

describe("Action type constants match Move types.move", () => {
  it("values", () => {
    expect(ACTION_TYPES.POOL_CREATED).toBe(0);
    expect(ACTION_TYPES.STATE_CHANGED).toBe(1);
    expect(ACTION_TYPES.MEMBER_ADDED).toBe(2);
    expect(ACTION_TYPES.MEMBER_REMOVED).toBe(3);
    expect(ACTION_TYPES.MEMBER_ROLE_UPDATED).toBe(4);
    expect(ACTION_TYPES.DOC_CREATED).toBe(5);
    expect(ACTION_TYPES.DOC_VERSION_ADDED).toBe(6);
    expect(ACTION_TYPES.DOC_REVIEWED).toBe(7);
    expect(ACTION_TYPES.DOC_ARCHIVED).toBe(8);
    expect(ACTION_TYPES.IC_DECISION).toBe(9);
    expect(ACTION_TYPES.FOLDER_CREATED).toBe(10);
    expect(ACTION_TYPES.POOL_CANCELLED).toBe(11);
    expect(ACTION_TYPES.PAUSE_TOGGLED).toBe(12);
  });
});

describe("Error codes match Move errors.move", () => {
  it("authorization errors", () => {
    expect(MOVE_ERRORS.E_NOT_AUTHORIZED).toBe(0);
    expect(MOVE_ERRORS.E_NOT_OWNER).toBe(1);
    expect(MOVE_ERRORS.E_NOT_MEMBER).toBe(2);
    expect(MOVE_ERRORS.E_INSUFFICIENT_ROLE).toBe(3);
    expect(MOVE_ERRORS.E_MEMBER_NOT_ACTIVE).toBe(4);
  });

  it("state machine errors", () => {
    expect(MOVE_ERRORS.E_INVALID_STATE_TRANSITION).toBe(100);
    expect(MOVE_ERRORS.E_POOL_PAUSED).toBe(101);
    expect(MOVE_ERRORS.E_POOL_NOT_IN_DRAFT).toBe(102);
    expect(MOVE_ERRORS.E_POOL_NOT_IN_DD).toBe(103);
    expect(MOVE_ERRORS.E_POOL_NOT_IN_IC_REVIEW).toBe(104);
    expect(MOVE_ERRORS.E_POOL_NOT_REJECTED).toBe(105);
    expect(MOVE_ERRORS.E_POOL_CANCELLED).toBe(106);
  });

  it("membership errors", () => {
    expect(MOVE_ERRORS.E_MEMBER_ALREADY_EXISTS).toBe(200);
    expect(MOVE_ERRORS.E_MEMBER_NOT_FOUND).toBe(201);
    expect(MOVE_ERRORS.E_CANNOT_REMOVE_OWNER).toBe(202);
    expect(MOVE_ERRORS.E_MAX_MEMBERS_REACHED).toBe(203);
    expect(MOVE_ERRORS.E_MEMBER_ALREADY_REVOKED).toBe(204);
  });

  it("document errors", () => {
    expect(MOVE_ERRORS.E_DOCUMENT_NOT_FOUND).toBe(300);
    expect(MOVE_ERRORS.E_MAX_VERSIONS_REACHED).toBe(301);
    expect(MOVE_ERRORS.E_DOCUMENT_ARCHIVED).toBe(302);
    expect(MOVE_ERRORS.E_INVALID_DOC_TYPE).toBe(303);
    expect(MOVE_ERRORS.E_EMPTY_BLOB_ID).toBe(304);
    expect(MOVE_ERRORS.E_EMPTY_CONTENT_HASH).toBe(305);
    expect(MOVE_ERRORS.E_INVALID_CONTENT_HASH_LEN).toBe(306);
    expect(MOVE_ERRORS.E_ALREADY_REVIEWED).toBe(307);
  });

  it("folder errors", () => {
    expect(MOVE_ERRORS.E_FOLDER_NOT_FOUND).toBe(400);
    expect(MOVE_ERRORS.E_FOLDER_NAME_EMPTY).toBe(401);
    expect(MOVE_ERRORS.E_PARENT_FOLDER_NOT_FOUND).toBe(402);
  });

  it("admin errors", () => {
    expect(MOVE_ERRORS.E_ALREADY_PAUSED).toBe(500);
    expect(MOVE_ERRORS.E_NOT_PAUSED).toBe(501);
    expect(MOVE_ERRORS.E_INVALID_CONFIG).toBe(502);
  });

  it("validation errors", () => {
    expect(MOVE_ERRORS.E_INVALID_ENCRYPTION_SCHEME).toBe(600);
    expect(MOVE_ERRORS.E_INVALID_ROLE).toBe(601);
    expect(MOVE_ERRORS.E_EMPTY_NAME).toBe(602);
    expect(MOVE_ERRORS.E_INVALID_HASH_LENGTH).toBe(603);
    expect(MOVE_ERRORS.E_EMPTY_COMMITTEE).toBe(604);
  });

  it("DD checklist errors", () => {
    expect(MOVE_ERRORS.E_REQUIRED_DOCS_NOT_REVIEWED).toBe(700);
    expect(MOVE_ERRORS.E_COMPLIANCE_CHECK_FAILED).toBe(701);
  });

  it("errata E3 errors", () => {
    expect(MOVE_ERRORS.E_NO_IC_APPROVAL).toBe(800);
    expect(MOVE_ERRORS.E_SELF_REVIEW).toBe(801);
    expect(MOVE_ERRORS.E_CANNOT_DEMOTE_OWNER).toBe(802);
  });
});

describe("Event type strings match Move events.move", () => {
  it("all event struct names present", () => {
    expect(EVENT_TYPES.POOL_CREATED).toBe("PoolCreated");
    expect(EVENT_TYPES.POOL_STATE_CHANGED).toBe("PoolStateChanged");
    expect(EVENT_TYPES.POOL_CANCELLED).toBe("PoolCancelled");
    expect(EVENT_TYPES.DATAROOM_CREATED).toBe("DataRoomCreated");
    expect(EVENT_TYPES.MEMBER_ADDED).toBe("MemberAdded");
    expect(EVENT_TYPES.MEMBER_REMOVED).toBe("MemberRemoved");
    expect(EVENT_TYPES.MEMBER_ROLE_UPDATED).toBe("MemberRoleUpdated");
    expect(EVENT_TYPES.DOCUMENT_CREATED).toBe("DocumentCreated");
    expect(EVENT_TYPES.DOCUMENT_VERSION_ADDED).toBe("DocumentVersionAdded");
    expect(EVENT_TYPES.DOCUMENT_REVIEWED).toBe("DocumentReviewed");
    expect(EVENT_TYPES.DOCUMENT_ARCHIVED).toBe("DocumentArchived");
    expect(EVENT_TYPES.IC_DECISION_CREATED).toBe("ICDecisionCreated");
    expect(EVENT_TYPES.FOLDER_CREATED).toBe("FolderCreated");
    expect(EVENT_TYPES.FOLDER_KEY_STORED).toBe("FolderKeyStored");
    expect(EVENT_TYPES.ADMIN_PAUSE_TOGGLED).toBe("AdminPauseToggled");
    expect(EVENT_TYPES.AUDIT_EVENT).toBe("AuditEvent");
  });

  it("suiEventType builds correct fully qualified string", () => {
    const pkgId = "0xabc123";
    expect(suiEventType(pkgId, "PoolCreated")).toBe(
      "0xabc123::events::PoolCreated",
    );
  });
});

describe("Default folders match Move dataroom.move", () => {
  it("folder names and IDs match create_default_folders()", () => {
    expect(DEFAULT_FOLDERS).toEqual([
      { id: 0, name: "Legal" },
      { id: 1, name: "Financials" },
      { id: 2, name: "Collateral" },
      { id: 3, name: "Compliance" },
      { id: 4, name: "Reports" },
      { id: 5, name: "Misc" },
    ]);
  });

  it("custom folder start ID", () => {
    expect(CUSTOM_FOLDER_START_ID).toBe(100);
  });
});

describe("Zod schemas validate correctly", () => {
  it("createPoolRequestSchema accepts valid input", async () => {
    const { createPoolRequestSchema } = await import(
      "../src/validation/schemas.js"
    );
    const result = createPoolRequestSchema.safeParse({
      name: "Test Pool",
      orgIdHash: "a".repeat(64),
      borrowerNameHash: "b".repeat(64),
      currency: "USD",
      targetNotional: "1000000",
      expectedMaturityDate: 1710000000000,
      encryptionScheme: 0,
      tags: ["test"],
    });
    expect(result.success).toBe(true);
  });

  it("createPoolRequestSchema rejects invalid encryption scheme", async () => {
    const { createPoolRequestSchema } = await import(
      "../src/validation/schemas.js"
    );
    const result = createPoolRequestSchema.safeParse({
      name: "Test Pool",
      orgIdHash: "a".repeat(64),
      borrowerNameHash: "b".repeat(64),
      currency: "USD",
      targetNotional: "1000000",
      expectedMaturityDate: 1710000000000,
      encryptionScheme: 99,
      tags: [],
    });
    expect(result.success).toBe(false);
  });

  it("submitReviewRequestSchema validates status", async () => {
    const { submitReviewRequestSchema } = await import(
      "../src/validation/schemas.js"
    );
    expect(
      submitReviewRequestSchema.safeParse({ status: 1 }).success,
    ).toBe(true);
    expect(
      submitReviewRequestSchema.safeParse({ status: 99 }).success,
    ).toBe(false);
  });
});
