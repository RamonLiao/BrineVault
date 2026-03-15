import { vi } from 'vitest';

// ─── Repository Mocks ────────────────────────────────────────

export interface MockRepos {
  usersRepo: Record<string, ReturnType<typeof vi.fn>>;
  orgsRepo: Record<string, ReturnType<typeof vi.fn>>;
  inviteCodesRepo: Record<string, ReturnType<typeof vi.fn>>;
  membersRepo: Record<string, ReturnType<typeof vi.fn>>;
  poolsRepo: Record<string, ReturnType<typeof vi.fn>>;
  dataroomsRepo: Record<string, ReturnType<typeof vi.fn>>;
  documentsRepo: Record<string, ReturnType<typeof vi.fn>>;
  documentVersionsRepo: Record<string, ReturnType<typeof vi.fn>>;
  documentReviewsRepo: Record<string, ReturnType<typeof vi.fn>>;
  icDecisionsRepo: Record<string, ReturnType<typeof vi.fn>>;
  checklistRepo: Record<string, ReturnType<typeof vi.fn>>;
  auditEventsRepo: Record<string, ReturnType<typeof vi.fn>>;
}

export function createMockRepos(): MockRepos {
  return {
    usersRepo: {
      findById: vi.fn(),
      findByWalletAddress: vi.fn(),
      upsertByWallet: vi.fn(),
      update: vi.fn(),
    },
    orgsRepo: {
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    inviteCodesRepo: {
      findByCode: vi.fn(),
      findByOrgId: vi.fn(),
      create: vi.fn(),
      incrementUses: vi.fn(),
    },
    membersRepo: {
      findByDataroomAndAddress: vi.fn(),
      findActiveByPoolId: vi.fn(),
      findByPoolId: vi.fn(),
    },
    poolsRepo: {
      findById: vi.fn(),
      findBySuiObjectId: vi.fn(),
      findByOrgId: vi.fn(),
      countByOrgId: vi.fn(),
    },
    dataroomsRepo: {
      findById: vi.fn(),
      findBySuiObjectId: vi.fn(),
      findByPoolId: vi.fn(),
    },
    documentsRepo: {
      findById: vi.fn(),
      findBySuiObjectId: vi.fn(),
      findByPoolId: vi.fn(),
      countByPoolId: vi.fn(),
    },
    documentVersionsRepo: {
      findByDocumentId: vi.fn(),
      findByDocumentAndVersion: vi.fn(),
    },
    documentReviewsRepo: {
      findByDocumentId: vi.fn(),
      findByDocumentAndReviewer: vi.fn(),
      upsertFromEvent: vi.fn(),
    },
    icDecisionsRepo: {
      findByPoolId: vi.fn(),
      findByPoolAndIndex: vi.fn(),
      insertFromEvent: vi.fn(),
    },
    checklistRepo: {
      findAllTemplates: vi.fn(),
      createTemplate: vi.fn(),
      findItemsByPoolId: vi.fn(),
      createItem: vi.fn(),
      updateItem: vi.fn(),
      deleteItem: vi.fn(),
    },
    auditEventsRepo: {
      findByPoolId: vi.fn(),
      findByActorAddress: vi.fn(),
      existsByTxSeq: vi.fn(),
      insertFromEvent: vi.fn(),
    },
  };
}

// ─── Mock Drizzle DB ─────────────────────────────────────────

/**
 * Creates a Proxy-based mock that supports any Drizzle chain:
 *   db.select({...}).from(table).where(...).limit(n).offset(n) → resolves to value
 */
function chainable(finalValue: unknown): any {
  return new Proxy(() => {}, {
    get(_, prop) {
      if (prop === 'then') {
        return (resolve: any, reject?: any) =>
          Promise.resolve(finalValue).then(resolve, reject);
      }
      if (prop === 'catch' || prop === 'finally') {
        return (...args: any[]) =>
          (Promise.resolve(finalValue) as any)[prop](...args);
      }
      // Any property access returns a function that returns another chainable
      return (..._args: any[]) => chainable(finalValue);
    },
    apply() {
      return chainable(finalValue);
    },
  });
}

export function createMockDb(overrides: { execute?: any; select?: any } = {}) {
  return {
    execute: vi.fn().mockResolvedValue(overrides.execute ?? [{ '1': 1 }]),
    select: vi.fn((..._args: any[]) => chainable(overrides.select ?? [])),
    insert: vi.fn((..._args: any[]) => chainable([])),
    update: vi.fn((..._args: any[]) => chainable([])),
    delete: vi.fn((..._args: any[]) => chainable([])),
  };
}

// ─── SuiTxService Mock ───────────────────────────────────────

export function createMockSuiTxService() {
  return {
    buildCreatePoolTx: vi.fn().mockResolvedValue({ txBytes: 'mock-tx-bytes' }),
    buildStateTransitionTx: vi.fn().mockResolvedValue({ txBytes: 'mock-tx-bytes' }),
    buildCancelPoolTx: vi.fn().mockResolvedValue({ txBytes: 'mock-tx-bytes' }),
    buildAddMemberTx: vi.fn().mockResolvedValue({ txBytes: 'mock-tx-bytes' }),
    buildRemoveMemberTx: vi.fn().mockResolvedValue({ txBytes: 'mock-tx-bytes' }),
    buildUpdateMemberRoleTx: vi.fn().mockResolvedValue({ txBytes: 'mock-tx-bytes' }),
    buildCreateFolderTx: vi.fn().mockResolvedValue({ txBytes: 'mock-tx-bytes' }),
    buildCreateDocumentTx: vi.fn().mockResolvedValue({ txBytes: 'mock-tx-bytes' }),
    buildAddVersionTx: vi.fn().mockResolvedValue({ txBytes: 'mock-tx-bytes' }),
    buildArchiveDocumentTx: vi.fn().mockResolvedValue({ txBytes: 'mock-tx-bytes' }),
    buildSubmitReviewTx: vi.fn().mockResolvedValue({ txBytes: 'mock-tx-bytes' }),
    buildRecordIcApprovalTx: vi.fn().mockResolvedValue({ txBytes: 'mock-tx-bytes' }),
    buildRecordIcRejectionTx: vi.fn().mockResolvedValue({ txBytes: 'mock-tx-bytes' }),
    buildRecordIcRequestChangesTx: vi.fn().mockResolvedValue({ txBytes: 'mock-tx-bytes' }),
    submitSignedTx: vi.fn().mockResolvedValue({
      digest: '0xmockdigest',
      effects: { status: { status: 'success' } },
    }),
  };
}

// ─── Reset Helpers ───────────────────────────────────────────

export function resetMockRepos(repos: MockRepos) {
  for (const repo of Object.values(repos)) {
    for (const fn of Object.values(repo)) {
      if (typeof (fn as any).mockClear === 'function') (fn as any).mockClear();
    }
  }
}
