import { Inject, Service } from 'typedi';
import { HealthRecordRepository, HEALTH_RECORD_REPOSITORY } from '../../domain/health/HealthRecordRepository';
import { PetRepository, PET_REPOSITORY } from '../../domain/pet/PetRepository';
import { GroupRepository, GROUP_REPOSITORY } from '../../domain/group/GroupRepository';
import { VetVisit } from '../../domain/health/VetVisit';
import { ForbiddenError, NotFoundError } from '../../shared/errors/AppError';

export interface UpdateVetVisitInput {
  visitId: string;
  vetId?: string;
  reason?: string;
  notes?: string;
  visitDate?: Date;
  nextVisitDate?: Date | null;
  requestingUserId: string;
}

@Service()
export class UpdateVetVisitUseCase {
  constructor(
    @Inject(HEALTH_RECORD_REPOSITORY) private readonly healthRepo: HealthRecordRepository,
    @Inject(PET_REPOSITORY) private readonly petRepository: PetRepository,
    @Inject(GROUP_REPOSITORY) private readonly groupRepository: GroupRepository,
  ) {}

  async execute(input: UpdateVetVisitInput): Promise<VetVisit> {
    const existing = await this.healthRepo.findVetVisitById(input.visitId);
    if (!existing) throw new NotFoundError('VetVisit');

    const pet = await this.petRepository.findById(existing.petId);
    const group = await this.groupRepository.findById(pet!.groupId);
    if (!group?.hasMember(input.requestingUserId)) throw new ForbiddenError('Not a group member');

    const updated = VetVisit.reconstitute(
      {
        petId: existing.petId,
        createdBy: existing.createdBy,
        createdAt: existing.createdAt,
        imageUrls: existing.imageUrls,
        clinic: existing.clinic,
        vetName: existing.vetName,
        vetId: input.vetId !== undefined ? (input.vetId || undefined) : existing.vetId,
        reason: input.reason ?? existing.reason,
        notes: input.notes !== undefined ? (input.notes || undefined) : existing.notes,
        visitDate: input.visitDate ?? existing.visitDate,
        nextVisitDate: input.nextVisitDate === null
          ? undefined
          : (input.nextVisitDate ?? existing.nextVisitDate),
      },
      existing.id,
    );

    await this.healthRepo.saveVetVisit(updated);
    return updated;
  }
}
