import { Inject, Service } from 'typedi';
import { PetOwnershipTransferRepository, PET_OWNERSHIP_TRANSFER_REPOSITORY } from '../../domain/transfer/PetOwnershipTransferRepository';
import { PetOwnershipTransfer } from '../../domain/transfer/PetOwnershipTransfer';

@Service()
export class ListPendingTransfersUseCase {
  constructor(
    @Inject(PET_OWNERSHIP_TRANSFER_REPOSITORY) private readonly transferRepo: PetOwnershipTransferRepository,
  ) {}

  async execute(userId: string): Promise<PetOwnershipTransfer[]> {
    return this.transferRepo.findPendingForUser(userId);
  }
}
