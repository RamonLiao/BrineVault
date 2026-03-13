import { z } from 'zod';

export const createOrgSchema = z.object({
  name: z.string().min(1).max(256),
  legalName: z.string().min(1).max(512).optional(),
});

export const updateOrgSchema = z.object({
  name: z.string().min(1).max(256).optional(),
  legalName: z.string().min(1).max(512).optional(),
});

export const generateInviteSchema = z.object({
  role: z.number().int().min(1).max(63).optional().default(1), // default VIEWER
  maxUses: z.number().int().min(1).max(100).default(5),
  expiresInHours: z.number().int().min(1).max(720).default(72), // max 30 days
});

export const joinOrgSchema = z.object({
  inviteCode: z.string().min(1),
});

export type CreateOrgDto = z.infer<typeof createOrgSchema>;
export type UpdateOrgDto = z.infer<typeof updateOrgSchema>;
export type GenerateInviteDto = z.infer<typeof generateInviteSchema>;
export type JoinOrgDto = z.infer<typeof joinOrgSchema>;
