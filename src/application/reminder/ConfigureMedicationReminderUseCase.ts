import { Inject, Service } from 'typedi';
import { HealthRecordRepository, HEALTH_RECORD_REPOSITORY } from '../../domain/health/HealthRecordRepository';
import { ReminderRepository, REMINDER_REPOSITORY } from '../../domain/reminder/ReminderRepository';
import { Reminder, AdvanceNotice } from '../../domain/reminder/Reminder';
import { NotFoundError } from '../../shared/errors/AppError';
import { ReminderSchedulerService } from '../../infrastructure/queue/ReminderSchedulerService';
import { PetAccessService } from '../pet/PetAccessService';

interface ConfigureReminderInput {
  medicationId: string;
  enabled: boolean;
  advanceNotice?: AdvanceNotice;
  requestingUserId: string;
}

@Service()
export class ConfigureMedicationReminderUseCase {
  constructor(
    @Inject(HEALTH_RECORD_REPOSITORY) private readonly healthRepo: HealthRecordRepository,
    private readonly petAccessService: PetAccessService,
    @Inject(REMINDER_REPOSITORY) private readonly reminderRepo: ReminderRepository,
    private readonly reminderScheduler: ReminderSchedulerService,
  ) {}

  async execute(input: ConfigureReminderInput): Promise<void> {
    const medication = await this.healthRepo.findMedicationById(input.medicationId);
    if (!medication) throw new NotFoundError('Medication');

    const pet = await this.petAccessService.assertCanAccess(medication.petId, input.requestingUserId, 'view_pet');

    const existing = await this.reminderRepo.findByEntityId(input.medicationId);

    let reminder: Reminder;
    if (existing) {
      existing.toggle(input.enabled);
      existing.updateAdvanceNotice(input.advanceNotice);
      reminder = existing;
    } else {
      reminder = Reminder.create({
        entityType: 'medication',
        entityId: input.medicationId,
        schedule: medication.schedule,
        enabled: input.enabled,
        advanceNotice: input.advanceNotice,
        notifyUserIds: [input.requestingUserId],
        createdBy: input.requestingUserId,
      });
    }

    await this.reminderRepo.save(reminder);

    if (input.enabled) {
      await this.reminderScheduler.scheduleReminder(reminder, {
        petId: pet.id.toValue(),
        petName: pet.name,
        medicationName: medication.name,
        dosage: medication.dosage.toString(),
      });
    } else {
      await this.reminderScheduler.cancelReminders(input.medicationId);
    }
  }
}
