import { Inject, Service } from 'typedi';
import { PetRepository, PET_REPOSITORY } from '../../domain/pet/PetRepository';
import { GroupRepository, GROUP_REPOSITORY } from '../../domain/group/GroupRepository';
import { Pet } from '../../domain/pet/Pet';
import { ForbiddenError, NotFoundError } from '../../shared/errors/AppError';
import { UniqueEntityId } from '../../domain/shared/UniqueEntityId';

export interface UpdatePetInput {
  petId: string;
  name?: string;
  species?: string;
  breed?: string;
  birthDate?: Date;
  photoUrl?: string;
  requestingUserId: string;
}

@Service()
export class UpdatePetUseCase {
  constructor(
    @Inject(PET_REPOSITORY) private readonly petRepository: PetRepository,
    @Inject(GROUP_REPOSITORY) private readonly groupRepository: GroupRepository,
  ) {}

  async execute(input: UpdatePetInput): Promise<Pet> {
    const existing = await this.petRepository.findById(input.petId);
    if (!existing) throw new NotFoundError('Pet');
    const group = await this.groupRepository.findById(existing.groupId);
    if (!group?.hasMember(input.requestingUserId)) throw new ForbiddenError('Not a group member');

    const updated = Pet.reconstitute(
      {
        name: input.name ?? existing.name,
        species: input.species ?? existing.species,
        breed: input.breed !== undefined ? input.breed : existing.breed,
        birthDate: input.birthDate !== undefined ? input.birthDate : existing.birthDate,
        photoUrl: input.photoUrl !== undefined ? input.photoUrl : existing.photoUrl,
        groupId: existing.groupId,
        createdAt: existing.createdAt,
      },
      new UniqueEntityId(existing.id.toValue()),
    );

    await this.petRepository.save(updated);
    return updated;
  }
}
