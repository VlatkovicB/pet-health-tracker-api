import { Inject, Service } from 'typedi';
import { PetRepository, PET_REPOSITORY } from '../../domain/pet/PetRepository';
import { Pet } from '../../domain/pet/Pet';
import { PaginationParams, PaginatedResult } from '../../shared/types/Pagination';

@Service()
export class ListPetsUseCase {
  constructor(
    @Inject(PET_REPOSITORY) private readonly petRepository: PetRepository,
  ) {}

  async execute(requestingUserId: string, pagination: PaginationParams): Promise<PaginatedResult<Pet>> {
    return this.petRepository.findByUserId(requestingUserId, pagination);
  }
}
