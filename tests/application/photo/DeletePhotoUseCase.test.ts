import 'reflect-metadata';
import { DeletePhotoUseCase } from '../../../src/application/photo/DeletePhotoUseCase';
import { PhotoRepository } from '../../../src/domain/photo/PhotoRepository';
import { PetAccessService } from '../../../src/application/pet/PetAccessService';
import { R2Service } from '../../../src/infrastructure/storage/R2Service';
import { Photo } from '../../../src/domain/photo/Photo';
import { Pet } from '../../../src/domain/pet/Pet';
import { UniqueEntityId } from '../../../src/domain/shared/UniqueEntityId';
import { ForbiddenError, NotFoundError } from '../../../src/shared/errors/AppError';
import { LimitService } from '../../../src/application/limits/LimitService';

function makePhoto(ownerId: string): Photo {
  return Photo.reconstitute(
    { petId: 'pet-1', ownerId, s3Key: 'photos/abc.jpg', takenAt: '2026-04-30', caption: undefined, sourceType: 'standalone', sourceId: undefined, sizeBytes: 1024, createdAt: new Date() },
    new UniqueEntityId('photo-1'),
  );
}

function makePet(userId: string): Pet {
  return Pet.reconstitute(
    { name: 'Buddy', species: 'dog', userId, createdAt: new Date() },
    new UniqueEntityId('pet-1'),
  );
}

function makeLimitService(): jest.Mocked<LimitService> {
  return {
    checkStorageLimit: jest.fn().mockResolvedValue(undefined),
    incrementStorage: jest.fn().mockResolvedValue(undefined),
    decrementStorage: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<LimitService>;
}

describe('DeletePhotoUseCase', () => {
  it('deletes photo from R2 and DB when user has edit_photos access', async () => {
    const repo: jest.Mocked<PhotoRepository> = {
      save: jest.fn(), findById: jest.fn().mockResolvedValue(makePhoto('user-1')),
      findByPetIds: jest.fn(), findYearsByOwnerId: jest.fn(), delete: jest.fn().mockResolvedValue(undefined),
    };
    const petAccess = { assertCanAccess: jest.fn().mockResolvedValue(makePet('user-1')) } as unknown as PetAccessService;
    const r2 = { upload: jest.fn(), getSignedUrl: jest.fn(), delete: jest.fn().mockResolvedValue(undefined) } as unknown as R2Service;
    const limitService = makeLimitService();
    const useCase = new DeletePhotoUseCase(repo, petAccess, r2, limitService);

    await useCase.execute({ userId: 'user-1', photoId: 'photo-1' });

    expect(petAccess.assertCanAccess).toHaveBeenCalledWith('pet-1', 'user-1', 'edit_photos');
    expect(r2.delete).toHaveBeenCalledWith('photos/abc.jpg');
    expect(repo.delete).toHaveBeenCalledWith('photo-1');
  });

  it('throws NotFoundError when photo does not exist', async () => {
    const repo: jest.Mocked<PhotoRepository> = {
      save: jest.fn(), findById: jest.fn().mockResolvedValue(null),
      findByPetIds: jest.fn(), findYearsByOwnerId: jest.fn(), delete: jest.fn(),
    };
    const petAccess = { assertCanAccess: jest.fn() } as unknown as PetAccessService;
    const r2 = { upload: jest.fn(), getSignedUrl: jest.fn(), delete: jest.fn() } as unknown as R2Service;
    const useCase = new DeletePhotoUseCase(repo, petAccess, r2, makeLimitService());

    await expect(useCase.execute({ userId: 'user-1', photoId: 'photo-99' })).rejects.toThrow(NotFoundError);
    expect(r2.delete).not.toHaveBeenCalled();
  });

  it('throws ForbiddenError when user lacks edit_photos permission', async () => {
    const repo: jest.Mocked<PhotoRepository> = {
      save: jest.fn(), findById: jest.fn().mockResolvedValue(makePhoto('user-1')),
      findByPetIds: jest.fn(), findYearsByOwnerId: jest.fn(), delete: jest.fn(),
    };
    const petAccess = { assertCanAccess: jest.fn().mockRejectedValue(new ForbiddenError()) } as unknown as PetAccessService;
    const r2 = { upload: jest.fn(), getSignedUrl: jest.fn(), delete: jest.fn() } as unknown as R2Service;
    const useCase = new DeletePhotoUseCase(repo, petAccess, r2, makeLimitService());

    await expect(useCase.execute({ userId: 'user-99', photoId: 'photo-1' })).rejects.toThrow(ForbiddenError);
    expect(r2.delete).not.toHaveBeenCalled();
  });
});
