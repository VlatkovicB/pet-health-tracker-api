import { Inject, Service } from 'typedi';
import { PetRepository, PET_REPOSITORY } from '../../domain/pet/PetRepository';
import { Pet } from '../../domain/pet/Pet';
import type { PetSpecies } from '../../domain/pet/PetSpecies';

interface AddPetInput {
  name: string;
  species: PetSpecies;
  breed?: string;
  birthDate?: Date;
  requestingUserId: string;
}

@Service()
export class AddPetUseCase {
  constructor(
    @Inject(PET_REPOSITORY) private readonly petRepository: PetRepository,
  ) {}

  async execute(input: AddPetInput): Promise<Pet> {
    const pet = Pet.create({
      name: input.name,
      species: input.species,
      breed: input.breed,
      birthDate: input.birthDate,
      userId: input.requestingUserId,
    });

    await this.petRepository.save(pet);
    return pet;
  }
}
