import { Inject, Service } from 'typedi';
import { PetShareRepository, PET_SHARE_REPOSITORY } from '../../domain/share/PetShareRepository';
import { PetShareDetails } from '../../domain/share/PetShareDetails';

@Service()
export class ListPendingSharesUseCase {
  constructor(@Inject(PET_SHARE_REPOSITORY) private readonly shareRepo: PetShareRepository) {}

  async execute(userId: string): Promise<PetShareDetails[]> {
    return this.shareRepo.findPendingForUserWithDetails(userId);
  }
}
