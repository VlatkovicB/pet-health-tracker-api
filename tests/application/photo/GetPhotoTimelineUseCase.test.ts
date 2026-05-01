import 'reflect-metadata';
import { GetPhotoTimelineUseCase } from '../../../src/application/photo/GetPhotoTimelineUseCase';
import { PhotoRepository } from '../../../src/domain/photo/PhotoRepository';
import { PhotoMapper } from '../../../src/infrastructure/mappers/PhotoMapper';
import { PetRepository } from '../../../src/domain/pet/PetRepository';
import { PetAccessService } from '../../../src/application/pet/PetAccessService';
import { R2Service } from '../../../src/infrastructure/storage/R2Service';
import { Photo } from '../../../src/domain/photo/Photo';
import { Pet } from '../../../src/domain/pet/Pet';
import { UniqueEntityId } from '../../../src/domain/shared/UniqueEntityId';
import { ForbiddenError } from '../../../src/shared/errors/AppError';

function makePhoto(takenAt: string): Photo {
  return Photo.reconstitute(
    { petId: 'pet-1', ownerId: 'user-1', s3Key: 'photos/abc.jpg', takenAt, caption: undefined, sourceType: 'standalone', sourceId: undefined, createdAt: new Date() },
    new UniqueEntityId('photo-1'),
  );
}

function makePet(): Pet {
  return Pet.reconstitute(
    { name: 'Buddy', species: 'dog', userId: 'user-1', createdAt: new Date() },
    new UniqueEntityId('pet-1'),
  );
}

describe('GetPhotoTimelineUseCase', () => {
  it('groups photos by month and returns signed URLs', async () => {
    const pet = makePet();
    const repo: jest.Mocked<PhotoRepository> = {
      save: jest.fn(),
      findById: jest.fn(),
      findByPetIds: jest.fn().mockResolvedValue([makePhoto('2026-04-15'), makePhoto('2026-04-28')]),
      findYearsByOwnerId: jest.fn(),
      delete: jest.fn(),
    };
    const petRepo: jest.Mocked<PetRepository> = {
      findById: jest.fn(),
      findByIds: jest.fn().mockResolvedValue([pet]),
      findByUserId: jest.fn().mockResolvedValue({ items: [pet], total: 1, page: 1, limit: 10000 }),
      save: jest.fn(),
      delete: jest.fn(),
    } as any;
    const petAccess = { assertCanAccess: jest.fn().mockResolvedValue(pet) } as unknown as PetAccessService;
    const r2 = { getSignedUrl: jest.fn().mockResolvedValue('https://signed.url/photo.jpg'), upload: jest.fn(), delete: jest.fn() } as unknown as R2Service;
    const mapper: jest.Mocked<PhotoMapper> = {
      toDomain: jest.fn(),
      toPersistence: jest.fn(),
      toResponse: jest.fn((_p, url) => ({ id: 'photo-1', petId: 'pet-1', pet: { id: 'pet-1', name: 'Buddy' }, ownerId: 'user-1', url, takenAt: '2026-04-15', sourceType: 'standalone' as const, createdAt: new Date().toISOString() })),
    } as any;

    const useCase = new GetPhotoTimelineUseCase(repo, petRepo, mapper, petAccess, r2);
    const result = await useCase.execute({ userId: 'user-1', year: 2026 });

    expect(result['2026']['04']).toHaveLength(2);
    expect(result['2026']['04'][0].url).toBe('https://signed.url/photo.jpg');
    expect(repo.findByPetIds).toHaveBeenCalledWith(['pet-1'], 2026);
    expect(petAccess.assertCanAccess).not.toHaveBeenCalled();
  });

  it('filters by petIds when provided and checks access', async () => {
    const pet = makePet();
    const repo: jest.Mocked<PhotoRepository> = {
      save: jest.fn(), findById: jest.fn(),
      findByPetIds: jest.fn().mockResolvedValue([]),
      findYearsByOwnerId: jest.fn(), delete: jest.fn(),
    };
    const petRepo: jest.Mocked<PetRepository> = {
      findByUserId: jest.fn(), findById: jest.fn(),
      findByIds: jest.fn().mockResolvedValue([]),
      save: jest.fn(), delete: jest.fn(),
    } as any;
    const petAccess = { assertCanAccess: jest.fn().mockResolvedValue(pet) } as unknown as PetAccessService;
    const r2 = { getSignedUrl: jest.fn(), upload: jest.fn(), delete: jest.fn() } as unknown as R2Service;
    const mapper = { toDomain: jest.fn(), toPersistence: jest.fn(), toResponse: jest.fn() } as any;

    const useCase = new GetPhotoTimelineUseCase(repo, petRepo, mapper, petAccess, r2);
    await useCase.execute({ userId: 'user-1', year: 2026, petIds: ['pet-2'] });

    expect(repo.findByPetIds).toHaveBeenCalledWith(['pet-2'], 2026);
    expect(petRepo.findByUserId).not.toHaveBeenCalled();
    expect(petAccess.assertCanAccess).toHaveBeenCalledWith('pet-2', 'user-1', 'view_photos');
  });

  it('throws ForbiddenError when user lacks access to a supplied petId', async () => {
    const repo: jest.Mocked<PhotoRepository> = {
      save: jest.fn(), findById: jest.fn(),
      findByPetIds: jest.fn(), findYearsByOwnerId: jest.fn(), delete: jest.fn(),
    };
    const petRepo: jest.Mocked<PetRepository> = {
      findByUserId: jest.fn(), findById: jest.fn(), findByIds: jest.fn(), save: jest.fn(), delete: jest.fn(),
    } as any;
    const petAccess = { assertCanAccess: jest.fn().mockRejectedValue(new ForbiddenError()) } as unknown as PetAccessService;
    const r2 = { getSignedUrl: jest.fn(), upload: jest.fn(), delete: jest.fn() } as unknown as R2Service;
    const mapper = { toDomain: jest.fn(), toPersistence: jest.fn(), toResponse: jest.fn() } as any;

    const useCase = new GetPhotoTimelineUseCase(repo, petRepo, mapper, petAccess, r2);

    await expect(useCase.execute({ userId: 'user-99', year: 2026, petIds: ['pet-1'] })).rejects.toThrow(ForbiddenError);
    expect(repo.findByPetIds).not.toHaveBeenCalled();
  });
});
