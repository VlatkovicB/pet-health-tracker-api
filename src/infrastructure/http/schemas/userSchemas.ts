import { z } from 'zod';

export const UpdateThemeSchema = z.object({
  theme: z.enum(['light', 'dark']),
});
export type UpdateThemeBody = z.infer<typeof UpdateThemeSchema>;
