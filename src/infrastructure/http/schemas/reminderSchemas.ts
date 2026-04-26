import { z } from 'zod';

const DailyScheduleSchema = z.object({
  type: z.literal('daily'),
  times: z.array(z.string()).min(1),
});

const WeeklyScheduleSchema = z.object({
  type: z.literal('weekly'),
  days: z.array(z.string()).min(1),
  times: z.array(z.string()).min(1),
});

const MonthlyScheduleSchema = z.object({
  type: z.literal('monthly'),
  daysOfMonth: z.array(z.number()).min(1),
  times: z.array(z.string()).min(1),
});

export const ReminderScheduleSchema = z.discriminatedUnion('type', [
  DailyScheduleSchema,
  WeeklyScheduleSchema,
  MonthlyScheduleSchema,
]);
export type ReminderSchedule = z.infer<typeof ReminderScheduleSchema>;

export const ConfigureReminderSchema = z.object({
  schedule: ReminderScheduleSchema,
  notifyUserIds: z.array(z.string()).optional(),
  advanceNotice: z.number().optional(),
  enabled: z.boolean().optional(),
});
export type ConfigureReminderBody = z.infer<typeof ConfigureReminderSchema>;

export const ToggleReminderSchema = z.object({
  enabled: z.boolean(),
});
export type ToggleReminderBody = z.infer<typeof ToggleReminderSchema>;

export const ConfigureVetVisitReminderSchema = z.object({
  schedule: ReminderScheduleSchema,
  enabled: z.boolean().optional(),
});
export type ConfigureVetVisitReminderBody = z.infer<typeof ConfigureVetVisitReminderSchema>;
