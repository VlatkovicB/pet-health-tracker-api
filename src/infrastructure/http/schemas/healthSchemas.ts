import { z } from 'zod';
import { ReminderScheduleSchema } from './reminderSchemas';

const toDate = (s: string) => new Date(s);

const ScheduleNextVisitSchema = z.object({
  visitDate: z.string().transform(toDate),
  reason: z.string().optional(),
  notes: z.string().optional(),
  vetId: z.string().optional(),
  clinic: z.string().optional(),
  vetName: z.string().optional(),
});

export const CreateVetVisitSchema = z.object({
  type: z.enum(['logged', 'scheduled']),
  reason: z.string().min(1),
  notes: z.string().optional(),
  visitDate: z.string().transform(toDate),
  vetId: z.string().optional(),
  clinic: z.string().optional(),
  vetName: z.string().optional(),
  scheduleNextVisit: ScheduleNextVisitSchema.optional(),
  imageUrls: z.array(z.string()).optional(),
});
export type CreateVetVisitBody = z.infer<typeof CreateVetVisitSchema>;

export const UpdateVetVisitSchema = z.object({
  vetId: z.string().optional(),
  reason: z.string().optional(),
  notes: z.string().optional(),
  visitDate: z.string().transform(toDate).optional(),
});
export type UpdateVetVisitBody = z.infer<typeof UpdateVetVisitSchema>;

export const CompleteVetVisitSchema = z.object({
  notes: z.string().optional(),
});
export type CompleteVetVisitBody = z.infer<typeof CompleteVetVisitSchema>;

export const VetVisitsByDateRangeQuerySchema = z.object({
  from: z.string().min(1, '`from` query param is required (YYYY-MM-DD)'),
  to: z.string().min(1, '`to` query param is required (YYYY-MM-DD)'),
});
export type VetVisitsByDateRangeQuery = z.infer<typeof VetVisitsByDateRangeQuerySchema>;

const MedicationReminderSchema = z.object({
  enabled: z.boolean(),
  schedule: ReminderScheduleSchema.optional(),
  advanceNotice: z.number().optional(),
}).optional();

export const CreateMedicationSchema = z.object({
  name: z.string().min(1),
  dosageAmount: z.number().positive(),
  dosageUnit: z.string().min(1),
  schedule: z.string().optional(),
  startDate: z.string().transform(toDate),
  endDate: z.string().transform(toDate).optional(),
  notes: z.string().optional(),
  reminder: MedicationReminderSchema,
});
export type CreateMedicationBody = z.infer<typeof CreateMedicationSchema>;

export const UpdateMedicationSchema = z.object({
  name: z.string().optional(),
  dosageAmount: z.number().positive().optional(),
  dosageUnit: z.string().optional(),
  schedule: z.string().optional(),
  startDate: z.string().transform(toDate).optional(),
  endDate: z.string().transform(toDate).nullable().optional(),
  notes: z.string().nullable().optional(),
  active: z.boolean().optional(),
  reminder: MedicationReminderSchema,
});
export type UpdateMedicationBody = z.infer<typeof UpdateMedicationSchema>;
