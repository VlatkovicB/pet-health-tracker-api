import { Inject, Service } from 'typedi';
import { PetAccessService } from '../pet/PetAccessService';
import { PetShareRepository, PET_SHARE_REPOSITORY } from '../../domain/share/PetShareRepository';
import { ForbiddenError, NotFoundError } from '../../shared/errors/AppError';

@Service()
export class RevokeShareUseCase {
  constructor(
    private readonly petAccessService: PetAccessService,
    @Inject(PET_SHARE_REPOSITORY) private readonly shareRepo: PetShareRepository,
  ) {}

  async execute(petId: string, shareId: string, requestingUserId: string): Promise<void> {
    await this.petAccessService.assertCanAccess(petId, requestingUserId, 'owner');
    const share = await this.shareRepo.findById(shareId);
    if (!share) throw new NotFoundError('Share');
    if (share.petId !== petId) throw new ForbiddenError();
    await this.shareRepo.delete(shareId);
  }
}
