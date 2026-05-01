import { z } from 'zod';

export const UploadPhotoSchema = z.object({
  petId: z.string().uuid(),
  takenAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'takenAt must be YYYY-MM-DD'),
  caption: z.string().optional(),
});
export type UploadPhotoBody = z.infer<typeof UploadPhotoSchema>;

export const AttachPhotoToNoteSchema = z.object({
  petId: z.string().uuid(),
  takenAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  caption: z.string().optional(),
});
export type AttachPhotoToNoteBody = z.infer<typeof AttachPhotoToNoteSchema>;

export const AttachPhotoToVisitSchema = z.object({
  takenAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  caption: z.string().optional(),
});
export type AttachPhotoToVisitBody = z.infer<typeof AttachPhotoToVisitSchema>;

export const PhotoTimelineQuerySchema = z.object({
  year: z.string().regex(/^\d{4}$/).transform(Number),
  petIds: z
    .union([z.string().uuid(), z.array(z.string().uuid())])
    .optional()
    .transform((v) => (v ? (Array.isArray(v) ? v : [v]) : undefined)),
});
export type PhotoTimelineQuery = z.infer<typeof PhotoTimelineQuerySchema>;

export const PhotoYearsQuerySchema = z.object({
  petIds: z
    .union([z.string().uuid(), z.array(z.string().uuid())])
    .optional()
    .transform((v) => (v ? (Array.isArray(v) ? v : [v]) : undefined)),
});
export type PhotoYearsQuery = z.infer<typeof PhotoYearsQuerySchema>;
