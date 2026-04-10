import { Worker, Job } from 'bullmq';
import { redis } from './redis';
import { REMINDER_QUEUE_NAME, ReminderJobData } from './ReminderQueue';
import { EmailService } from '../email/EmailService';
import { UserRepository } from '../../domain/user/UserRepository';

export class ReminderWorker {
  private readonly worker: Worker<ReminderJobData>;

  constructor(
    private readonly emailService: EmailService,
    private readonly userRepository: UserRepository,
  ) {
    this.worker = new Worker<ReminderJobData>(
      REMINDER_QUEUE_NAME,
      (job) => this.process(job),
      { connection: redis },
    );

    this.worker.on('failed', (job, err) => {
      console.error(`Reminder job ${job?.id} failed:`, err.message);
    });
  }

  private async process(job: Job<ReminderJobData>): Promise<void> {
    const { medicationName, dosage, petName, notifyUserIds } = job.data;

    const users = await this.userRepository.findByIds(notifyUserIds);

    await Promise.all(
      users.map((user) =>
        this.emailService.sendMedicationReminder({
          to: user.email,
          recipientName: user.name,
          petName,
          medicationName,
          dosage,
        }),
      ),
    );
  }

  async close(): Promise<void> {
    await this.worker.close();
  }
}
