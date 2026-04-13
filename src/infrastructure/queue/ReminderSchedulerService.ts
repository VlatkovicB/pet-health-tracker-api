import { Service } from 'typedi';
import { notificationQueue, MedicationReminderJobData, VetVisitReminderJobData, VetVisitRepeatingReminderJobData } from './NotificationQueue';
import { Reminder } from '../../domain/reminder/Reminder';

const VET_VISIT_JOB_PREFIX = 'vet-visit-reminder--';
const DEFAULT_LEAD_TIME_MS = 24 * 60 * 60 * 1000;

export interface VetVisitReminderContext {
  visitId: string;
  petName: string;
  reason: string;
  nextVisitDate: Date;
  vetName?: string;
  clinic?: string;
  notifyUserIds: string[];
  leadTimeMs?: number;
}

@Service()
export class ReminderSchedulerService {
  // ── Medication reminders (cron-based repeating) ────────────────────────────

  async scheduleReminder(
    reminder: Reminder,
    context: { petId: string; petName: string; medicationName: string; dosage: string },
  ): Promise<void> {
    if (!reminder.enabled) return;

    await this.cancelReminders(reminder.entityId);

    const jobData: MedicationReminderJobData = {
      type: 'medication_reminder',
      reminderId: reminder.id.toValue(),
      petName: context.petName,
      medicationName: context.medicationName,
      dosage: context.dosage,
      notifyUserIds: reminder.notifyUserIds,
    };

    const cronExpressions = reminder.schedule.toCronExpressions();
    await Promise.all(
      cronExpressions.map((pattern, index) =>
        notificationQueue.upsertJobScheduler(
          `reminder--${reminder.entityId}--${index}`,
          { pattern, tz: 'UTC' },
          { name: `reminder--${reminder.entityId}`, data: jobData },
        ),
      ),
    );
  }

  async cancelReminders(entityId: string): Promise<void> {
    const prefix = `reminder--${entityId}--`;
    const schedulers = await notificationQueue.getJobSchedulers();
    await Promise.all(
      schedulers
        .filter((s) => s.id?.startsWith(prefix))
        .map((s) => notificationQueue.removeJobScheduler(s.id!)),
    );
  }

  async scheduleVetVisitRepeatingReminder(
    reminder: Reminder,
    context: {
      petId: string;
      petName: string;
      reason: string;
      visitDate: Date;
      vetName?: string;
      clinic?: string;
    },
  ): Promise<void> {
    if (!reminder.enabled) return;

    await this.cancelReminders(reminder.entityId);

    const jobData: VetVisitRepeatingReminderJobData = {
      type: 'vet_visit_repeating_reminder',
      reminderId: reminder.id.toValue(),
      petName: context.petName,
      reason: context.reason,
      visitDate: context.visitDate.toISOString(),
      vetName: context.vetName,
      clinic: context.clinic,
      notifyUserIds: reminder.notifyUserIds,
    };

    const cronExpressions = reminder.schedule.toCronExpressions();
    await Promise.all(
      cronExpressions.map((pattern, index) =>
        notificationQueue.upsertJobScheduler(
          `reminder--${reminder.entityId}--${index}`,
          { pattern, tz: 'UTC' },
          { name: `reminder--${reminder.entityId}`, data: jobData },
        ),
      ),
    );
  }

  // ── Vet visit reminders (one-time delayed) ─────────────────────────────────

  async scheduleVetVisitReminder(ctx: VetVisitReminderContext): Promise<void> {
    await this.cancelVetVisitReminder(ctx.visitId);

    const leadTime = ctx.leadTimeMs ?? DEFAULT_LEAD_TIME_MS;
    const fireAt = ctx.nextVisitDate.getTime() - leadTime;
    const delay = Math.max(0, fireAt - Date.now());

    const jobData: VetVisitReminderJobData = {
      type: 'vet_visit_reminder',
      visitId: ctx.visitId,
      petName: ctx.petName,
      reason: ctx.reason,
      nextVisitDate: ctx.nextVisitDate.toISOString(),
      vetName: ctx.vetName,
      clinic: ctx.clinic,
      notifyUserIds: ctx.notifyUserIds,
    };

    const jobId = `${VET_VISIT_JOB_PREFIX}${ctx.visitId}`;
    await notificationQueue.add(jobId, jobData, { delay, jobId });
  }

  async cancelVetVisitReminder(visitId: string): Promise<void> {
    const jobId = `${VET_VISIT_JOB_PREFIX}${visitId}`;
    const job = await notificationQueue.getJob(jobId);
    if (job) await job.remove();
  }
}
