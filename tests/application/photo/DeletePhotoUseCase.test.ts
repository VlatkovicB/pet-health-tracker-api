import 'reflect-metadata';
import { DeletePhotoUseCase } from '../../../src/application/photo/DeletePhotoUseCase';
import { PhotoRepository } from '../../../src/domain/photo/PhotoRepository';
import { R2Service } from '../../../src/infrastructure/storage/R2Service';
import { Photo } from '../../../src/domain/photo/Photo';
import { UniqueEntityId } from '../../../src/domain/shared/UniqueEntityId';
import { ForbiddenError, NotFoundError } from '../../../src/shared/errors/AppError';

function makePhoto(ownerId: string): Photo {
  return Photo.reconstitute(
    { petId: 'pet-1', ownerId, s3Key: 'photos/abc.jpg', takenAt: '2026-04-30', caption: undefined, sourceType: 'standalone', sourceId: undefined, createdAt: new Date() },
    new UniqueEntityId('photo-1'),
  );
}

describe('DeletePhotoUseCase', () => {
  it('deletes photo from R2 and DB when user is owner', async () => {
    const repo: jest.Mocked<PhotoRepository> = {
      save: jest.fn(), findById: jest.fn().mockResolvedValue(makePhoto('user-1')),
      findByPetIds: jest.fn(), findYearsByOwnerId: jest.fn(), delete: jest.fn().mockResolvedValue(undefined),
    };
    const r2 = { upload: jest.fn(), getSignedUrl: jest.fn(), delete: jest.fn().mockResolvedValue(undefined) } as unknown as R2Service;
    const useCase = new DeletePhotoUseCase(repo, r2);

    await useCase.execute({ userId: 'user-1', photoId: 'photo-1' });

    expect(r2.delete).toHaveBeenCalledWith('photos/abc.jpg');
    expect(repo.delete).toHaveBeenCalledWith('photo-1');
  });

  it('throws NotFoundError when photo does not exist', async () => {
    const repo: jest.Mocked<PhotoRepository> = {
      save: jest.fn(), findById: jest.fn().mockResolvedValue(null),
      findByPetIds: jest.fn(), findYearsByOwnerId: jest.fn(), delete: jest.fn(),
    };
    const r2 = { upload: jest.fn(), getSignedUrl: jest.fn(), delete: jest.fn() } as unknown as R2Service;
    const useCase = new DeletePhotoUseCase(repo, r2);

    await expect(useCase.execute({ userId: 'user-1', photoId: 'photo-99' })).rejects.toThrow(NotFoundError);
    expect(r2.delete).not.toHaveBeenCalled();
  });

  it('throws ForbiddenError when user is not owner', async () => {
    const repo: jest.Mocked<PhotoRepository> = {
      save: jest.fn(), findById: jest.fn().mockResolvedValue(makePhoto('user-1')),
      findByPetIds: jest.fn(), findYearsByOwnerId: jest.fn(), delete: jest.fn(),
    };
    const r2 = { upload: jest.fn(), getSignedUrl: jest.fn(), delete: jest.fn() } as unknown as R2Service;
    const useCase = new DeletePhotoUseCase(repo, r2);

    await expect(useCase.execute({ userId: 'user-99', photoId: 'photo-1' })).rejects.toThrow(ForbiddenError);
    expect(r2.delete).not.toHaveBeenCalled();
  });
});
