import { z } from 'zod';

const PermissionsSchema = z.object({
  canViewVetVisits: z.boolean().default(true),
  canEditVetVisits: z.boolean().default(false),
  canViewMedications: z.boolean().default(true),
  canEditMedications: z.boolean().default(false),
  canViewNotes: z.boolean().default(true),
  canEditNotes: z.boolean().default(false),
});

export const CreateShareSchema = z.object({
  email: z.string().email(),
  permissions: PermissionsSchema.default({
    canViewVetVisits: true,
    canEditVetVisits: false,
    canViewMedications: true,
    canEditMedications: false,
    canViewNotes: true,
    canEditNotes: false,
  }),
});
export type CreateShareBody = z.infer<typeof CreateShareSchema>;

export const UpdateSharePermissionsSchema = PermissionsSchema;
export type UpdateSharePermissionsBody = z.infer<typeof UpdateSharePermissionsSchema>;
