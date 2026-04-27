import { z } from 'zod';
import { PET_SPECIES } from '../../../domain/pet/PetSpecies';

const toDate = (s: string) => new Date(s);

export const CreatePetSchema = z.object({
  name: z.string().min(1),
  species: z.enum(PET_SPECIES),
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

export const VetVisitsByPetQuerySchema = PaginationQuerySchema.extend({
  from: z.string().min(1).transform(toDate).optional(),
  to: z.string().min(1).transform(toDate).optional(),
}).refine(
  (data) => (data.from == null) === (data.to == null),
  { message: 'Both `from` and `to` must be provided together, or neither.' },
);
export type VetVisitsByPetQuery = z.infer<typeof VetVisitsByPetQuerySchema>;
