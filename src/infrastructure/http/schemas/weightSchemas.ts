import { z } from 'zod';

export const AddWeightEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  value: z.number().positive(),
  unit: z.enum(['kg', 'lb']),
  notes: z.string().optional(),
});
export type AddWeightEntryBody = z.infer<typeof AddWeightEntrySchema>;

export const UpdateWeightEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  value: z.number().positive().optional(),
  unit: z.enum(['kg', 'lb']).optional(),
  notes: z.string().nullable().optional(),
});
export type UpdateWeightEntryBody = z.infer<typeof UpdateWeightEntrySchema>;
