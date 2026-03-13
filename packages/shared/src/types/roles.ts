// ========== Role Bitmask Constants ==========
// Must match contracts/rwa_dataroom/sources/types.move exactly

export const ROLES = {
  VIEWER: 1, // 0b000001
  REVIEWER: 2, // 0b000010
  EDITOR: 4, // 0b000100
  OWNER: 8, // 0b001000
  AUDITOR: 16, // 0b010000
  ORG_ADMIN: 32, // 0b100000
  ALL: 63, // 0b111111
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

// Composite role masks (matching Move)
export const ROLE_MASKS = {
  REVIEWER_UP: 42, // REVIEWER | OWNER | ORG_ADMIN (EDITOR is lateral, not above REVIEWER)
  EDITOR_UP: 12, // EDITOR | OWNER
  OWNER_UP: 40, // OWNER | ORG_ADMIN
} as const;

/**
 * Check if a user's role bitmask includes the required role bit(s).
 * Matches Move: `(role & required) > 0`
 */
export function hasRole(userRole: number, requiredRole: number): boolean {
  return (userRole & requiredRole) > 0;
}

/**
 * Expand OWNER role to include implied sub-roles.
 * OWNER implies EDITOR + REVIEWER + VIEWER.
 */
export function ownerImplies(userRole: number): number {
  if (hasRole(userRole, ROLES.OWNER)) {
    return userRole | ROLES.EDITOR | ROLES.REVIEWER | ROLES.VIEWER;
  }
  return userRole;
}

export const ROLE_LABELS: Record<number, string> = {
  [ROLES.VIEWER]: "Viewer",
  [ROLES.REVIEWER]: "Reviewer",
  [ROLES.EDITOR]: "Editor",
  [ROLES.OWNER]: "Owner",
  [ROLES.AUDITOR]: "Auditor",
  [ROLES.ORG_ADMIN]: "Org Admin",
};
