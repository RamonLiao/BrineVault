import { z } from 'zod';

export const renewSubscriptionSchema = z.object({
  plan: z.enum(['free_trial', 'pro', 'enterprise']),
  durationMonths: z.coerce.number().int().min(1).max(36).default(12),
});

export type RenewSubscriptionDto = z.infer<typeof renewSubscriptionSchema>;

export const invoicesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['pending', 'paid', 'overdue', 'cancelled']).optional(),
});

export type InvoicesQueryDto = z.infer<typeof invoicesQuerySchema>;
