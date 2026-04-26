import { z } from 'zod';

export const CreateNoteSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  noteDate: z.string(),
  petIds: z.array(z.string()).optional(),
  imageUrls: z.array(z.string()).optional(),
});
export type CreateNoteBody = z.infer<typeof CreateNoteSchema>;

export const UpdateNoteSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  noteDate: z.string().optional(),
  petIds: z.array(z.string()).optional(),
});
export type UpdateNoteBody = z.infer<typeof UpdateNoteSchema>;

export const ListNotesQuerySchema = z.object({
  petId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});
export type ListNotesQuery = z.infer<typeof ListNotesQuerySchema>;
