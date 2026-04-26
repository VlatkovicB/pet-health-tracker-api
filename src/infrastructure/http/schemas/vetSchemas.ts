import { z } from 'zod';

const WorkHoursEntrySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  open: z.boolean(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
});

export const CreateVetSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  website: z.string().optional(),
  placeId: z.string().optional(),
  googleMapsUrl: z.string().optional(),
  rating: z.number().optional(),
  workHours: z.array(WorkHoursEntrySchema).optional(),
});
export type CreateVetBody = z.infer<typeof CreateVetSchema>;

export const UpdateVetSchema = CreateVetSchema.partial();
export type UpdateVetBody = z.infer<typeof UpdateVetSchema>;
