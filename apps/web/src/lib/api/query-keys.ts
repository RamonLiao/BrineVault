export const queryKeys = {
  pools: {
    all:    ['pools'] as const,
    list:   (orgId: string) => ['pools', 'list', orgId] as const,
    detail: (poolId: string) => ['pools', 'detail', poolId] as const,
  },
  documents: {
    list:   (poolId: string) => ['documents', 'list', poolId] as const,
    detail: (docId: string)  => ['documents', 'detail', docId] as const,
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
