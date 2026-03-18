import { z } from 'zod';

export const notificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  read: z.enum(['true', 'false']).optional(),
  type: z.string().optional(),
});

export type NotificationsQueryDto = z.infer<typeof notificationsQuerySchema>;

const perTypePreference = z.object({
  email: z.boolean().optional(),
  in_app: z.boolean().optional(),
});

export const updatePreferencesSchema = z.object({
  emailEnabled: z.boolean().optional(),
  inAppEnabled: z.boolean().optional(),
  preferences: z.record(z.string(), perTypePreference).optional(),
});

export type UpdatePreferencesDto = z.infer<typeof updatePreferencesSchema>;
