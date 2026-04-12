import { Inject, Service } from 'typedi';
import { HealthRecordRepository, HEALTH_RECORD_REPOSITORY } from '../../domain/health/HealthRecordRepository';
import { PetRepository, PET_REPOSITORY } from '../../domain/pet/PetRepository';
import { VetVisit } from '../../domain/health/VetVisit';
import { ForbiddenError, NotFoundError } from '../../shared/errors/AppError';

@Service()
export class AddVetVisitImageUseCase {
  constructor(
    @Inject(HEALTH_RECORD_REPOSITORY) private readonly healthRepo: HealthRecordRepository,
    @Inject(PET_REPOSITORY) private readonly petRepository: PetRepository,
  ) {}

  async execute(visitId: string, imageUrl: string, requestingUserId: string): Promise<VetVisit> {
    const visit = await this.healthRepo.findVetVisitById(visitId);
    if (!visit) throw new NotFoundError('VetVisit');

    const pet = await this.petRepository.findById(visit.petId);
    if (!pet) throw new NotFoundError('Pet');
    if (pet.userId !== requestingUserId) throw new ForbiddenError('Not your pet');

    const updated = VetVisit.addImage(visit, imageUrl);
    await this.healthRepo.saveVetVisit(updated);
    return updated;
  }
}
