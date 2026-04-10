import { Inject, Service } from 'typedi';
import { HealthRecordRepository, HEALTH_RECORD_REPOSITORY } from '../../domain/health/HealthRecordRepository';
import { PetRepository, PET_REPOSITORY } from '../../domain/pet/PetRepository';
import { GroupRepository, GROUP_REPOSITORY } from '../../domain/group/GroupRepository';
import { VetVisit } from '../../domain/health/VetVisit';
import { ForbiddenError, NotFoundError } from '../../shared/errors/AppError';

@Service()
export class AddVetVisitImageUseCase {
  constructor(
    @Inject(HEALTH_RECORD_REPOSITORY) private readonly healthRepo: HealthRecordRepository,
    @Inject(PET_REPOSITORY) private readonly petRepository: PetRepository,
    @Inject(GROUP_REPOSITORY) private readonly groupRepository: GroupRepository,
  ) {}

  async execute(visitId: string, imageUrl: string, requestingUserId: string): Promise<VetVisit> {
    const visit = await this.healthRepo.findVetVisitById(visitId);
    if (!visit) throw new NotFoundError('VetVisit');

    const pet = await this.petRepository.findById(visit.petId);
    if (!pet) throw new NotFoundError('Pet');

    const group = await this.groupRepository.findById(pet.groupId);
    if (!group?.hasMember(requestingUserId)) throw new ForbiddenError('Not a group member');

    const updated = VetVisit.addImage(visit, imageUrl);
    await this.healthRepo.saveVetVisit(updated);
    return updated;
  }
}
