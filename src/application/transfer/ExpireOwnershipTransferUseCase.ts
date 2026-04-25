import { Inject, Service } from 'typedi';
import { PetOwnershipTransferRepository, PET_OWNERSHIP_TRANSFER_REPOSITORY } from '../../domain/transfer/PetOwnershipTransferRepository';

@Service()
export class ExpireOwnershipTransferUseCase {
  constructor(
    @Inject(PET_OWNERSHIP_TRANSFER_REPOSITORY) private readonly transferRepo: PetOwnershipTransferRepository,
  ) {}

  async execute(transferId: string): Promise<void> {
    const transfer = await this.transferRepo.findById(transferId);
    if (!transfer || transfer.status !== 'pending') return;
    transfer.expire();
    await this.transferRepo.save(transfer);
  }
}
