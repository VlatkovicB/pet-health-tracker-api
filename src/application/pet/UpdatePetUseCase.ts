import { Inject, Service } from 'typedi';
import { PetRepository, PET_REPOSITORY } from '../../domain/pet/PetRepository';
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
  color?: string;
  requestingUserId: string;
}

@Service()
export class UpdatePetUseCase {
  constructor(
    @Inject(PET_REPOSITORY) private readonly petRepository: PetRepository,
  ) {}

  async execute(input: UpdatePetInput): Promise<Pet> {
    const existing = await this.petRepository.findById(input.petId);
    if (!existing) throw new NotFoundError('Pet');
    if (existing.userId !== input.requestingUserId) throw new ForbiddenError('Not your pet');

    const updated = Pet.reconstitute(
      {
        name: input.name ?? existing.name,
        species: input.species ?? existing.species,
        breed: input.breed !== undefined ? input.breed : existing.breed,
        birthDate: input.birthDate !== undefined ? input.birthDate : existing.birthDate,
        photoUrl: input.photoUrl !== undefined ? input.photoUrl : existing.photoUrl,
        color: input.color !== undefined ? input.color : existing.color,
        userId: existing.userId,
        createdAt: existing.createdAt,
      },
      new UniqueEntityId(existing.id.toValue()),
    );

    await this.petRepository.save(updated);
    return updated;
  }
}
