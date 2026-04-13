import { Inject, Service } from 'typedi';
import { HealthRecordRepository, HEALTH_RECORD_REPOSITORY } from '../../domain/health/HealthRecordRepository';
import { PetRepository, PET_REPOSITORY } from '../../domain/pet/PetRepository';
import { VetVisit } from '../../domain/health/VetVisit';
import { ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors/AppError';
import { ReminderSchedulerService } from '../../infrastructure/queue/ReminderSchedulerService';

interface ScheduleNextVisitInput {
  visitDate: Date;
  vetId?: string;
  reason?: string;
}

interface AddVetVisitInput {
  petId: string;
  vetId?: string;
  visitDate: Date;
  clinic?: string;
  vetName?: string;
  reason: string;
  notes?: string;
  scheduleNextVisit?: ScheduleNextVisitInput;
  requestingUserId: string;
}

export interface AddVetVisitResult {
  visit: VetVisit;
  nextVisit?: VetVisit;
}

@Service()
export class AddVetVisitUseCase {
  constructor(
    @Inject(HEALTH_RECORD_REPOSITORY) private readonly healthRepo: HealthRecordRepository,
    @Inject(PET_REPOSITORY) private readonly petRepository: PetRepository,
    private readonly reminderScheduler: ReminderSchedulerService,
  ) {}

  async execute(input: AddVetVisitInput): Promise<AddVetVisitResult> {
    if (!input.reason?.trim()) throw new ValidationError('Reason is required');
    if (!input.visitDate) throw new ValidationError('Visit date is required');

    const pet = await this.petRepository.findById(input.petId);
    if (!pet) throw new NotFoundError('Pet');
    if (pet.userId !== input.requestingUserId) throw new ForbiddenError('Not your pet');

    const now = new Date();
    const type = input.visitDate > now ? 'scheduled' : 'logged';

    const visit = VetVisit.create({
      petId: input.petId,
      type,
      vetId: input.vetId,
      visitDate: input.visitDate,
      clinic: input.clinic,
      vetName: input.vetName,
      reason: input.reason,
      notes: input.notes,
      createdBy: input.requestingUserId,
    });

    await this.healthRepo.saveVetVisit(visit);

    if (type === 'scheduled') {
      await this.reminderScheduler.scheduleVetVisitReminder({
        visitId: visit.id.toValue(),
        petName: pet.name,
        reason: input.reason,
        nextVisitDate: input.visitDate,
        vetName: input.vetName,
        clinic: input.clinic,
        notifyUserIds: [input.requestingUserId],
      });
    }

    let nextVisit: VetVisit | undefined;
    if (input.scheduleNextVisit) {
      nextVisit = VetVisit.create({
        petId: input.petId,
        type: 'scheduled',
        vetId: input.scheduleNextVisit.vetId ?? input.vetId,
        visitDate: input.scheduleNextVisit.visitDate,
        reason: input.scheduleNextVisit.reason ?? input.reason,
        createdBy: input.requestingUserId,
      });
      await this.healthRepo.saveVetVisit(nextVisit);
      await this.reminderScheduler.scheduleVetVisitReminder({
        visitId: nextVisit.id.toValue(),
        petName: pet.name,
        reason: nextVisit.reason,
        nextVisitDate: nextVisit.visitDate,
        vetName: nextVisit.vetName,
        clinic: nextVisit.clinic,
        notifyUserIds: [input.requestingUserId],
      });
    }

    return { visit, nextVisit };
  }
}
