import { Inject, Service } from 'typedi';
import { HealthRecordRepository, HEALTH_RECORD_REPOSITORY } from '../../domain/health/HealthRecordRepository';
import { PetRepository, PET_REPOSITORY } from '../../domain/pet/PetRepository';
import { ReminderRepository, REMINDER_REPOSITORY } from '../../domain/reminder/ReminderRepository';
import { Medication } from '../../domain/health/Medication';
import { Dosage } from '../../domain/health/value-objects/Dosage';
import { ReminderSchedule, ReminderScheduleProps } from '../../domain/health/value-objects/ReminderSchedule';
import { Reminder, AdvanceNotice } from '../../domain/reminder/Reminder';
import { ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors/AppError';
import { ReminderSchedulerService } from '../../infrastructure/queue/ReminderSchedulerService';

interface LogMedicationInput {
  petId: string;
  name: string;
  dosageAmount: number;
  dosageUnit: string;
  schedule: ReminderScheduleProps;
  startDate: Date;
  endDate?: Date;
  notes?: string;
  reminder?: { enabled: boolean; advanceNotice?: AdvanceNotice };
  requestingUserId: string;
}

@Service()
export class LogMedicationUseCase {
  constructor(
    @Inject(HEALTH_RECORD_REPOSITORY) private readonly healthRepo: HealthRecordRepository,
    @Inject(PET_REPOSITORY) private readonly petRepository: PetRepository,
    @Inject(REMINDER_REPOSITORY) private readonly reminderRepo: ReminderRepository,
    private readonly reminderScheduler: ReminderSchedulerService,
  ) {}

  async execute(input: LogMedicationInput): Promise<Medication> {
    if (!input.name?.trim()) throw new ValidationError('Medication name is required');
    if (input.dosageAmount == null || isNaN(input.dosageAmount)) throw new ValidationError('Dosage amount is required');
    if (!input.dosageUnit?.trim()) throw new ValidationError('Dosage unit is required');
    if (!input.schedule) throw new ValidationError('Schedule is required');
    if (!input.startDate) throw new ValidationError('Start date is required');

    const pet = await this.petRepository.findById(input.petId);
    if (!pet) throw new NotFoundError('Pet');
    if (pet.userId !== input.requestingUserId) throw new ForbiddenError('Not your pet');

    const schedule = ReminderSchedule.create(input.schedule);

    const medication = Medication.create({
      petId: input.petId,
      name: input.name,
      dosage: Dosage.create(input.dosageAmount, input.dosageUnit as any),
      schedule,
      startDate: input.startDate,
      endDate: input.endDate,
      notes: input.notes,
      active: true,
      createdBy: input.requestingUserId,
    });

    await this.healthRepo.saveMedication(medication);

    if (input.reminder) {
      const reminder = Reminder.create({
        entityType: 'medication',
        entityId: medication.id.toValue(),
        schedule,
        enabled: input.reminder.enabled,
        advanceNotice: input.reminder.advanceNotice,
        notifyUserIds: [input.requestingUserId],
        createdBy: input.requestingUserId,
      });
      await this.reminderRepo.save(reminder);

      if (input.reminder.enabled) {
        await this.reminderScheduler.scheduleReminder(
          reminder,
          { petId: pet.id.toValue(), petName: pet.name, medicationName: medication.name, dosage: medication.dosage.toString() },
        );
      }
    }

    return medication;
  }
}
