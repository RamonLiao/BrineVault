import { z } from 'zod';

const hexHash64 = z.string().regex(/^[a-fA-F0-9]{64}$/, 'Invalid 64-char hex hash');
const blobId = z.string().min(1, 'Blob ID cannot be empty');

export const createDocumentSchema = z.object({
  adminConfigId: z.string().min(1),
  folderId: z.number().int().min(0),
  docType: z.number().int().min(0).max(9),
  title: z.string().min(1).max(512),
  requiredFlag: z.boolean().default(false),
  visibleToRoles: z.number().int().min(1).max(63),
  walrusBlobId: blobId,
  contentHash: hexHash64,
  sizeBytes: z.number().int().positive(),
  changeLog: z.string().max(2048).default(''),
  tags: z.array(z.string().max(64)).max(20).default([]),
});

export const addVersionSchema = z.object({
  adminConfigId: z.string().min(1),
  walrusBlobId: blobId,
  contentHash: hexHash64,
  sizeBytes: z.number().int().positive(),
  changeLog: z.string().max(2048).default(''),
});

export const archiveDocumentSchema = z.object({
  adminConfigId: z.string().min(1),
});

export type CreateDocumentDto = z.infer<typeof createDocumentSchema>;
export type AddVersionDto = z.infer<typeof addVersionSchema>;
export type ArchiveDocumentDto = z.infer<typeof archiveDocumentSchema>;
