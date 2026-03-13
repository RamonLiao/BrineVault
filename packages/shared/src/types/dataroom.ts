export interface DataRoom {
  id: string;
  poolId: string;
  owner: string;
  memberCount: number;
  defaultFolders: string[];
  customFolderCount: number;
  sealPolicyId: string | null;
  createdAt: number;
  lastUpdatedAt: number;
}

export interface Membership {
  address: string;
  role: number;
  addedBy: string;
  addedAt: number;
  isActive: boolean;
  revokedAt: number | null;
  tags: string[];
}

export interface FolderMeta {
  name: string;
  folderId: number;
  parentId: number | null;
  visibleToRoles: number;
  createdAt: number;
  createdBy: string;
}

export const DEFAULT_FOLDERS = [
  { id: 0, name: "Legal" },
  { id: 1, name: "Financials" },
  { id: 2, name: "Collateral" },
  { id: 3, name: "Compliance" },
  { id: 4, name: "Reports" },
  { id: 5, name: "Misc" },
] as const;

export const CUSTOM_FOLDER_START_ID = 100;
