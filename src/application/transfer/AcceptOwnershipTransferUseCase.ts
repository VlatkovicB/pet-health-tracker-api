import { Inject, Service } from 'typedi';
import { PetOwnershipTransferRepository, PET_OWNERSHIP_TRANSFER_REPOSITORY } from '../../domain/transfer/PetOwnershipTransferRepository';
import { PetRepository, PET_REPOSITORY } from '../../domain/pet/PetRepository';
import { PetShareRepository, PET_SHARE_REPOSITORY } from '../../domain/share/PetShareRepository';
import { PetShare } from '../../domain/share/PetShare';
import { AppError, ForbiddenError, NotFoundError } from '../../shared/errors/AppError';

@Service()
export class AcceptOwnershipTransferUseCase {
  constructor(
    @Inject(PET_OWNERSHIP_TRANSFER_REPOSITORY) private readonly transferRepo: PetOwnershipTransferRepository,
    @Inject(PET_REPOSITORY) private readonly petRepo: PetRepository,
    @Inject(PET_SHARE_REPOSITORY) private readonly shareRepo: PetShareRepository,
  ) {}

  async execute(transferId: string, requestingUserId: string, retainAccessForOriginalOwner: boolean): Promise<void> {
    const transfer = await this.transferRepo.findById(transferId);
    if (!transfer) throw new NotFoundError('Transfer');
    if (transfer.toUserId !== requestingUserId) throw new ForbiddenError();
    if (transfer.status !== 'pending') throw new AppError('Transfer is no longer pending', 400);

    const pet = await this.petRepo.findById(transfer.petId);
    if (!pet) throw new NotFoundError('Pet');

    const originalOwnerId = transfer.fromUserId;
    transfer.accept();
    pet.transferOwnership(requestingUserId);

    await this.transferRepo.save(transfer);
    await this.petRepo.save(pet);

    if (retainAccessForOriginalOwner) {
      const share = PetShare.create({
        petId: pet.id.toValue(),
        ownerId: requestingUserId,
        sharedWithUserId: originalOwnerId,
        invitedEmail: transfer.invitedEmail,
        canViewVetVisits: true,
        canEditVetVisits: true,
        canViewMedications: true,
        canEditMedications: true,
        canViewNotes: true,
        canEditNotes: true,
      });
      share.accept();
      await this.shareRepo.save(share);
    }
  }
}
