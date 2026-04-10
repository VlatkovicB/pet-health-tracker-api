import { Inject, Service } from 'typedi';
import { HealthRecordRepository, HEALTH_RECORD_REPOSITORY } from '../../domain/health/HealthRecordRepository';
import { PetRepository, PET_REPOSITORY } from '../../domain/pet/PetRepository';
import { GroupRepository, GROUP_REPOSITORY } from '../../domain/group/GroupRepository';
import { PaginationParams, PaginatedResult } from '../../shared/types/Pagination';
import { HealthCheck } from '../../domain/health/HealthCheck';
import { ForbiddenError, NotFoundError } from '../../shared/errors/AppError';

@Service()
export class ListHealthChecksUseCase {
  constructor(
    @Inject(HEALTH_RECORD_REPOSITORY) private readonly healthRepo: HealthRecordRepository,
    @Inject(PET_REPOSITORY) private readonly petRepository: PetRepository,
    @Inject(GROUP_REPOSITORY) private readonly groupRepository: GroupRepository,
  ) {}

  async execute(petId: string, requestingUserId: string, pagination: PaginationParams): Promise<PaginatedResult<HealthCheck>> {
    const pet = await this.petRepository.findById(petId);
    if (!pet) throw new NotFoundError('Pet');
    const group = await this.groupRepository.findById(pet.groupId);
    if (!group?.hasMember(requestingUserId)) throw new ForbiddenError('Not a group member');
    return this.healthRepo.findHealthChecksByPetId(petId, pagination);
  }
}
