import type { DocType } from "./document.js";

export const CHECKLIST_ITEM_STATUS = {
  MISSING: "missing",
  UPLOADED: "uploaded",
  REVIEWED: "reviewed",
  NEEDS_REVISION: "needs_revision",
} as const;

export type ChecklistItemStatus =
  (typeof CHECKLIST_ITEM_STATUS)[keyof typeof CHECKLIST_ITEM_STATUS];

export const REQUIREMENT_LEVEL = {
  REQUIRED: "required",
  RECOMMENDED: "recommended",
  OPTIONAL: "optional",
} as const;

export type RequirementLevel =
  (typeof REQUIREMENT_LEVEL)[keyof typeof REQUIREMENT_LEVEL];

export interface ChecklistItem {
  id: string;
  poolId: string;
  folderId: number;
  label: string;
  description: string;
  requirementLevel: RequirementLevel;
  expectedDocType: DocType;
  linkedDocumentId: string | null;
  status: ChecklistItemStatus;
  createdAt: number;
  updatedAt: number;
}

export interface ChecklistTemplate {
  id: string;
  name: string;
  description: string;
  items: Omit<
    ChecklistItem,
    "id" | "poolId" | "linkedDocumentId" | "status" | "createdAt" | "updatedAt"
  >[];
}

/** Default DD checklist template */
export const DEFAULT_DD_CHECKLIST_ITEMS: ReadonlyArray<{
  folderId: number;
  label: string;
  description: string;
  requirementLevel: RequirementLevel;
  expectedDocType: DocType;
}> = [
  {
    folderId: 0,
    label: "Credit Agreement",
    description: "Executed credit agreement or term sheet",
    requirementLevel: "required",
    expectedDocType: 1,
  },
  {
    folderId: 0,
    label: "Security Agreement",
    description: "Security and collateral pledge agreements",
    requirementLevel: "required",
    expectedDocType: 1,
  },
  {
    folderId: 1,
    label: "Audited Financial Statements",
    description: "Last 3 years audited financial statements",
    requirementLevel: "required",
    expectedDocType: 0,
  },
  {
    folderId: 1,
    label: "Interim Financials",
    description: "Most recent interim / management accounts",
    requirementLevel: "recommended",
    expectedDocType: 0,
  },
  {
    folderId: 2,
    label: "Collateral Valuation",
    description: "Independent collateral valuation report",
    requirementLevel: "required",
    expectedDocType: 4,
  },
  {
    folderId: 2,
    label: "Insurance Certificate",
    description: "Insurance coverage for pledged assets",
    requirementLevel: "recommended",
    expectedDocType: 5,
  },
  {
    folderId: 3,
    label: "KYC / AML Package",
    description: "KYC, AML, and sanctions screening documentation",
    requirementLevel: "required",
    expectedDocType: 2,
  },
  {
    folderId: 3,
    label: "Corporate Documents",
    description: "Articles of incorporation, board resolutions, signatories",
    requirementLevel: "required",
    expectedDocType: 6,
  },
  {
    folderId: 4,
    label: "IC Memo",
    description: "Investment Committee memorandum",
    requirementLevel: "required",
    expectedDocType: 8,
  },
];
