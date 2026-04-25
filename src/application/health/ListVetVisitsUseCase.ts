import { Inject, Service } from 'typedi';
import { HealthRecordRepository, HEALTH_RECORD_REPOSITORY } from '../../domain/health/HealthRecordRepository';
import { PaginationParams, PaginatedResult } from '../../shared/types/Pagination';
import { VetVisit } from '../../domain/health/VetVisit';
import { PetAccessService } from '../pet/PetAccessService';

@Service()
export class ListVetVisitsUseCase {
  constructor(
    @Inject(HEALTH_RECORD_REPOSITORY) private readonly healthRepo: HealthRecordRepository,
    private readonly petAccessService: PetAccessService,
  ) {}

  async execute(petId: string, requestingUserId: string, pagination: PaginationParams): Promise<PaginatedResult<VetVisit>> {
    await this.petAccessService.assertCanAccess(petId, requestingUserId, 'view_vet_visits');
    return this.healthRepo.findVetVisitsByPetId(petId, pagination);
  }
}
