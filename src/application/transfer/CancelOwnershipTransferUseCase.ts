import { Inject, Service } from 'typedi';
import { PetAccessService } from '../pet/PetAccessService';
import { PetOwnershipTransferRepository, PET_OWNERSHIP_TRANSFER_REPOSITORY } from '../../domain/transfer/PetOwnershipTransferRepository';
import { AppError, NotFoundError } from '../../shared/errors/AppError';

@Service()
export class CancelOwnershipTransferUseCase {
  constructor(
    private readonly petAccessService: PetAccessService,
    @Inject(PET_OWNERSHIP_TRANSFER_REPOSITORY) private readonly transferRepo: PetOwnershipTransferRepository,
  ) {}

  async execute(petId: string, requestingUserId: string): Promise<void> {
    await this.petAccessService.assertCanAccess(petId, requestingUserId, 'owner');
    const transfer = await this.transferRepo.findActivePendingByPetId(petId);
    if (!transfer) throw new NotFoundError('Transfer');
    if (transfer.status !== 'pending') throw new AppError('Transfer is no longer pending', 400);
    transfer.cancel();
    await this.transferRepo.save(transfer);
  }
}
