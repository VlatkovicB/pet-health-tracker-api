import { Inject, Service } from 'typedi';
import { PetRepository, PET_REPOSITORY } from '../../domain/pet/PetRepository';
import { Pet } from '../../domain/pet/Pet';
import { ForbiddenError, NotFoundError } from '../../shared/errors/AppError';

@Service()
export class GetPetUseCase {
  constructor(
    @Inject(PET_REPOSITORY) private readonly petRepository: PetRepository,
  ) {}

  async execute(petId: string, requestingUserId: string): Promise<Pet> {
    const pet = await this.petRepository.findById(petId);
    if (!pet) throw new NotFoundError('Pet');
    if (pet.userId !== requestingUserId) throw new ForbiddenError('Not your pet');
    return pet;
  }
}
