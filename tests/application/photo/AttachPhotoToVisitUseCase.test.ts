import 'reflect-metadata';
import { AttachPhotoToVisitUseCase } from '../../../src/application/photo/AttachPhotoToVisitUseCase';
import { PhotoRepository } from '../../../src/domain/photo/PhotoRepository';
import { HealthRecordRepository } from '../../../src/domain/health/HealthRecordRepository';
import { PetAccessService } from '../../../src/application/pet/PetAccessService';
import { PhotoMapper } from '../../../src/infrastructure/mappers/PhotoMapper';
import { R2Service } from '../../../src/infrastructure/storage/R2Service';
import { Photo } from '../../../src/domain/photo/Photo';
import { Pet } from '../../../src/domain/pet/Pet';
import { VetVisit } from '../../../src/domain/health/VetVisit';
import { UniqueEntityId } from '../../../src/domain/shared/UniqueEntityId';
import { ForbiddenError, NotFoundError } from '../../../src/shared/errors/AppError';

function makePet(): Pet {
  return Pet.reconstitute(
    { name: 'Buddy', species: 'dog', userId: 'user-1', createdAt: new Date() },
    new UniqueEntityId('pet-1'),
  );
}

function makeVisit(): VetVisit {
  return VetVisit.reconstitute(
    {
      petId: 'pet-1',
      type: 'logged',
      visitDate: new Date('2026-04-15'),
      reason: 'Checkup',
      imageUrls: [],
      createdBy: 'user-1',
      createdAt: new Date(),
    },
    new UniqueEntityId('visit-1'),
  );
}

function makePhoto(): Photo {
  return Photo.reconstitute(
    {
      petId: 'pet-1',
      ownerId: 'user-1',
      s3Key: 'photos/abc.jpg',
      takenAt: '2026-04-15',
      caption: undefined,
      sourceType: 'vet-visit',
      sourceId: 'visit-1',
      createdAt: new Date(),
    },
    new UniqueEntityId('photo-1'),
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
      pet: { id: 'pet-1', name: 'Buddy' },
      ownerId: 'user-1',
      url,
      takenAt: '2026-04-15',
      caption: undefined,
      sourceType: 'vet-visit' as const,
      sourceId: 'visit-1',
      createdAt: new Date().toISOString(),
    })),
  } as any;
}

describe('AttachPhotoToVisitUseCase', () => {
  it('successfully attaches photo to visit, checks access, saves photo, and returns signed URL', async () => {
    const visit = makeVisit();
    const pet = makePet();
    const repo = makeRepo();
    const mapper = makeMapper();
    const healthRepo: jest.Mocked<HealthRecordRepository> = {
      findVetVisitById: jest.fn().mockResolvedValue(visit),
      findVetVisitsByPetId: jest.fn(),
      findVetVisitsByPetIdAndDateRange: jest.fn(),
      findUpcomingVetVisitsByUserId: jest.fn(),
      findVetVisitsByDateRange: jest.fn(),
      saveVetVisit: jest.fn(),
      findMedicationById: jest.fn(),
      findMedicationsByPetId: jest.fn(),
      findActiveMedications: jest.fn(),
      saveMedication: jest.fn(),
    };
    const petAccess = { assertCanAccess: jest.fn().mockResolvedValue(pet) } as unknown as PetAccessService;
    const r2 = {
      upload: jest.fn().mockResolvedValue(undefined),
      getSignedUrl: jest.fn().mockResolvedValue('https://signed.url/photo.jpg'),
      delete: jest.fn(),
    } as unknown as R2Service;

    const useCase = new AttachPhotoToVisitUseCase(repo, healthRepo, petAccess, mapper, r2);

    const result = await useCase.execute({
      userId: 'user-1',
      visitId: 'visit-1',
      buffer: Buffer.from('fake-image'),
      mimeType: 'image/jpeg',
      takenAt: '2026-04-15',
      caption: 'Vet checkup',
    });

    expect(petAccess.assertCanAccess).toHaveBeenCalledWith('pet-1', 'user-1', 'edit_photos');
    expect(r2.upload).toHaveBeenCalledTimes(1);
    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(result.url).toBe('https://signed.url/photo.jpg');
  });

  it('throws NotFoundError when visit does not exist', async () => {
    const repo = makeRepo();
    const mapper = makeMapper();
    const healthRepo: jest.Mocked<HealthRecordRepository> = {
      findVetVisitById: jest.fn().mockResolvedValue(null),
      findVetVisitsByPetId: jest.fn(),
      findVetVisitsByPetIdAndDateRange: jest.fn(),
      findUpcomingVetVisitsByUserId: jest.fn(),
      findVetVisitsByDateRange: jest.fn(),
      saveVetVisit: jest.fn(),
      findMedicationById: jest.fn(),
      findMedicationsByPetId: jest.fn(),
      findActiveMedications: jest.fn(),
      saveMedication: jest.fn(),
    };
    const petAccess = { assertCanAccess: jest.fn() } as unknown as PetAccessService;
    const r2 = { upload: jest.fn(), getSignedUrl: jest.fn(), delete: jest.fn() } as unknown as R2Service;

    const useCase = new AttachPhotoToVisitUseCase(repo, healthRepo, petAccess, mapper, r2);

    await expect(
      useCase.execute({ userId: 'user-1', visitId: 'nonexistent', buffer: Buffer.from('x'), mimeType: 'image/jpeg', takenAt: '2026-04-15' }),
    ).rejects.toThrow(NotFoundError);
    expect(r2.upload).not.toHaveBeenCalled();
  });

  it('throws ForbiddenError when user lacks edit_photos permission, does not upload', async () => {
    const visit = makeVisit();
    const repo = makeRepo();
    const mapper = makeMapper();
    const healthRepo: jest.Mocked<HealthRecordRepository> = {
      findVetVisitById: jest.fn().mockResolvedValue(visit),
      findVetVisitsByPetId: jest.fn(),
      findVetVisitsByPetIdAndDateRange: jest.fn(),
      findUpcomingVetVisitsByUserId: jest.fn(),
      findVetVisitsByDateRange: jest.fn(),
      saveVetVisit: jest.fn(),
      findMedicationById: jest.fn(),
      findMedicationsByPetId: jest.fn(),
      findActiveMedications: jest.fn(),
      saveMedication: jest.fn(),
    };
    const petAccess = { assertCanAccess: jest.fn().mockRejectedValue(new ForbiddenError()) } as unknown as PetAccessService;
    const r2 = { upload: jest.fn(), getSignedUrl: jest.fn(), delete: jest.fn() } as unknown as R2Service;

    const useCase = new AttachPhotoToVisitUseCase(repo, healthRepo, petAccess, mapper, r2);

    await expect(
      useCase.execute({ userId: 'user-99', visitId: 'visit-1', buffer: Buffer.from('x'), mimeType: 'image/jpeg', takenAt: '2026-04-15' }),
    ).rejects.toThrow(ForbiddenError);
    expect(r2.upload).not.toHaveBeenCalled();
  });
});
