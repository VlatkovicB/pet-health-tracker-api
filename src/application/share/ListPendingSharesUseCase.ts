import { Inject, Service } from 'typedi';
import { PetShareRepository, PET_SHARE_REPOSITORY } from '../../domain/share/PetShareRepository';
import { PetShare } from '../../domain/share/PetShare';

@Service()
export class ListPendingSharesUseCase {
  constructor(@Inject(PET_SHARE_REPOSITORY) private readonly shareRepo: PetShareRepository) {}

  async execute(userId: string): Promise<PetShare[]> {
    return this.shareRepo.findPendingForUser(userId);
  }
}
