import { Service } from 'typedi';
import { notificationQueue, MedicationReminderJobData, VetVisitReminderJobData } from './NotificationQueue';
import { Reminder } from '../../domain/reminder/Reminder';

const VET_VISIT_JOB_PREFIX = 'vet-visit-reminder';
const DEFAULT_LEAD_TIME_MS = 24 * 60 * 60 * 1000; // 24 hours before visit

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
  // ── Medication reminders (repeating interval) ──────────────────────────────

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

    const jobName = `reminder:${reminder.entityId}`;
    await notificationQueue.add(jobName, jobData, {
      repeat: { every: reminder.schedule.toMilliseconds() },
      jobId: jobName,
    });
  }

  async cancelReminders(entityId: string): Promise<void> {
    const repeatableJobs = await notificationQueue.getRepeatableJobs();
    await Promise.all(
      repeatableJobs
        .filter((job) => job.name === `reminder:${entityId}`)
        .map((job) => notificationQueue.removeRepeatableByKey(job.key)),
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

    const jobId = `${VET_VISIT_JOB_PREFIX}:${ctx.visitId}`;
    await notificationQueue.add(jobId, jobData, { delay, jobId });
  }

  async cancelVetVisitReminder(visitId: string): Promise<void> {
    const jobId = `${VET_VISIT_JOB_PREFIX}:${visitId}`;
    const job = await notificationQueue.getJob(jobId);
    if (job) await job.remove();
  }
}
