import { z } from 'zod';

const suiAddress = z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid Sui address');

export const addMemberSchema = z.object({
  adminConfigId: z.string().min(1),
  address: suiAddress,
  role: z.number().int().min(1).max(63),
  tags: z.array(z.string().max(64)).max(20).default([]),
});

export const removeMemberSchema = z.object({
  adminConfigId: z.string().min(1),
});

export const updateMemberRoleSchema = z.object({
  adminConfigId: z.string().min(1),
  newRole: z.number().int().min(1).max(63),
});

export const createFolderSchema = z.object({
  adminConfigId: z.string().min(1),
  name: z.string().min(1).max(256),
  parentId: z.number().int().min(0).optional(),
  visibleToRoles: z.number().int().min(1).max(63),
});

export type AddMemberDto = z.infer<typeof addMemberSchema>;
export type RemoveMemberDto = z.infer<typeof removeMemberSchema>;
export type UpdateMemberRoleDto = z.infer<typeof updateMemberRoleSchema>;
export type CreateFolderDto = z.infer<typeof createFolderSchema>;
