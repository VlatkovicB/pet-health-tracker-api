import { Inject, Service } from 'typedi';
import { HealthRecordRepository, HEALTH_RECORD_REPOSITORY } from '../../domain/health/HealthRecordRepository';
import { PetRepository, PET_REPOSITORY } from '../../domain/pet/PetRepository';
import { ReminderRepository, REMINDER_REPOSITORY } from '../../domain/reminder/ReminderRepository';
import { Reminder } from '../../domain/reminder/Reminder';
import { ReminderSchedule, ReminderScheduleProps } from '../../domain/health/value-objects/ReminderSchedule';
import { ForbiddenError, NotFoundError } from '../../shared/errors/AppError';
import { ReminderSchedulerService } from '../../infrastructure/queue/ReminderSchedulerService';

interface ConfigureReminderInput {
  medicationId: string;
  schedule: ReminderScheduleProps;
  enabled: boolean;
  requestingUserId: string;
}

@Service()
export class ConfigureMedicationReminderUseCase {
  constructor(
    @Inject(HEALTH_RECORD_REPOSITORY) private readonly healthRepo: HealthRecordRepository,
    @Inject(PET_REPOSITORY) private readonly petRepository: PetRepository,
    @Inject(REMINDER_REPOSITORY) private readonly reminderRepo: ReminderRepository,
    private readonly reminderScheduler: ReminderSchedulerService,
  ) {}

  async execute(input: ConfigureReminderInput): Promise<void> {
    const medication = await this.healthRepo.findMedicationById(input.medicationId);
    if (!medication) throw new NotFoundError('Medication');

    const pet = await this.petRepository.findById(medication.petId);
    if (!pet) throw new NotFoundError('Pet');
    if (pet.userId !== input.requestingUserId) throw new ForbiddenError('Not your pet');

    const schedule = ReminderSchedule.create(input.schedule);

    const existing = await this.reminderRepo.findByEntityId(input.medicationId);

    let reminder: Reminder;
    if (existing) {
      existing.updateSchedule(schedule);
      existing.toggle(input.enabled);
      reminder = existing;
    } else {
      reminder = Reminder.create({
        entityType: 'medication',
        entityId: input.medicationId,
        schedule,
        enabled: input.enabled,
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
