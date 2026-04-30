import 'reflect-metadata';
import { ListWeightEntriesUseCase } from '../../../src/application/weight/ListWeightEntriesUseCase';
import { WeightEntryRepository } from '../../../src/domain/weight/WeightEntryRepository';
import { WeightEntry } from '../../../src/domain/weight/WeightEntry';
import { WeightEntryMapper, WeightEntryResponseDto } from '../../../src/infrastructure/mappers/WeightEntryMapper';
import { PetAccessService } from '../../../src/application/pet/PetAccessService';
import { Pet } from '../../../src/domain/pet/Pet';
import { UniqueEntityId } from '../../../src/domain/shared/UniqueEntityId';

function makePet(): Pet {
  return Pet.reconstitute(
    { name: 'Fluffy', species: 'cat', userId: 'user-1', createdAt: new Date() },
    new UniqueEntityId('pet-1'),
  );
}

function makeEntry(value: number): WeightEntry {
  return WeightEntry.create({ petId: 'pet-1', date: '2026-04-30', value, unit: 'kg' });
}

describe('ListWeightEntriesUseCase', () => {
  it('returns DTOs for all entries belonging to the pet', async () => {
    const entries = [makeEntry(4.2), makeEntry(4.0)];
    const repo = {
      findByPetId: jest.fn().mockResolvedValue(entries),
    } as unknown as WeightEntryRepository;
    const mapper = {
      toResponse: jest.fn((e: WeightEntry): WeightEntryResponseDto => ({
        id: e.id.toValue(),
        petId: e.petId,
        date: e.date,
        value: e.value,
        unit: e.unit,
        createdAt: e.createdAt.toISOString(),
      })),
    } as unknown as WeightEntryMapper;
    const petAccess = { assertCanAccess: jest.fn().mockResolvedValue(makePet()) } as unknown as PetAccessService;
    const useCase = new ListWeightEntriesUseCase(repo, petAccess, mapper);

    const result = await useCase.execute({ userId: 'user-1', petId: 'pet-1' });

    expect(result).toHaveLength(2);
    expect(result[0].value).toBe(4.2);
    expect(result[1].value).toBe(4.0);
    expect(repo.findByPetId).toHaveBeenCalledWith('pet-1');
    expect(petAccess.assertCanAccess).toHaveBeenCalledWith('pet-1', 'user-1', 'view_weight');
  });
});
