import { Inject, Service } from 'typedi';
import { HealthRecordRepository, HEALTH_RECORD_REPOSITORY } from '../../domain/health/HealthRecordRepository';
import { PetRepository, PET_REPOSITORY } from '../../domain/pet/PetRepository';
import { VetVisit } from '../../domain/health/VetVisit';
import { ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors/AppError';
import { ReminderSchedulerService } from '../../infrastructure/queue/ReminderSchedulerService';

interface AddVetVisitInput {
  petId: string;
  vetId?: string;
  visitDate: Date;
  clinic?: string;
  vetName?: string;
  reason: string;
  notes?: string;
  nextVisitDate?: Date;
  requestingUserId: string;
}

@Service()
export class AddVetVisitUseCase {
  constructor(
    @Inject(HEALTH_RECORD_REPOSITORY) private readonly healthRepo: HealthRecordRepository,
    @Inject(PET_REPOSITORY) private readonly petRepository: PetRepository,
    private readonly reminderScheduler: ReminderSchedulerService,
  ) {}

  async execute(input: AddVetVisitInput): Promise<VetVisit> {
    if (!input.reason?.trim()) throw new ValidationError('Reason is required');
    if (!input.visitDate) throw new ValidationError('Visit date is required');

    const pet = await this.petRepository.findById(input.petId);
    if (!pet) throw new NotFoundError('Pet');
    if (pet.userId !== input.requestingUserId) throw new ForbiddenError('Not your pet');

    const visit = VetVisit.create({
      petId: input.petId,
      vetId: input.vetId,
      visitDate: input.visitDate,
      clinic: input.clinic,
      vetName: input.vetName,
      reason: input.reason,
      notes: input.notes,
      nextVisitDate: input.nextVisitDate,
      createdBy: input.requestingUserId,
    });

    await this.healthRepo.saveVetVisit(visit);

    if (input.nextVisitDate) {
      await this.reminderScheduler.scheduleVetVisitReminder({
        visitId: visit.id.toValue(),
        petName: pet.name,
        reason: input.reason,
        nextVisitDate: input.nextVisitDate,
        vetName: input.vetName,
        clinic: input.clinic,
        notifyUserIds: [input.requestingUserId],
      });
    }

    return visit;
  }
}
