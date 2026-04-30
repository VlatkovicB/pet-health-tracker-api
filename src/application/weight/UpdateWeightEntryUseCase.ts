import { Inject, Service } from 'typedi';
import { WeightEntryRepository, WEIGHT_ENTRY_REPOSITORY } from '../../domain/weight/WeightEntryRepository';
import { WeightEntry, WeightUnit } from '../../domain/weight/WeightEntry';
import { WeightEntryMapper, WeightEntryResponseDto } from '../../infrastructure/mappers/WeightEntryMapper';
import { UniqueEntityId } from '../../domain/shared/UniqueEntityId';
import { ForbiddenError, NotFoundError } from '../../shared/errors/AppError';

export interface UpdateWeightEntryInput {
  userId: string;
  petId: string;
  entryId: string;
  date?: string;
  value?: number;
  unit?: WeightUnit;
  notes?: string | null;
}

@Service()
export class UpdateWeightEntryUseCase {
  constructor(
    @Inject(WEIGHT_ENTRY_REPOSITORY) private readonly repo: WeightEntryRepository,
    private readonly mapper: WeightEntryMapper,
  ) {}

  async execute(input: UpdateWeightEntryInput): Promise<WeightEntryResponseDto> {
    const existing = await this.repo.findById(input.entryId);
    if (!existing) throw new NotFoundError('WeightEntry');
    if (existing.petId !== input.petId) throw new ForbiddenError();

    const updated = WeightEntry.reconstitute(
      {
        petId: existing.petId,
        date: input.date ?? existing.date,
        value: input.value ?? existing.value,
        unit: input.unit ?? existing.unit,
        notes: input.notes !== undefined ? (input.notes ?? undefined) : existing.notes,
        createdAt: existing.createdAt,
      },
      new UniqueEntityId(existing.id.toValue()),
    );

    const saved = await this.repo.save(updated);
    return this.mapper.toResponse(saved);
  }
}
