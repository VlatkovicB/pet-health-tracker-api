import { Inject, Service } from 'typedi';
import { HealthRecordRepository, HEALTH_RECORD_REPOSITORY } from '../../domain/health/HealthRecordRepository';
import { PetRepository, PET_REPOSITORY } from '../../domain/pet/PetRepository';
import { ReminderRepository, REMINDER_REPOSITORY } from '../../domain/reminder/ReminderRepository';
import { Medication } from '../../domain/health/Medication';
import { Dosage } from '../../domain/health/value-objects/Dosage';
import { ReminderSchedule, ReminderScheduleProps } from '../../domain/health/value-objects/ReminderSchedule';
import { Reminder, AdvanceNotice } from '../../domain/reminder/Reminder';
import { ForbiddenError, NotFoundError } from '../../shared/errors/AppError';
import { ReminderSchedulerService } from '../../infrastructure/queue/ReminderSchedulerService';

export interface UpdateMedicationInput {
  medicationId: string;
  name?: string;
  dosageAmount?: number;
  dosageUnit?: string;
  schedule?: ReminderScheduleProps;
  startDate?: Date;
  endDate?: Date | null;
  notes?: string | null;
  active?: boolean;
  reminder?: { enabled: boolean; advanceNotice?: AdvanceNotice };
  requestingUserId: string;
}

@Service()
export class UpdateMedicationUseCase {
  constructor(
    @Inject(HEALTH_RECORD_REPOSITORY) private readonly healthRepo: HealthRecordRepository,
    @Inject(PET_REPOSITORY) private readonly petRepository: PetRepository,
    @Inject(REMINDER_REPOSITORY) private readonly reminderRepo: ReminderRepository,
    private readonly reminderScheduler: ReminderSchedulerService,
  ) {}

  async execute(input: UpdateMedicationInput): Promise<Medication> {
    const existing = await this.healthRepo.findMedicationById(input.medicationId);
    if (!existing) throw new NotFoundError('Medication');

    const pet = await this.petRepository.findById(existing.petId);
    if (!pet || pet.userId !== input.requestingUserId) throw new ForbiddenError('Not your pet');

    const newSchedule = input.schedule
      ? ReminderSchedule.create(input.schedule)
      : existing.schedule;

    const updated = Medication.reconstitute(
      {
        petId: existing.petId,
        createdBy: existing.createdBy,
        createdAt: existing.createdAt,
        name: input.name ?? existing.name,
        dosage: Dosage.create(
          input.dosageAmount ?? existing.dosage.amount,
          (input.dosageUnit ?? existing.dosage.unit) as any,
        ),
        schedule: newSchedule,
        startDate: input.startDate ?? existing.startDate,
        endDate: input.endDate === null ? undefined : (input.endDate ?? existing.endDate),
        notes: input.notes === null ? undefined : (input.notes ?? existing.notes),
        active: input.active ?? existing.active,
      },
      existing.id,
    );

    await this.healthRepo.saveMedication(updated);

    if (input.reminder !== undefined) {
      const existingReminder = await this.reminderRepo.findByEntityId(input.medicationId);
      let reminder: Reminder;
      if (existingReminder) {
        existingReminder.updateSchedule(newSchedule);
        existingReminder.toggle(input.reminder.enabled);
        existingReminder.updateAdvanceNotice(input.reminder.advanceNotice);
        reminder = existingReminder;
      } else {
        reminder = Reminder.create({
          entityType: 'medication',
          entityId: input.medicationId,
          schedule: newSchedule,
          enabled: input.reminder.enabled,
          advanceNotice: input.reminder.advanceNotice,
          notifyUserIds: [input.requestingUserId],
          createdBy: input.requestingUserId,
        });
      }
      await this.reminderRepo.save(reminder);

      if (input.reminder.enabled) {
        await this.reminderScheduler.scheduleReminder(
          reminder,
          { petId: pet.id.toValue(), petName: pet.name, medicationName: updated.name, dosage: updated.dosage.toString() },
        );
      } else {
        await this.reminderScheduler.cancelReminders(input.medicationId);
      }
    } else if (input.schedule) {
      const existingReminder = await this.reminderRepo.findByEntityId(input.medicationId);
      if (existingReminder) {
        existingReminder.updateSchedule(newSchedule);
        await this.reminderRepo.save(existingReminder);
        if (existingReminder.enabled) {
          await this.reminderScheduler.scheduleReminder(
            existingReminder,
            { petId: pet.id.toValue(), petName: pet.name, medicationName: updated.name, dosage: updated.dosage.toString() },
          );
        }
      }
    }

    return updated;
  }
}
