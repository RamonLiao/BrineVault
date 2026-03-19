/**
 * Default DD checklist items for new pool creation.
 * Mirrors packages/shared/src/types/checklist.ts — kept local until
 * @rwa-dataroom/shared is wired as a workspace dependency.
 */
export const DEFAULT_DD_CHECKLIST_ITEMS: ReadonlyArray<{
  folderId: number;
  label: string;
  description: string;
  requirementLevel: 'required' | 'recommended' | 'optional';
  expectedDocType: number;
}> = [
  {
    folderId: 0,
    label: 'Credit Agreement',
    description: 'Executed credit agreement or term sheet',
    requirementLevel: 'required',
    expectedDocType: 1,
  },
  {
    folderId: 0,
    label: 'Security Agreement',
    description: 'Security and collateral pledge agreements',
    requirementLevel: 'required',
    expectedDocType: 1,
  },
  {
    folderId: 1,
    label: 'Audited Financial Statements',
    description: 'Last 3 years audited financial statements',
    requirementLevel: 'required',
    expectedDocType: 0,
  },
  {
    folderId: 1,
    label: 'Interim Financials',
    description: 'Most recent interim / management accounts',
    requirementLevel: 'recommended',
    expectedDocType: 0,
  },
  {
    folderId: 2,
    label: 'Collateral Valuation',
    description: 'Independent collateral valuation report',
    requirementLevel: 'required',
    expectedDocType: 4,
  },
  {
    folderId: 2,
    label: 'Insurance Certificate',
    description: 'Insurance coverage for pledged assets',
    requirementLevel: 'recommended',
    expectedDocType: 5,
  },
  {
    folderId: 3,
    label: 'KYC / AML Package',
    description: 'KYC, AML, and sanctions screening documentation',
    requirementLevel: 'required',
    expectedDocType: 2,
  },
  {
    folderId: 3,
    label: 'Corporate Documents',
    description: 'Articles of incorporation, board resolutions, signatories',
    requirementLevel: 'required',
    expectedDocType: 6,
  },
  {
    folderId: 4,
    label: 'IC Memo',
    description: 'Investment Committee memorandum',
    requirementLevel: 'required',
    expectedDocType: 8,
  },
];
