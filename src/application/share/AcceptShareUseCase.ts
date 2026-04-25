import { Inject, Service } from 'typedi';
import { PetShareRepository, PET_SHARE_REPOSITORY } from '../../domain/share/PetShareRepository';
import { ForbiddenError, NotFoundError } from '../../shared/errors/AppError';

@Service()
export class AcceptShareUseCase {
  constructor(@Inject(PET_SHARE_REPOSITORY) private readonly shareRepo: PetShareRepository) {}

  async execute(shareId: string, requestingUserId: string): Promise<void> {
    const share = await this.shareRepo.findById(shareId);
    if (!share) throw new NotFoundError('Share');
    if (share.sharedWithUserId !== requestingUserId) throw new ForbiddenError();
    share.accept();
    await this.shareRepo.save(share);
  }
}
