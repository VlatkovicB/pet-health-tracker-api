import { Inject, Service } from 'typedi';
import { HealthRecordRepository, HEALTH_RECORD_REPOSITORY } from '../../domain/health/HealthRecordRepository';
import { PetRepository, PET_REPOSITORY } from '../../domain/pet/PetRepository';
import { VetVisit } from '../../domain/health/VetVisit';
import { ForbiddenError, NotFoundError } from '../../shared/errors/AppError';
import { ReminderSchedulerService } from '../../infrastructure/queue/ReminderSchedulerService';

export interface UpdateVetVisitInput {
  visitId: string;
  vetId?: string;
  reason?: string;
  notes?: string;
  visitDate?: Date;
  requestingUserId: string;
}

@Service()
export class UpdateVetVisitUseCase {
  constructor(
    @Inject(HEALTH_RECORD_REPOSITORY) private readonly healthRepo: HealthRecordRepository,
    @Inject(PET_REPOSITORY) private readonly petRepository: PetRepository,
    private readonly reminderScheduler: ReminderSchedulerService,
  ) {}

  async execute(input: UpdateVetVisitInput): Promise<VetVisit> {
    const existing = await this.healthRepo.findVetVisitById(input.visitId);
    if (!existing) throw new NotFoundError('VetVisit');

    const pet = await this.petRepository.findById(existing.petId);
    if (!pet || pet.userId !== input.requestingUserId) throw new ForbiddenError('Not your pet');

    const updated = VetVisit.reconstitute(
      {
        petId: existing.petId,
        type: existing.type,
        createdBy: existing.createdBy,
        createdAt: existing.createdAt,
        imageUrls: existing.imageUrls,
        clinic: existing.clinic,
        vetName: existing.vetName,
        vetId: input.vetId !== undefined ? (input.vetId || undefined) : existing.vetId,
        reason: input.reason ?? existing.reason,
        notes: input.notes !== undefined ? (input.notes || undefined) : existing.notes,
        visitDate: input.visitDate ?? existing.visitDate,
      },
      existing.id,
    );

    await this.healthRepo.saveVetVisit(updated);

    // Reschedule lead-time job if visitDate changed on a scheduled visit
    if (updated.type === 'scheduled' && input.visitDate) {
      await this.reminderScheduler.scheduleVetVisitReminder({
        visitId: updated.id.toValue(),
        petName: pet.name,
        reason: updated.reason,
        nextVisitDate: updated.visitDate,
        vetName: updated.vetName,
        clinic: updated.clinic,
        notifyUserIds: [input.requestingUserId],
      });
    }

    return updated;
  }
}
