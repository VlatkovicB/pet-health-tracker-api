import 'reflect-metadata';
import { DeleteWeightEntryUseCase } from '../../../src/application/weight/DeleteWeightEntryUseCase';
import { WeightEntryRepository } from '../../../src/domain/weight/WeightEntryRepository';
import { WeightEntry } from '../../../src/domain/weight/WeightEntry';
import { UniqueEntityId } from '../../../src/domain/shared/UniqueEntityId';
import { NotFoundError, ForbiddenError } from '../../../src/shared/errors/AppError';

function makeEntry(petId: string): WeightEntry {
  return WeightEntry.reconstitute(
    { petId, date: '2026-04-30', value: 4.2, unit: 'kg', createdAt: new Date() },
    new UniqueEntityId('entry-1'),
  );
}

describe('DeleteWeightEntryUseCase', () => {
  it('deletes the entry when it exists and belongs to the pet', async () => {
    const entry = makeEntry('pet-1');
    const repo = {
      findById: jest.fn().mockResolvedValue(entry),
      delete: jest.fn().mockResolvedValue(undefined),
    } as unknown as WeightEntryRepository;
    const useCase = new DeleteWeightEntryUseCase(repo);

    await useCase.execute({ userId: 'user-1', petId: 'pet-1', entryId: 'entry-1' });

    expect(repo.delete).toHaveBeenCalledWith('entry-1');
  });

  it('throws NotFoundError when entry does not exist', async () => {
    const repo = { findById: jest.fn().mockResolvedValue(null) } as unknown as WeightEntryRepository;
    const useCase = new DeleteWeightEntryUseCase(repo);

    await expect(
      useCase.execute({ userId: 'user-1', petId: 'pet-1', entryId: 'entry-1' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws ForbiddenError when entry belongs to a different pet', async () => {
    const entry = makeEntry('pet-other');
    const repo = { findById: jest.fn().mockResolvedValue(entry) } as unknown as WeightEntryRepository;
    const useCase = new DeleteWeightEntryUseCase(repo);

    await expect(
      useCase.execute({ userId: 'user-1', petId: 'pet-1', entryId: 'entry-1' }),
    ).rejects.toThrow(ForbiddenError);
  });
});
