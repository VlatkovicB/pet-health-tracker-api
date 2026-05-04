import { z } from 'zod';

export const UpdateUserRoleSchema = z.object({
  role: z.enum(['user', 'admin']),
});
export type UpdateUserRoleBody = z.infer<typeof UpdateUserRoleSchema>;

export const UpsertUserLimitsSchema = z.object({
  maxPets: z.number().int().positive().nullable().optional(),
  maxVets: z.number().int().positive().nullable().optional(),
  maxMedications: z.number().int().positive().nullable().optional(),
  maxNotes: z.number().int().positive().nullable().optional(),
  maxStorageBytes: z.number().int().positive().nullable().optional(),
  maxPlacesSearchesMonthly: z.number().int().positive().nullable().optional(),
});
export type UpsertUserLimitsBody = z.infer<typeof UpsertUserLimitsSchema>;
