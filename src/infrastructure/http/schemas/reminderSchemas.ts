import { z } from 'zod';

export const AdvanceNoticeSchema = z.object({
  amount: z.number().positive(),
  unit: z.enum(['minutes', 'hours', 'days']),
});
export type AdvanceNotice = z.infer<typeof AdvanceNoticeSchema>;

const DayOfWeekSchema = z.enum(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']);

const DailyScheduleSchema = z.object({
  type: z.literal('daily'),
  times: z.array(z.string()).min(1),
});

const WeeklyScheduleSchema = z.object({
  type: z.literal('weekly'),
  days: z.array(DayOfWeekSchema).min(1),
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
  advanceNotice: AdvanceNoticeSchema.optional(),
  enabled: z.boolean(),
});
export type ConfigureReminderBody = z.infer<typeof ConfigureReminderSchema>;

export const ToggleReminderSchema = z.object({
  enabled: z.boolean(),
});
export type ToggleReminderBody = z.infer<typeof ToggleReminderSchema>;

export const ConfigureVetVisitReminderSchema = z.object({
  schedule: ReminderScheduleSchema,
  enabled: z.boolean(),
});
export type ConfigureVetVisitReminderBody = z.infer<typeof ConfigureVetVisitReminderSchema>;
