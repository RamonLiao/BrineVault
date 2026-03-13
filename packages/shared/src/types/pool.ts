// ========== Pool State Constants ==========
// Must match contracts/rwa_dataroom/sources/types.move exactly

export const POOL_STATES = {
  DRAFT: 0,
  DD_IN_PROGRESS: 1,
  IC_REVIEW: 2,
  APPROVED_INTERNAL: 3,
  READY_TO_ISSUE: 4,
  REJECTED: 5,
  CANCELLED: 6,
  ISSUED: 7, // Phase 2
  CLOSED: 8, // Phase 2
} as const;

export type PoolState = (typeof POOL_STATES)[keyof typeof POOL_STATES];

export const POOL_STATE_LABELS: Record<PoolState, string> = {
  [POOL_STATES.DRAFT]: "Draft",
  [POOL_STATES.DD_IN_PROGRESS]: "DD In Progress",
  [POOL_STATES.IC_REVIEW]: "IC Review",
  [POOL_STATES.APPROVED_INTERNAL]: "Approved (Internal)",
  [POOL_STATES.READY_TO_ISSUE]: "Ready to Issue",
  [POOL_STATES.REJECTED]: "Rejected",
  [POOL_STATES.CANCELLED]: "Cancelled",
  [POOL_STATES.ISSUED]: "Issued",
  [POOL_STATES.CLOSED]: "Closed",
};

/**
 * Valid state transitions whitelist.
 * Must match `is_valid_transition()` in pool.move.
 */
export const VALID_TRANSITIONS: ReadonlyMap<PoolState, readonly PoolState[]> =
  new Map([
    [
      POOL_STATES.DRAFT,
      [POOL_STATES.DD_IN_PROGRESS, POOL_STATES.CANCELLED],
    ],
    [POOL_STATES.DD_IN_PROGRESS, [POOL_STATES.IC_REVIEW, POOL_STATES.CANCELLED]],
    [
      POOL_STATES.IC_REVIEW,
      [
        POOL_STATES.APPROVED_INTERNAL,
        POOL_STATES.REJECTED,
        POOL_STATES.DD_IN_PROGRESS,
      ],
    ],
    [POOL_STATES.APPROVED_INTERNAL, [POOL_STATES.READY_TO_ISSUE]],
    [POOL_STATES.READY_TO_ISSUE, [POOL_STATES.ISSUED]],
    [POOL_STATES.REJECTED, [POOL_STATES.DRAFT]],
    [POOL_STATES.ISSUED, [POOL_STATES.CLOSED]],
  ]);

export function isValidTransition(from: PoolState, to: PoolState): boolean {
  const allowed = VALID_TRANSITIONS.get(from);
  return allowed !== undefined && allowed.includes(to);
}

export interface Pool {
  id: string;
  orgIdHash: string;
  name: string;
  borrowerNameHash: string;
  currency: string;
  targetNotional: bigint;
  expectedMaturityDate: number;
  createdAt: number;
  createdBy: string;
  currentState: PoolState;
  encryptionScheme: number;
  tags: string[];
  icDecisionCount: number;
  hasIcApprovalCached: boolean;
  lastUpdatedAt: number;
}
