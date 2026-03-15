import { z } from 'zod';

const hexHash64 = z.string().regex(/^[a-fA-F0-9]{64}$/, 'Invalid 64-char hex hash');

export const submitReviewSchema = z.object({
  adminConfigId: z.string().min(1),
  status: z.number().int().min(0).max(2), // 0=approved, 1=needs_revision, 2=rejected
  commentHash: hexHash64.optional(),
});

export type SubmitReviewDto = z.infer<typeof submitReviewSchema>;
