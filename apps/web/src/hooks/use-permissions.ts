import { ROLE, type RoleBitmask } from '@/types';

interface PoolContext {
  myRole: RoleBitmask;
  icCommitteeMembers?: string[]; // wallet addresses
}

export function usePermissions(pool: PoolContext | null, userAddress: string | null) {
  const role = pool?.myRole ?? 0;

  const isICMember = !!(
    userAddress &&
    pool?.icCommitteeMembers?.includes(userAddress)
  );

  return {
    canUpload:        (role & (ROLE.EDITOR | ROLE.OWNER | ROLE.ORG_ADMIN)) !== 0,
    canReview:        (role & (ROLE.REVIEWER | ROLE.EDITOR | ROLE.OWNER | ROLE.ORG_ADMIN)) !== 0,
    canManagePool:    (role & (ROLE.OWNER | ROLE.ORG_ADMIN)) !== 0,
    canVoteIC:        isICMember,
    canManageMembers: (role & (ROLE.OWNER | ROLE.ORG_ADMIN)) !== 0,
    canComment:       role !== 0,
    canViewAudit:     true,
  };
}
