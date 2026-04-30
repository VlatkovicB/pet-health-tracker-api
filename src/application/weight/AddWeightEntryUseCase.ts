import { Inject, Service } from 'typedi';
import { WeightEntryRepository, WEIGHT_ENTRY_REPOSITORY } from '../../domain/weight/WeightEntryRepository';
import { WeightEntry, WeightUnit } from '../../domain/weight/WeightEntry';
import { WeightEntryMapper, WeightEntryResponseDto } from '../../infrastructure/mappers/WeightEntryMapper';
import { PetAccessService } from '../pet/PetAccessService';

export interface AddWeightEntryInput {
  userId: string;
  petId: string;
  date: string;
  value: number;
  unit: WeightUnit;
  notes?: string;
}

@Service()
export class AddWeightEntryUseCase {
  constructor(
    @Inject(WEIGHT_ENTRY_REPOSITORY) private readonly repo: WeightEntryRepository,
    private readonly petAccessService: PetAccessService,
    private readonly mapper: WeightEntryMapper,
  ) {}

  async execute(input: AddWeightEntryInput): Promise<WeightEntryResponseDto> {
    await this.petAccessService.assertCanAccess(input.petId, input.userId, 'edit_weight');
    const entry = WeightEntry.create({
      petId: input.petId,
      date: input.date,
      value: input.value,
      unit: input.unit,
      notes: input.notes,
    });
    const saved = await this.repo.save(entry);
    return this.mapper.toResponse(saved);
  }
}
