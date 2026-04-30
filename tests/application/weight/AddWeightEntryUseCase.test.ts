import 'reflect-metadata';
import { AddWeightEntryUseCase } from '../../../src/application/weight/AddWeightEntryUseCase';
import { WeightEntryRepository } from '../../../src/domain/weight/WeightEntryRepository';
import { WeightEntry } from '../../../src/domain/weight/WeightEntry';
import { WeightEntryMapper, WeightEntryResponseDto } from '../../../src/infrastructure/mappers/WeightEntryMapper';
import { PetAccessService } from '../../../src/application/pet/PetAccessService';
import { Pet } from '../../../src/domain/pet/Pet';
import { UniqueEntityId } from '../../../src/domain/shared/UniqueEntityId';
import { ForbiddenError } from '../../../src/shared/errors/AppError';

function makePet(userId: string): Pet {
  return Pet.reconstitute(
    { name: 'Fluffy', species: 'cat', userId, createdAt: new Date() },
    new UniqueEntityId('pet-1'),
  );
}

function makeRepo(): jest.Mocked<WeightEntryRepository> {
  return {
    save: jest.fn((e: WeightEntry) => Promise.resolve(e)),
    findById: jest.fn(),
    findByPetId: jest.fn(),
    delete: jest.fn(),
  };
}

function makeMapper(): jest.Mocked<WeightEntryMapper> {
  return {
    toDomain: jest.fn(),
    toPersistence: jest.fn(),
    toResponse: jest.fn((e: WeightEntry): WeightEntryResponseDto => ({
      id: e.id.toValue(),
      petId: e.petId,
      date: e.date,
      value: e.value,
      unit: e.unit,
      notes: e.notes,
      createdAt: e.createdAt.toISOString(),
    })),
  } as any;
}

describe('AddWeightEntryUseCase', () => {
  it('saves and returns a weight entry DTO', async () => {
    const repo = makeRepo();
    const mapper = makeMapper();
    const petAccess = { assertCanAccess: jest.fn().mockResolvedValue(makePet('user-1')) } as unknown as PetAccessService;
    const useCase = new AddWeightEntryUseCase(repo, petAccess, mapper);

    const result = await useCase.execute({
      userId: 'user-1',
      petId: 'pet-1',
      date: '2026-04-30',
      value: 4.2,
      unit: 'kg',
    });

    expect(result.petId).toBe('pet-1');
    expect(result.value).toBe(4.2);
    expect(result.unit).toBe('kg');
    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(petAccess.assertCanAccess).toHaveBeenCalledWith('pet-1', 'user-1', 'view_pet');
  });

  it('propagates ForbiddenError when user cannot access pet', async () => {
    const repo = makeRepo();
    const mapper = makeMapper();
    const petAccess = { assertCanAccess: jest.fn().mockRejectedValue(new ForbiddenError()) } as unknown as PetAccessService;
    const useCase = new AddWeightEntryUseCase(repo, petAccess, mapper);

    await expect(
      useCase.execute({ userId: 'user-99', petId: 'pet-1', date: '2026-04-30', value: 4.2, unit: 'kg' }),
    ).rejects.toThrow(ForbiddenError);
    expect(repo.save).not.toHaveBeenCalled();
  });
});
