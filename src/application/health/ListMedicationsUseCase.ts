import { Inject, Service } from 'typedi';
import { HealthRecordRepository, HEALTH_RECORD_REPOSITORY, MedicationSummary } from '../../domain/health/HealthRecordRepository';
import { PetAccessService } from '../pet/PetAccessService';

@Service()
export class ListMedicationsUseCase {
  constructor(
    @Inject(HEALTH_RECORD_REPOSITORY) private readonly healthRepo: HealthRecordRepository,
    private readonly petAccessService: PetAccessService,
  ) {}

  async execute(petId: string, requestingUserId: string): Promise<MedicationSummary[]> {
    await this.petAccessService.assertCanAccess(petId, requestingUserId, 'view_medications');
    return this.healthRepo.findMedicationsByPetId(petId);
  }
}
