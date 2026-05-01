import 'reflect-metadata';
import { UploadStandalonePhotoUseCase } from '../../../src/application/photo/UploadStandalonePhotoUseCase';
import { PhotoRepository } from '../../../src/domain/photo/PhotoRepository';
import { Photo } from '../../../src/domain/photo/Photo';
import { PhotoMapper } from '../../../src/infrastructure/mappers/PhotoMapper';
import { PetAccessService } from '../../../src/application/pet/PetAccessService';
import { R2Service } from '../../../src/infrastructure/storage/R2Service';
import { Pet } from '../../../src/domain/pet/Pet';
import { UniqueEntityId } from '../../../src/domain/shared/UniqueEntityId';
import { ForbiddenError } from '../../../src/shared/errors/AppError';

function makePet(): Pet {
  return Pet.reconstitute(
    { name: 'Buddy', species: 'dog', userId: 'user-1', createdAt: new Date() },
    new UniqueEntityId('pet-1'),
  );
}

function makeRepo(): jest.Mocked<PhotoRepository> {
  return {
    save: jest.fn((p: Photo) => Promise.resolve(p)),
    findById: jest.fn(),
    findByPetIds: jest.fn(),
    findYearsByOwnerId: jest.fn(),
    delete: jest.fn(),
  };
}

function makeMapper(): jest.Mocked<PhotoMapper> {
  return {
    toDomain: jest.fn(),
    toPersistence: jest.fn(),
    toResponse: jest.fn((_p: Photo, url: string) => ({
      id: 'photo-1',
      petId: 'pet-1',
      ownerId: 'user-1',
      url,
      takenAt: '2026-04-30',
      caption: undefined,
      sourceType: 'standalone' as const,
      sourceId: undefined,
      createdAt: new Date().toISOString(),
    })),
  } as any;
}

describe('UploadStandalonePhotoUseCase', () => {
  it('uploads to R2 and saves photo entity', async () => {
    const repo = makeRepo();
    const mapper = makeMapper();
    const petAccess = { assertCanAccess: jest.fn().mockResolvedValue(makePet()) } as unknown as PetAccessService;
    const r2 = { upload: jest.fn().mockResolvedValue(undefined), getSignedUrl: jest.fn().mockResolvedValue('https://signed.url/photo.jpg'), delete: jest.fn() } as unknown as R2Service;
    const useCase = new UploadStandalonePhotoUseCase(repo, petAccess, mapper, r2);

    const result = await useCase.execute({
      userId: 'user-1',
      petId: 'pet-1',
      buffer: Buffer.from('fake-image'),
      mimeType: 'image/jpeg',
      takenAt: '2026-04-30',
      caption: 'A sunny day',
    });

    expect(r2.upload).toHaveBeenCalledTimes(1);
    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(result.url).toBe('https://signed.url/photo.jpg');
    expect(petAccess.assertCanAccess).toHaveBeenCalledWith('pet-1', 'user-1', 'edit_photos');
  });

  it('throws ForbiddenError when user lacks edit_photos permission', async () => {
    const repo = makeRepo();
    const mapper = makeMapper();
    const petAccess = { assertCanAccess: jest.fn().mockRejectedValue(new ForbiddenError()) } as unknown as PetAccessService;
    const r2 = { upload: jest.fn(), getSignedUrl: jest.fn(), delete: jest.fn() } as unknown as R2Service;
    const useCase = new UploadStandalonePhotoUseCase(repo, petAccess, mapper, r2);

    await expect(
      useCase.execute({ userId: 'user-99', petId: 'pet-1', buffer: Buffer.from('x'), mimeType: 'image/jpeg', takenAt: '2026-04-30' }),
    ).rejects.toThrow(ForbiddenError);
    expect(r2.upload).not.toHaveBeenCalled();
  });
});
