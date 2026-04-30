import { Inject, Service } from 'typedi';
import { WeightEntryRepository, WEIGHT_ENTRY_REPOSITORY } from '../../domain/weight/WeightEntryRepository';
import { WeightEntryMapper, WeightEntryResponseDto } from '../../infrastructure/mappers/WeightEntryMapper';
import { PetAccessService } from '../pet/PetAccessService';

export interface ListWeightEntriesInput {
  userId: string;
  petId: string;
}

@Service()
export class ListWeightEntriesUseCase {
  constructor(
    @Inject(WEIGHT_ENTRY_REPOSITORY) private readonly repo: WeightEntryRepository,
    private readonly petAccessService: PetAccessService,
    private readonly mapper: WeightEntryMapper,
  ) {}

  async execute(input: ListWeightEntriesInput): Promise<WeightEntryResponseDto[]> {
    await this.petAccessService.assertCanAccess(input.petId, input.userId, 'view_weight');
    const entries = await this.repo.findByPetId(input.petId);
    return entries.map((e) => this.mapper.toResponse(e));
  }
}
