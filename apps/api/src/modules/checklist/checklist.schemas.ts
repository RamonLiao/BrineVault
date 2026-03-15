import { z } from 'zod';

export const createChecklistItemSchema = z.object({
  folder: z.string().min(1).max(256),
  itemName: z.string().min(1).max(512),
  isRequired: z.boolean().default(false),
});

export const updateChecklistItemSchema = z.object({
  isRequired: z.boolean().optional(),
  linkedDocumentId: z.string().uuid().nullable().optional(),
  status: z.enum(['missing', 'uploaded', 'reviewed', 'needs_revision']).optional(),
});

export type CreateChecklistItemDto = z.infer<typeof createChecklistItemSchema>;
export type UpdateChecklistItemDto = z.infer<typeof updateChecklistItemSchema>;
