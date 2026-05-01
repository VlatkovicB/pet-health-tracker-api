import 'reflect-metadata';
import { AttachPhotoToNoteUseCase } from '../../../src/application/photo/AttachPhotoToNoteUseCase';
import { PhotoRepository } from '../../../src/domain/photo/PhotoRepository';
import { NoteRepository } from '../../../src/domain/note/NoteRepository';
import { PetAccessService } from '../../../src/application/pet/PetAccessService';
import { PhotoMapper } from '../../../src/infrastructure/mappers/PhotoMapper';
import { R2Service } from '../../../src/infrastructure/storage/R2Service';
import { Photo } from '../../../src/domain/photo/Photo';
import { Pet } from '../../../src/domain/pet/Pet';
import { Note } from '../../../src/domain/note/Note';
import { UniqueEntityId } from '../../../src/domain/shared/UniqueEntityId';
import { ForbiddenError, NotFoundError, ValidationError } from '../../../src/shared/errors/AppError';

function makePet(): Pet {
  return Pet.reconstitute(
    { name: 'Buddy', species: 'dog', userId: 'user-1', createdAt: new Date() },
    new UniqueEntityId('pet-1'),
  );
}

function makeNote(): Note {
  return Note.reconstitute(
    {
      userId: 'user-1',
      title: 'Test note',
      noteDate: '2026-04-15',
      petIds: ['pet-1'],
      createdAt: new Date(),
    },
    new UniqueEntityId('note-1'),
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
      sourceType: 'note' as const,
      sourceId: 'note-1',
      createdAt: new Date().toISOString(),
    })),
  } as any;
}

