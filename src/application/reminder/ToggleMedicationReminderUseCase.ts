import { Inject, Service } from 'typedi';
import { HealthRecordRepository, HEALTH_RECORD_REPOSITORY } from '../../domain/health/HealthRecordRepository';
import { PetRepository, PET_REPOSITORY } from '../../domain/pet/PetRepository';
import { GroupRepository, GROUP_REPOSITORY } from '../../domain/group/GroupRepository';
import { ForbiddenError, NotFoundError } from '../../shared/errors/AppError';
import { ReminderSchedulerService } from '../../infrastructure/queue/ReminderSchedulerService';

@Service()
export class ToggleMedicationReminderUseCase {
  constructor(
    @Inject(HEALTH_RECORD_REPOSITORY) private readonly healthRepo: HealthRecordRepository,
    @Inject(PET_REPOSITORY) private readonly petRepository: PetRepository,
    @Inject(GROUP_REPOSITORY) private readonly groupRepository: GroupRepository,
    private readonly reminderScheduler: ReminderSchedulerService,
  ) {}

  async execute(medicationId: string, enabled: boolean, requestingUserId: string): Promise<void> {
    const medication = await this.healthRepo.findMedicationById(medicationId);
    if (!medication) throw new NotFoundError('Medication');

    const pet = await this.petRepository.findById(medication.petId);
    if (!pet) throw new NotFoundError('Pet');

    const group = await this.groupRepository.findById(pet.groupId);
    if (!group?.hasMember(requestingUserId)) throw new ForbiddenError('Not a group member');

    medication.toggleReminder(enabled);
    await this.healthRepo.saveMedication(medication);

    if (enabled) {
      await this.reminderScheduler.scheduleReminder(medication, pet);
    } else {
      await this.reminderScheduler.cancelReminders(medicationId);
    }
  }
}
