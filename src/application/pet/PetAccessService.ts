import { Inject, Service } from 'typedi';
import { PetRepository, PET_REPOSITORY } from '../../domain/pet/PetRepository';
import { PetShareRepository, PET_SHARE_REPOSITORY } from '../../domain/share/PetShareRepository';
import { PetPermission } from '../../domain/share/PetPermission';
import { Pet } from '../../domain/pet/Pet';
import { ForbiddenError, NotFoundError } from '../../shared/errors/AppError';

@Service()
export class PetAccessService {
  constructor(
    @Inject(PET_REPOSITORY) private readonly petRepo: PetRepository,
    @Inject(PET_SHARE_REPOSITORY) private readonly shareRepo: PetShareRepository,
  ) {}

  async assertCanAccess(petId: string, userId: string, permission: PetPermission): Promise<Pet> {
    const pet = await this.petRepo.findById(petId);
    if (!pet) throw new NotFoundError('Pet');
    if (pet.userId === userId) return pet;

    const share = await this.shareRepo.findAcceptedByPetIdAndUserId(petId, userId);
    if (!share) throw new ForbiddenError();
    if (!share.hasPermission(permission)) throw new ForbiddenError();
    return pet;
  }
}
