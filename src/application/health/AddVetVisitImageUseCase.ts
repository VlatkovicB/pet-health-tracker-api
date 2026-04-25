import { Inject, Service } from 'typedi';
import { HealthRecordRepository, HEALTH_RECORD_REPOSITORY } from '../../domain/health/HealthRecordRepository';
import { VetVisit } from '../../domain/health/VetVisit';
import { NotFoundError } from '../../shared/errors/AppError';
import { PetAccessService } from '../pet/PetAccessService';

@Service()
export class AddVetVisitImageUseCase {
  constructor(
    @Inject(HEALTH_RECORD_REPOSITORY) private readonly healthRepo: HealthRecordRepository,
    private readonly petAccessService: PetAccessService,
  ) {}

  async execute(visitId: string, imageUrl: string, requestingUserId: string): Promise<VetVisit> {
    const visit = await this.healthRepo.findVetVisitById(visitId);
    if (!visit) throw new NotFoundError('VetVisit');

    await this.petAccessService.assertCanAccess(visit.petId, requestingUserId, 'edit_vet_visits');

    const updated = VetVisit.addImage(visit, imageUrl);
    await this.healthRepo.saveVetVisit(updated);
    return updated;
  }
}
