import { Inject, Service } from 'typedi';
import { PetAccessService } from '../pet/PetAccessService';
import { UserRepository, USER_REPOSITORY } from '../../domain/user/UserRepository';
import { PetOwnershipTransferRepository, PET_OWNERSHIP_TRANSFER_REPOSITORY } from '../../domain/transfer/PetOwnershipTransferRepository';
import { PetOwnershipTransfer } from '../../domain/transfer/PetOwnershipTransfer';
import { EmailService } from '../../infrastructure/email/EmailService';
import { AppError } from '../../shared/errors/AppError';
import { scheduleTransferExpiry } from '../../infrastructure/queue/TransferExpiryQueue';
import { petTransferNotificationHtml } from '../../infrastructure/email/templates/petTransferNotification';
import { petTransferInviteHtml } from '../../infrastructure/email/templates/petTransferInvite';

@Service()
export class InitiateOwnershipTransferUseCase {
  constructor(
    private readonly petAccessService: PetAccessService,
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(PET_OWNERSHIP_TRANSFER_REPOSITORY) private readonly transferRepo: PetOwnershipTransferRepository,
    private readonly emailService: EmailService,
  ) {}

  async execute(petId: string, requestingUserId: string, email: string): Promise<PetOwnershipTransfer> {
    const pet = await this.petAccessService.assertCanAccess(petId, requestingUserId, 'owner');

    const existing = await this.transferRepo.findActivePendingByPetId(petId);
    if (existing) throw new AppError('A pending transfer already exists for this pet', 409);

    const targetUser = await this.userRepo.findByEmail(email);

    const transfer = PetOwnershipTransfer.create({
      petId,
      fromUserId: requestingUserId,
      toUserId: targetUser?.id.toValue() ?? null,
      invitedEmail: email,
    });

    await this.transferRepo.save(transfer);
    await scheduleTransferExpiry(transfer.id.toValue(), transfer.expiresAt);

    if (targetUser) {
      await this.emailService.send({
        to: email,
        subject: `${pet.name} ownership transfer request`,
        html: petTransferNotificationHtml({ petName: pet.name }),
      });
    } else {
      await this.emailService.send({
        to: email,
        subject: `You've been invited to take ownership of a pet`,
        html: petTransferInviteHtml({ petName: pet.name }),
      });
    }

    return transfer;
  }
}
