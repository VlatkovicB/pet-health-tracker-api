import { z } from 'zod';

export const CreatePetSchema = z.object({
  name: z.string().min(1),
  species: z.string().min(1),
  breed: z.string().optional(),
  birthDate: z.string().transform(s => new Date(s)).optional(),
  color: z.string().optional(),
});
export type CreatePetBody = z.infer<typeof CreatePetSchema>;

export const UpdatePetSchema = CreatePetSchema.partial();
export type UpdatePetBody = z.infer<typeof UpdatePetSchema>;

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
