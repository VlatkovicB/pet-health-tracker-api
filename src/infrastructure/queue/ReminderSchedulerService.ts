import { Service } from 'typedi';
import { reminderQueue, ReminderJobData } from './ReminderQueue';
import { Medication } from '../../domain/health/Medication';
import { Pet } from '../../domain/pet/Pet';

@Service()
export class ReminderSchedulerService {
  async scheduleReminder(medication: Medication, pet: Pet): Promise<void> {
    const { reminder } = medication;
    if (!reminder || !reminder.enabled) return;

    await this.cancelReminders(medication.id.toValue());

    const cronExpressions = reminder.schedule.toCronExpressions();
    const jobData: ReminderJobData = {
      medicationId: medication.id.toValue(),
      medicationName: medication.name,
      dosage: medication.dosage.toString(),
      petId: pet.id.toValue(),
      petName: pet.name,
      notifyUserIds: reminder.notifyUserIds,
    };

    for (const pattern of cronExpressions) {
      const jobName = `reminder:${medication.id.toValue()}:${pattern}`;
      await reminderQueue.add(jobName, jobData, {
        repeat: { pattern, tz: reminder.schedule.timezone },
        jobId: jobName,
      });
    }
  }

  async cancelReminders(medicationId: string): Promise<void> {
    const repeatableJobs = await reminderQueue.getRepeatableJobs();
    await Promise.all(
      repeatableJobs
        .filter((job) => job.name.startsWith(`reminder:${medicationId}:`))
        .map((job) => reminderQueue.removeRepeatableByKey(job.key)),
    );
  }
}
