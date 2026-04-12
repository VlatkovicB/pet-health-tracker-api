import { Worker, Job } from 'bullmq';
import { redis } from './redis';
import {
  NOTIFICATION_QUEUE_NAME,
  NotificationJobData,
  MedicationReminderJobData,
  VetVisitReminderJobData,
} from './NotificationQueue';
import { EmailService } from '../email/EmailService';
import { UserRepository } from '../../domain/user/UserRepository';
import { User } from '../../domain/user/User';

export class NotificationWorker {
  private readonly worker: Worker<NotificationJobData>;

  constructor(
    private readonly emailService: EmailService,
    private readonly userRepository: UserRepository,
  ) {
    this.worker = new Worker<NotificationJobData>(
      NOTIFICATION_QUEUE_NAME,
      (job) => this.process(job),
      { connection: redis },
    );

    this.worker.on('failed', (job, err) => {
      console.error(`Notification job ${job?.id} (${job?.data.type}) failed:`, err.message);
    });
  }

  private async process(job: Job<NotificationJobData>): Promise<void> {
    const users = await this.userRepository.findByIds(job.data.notifyUserIds);

    switch (job.data.type) {
      case 'medication_reminder':
        await this.processMedicationReminder(job.data, users);
        break;
      case 'vet_visit_reminder':
        await this.processVetVisitReminder(job.data, users);
        break;
    }
  }

  private async processMedicationReminder(data: MedicationReminderJobData, users: User[]): Promise<void> {
    await Promise.all(
      users.map((user) =>
        this.emailService.sendMedicationReminder(user.email, {
          recipientName: user.name,
          petName: data.petName,
          medicationName: data.medicationName,
          dosage: data.dosage,
        }),
      ),
    );
  }

  private async processVetVisitReminder(data: VetVisitReminderJobData, users: User[]): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [year, month, day] = data.nextVisitDate.split('T')[0].split('-').map(Number);
    const visitDay = new Date(year, month - 1, day);
    const daysUntil = Math.round((visitDay.getTime() - today.getTime()) / 86_400_000);

    await Promise.all(
      users.map((user) =>
        this.emailService.sendVetVisitReminder(user.email, {
          recipientName: user.name,
          petName: data.petName,
          reason: data.reason,
          nextVisitDate: data.nextVisitDate,
          vetName: data.vetName,
          clinic: data.clinic,
          daysUntil,
        }),
      ),
    );
  }

  async close(): Promise<void> {
    await this.worker.close();
  }
}
