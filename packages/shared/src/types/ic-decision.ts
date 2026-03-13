// ========== IC Decision Types ==========
// Must match contracts/rwa_dataroom/sources/types.move exactly

export const IC_DECISION_TYPES = {
  APPROVE: 0,
  REJECT: 1,
  REQUEST_CHANGES: 2,
} as const;

export type ICDecisionType =
  (typeof IC_DECISION_TYPES)[keyof typeof IC_DECISION_TYPES];

export const IC_DECISION_LABELS: Record<ICDecisionType, string> = {
  [IC_DECISION_TYPES.APPROVE]: "Approve",
  [IC_DECISION_TYPES.REJECT]: "Reject",
  [IC_DECISION_TYPES.REQUEST_CHANGES]: "Request Changes",
};

export interface ICDecision {
  index: number;
  decisionType: ICDecisionType;
  decisionText: string;
  pdfBlobId: string;
  createdBy: string;
  committee: string[];
  votes: number[];
  createdAt: number;
  relatedDocIds: string[];
}
