import { Inject, Service } from 'typedi';
import { PetRepository, PET_REPOSITORY } from '../../domain/pet/PetRepository';
import { GroupRepository, GROUP_REPOSITORY } from '../../domain/group/GroupRepository';
import { Pet } from '../../domain/pet/Pet';
import { ForbiddenError, NotFoundError } from '../../shared/errors/AppError';

@Service()
export class GetPetUseCase {
  constructor(
    @Inject(PET_REPOSITORY) private readonly petRepository: PetRepository,
    @Inject(GROUP_REPOSITORY) private readonly groupRepository: GroupRepository,
  ) {}

  async execute(petId: string, requestingUserId: string): Promise<Pet> {
    const pet = await this.petRepository.findById(petId);
    if (!pet) throw new NotFoundError('Pet');
    const group = await this.groupRepository.findById(pet.groupId);
    if (!group?.hasMember(requestingUserId)) throw new ForbiddenError('Not a group member');
    return pet;
  }
}
