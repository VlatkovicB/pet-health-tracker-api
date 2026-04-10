import { Inject, Service } from 'typedi';
import { PetRepository, PET_REPOSITORY } from '../../domain/pet/PetRepository';
import { GroupRepository, GROUP_REPOSITORY } from '../../domain/group/GroupRepository';
import { Pet } from '../../domain/pet/Pet';
import { ForbiddenError, NotFoundError } from '../../shared/errors/AppError';

interface AddPetInput {
  name: string;
  species: string;
  breed?: string;
  birthDate?: Date;
  groupId: string;
  requestingUserId: string;
}

@Service()
export class AddPetUseCase {
  constructor(
    @Inject(PET_REPOSITORY) private readonly petRepository: PetRepository,
    @Inject(GROUP_REPOSITORY) private readonly groupRepository: GroupRepository,
  ) {}

  async execute(input: AddPetInput): Promise<Pet> {
    const group = await this.groupRepository.findById(input.groupId);
    if (!group) throw new NotFoundError('Group');
    if (!group.hasMember(input.requestingUserId)) throw new ForbiddenError('Not a group member');

    const pet = Pet.create({
      name: input.name,
      species: input.species,
      breed: input.breed,
      birthDate: input.birthDate,
      groupId: input.groupId,
    });

    await this.petRepository.save(pet);
    return pet;
  }
}
