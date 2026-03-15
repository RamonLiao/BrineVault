import { z } from 'zod';

export const auditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  eventType: z.string().optional(),
  actorAddress: z.string().optional(),
  format: z.enum(['json', 'csv']).default('json'),
});

export type AuditQueryDto = z.infer<typeof auditQuerySchema>;
