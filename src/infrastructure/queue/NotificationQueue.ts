import { Queue } from 'bullmq';
import { redis } from './redis';

export type NotificationType = 'medication_reminder' | 'vet_visit_reminder' | 'vet_visit_repeating_reminder';

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
  nextVisitDate: string;
  vetName?: string;
  clinic?: string;
  notifyUserIds: string[];
}

export interface VetVisitRepeatingReminderJobData {
  type: 'vet_visit_repeating_reminder';
  reminderId: string;
  petName: string;
  reason: string;
  visitDate: string; // ISO — the scheduled appointment date
  vetName?: string;
  clinic?: string;
  notifyUserIds: string[];
}

export type NotificationJobData =
  | MedicationReminderJobData
  | VetVisitReminderJobData
  | VetVisitRepeatingReminderJobData;

export const NOTIFICATION_QUEUE_NAME = 'notifications';

export const notificationQueue = new Queue<NotificationJobData>(NOTIFICATION_QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});
