import { z } from 'zod';

const hexHash64 = z.string().regex(/^[a-fA-F0-9]{64}$/, 'Invalid 64-char hex hash');

export const createPoolSchema = z.object({
  name: z.string().min(1).max(256),
  adminConfigId: z.string().min(1),
  orgIdHash: hexHash64,
  borrowerNameHash: hexHash64,
  currency: z.string().min(1).max(10),
  targetNotional: z.string().regex(/^\d+$/, 'Must be a numeric string'),
  expectedMaturityDate: z.number().int().positive(),
  encryptionScheme: z.number().int().min(0).max(1),
  tags: z.array(z.string().max(64)).max(20).default([]),
});

export const submitSignedTxSchema = z.object({
  txBytes: z.string().min(1),
  signature: z.string().min(1),
});

export const transitionPoolSchema = z.object({
  adminConfigId: z.string().min(1),
  targetFunction: z.enum([
    'progress_to_dd',
    'progress_to_ic_review',
    'progress_to_ready_to_issue',
    'reopen_rejected_pool',
  ]),
  extraArgs: z.array(z.any()).optional(),
});

export const cancelPoolSchema = z.object({
  adminConfigId: z.string().min(1),
});

export type CreatePoolDto = z.infer<typeof createPoolSchema>;
export type SubmitSignedTxDto = z.infer<typeof submitSignedTxSchema>;
export type TransitionPoolDto = z.infer<typeof transitionPoolSchema>;
export type CancelPoolDto = z.infer<typeof cancelPoolSchema>;
