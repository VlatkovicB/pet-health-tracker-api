import { Inject, Service } from 'typedi';
import { PetOwnershipTransferRepository, PET_OWNERSHIP_TRANSFER_REPOSITORY } from '../../domain/transfer/PetOwnershipTransferRepository';
import { AppError, ForbiddenError, NotFoundError } from '../../shared/errors/AppError';

@Service()
export class DeclineOwnershipTransferUseCase {
  constructor(
    @Inject(PET_OWNERSHIP_TRANSFER_REPOSITORY) private readonly transferRepo: PetOwnershipTransferRepository,
  ) {}

  async execute(transferId: string, requestingUserId: string): Promise<void> {
    const transfer = await this.transferRepo.findById(transferId);
    if (!transfer) throw new NotFoundError('Transfer');
    if (transfer.toUserId !== requestingUserId) throw new ForbiddenError();
    if (transfer.status !== 'pending') throw new AppError('Transfer is no longer pending', 400);
    transfer.decline();
    await this.transferRepo.save(transfer);
  }
}
