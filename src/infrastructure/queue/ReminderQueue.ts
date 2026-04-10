import { Queue } from 'bullmq';
import { redis } from './redis';

export interface ReminderJobData {
  medicationId: string;
  medicationName: string;
  dosage: string;
  petId: string;
  petName: string;
  notifyUserIds: string[];
}

export const REMINDER_QUEUE_NAME = 'medication-reminders';

export const reminderQueue = new Queue<ReminderJobData>(REMINDER_QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});
