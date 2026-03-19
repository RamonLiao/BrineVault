export const queryKeys = {
  pools: {
    all:       ['pools'] as const,
    list:      (orgId: string) => ['pools', 'list', orgId] as const,
    detail:    (poolId: string) => ['pools', 'detail', poolId] as const,
    stats:     (orgId: string) => ['pools', 'stats', orgId] as const,
    documents: (poolId: string) => ['pools', poolId, 'documents'] as const,
  },
  documents: {
    detail: (docId: string) => ['documents', 'detail', docId] as const,
  },
  comments:      (contextType: string, contextId: string) => ['comments', contextType, contextId] as const,
  checklist:     (poolId: string) => ['checklist', poolId] as const,
  reviews:       (docId: string)  => ['reviews', docId] as const,
  icDecisions:   (poolId: string) => ['ic-decisions', poolId] as const,
  audit:         (poolId: string) => ['audit', poolId] as const,
  members:       (poolId: string) => ['members', poolId] as const,
  notifications: ['notifications'] as const,
  billing:       ['billing'] as const,
} as const;
