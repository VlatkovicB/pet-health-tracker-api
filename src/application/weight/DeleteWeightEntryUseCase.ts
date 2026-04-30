import { Inject, Service } from 'typedi';
import { WeightEntryRepository, WEIGHT_ENTRY_REPOSITORY } from '../../domain/weight/WeightEntryRepository';
import { ForbiddenError, NotFoundError } from '../../shared/errors/AppError';

export interface DeleteWeightEntryInput {
  userId: string;
  petId: string;
  entryId: string;
}

@Service()
export class DeleteWeightEntryUseCase {
  constructor(
    @Inject(WEIGHT_ENTRY_REPOSITORY) private readonly repo: WeightEntryRepository,
  ) {}

  async execute(input: DeleteWeightEntryInput): Promise<void> {
    const existing = await this.repo.findById(input.entryId);
    if (!existing) throw new NotFoundError('WeightEntry');
    if (existing.petId !== input.petId) throw new ForbiddenError();
    await this.repo.delete(input.entryId);
  }
}
