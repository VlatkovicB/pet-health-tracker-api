import { Inject, Service } from 'typedi';
import { HealthRecordRepository, HEALTH_RECORD_REPOSITORY } from '../../domain/health/HealthRecordRepository';
import { PetRepository, PET_REPOSITORY } from '../../domain/pet/PetRepository';
import { PaginationParams, PaginatedResult } from '../../shared/types/Pagination';
import { VetVisit } from '../../domain/health/VetVisit';
import { ForbiddenError, NotFoundError } from '../../shared/errors/AppError';

@Service()
export class ListVetVisitsUseCase {
  constructor(
    @Inject(HEALTH_RECORD_REPOSITORY) private readonly healthRepo: HealthRecordRepository,
    @Inject(PET_REPOSITORY) private readonly petRepository: PetRepository,
  ) {}

  async execute(petId: string, requestingUserId: string, pagination: PaginationParams): Promise<PaginatedResult<VetVisit>> {
    const pet = await this.petRepository.findById(petId);
    if (!pet) throw new NotFoundError('Pet');
    if (pet.userId !== requestingUserId) throw new ForbiddenError('Not your pet');
    return this.healthRepo.findVetVisitsByPetId(petId, pagination);
  }
}
