import 'reflect-metadata';
import { UpdateWeightEntryUseCase } from '../../../src/application/weight/UpdateWeightEntryUseCase';
import { WeightEntryRepository } from '../../../src/domain/weight/WeightEntryRepository';
import { WeightEntry } from '../../../src/domain/weight/WeightEntry';
import { WeightEntryMapper, WeightEntryResponseDto } from '../../../src/infrastructure/mappers/WeightEntryMapper';
import { UniqueEntityId } from '../../../src/domain/shared/UniqueEntityId';
import { NotFoundError, ForbiddenError } from '../../../src/shared/errors/AppError';

function makeEntry(petId: string, value: number): WeightEntry {
  return WeightEntry.reconstitute(
    { petId, date: '2026-04-30', value, unit: 'kg', createdAt: new Date() },
    new UniqueEntityId('entry-1'),
  );
}

describe('UpdateWeightEntryUseCase', () => {
  it('updates and returns the updated entry DTO', async () => {
    const entry = makeEntry('pet-1', 4.2);
    const saved: WeightEntry[] = [];
    const repo = {
      findById: jest.fn().mockResolvedValue(entry),
      save: jest.fn((e: WeightEntry) => { saved.push(e); return Promise.resolve(e); }),
    } as unknown as WeightEntryRepository;
    const mapper = {
      toResponse: jest.fn((e: WeightEntry): WeightEntryResponseDto => ({
        id: e.id.toValue(), petId: e.petId, date: e.date, value: e.value, unit: e.unit, notes: e.notes, createdAt: e.createdAt.toISOString(),
      })),
    } as unknown as WeightEntryMapper;
    const useCase = new UpdateWeightEntryUseCase(repo, mapper);

    const result = await useCase.execute({ userId: 'user-1', petId: 'pet-1', entryId: 'entry-1', value: 4.5 });

    expect(result.value).toBe(4.5);
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('throws NotFoundError when entry does not exist', async () => {
    const repo = { findById: jest.fn().mockResolvedValue(null) } as unknown as WeightEntryRepository;
    const mapper = {} as WeightEntryMapper;
    const useCase = new UpdateWeightEntryUseCase(repo, mapper);

    await expect(
      useCase.execute({ userId: 'user-1', petId: 'pet-1', entryId: 'entry-1', value: 4.5 }),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws ForbiddenError when entry belongs to a different pet', async () => {
    const entry = makeEntry('pet-other', 4.2);
    const repo = { findById: jest.fn().mockResolvedValue(entry) } as unknown as WeightEntryRepository;
    const mapper = {} as WeightEntryMapper;
    const useCase = new UpdateWeightEntryUseCase(repo, mapper);

    await expect(
      useCase.execute({ userId: 'user-1', petId: 'pet-1', entryId: 'entry-1', value: 4.5 }),
    ).rejects.toThrow(ForbiddenError);
  });
});
