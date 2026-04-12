import { Queue } from 'bullmq';
import { redis } from './redis';

export type NotificationType = 'medication_reminder' | 'vet_visit_reminder';

export interface MedicationReminderJobData {
  type: 'medication_reminder';
  reminderId: string;
  petName: string;
  medicationName: string;
  dosage: string;
  notifyUserIds: string[];
}

export interface VetVisitReminderJobData {
  type: 'vet_visit_reminder';
  visitId: string;
  petName: string;
  reason: string;
  nextVisitDate: string; // ISO string
  vetName?: string;
  clinic?: string;
  notifyUserIds: string[];
}

export type NotificationJobData = MedicationReminderJobData | VetVisitReminderJobData;

export const NOTIFICATION_QUEUE_NAME = 'notifications';

export const notificationQueue = new Queue<NotificationJobData>(NOTIFICATION_QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});
