import 'reflect-metadata';
import { GetPhotoTimelineUseCase } from '../../../src/application/photo/GetPhotoTimelineUseCase';
import { PhotoRepository } from '../../../src/domain/photo/PhotoRepository';
import { PhotoMapper } from '../../../src/infrastructure/mappers/PhotoMapper';
import { PetRepository } from '../../../src/domain/pet/PetRepository';
import { R2Service } from '../../../src/infrastructure/storage/R2Service';
import { Photo } from '../../../src/domain/photo/Photo';
import { Pet } from '../../../src/domain/pet/Pet';
import { UniqueEntityId } from '../../../src/domain/shared/UniqueEntityId';

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
    const repo: jest.Mocked<PhotoRepository> = {
      save: jest.fn(),
      findById: jest.fn(),
      findByPetIds: jest.fn().mockResolvedValue([makePhoto('2026-04-15'), makePhoto('2026-04-28')]),
      findYearsByOwnerId: jest.fn(),
      delete: jest.fn(),
    };
    const petRepo: jest.Mocked<PetRepository> = {
      findById: jest.fn(),
      findByUserId: jest.fn().mockResolvedValue([makePet()]),
      save: jest.fn(),
      delete: jest.fn(),
    } as any;
    const r2 = { getSignedUrl: jest.fn().mockResolvedValue('https://signed.url/photo.jpg'), upload: jest.fn(), delete: jest.fn() } as unknown as R2Service;
    const mapper: jest.Mocked<PhotoMapper> = {
      toDomain: jest.fn(),
      toPersistence: jest.fn(),
      toResponse: jest.fn((_p, url) => ({ id: 'photo-1', petId: 'pet-1', ownerId: 'user-1', url, takenAt: '2026-04-15', sourceType: 'standalone' as const, createdAt: new Date().toISOString() })),
    } as any;

    const useCase = new GetPhotoTimelineUseCase(repo, petRepo, mapper, r2);
    const result = await useCase.execute({ userId: 'user-1', year: 2026 });

    expect(result['2026']['04']).toHaveLength(2);
    expect(result['2026']['04'][0].url).toBe('https://signed.url/photo.jpg');
    expect(repo.findByPetIds).toHaveBeenCalledWith(['pet-1'], 2026);
  });

  it('filters by petIds when provided', async () => {
    const repo: jest.Mocked<PhotoRepository> = {
      save: jest.fn(), findById: jest.fn(),
      findByPetIds: jest.fn().mockResolvedValue([]),
      findYearsByOwnerId: jest.fn(), delete: jest.fn(),
    };
    const petRepo: jest.Mocked<PetRepository> = { findByUserId: jest.fn(), findById: jest.fn(), save: jest.fn(), delete: jest.fn() } as any;
    const r2 = { getSignedUrl: jest.fn(), upload: jest.fn(), delete: jest.fn() } as unknown as R2Service;
    const mapper = { toDomain: jest.fn(), toPersistence: jest.fn(), toResponse: jest.fn() } as any;

    const useCase = new GetPhotoTimelineUseCase(repo, petRepo, mapper, r2);
    await useCase.execute({ userId: 'user-1', year: 2026, petIds: ['pet-2'] });

    expect(repo.findByPetIds).toHaveBeenCalledWith(['pet-2'], 2026);
    expect(petRepo.findByUserId).not.toHaveBeenCalled();
  });
});
