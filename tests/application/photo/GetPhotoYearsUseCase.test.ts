import 'reflect-metadata';
import { GetPhotoYearsUseCase } from '../../../src/application/photo/GetPhotoYearsUseCase';
import { PhotoRepository } from '../../../src/domain/photo/PhotoRepository';
import { PetAccessService } from '../../../src/application/pet/PetAccessService';
import { Pet } from '../../../src/domain/pet/Pet';
import { UniqueEntityId } from '../../../src/domain/shared/UniqueEntityId';
import { ForbiddenError } from '../../../src/shared/errors/AppError';

function makePet(): Pet {
  return Pet.reconstitute(
    { name: 'Buddy', species: 'dog', userId: 'user-1', createdAt: new Date() },
    new UniqueEntityId('pet-1'),
  );
}

function makeRepo(years: number[] = [2024, 2025, 2026]): jest.Mocked<PhotoRepository> {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    findByPetIds: jest.fn(),
    findYearsByOwnerId: jest.fn().mockResolvedValue(years),
    delete: jest.fn(),
  };
}

describe('GetPhotoYearsUseCase', () => {
  it('returns years without checking access when no petIds provided', async () => {
    const repo = makeRepo([2024, 2025, 2026]);
    const petAccess = { assertCanAccess: jest.fn() } as unknown as PetAccessService;
    const useCase = new GetPhotoYearsUseCase(repo, petAccess);

    const result = await useCase.execute({ userId: 'user-1' });

    expect(result).toEqual([2024, 2025, 2026]);
    expect(repo.findYearsByOwnerId).toHaveBeenCalledWith('user-1', undefined, undefined);
    expect(petAccess.assertCanAccess).not.toHaveBeenCalled();
  });

  it('checks access for each petId then calls findYearsByOwnerId with petIds', async () => {
    const pet = makePet();
    const repo = makeRepo([2025, 2026]);
    const petAccess = { assertCanAccess: jest.fn().mockResolvedValue(pet) } as unknown as PetAccessService;
    const useCase = new GetPhotoYearsUseCase(repo, petAccess);

    const result = await useCase.execute({ userId: 'user-1', petIds: ['pet-1', 'pet-2'] });

    expect(petAccess.assertCanAccess).toHaveBeenCalledWith('pet-1', 'user-1', 'view_photos');
    expect(petAccess.assertCanAccess).toHaveBeenCalledWith('pet-2', 'user-1', 'view_photos');
    expect(petAccess.assertCanAccess).toHaveBeenCalledTimes(2);
    expect(repo.findYearsByOwnerId).toHaveBeenCalledWith('user-1', ['pet-1', 'pet-2'], undefined);
    expect(result).toEqual([2025, 2026]);
  });

  it('throws ForbiddenError when user lacks access to one of the petIds', async () => {
    const repo = makeRepo();
    const petAccess = { assertCanAccess: jest.fn().mockRejectedValue(new ForbiddenError()) } as unknown as PetAccessService;
    const useCase = new GetPhotoYearsUseCase(repo, petAccess);

    await expect(
      useCase.execute({ userId: 'user-99', petIds: ['pet-1'] }),
    ).rejects.toThrow(ForbiddenError);
    expect(repo.findYearsByOwnerId).not.toHaveBeenCalled();
  });

  it('passes sourceTypes to repo when provided', async () => {
    const repo = makeRepo([2025, 2026]);
    const petAccess = { assertCanAccess: jest.fn() } as unknown as PetAccessService;
    const useCase = new GetPhotoYearsUseCase(repo, petAccess);

    await useCase.execute({ userId: 'user-1', sourceTypes: ['standalone', 'vet-visit'] });

    expect(repo.findYearsByOwnerId).toHaveBeenCalledWith('user-1', undefined, ['standalone', 'vet-visit']);
  });
});
