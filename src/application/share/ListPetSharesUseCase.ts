import { Inject, Service } from 'typedi';
import { PetAccessService } from '../pet/PetAccessService';
import { PetShareRepository, PET_SHARE_REPOSITORY } from '../../domain/share/PetShareRepository';
import { PetShare } from '../../domain/share/PetShare';

@Service()
export class ListPetSharesUseCase {
  constructor(
    private readonly petAccessService: PetAccessService,
    @Inject(PET_SHARE_REPOSITORY) private readonly shareRepo: PetShareRepository,
  ) {}

  async execute(petId: string, requestingUserId: string): Promise<PetShare[]> {
    await this.petAccessService.assertCanAccess(petId, requestingUserId, 'owner');
    return this.shareRepo.findByPetId(petId);
  }
}
