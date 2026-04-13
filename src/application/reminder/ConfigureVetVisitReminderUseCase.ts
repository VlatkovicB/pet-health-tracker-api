import { Inject, Service } from 'typedi';
import { HealthRecordRepository, HEALTH_RECORD_REPOSITORY } from '../../domain/health/HealthRecordRepository';
import { PetRepository, PET_REPOSITORY } from '../../domain/pet/PetRepository';
import { ReminderRepository, REMINDER_REPOSITORY } from '../../domain/reminder/ReminderRepository';
import { Reminder } from '../../domain/reminder/Reminder';
import { ReminderSchedule, ReminderScheduleProps } from '../../domain/health/value-objects/ReminderSchedule';
import { ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors/AppError';
import { ReminderSchedulerService } from '../../infrastructure/queue/ReminderSchedulerService';

interface ConfigureVetVisitReminderInput {
  visitId: string;
  schedule: ReminderScheduleProps;
  enabled: boolean;
  requestingUserId: string;
}

@Service()
export class ConfigureVetVisitReminderUseCase {
  constructor(
    @Inject(HEALTH_RECORD_REPOSITORY) private readonly healthRepo: HealthRecordRepository,
    @Inject(PET_REPOSITORY) private readonly petRepository: PetRepository,
    @Inject(REMINDER_REPOSITORY) private readonly reminderRepo: ReminderRepository,
    private readonly reminderScheduler: ReminderSchedulerService,
  ) {}

  async execute(input: ConfigureVetVisitReminderInput): Promise<void> {
    const visit = await this.healthRepo.findVetVisitById(input.visitId);
    if (!visit) throw new NotFoundError('VetVisit');
    if (visit.type !== 'scheduled') {
      throw new ValidationError('Only scheduled visits can have repeating reminders');
    }

    const pet = await this.petRepository.findById(visit.petId);
    if (!pet) throw new NotFoundError('Pet');
    if (pet.userId !== input.requestingUserId) throw new ForbiddenError('Not your pet');

    const schedule = ReminderSchedule.create(input.schedule);
    const existing = await this.reminderRepo.findByEntityId(input.visitId);

    let reminder: Reminder;
    if (existing) {
      existing.updateSchedule(schedule);
      existing.toggle(input.enabled);
      reminder = existing;
    } else {
      reminder = Reminder.create({
        entityType: 'vet_visit',
        entityId: input.visitId,
        schedule,
        enabled: input.enabled,
        notifyUserIds: [input.requestingUserId],
        createdBy: input.requestingUserId,
      });
    }

    await this.reminderRepo.save(reminder);

    if (input.enabled) {
      await this.reminderScheduler.scheduleVetVisitRepeatingReminder(reminder, {
        petId: pet.id.toValue(),
        petName: pet.name,
        reason: visit.reason,
        visitDate: visit.visitDate,
        vetName: visit.vetName,
        clinic: visit.clinic,
      });
    } else {
      await this.reminderScheduler.cancelReminders(input.visitId);
    }
  }
}
