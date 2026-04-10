import { Inject, Service } from 'typedi';
import { HealthRecordRepository, HEALTH_RECORD_REPOSITORY } from '../../domain/health/HealthRecordRepository';
import { PetRepository, PET_REPOSITORY } from '../../domain/pet/PetRepository';
import { GroupRepository, GROUP_REPOSITORY } from '../../domain/group/GroupRepository';
import { ReminderSchedule, DayOfWeek } from '../../domain/health/value-objects/ReminderSchedule';
import { ForbiddenError, NotFoundError } from '../../shared/errors/AppError';
import { ReminderSchedulerService } from '../../infrastructure/queue/ReminderSchedulerService';

interface ConfigureReminderInput {
  medicationId: string;
  times?: string[];
  intervalHours?: number;
  days?: DayOfWeek[];
  timezone: string;
  notifyUserIds: string[];
  enabled: boolean;
  requestingUserId: string;
}

@Service()
export class ConfigureMedicationReminderUseCase {
  constructor(
    @Inject(HEALTH_RECORD_REPOSITORY) private readonly healthRepo: HealthRecordRepository,
    @Inject(PET_REPOSITORY) private readonly petRepository: PetRepository,
    @Inject(GROUP_REPOSITORY) private readonly groupRepository: GroupRepository,
    private readonly reminderScheduler: ReminderSchedulerService,
  ) {}

  async execute(input: ConfigureReminderInput): Promise<void> {
    const medication = await this.healthRepo.findMedicationById(input.medicationId);
    if (!medication) throw new NotFoundError('Medication');

    const pet = await this.petRepository.findById(medication.petId);
    if (!pet) throw new NotFoundError('Pet');

    const group = await this.groupRepository.findById(pet.groupId);
    if (!group?.hasMember(input.requestingUserId)) throw new ForbiddenError('Not a group member');

    const schedule = ReminderSchedule.create({
      times: input.times,
      intervalHours: input.intervalHours,
      days: input.days,
      timezone: input.timezone,
    });

    medication.configureReminder({
      schedule,
      enabled: input.enabled,
      notifyUserIds: input.notifyUserIds,
    });

    await this.healthRepo.saveMedication(medication);

    if (input.enabled) {
      await this.reminderScheduler.scheduleReminder(medication, pet);
    } else {
      await this.reminderScheduler.cancelReminders(medication.id.toValue());
    }
  }
}
