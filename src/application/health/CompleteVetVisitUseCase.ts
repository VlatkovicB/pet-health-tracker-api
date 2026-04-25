import { Inject, Service } from 'typedi';
import { HealthRecordRepository, HEALTH_RECORD_REPOSITORY } from '../../domain/health/HealthRecordRepository';
import { VetVisit } from '../../domain/health/VetVisit';
import { NotFoundError, ValidationError } from '../../shared/errors/AppError';
import { ReminderSchedulerService } from '../../infrastructure/queue/ReminderSchedulerService';
import { PetAccessService } from '../pet/PetAccessService';

interface CompleteVetVisitInput {
  visitId: string;
  notes?: string;
  requestingUserId: string;
}

@Service()
export class CompleteVetVisitUseCase {
  constructor(
    @Inject(HEALTH_RECORD_REPOSITORY) private readonly healthRepo: HealthRecordRepository,
    private readonly petAccessService: PetAccessService,
    private readonly reminderScheduler: ReminderSchedulerService,
  ) {}

  async execute(input: CompleteVetVisitInput): Promise<VetVisit> {
    const existing = await this.healthRepo.findVetVisitById(input.visitId);
    if (!existing) throw new NotFoundError('VetVisit');
    if (existing.type !== 'scheduled') {
      throw new ValidationError('Only scheduled visits can be marked as done');
    }

    await this.petAccessService.assertCanAccess(existing.petId, input.requestingUserId, 'edit_vet_visits');

    const completed = VetVisit.reconstitute(
      {
        petId: existing.petId,
        type: 'logged',
        vetId: existing.vetId,
        visitDate: existing.visitDate,
        clinic: existing.clinic,
        vetName: existing.vetName,
        reason: existing.reason,
        notes: input.notes ?? existing.notes,
        imageUrls: existing.imageUrls,
        createdBy: existing.createdBy,
        createdAt: existing.createdAt,
      },
      existing.id,
    );

    await this.healthRepo.saveVetVisit(completed);
    await this.reminderScheduler.cancelVetVisitReminder(input.visitId);
    await this.reminderScheduler.cancelReminders(input.visitId);

    return completed;
  }
}