describe('AttachPhotoToNoteUseCase', () => {
  it('successfully attaches photo to note, checks access, saves photo, and returns signed URL', async () => {
    const note = makeNote();
    const pet = makePet();
    const repo = makeRepo();
    const mapper = makeMapper();
    const noteRepo: jest.Mocked<NoteRepository> = {
      save: jest.fn(),
      findById: jest.fn().mockResolvedValue(note),
      findByUserId: jest.fn(),
      delete: jest.fn(),
    };
    const petAccess = { assertCanAccess: jest.fn().mockResolvedValue(pet) } as unknown as PetAccessService;
    const r2 = {
      upload: jest.fn().mockResolvedValue(undefined),
      getSignedUrl: jest.fn().mockResolvedValue('https://signed.url/photo.jpg'),
      delete: jest.fn(),
    } as unknown as R2Service;

    const useCase = new AttachPhotoToNoteUseCase(repo, noteRepo, petAccess, mapper, r2);

    const result = await useCase.execute({
      userId: 'user-1',
      noteId: 'note-1',
      petId: 'pet-1',
      buffer: Buffer.from('fake-image'),
      mimeType: 'image/jpeg',
      takenAt: '2026-04-15',
      caption: 'Note photo',
    });

    expect(petAccess.assertCanAccess).toHaveBeenCalledWith('pet-1', 'user-1', 'edit_photos');
    expect(r2.upload).toHaveBeenCalledTimes(1);
    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(result.url).toBe('https://signed.url/photo.jpg');
  });

  it('throws NotFoundError when note does not exist', async () => {
    const repo = makeRepo();
    const mapper = makeMapper();
    const noteRepo: jest.Mocked<NoteRepository> = {
      save: jest.fn(),
      findById: jest.fn().mockResolvedValue(null),
      findByUserId: jest.fn(),
      delete: jest.fn(),
    };
    const petAccess = { assertCanAccess: jest.fn() } as unknown as PetAccessService;
    const r2 = { upload: jest.fn(), getSignedUrl: jest.fn(), delete: jest.fn() } as unknown as R2Service;

    const useCase = new AttachPhotoToNoteUseCase(repo, noteRepo, petAccess, mapper, r2);

    await expect(
      useCase.execute({ userId: 'user-1', noteId: 'nonexistent', petId: 'pet-1', buffer: Buffer.from('x'), mimeType: 'image/jpeg', takenAt: '2026-04-15' }),
    ).rejects.toThrow(NotFoundError);
    expect(r2.upload).not.toHaveBeenCalled();
  });

  it('throws ForbiddenError when user lacks edit_photos permission, does not upload', async () => {
    const note = makeNote();
    const repo = makeRepo();
    const mapper = makeMapper();
    const noteRepo: jest.Mocked<NoteRepository> = {
      save: jest.fn(),
      findById: jest.fn().mockResolvedValue(note),
      findByUserId: jest.fn(),
      delete: jest.fn(),
    };
    const petAccess = { assertCanAccess: jest.fn().mockRejectedValue(new ForbiddenError()) } as unknown as PetAccessService;
    const r2 = { upload: jest.fn(), getSignedUrl: jest.fn(), delete: jest.fn() } as unknown as R2Service;

    const useCase = new AttachPhotoToNoteUseCase(repo, noteRepo, petAccess, mapper, r2);

    await expect(
      useCase.execute({ userId: 'user-99', noteId: 'note-1', petId: 'pet-1', buffer: Buffer.from('x'), mimeType: 'image/jpeg', takenAt: '2026-04-15' }),
    ).rejects.toThrow(ForbiddenError);
    expect(r2.upload).not.toHaveBeenCalled();
  });

  it('throws ValidationError when petId is not associated with the note', async () => {
    const note = makeNote(); // note.petIds = ['pet-1']
    const repo = makeRepo();
    const mapper = makeMapper();
    const noteRepo: jest.Mocked<NoteRepository> = {
      save: jest.fn(),
      findById: jest.fn().mockResolvedValue(note),
      findByUserId: jest.fn(),
      delete: jest.fn(),
    };
    const petAccess = { assertCanAccess: jest.fn() } as unknown as PetAccessService;
    const r2 = { upload: jest.fn(), getSignedUrl: jest.fn(), delete: jest.fn() } as unknown as R2Service;

    const useCase = new AttachPhotoToNoteUseCase(repo, noteRepo, petAccess, mapper, r2);

    await expect(
      useCase.execute({ userId: 'user-1', noteId: 'note-1', petId: 'pet-99', buffer: Buffer.from('x'), mimeType: 'image/jpeg', takenAt: '2026-04-15' }),
    ).rejects.toThrow(ValidationError);
    expect(petAccess.assertCanAccess).not.toHaveBeenCalled();
    expect(r2.upload).not.toHaveBeenCalled();
  });

  it('allows group member to attach photo (no userId pre-gate)', async () => {
    const note = makeNote(); // note.userId is 'user-1', but group member 'user-2' has access
    const pet = makePet();
    const repo = makeRepo();
    const mapper = makeMapper();
    const noteRepo: jest.Mocked<NoteRepository> = {
      save: jest.fn(),
      findById: jest.fn().mockResolvedValue(note),
      findByUserId: jest.fn(),
      delete: jest.fn(),
    };
    const petAccess = { assertCanAccess: jest.fn().mockResolvedValue(pet) } as unknown as PetAccessService;
    const r2 = {
      upload: jest.fn().mockResolvedValue(undefined),
      getSignedUrl: jest.fn().mockResolvedValue('https://signed.url/photo.jpg'),
      delete: jest.fn(),
    } as unknown as R2Service;

    const useCase = new AttachPhotoToNoteUseCase(repo, noteRepo, petAccess, mapper, r2);

    // user-2 is not note.userId but has edit_photos via group share
    const result = await useCase.execute({
      userId: 'user-2',
      noteId: 'note-1',
      petId: 'pet-1',
      buffer: Buffer.from('fake-image'),
      mimeType: 'image/jpeg',
      takenAt: '2026-04-15',
    });

    expect(petAccess.assertCanAccess).toHaveBeenCalledWith('pet-1', 'user-2', 'edit_photos');
    expect(result.url).toBe('https://signed.url/photo.jpg');
  });
});
