import { Inject, Service } from 'typedi';
import { PetShareRepository, PET_SHARE_REPOSITORY } from '../../domain/share/PetShareRepository';
import { PetRepository, PET_REPOSITORY } from '../../domain/pet/PetRepository';
import { Pet } from '../../domain/pet/Pet';
import { PetShare } from '../../domain/share/PetShare';

export interface SharedPetResult {
  pet: Pet;
  share: PetShare;
}

@Service()
export class ListSharedPetsUseCase {
  constructor(
    @Inject(PET_SHARE_REPOSITORY) private readonly shareRepo: PetShareRepository,
    @Inject(PET_REPOSITORY) private readonly petRepo: PetRepository,
  ) {}

  async execute(userId: string): Promise<SharedPetResult[]> {
    const shares = await this.shareRepo.findAcceptedForUser(userId);
    if (shares.length === 0) return [];

    const petIds = shares.map((s) => s.petId);
    const pets = await this.petRepo.findByIds(petIds);
    const petMap = new Map(pets.map((p) => [p.id.toValue(), p]));

    return shares
      .map((share) => ({ pet: petMap.get(share.petId), share }))
      .filter((r): r is SharedPetResult => r.pet !== undefined);
  }
}
