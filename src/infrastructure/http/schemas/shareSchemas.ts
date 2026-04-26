import { z } from 'zod';

const PermissionsSchema = z.object({
  canViewVetVisits: z.boolean().optional(),
  canEditVetVisits: z.boolean().optional(),
  canViewMedications: z.boolean().optional(),
  canEditMedications: z.boolean().optional(),
  canViewNotes: z.boolean().optional(),
  canEditNotes: z.boolean().optional(),
});

export const CreateShareSchema = z.object({
  email: z.string().email(),
  permissions: PermissionsSchema.optional(),
});
export type CreateShareBody = z.infer<typeof CreateShareSchema>;

export const UpdateSharePermissionsSchema = PermissionsSchema;
export type UpdateSharePermissionsBody = z.infer<typeof UpdateSharePermissionsSchema>;
