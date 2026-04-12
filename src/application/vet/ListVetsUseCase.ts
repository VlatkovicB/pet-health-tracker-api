import { Inject, Service } from 'typedi';
import { VetRepository, VET_REPOSITORY } from '../../domain/vet/VetRepository';
import { Vet } from '../../domain/vet/Vet';
import { PaginationParams, PaginatedResult } from '../../shared/types/Pagination';

@Service()
export class ListVetsUseCase {
  constructor(
    @Inject(VET_REPOSITORY) private readonly vetRepository: VetRepository,
  ) {}

  async execute(requestingUserId: string, pagination: PaginationParams): Promise<PaginatedResult<Vet>> {
    return this.vetRepository.findByUserId(requestingUserId, pagination);
  }
}
