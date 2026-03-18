import { z } from 'zod';

export const submitIcDecisionSchema = z
  .object({
    adminConfigId: z.string().min(1),
    decisionType: z.number().int().min(0).max(2), // 0=approve, 1=reject, 2=request_changes
    decisionText: z.string().min(1).max(10000),
    pdfBlobId: z.string().min(1),
    committeeMembers: z.array(z.string().min(1)).min(1).max(50),
    votes: z.array(z.number().int().min(0).max(2)).min(1).max(50),
    relatedDocIds: z.array(z.string().min(1)).default([]),
  })
  .refine((data) => data.committeeMembers.length === data.votes.length, {
    message: 'committeeMembers and votes must have the same length',
  });

export type SubmitIcDecisionDto = z.infer<typeof submitIcDecisionSchema>;
