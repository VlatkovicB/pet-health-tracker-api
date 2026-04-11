import { Service } from 'typedi';
import { reminderQueue, ReminderJobData } from './ReminderQueue';
import { Reminder } from '../../domain/reminder/Reminder';

@Service()
export class ReminderSchedulerService {
  async scheduleReminder(
    reminder: Reminder,
    context: { petId: string; petName: string; medicationName: string; dosage: string },
  ): Promise<void> {
    if (!reminder.enabled) return;

    await this.cancelReminders(reminder.entityId);

    const jobData: ReminderJobData = {
      reminderId: reminder.id.toValue(),
      medicationId: reminder.entityId,
      medicationName: context.medicationName,
      dosage: context.dosage,
      petId: context.petId,
      petName: context.petName,
      notifyUserIds: reminder.notifyUserIds,
    };

    const jobName = `reminder:${reminder.entityId}`;
    await reminderQueue.add(jobName, jobData, {
      repeat: { every: reminder.schedule.toMilliseconds() },
      jobId: jobName,
    });
  }

  async cancelReminders(entityId: string): Promise<void> {
    const repeatableJobs = await reminderQueue.getRepeatableJobs();
    await Promise.all(
      repeatableJobs
        .filter((job) => job.name === `reminder:${entityId}`)
        .map((job) => reminderQueue.removeRepeatableByKey(job.key)),
    );
  }
}
