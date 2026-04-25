import { Inject, Service } from 'typedi';
import { PetAccessService } from '../pet/PetAccessService';
import { UserRepository, USER_REPOSITORY } from '../../domain/user/UserRepository';
import { PetShareRepository, PET_SHARE_REPOSITORY } from '../../domain/share/PetShareRepository';
import { PetShare } from '../../domain/share/PetShare';
import { EmailService } from '../../infrastructure/email/EmailService';
import { AppError } from '../../shared/errors/AppError';
import { petShareNotificationHtml } from '../../infrastructure/email/templates/petShareNotification';
import { petShareInviteHtml } from '../../infrastructure/email/templates/petShareInvite';

interface SharePermissionsInput {
  canViewVetVisits: boolean;
  canEditVetVisits: boolean;
  canViewMedications: boolean;
  canEditMedications: boolean;
  canViewNotes: boolean;
  canEditNotes: boolean;
}

interface SharePetInput {
  petId: string;
  requestingUserId: string;
  email: string;
  permissions: SharePermissionsInput;
}

@Service()
export class SharePetUseCase {
  constructor(
    private readonly petAccessService: PetAccessService,
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(PET_SHARE_REPOSITORY) private readonly shareRepo: PetShareRepository,
    private readonly emailService: EmailService,
  ) {}

  async execute(input: SharePetInput): Promise<PetShare> {
    const pet = await this.petAccessService.assertCanAccess(input.petId, input.requestingUserId, 'owner');

    const existing = await this.shareRepo.findByPetIdAndEmail(input.petId, input.email);
    if (existing) throw new AppError('Pet already shared with this email', 409);

    const targetUser = await this.userRepo.findByEmail(input.email);

    const share = PetShare.create({
      petId: input.petId,
      ownerId: input.requestingUserId,
      sharedWithUserId: targetUser?.id.toValue() ?? null,
      invitedEmail: input.email,
      ...input.permissions,
    });

    await this.shareRepo.save(share);

    if (targetUser) {
      await this.emailService.send({
        to: input.email,
        subject: `${pet.name} has been shared with you`,
        html: petShareNotificationHtml({ petName: pet.name }),
      });
    } else {
      await this.emailService.send({
        to: input.email,
        subject: `You've been invited to care for a pet`,
        html: petShareInviteHtml({ petName: pet.name }),
      });
    }

    return share;
  }
}
