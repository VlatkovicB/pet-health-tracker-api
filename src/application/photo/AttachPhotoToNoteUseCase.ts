import { Inject, Service } from 'typedi';
import { v4 as uuidv4 } from 'uuid';
import { PhotoRepository, PHOTO_REPOSITORY } from '../../domain/photo/PhotoRepository';
import { Photo } from '../../domain/photo/Photo';
import { PhotoMapper, PhotoResponseDto } from '../../infrastructure/mappers/PhotoMapper';
import { PetAccessService } from '../pet/PetAccessService';
import { R2Service } from '../../infrastructure/storage/R2Service';
import { NoteRepository, NOTE_REPOSITORY } from '../../domain/note/NoteRepository';
import { NotFoundError, ValidationError } from '../../shared/errors/AppError';
import { UniqueEntityId } from '../../domain/shared/UniqueEntityId';

export interface AttachPhotoToNoteInput {
  userId: string;
  noteId: string;
  petId: string;
  buffer: Buffer;
  mimeType: string;
  takenAt: string;
  caption?: string;
}

@Service()
export class AttachPhotoToNoteUseCase {
  constructor(
    @Inject(PHOTO_REPOSITORY) private readonly repo: PhotoRepository,
    @Inject(NOTE_REPOSITORY) private readonly noteRepo: NoteRepository,
    private readonly petAccessService: PetAccessService,
    private readonly mapper: PhotoMapper,
    private readonly r2: R2Service,
  ) {}

  async execute(input: AttachPhotoToNoteInput): Promise<PhotoResponseDto> {
    const note = await this.noteRepo.findById(input.noteId);
    if (!note) throw new NotFoundError('Note');
    if (!note.petIds.includes(input.petId)) {
      throw new ValidationError(`Pet ${input.petId} is not associated with this note`);
    }
    const pet = await this.petAccessService.assertCanAccess(input.petId, input.userId, 'edit_photos');
    const ext = input.mimeType.split('/')[1] ?? 'jpg';
    const s3Key = `photos/${uuidv4()}.${ext}`;
    await this.r2.upload(s3Key, input.buffer, input.mimeType);
    const photo = Photo.create({
      petId: input.petId,
      ownerId: pet.userId,
      s3Key,
      takenAt: input.takenAt,
      caption: input.caption,
      sourceType: 'note',
      sourceId: input.noteId,
    }, new UniqueEntityId());
    const saved = await this.repo.save(photo);
    const url = await this.r2.getSignedUrl(saved.s3Key);
    return this.mapper.toResponse(saved, url);
  }
}
