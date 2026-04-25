import { Inject, Service } from 'typedi';
import { PetAccessService } from '../pet/PetAccessService';
import { PetShareRepository, PET_SHARE_REPOSITORY } from '../../domain/share/PetShareRepository';
import { PetShare } from '../../domain/share/PetShare';
import { ForbiddenError, NotFoundError } from '../../shared/errors/AppError';

interface UpdatePermissionsInput {
  petId: string;
  shareId: string;
  requestingUserId: string;
  canViewVetVisits: boolean;
  canEditVetVisits: boolean;
  canViewMedications: boolean;
  canEditMedications: boolean;
  canViewNotes: boolean;
  canEditNotes: boolean;
}

@Service()
export class UpdateSharePermissionsUseCase {
  constructor(
    private readonly petAccessService: PetAccessService,
    @Inject(PET_SHARE_REPOSITORY) private readonly shareRepo: PetShareRepository,
  ) {}

  async execute(input: UpdatePermissionsInput): Promise<PetShare> {
    await this.petAccessService.assertCanAccess(input.petId, input.requestingUserId, 'owner');
    const share = await this.shareRepo.findById(input.shareId);
    if (!share) throw new NotFoundError('Share');
    if (share.petId !== input.petId) throw new ForbiddenError();
    share.updatePermissions({
      canViewVetVisits: input.canViewVetVisits,
      canEditVetVisits: input.canEditVetVisits,
      canViewMedications: input.canViewMedications,
      canEditMedications: input.canEditMedications,
      canViewNotes: input.canViewNotes,
      canEditNotes: input.canEditNotes,
    });
    await this.shareRepo.save(share);
    return share;
  }
}
