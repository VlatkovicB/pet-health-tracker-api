import { Inject, Service } from 'typedi';
import { HealthRecordRepository, HEALTH_RECORD_REPOSITORY } from '../../domain/health/HealthRecordRepository';
import { PetRepository, PET_REPOSITORY } from '../../domain/pet/PetRepository';
import { ReminderRepository, REMINDER_REPOSITORY } from '../../domain/reminder/ReminderRepository';
import { ForbiddenError, NotFoundError } from '../../shared/errors/AppError';
import { ReminderSchedulerService } from '../../infrastructure/queue/ReminderSchedulerService';

@Service()
export class ToggleMedicationReminderUseCase {
  constructor(
    @Inject(HEALTH_RECORD_REPOSITORY) private readonly healthRepo: HealthRecordRepository,
    @Inject(PET_REPOSITORY) private readonly petRepository: PetRepository,
    @Inject(REMINDER_REPOSITORY) private readonly reminderRepo: ReminderRepository,
    private readonly reminderScheduler: ReminderSchedulerService,
  ) {}

  async execute(medicationId: string, enabled: boolean, requestingUserId: string): Promise<void> {
    const medication = await this.healthRepo.findMedicationById(medicationId);
    if (!medication) throw new NotFoundError('Medication');

    const pet = await this.petRepository.findById(medication.petId);
    if (!pet) throw new NotFoundError('Pet');
    if (pet.userId !== requestingUserId) throw new ForbiddenError('Not your pet');

    const reminder = await this.reminderRepo.findByEntityId(medicationId);
    if (!reminder) throw new NotFoundError('Reminder');

    reminder.toggle(enabled);
    await this.reminderRepo.save(reminder);

    if (enabled) {
      await this.reminderScheduler.scheduleReminder(reminder, {
        petId: pet.id.toValue(),
        petName: pet.name,
        medicationName: medication.name,
        dosage: medication.dosage.toString(),
      });
    } else {
      await this.reminderScheduler.cancelReminders(medicationId);
    }
  }
}
