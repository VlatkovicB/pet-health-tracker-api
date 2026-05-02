import { Inject, Service } from 'typedi';
import { v4 as uuidv4 } from 'uuid';
import { PhotoRepository, PHOTO_REPOSITORY } from '../../domain/photo/PhotoRepository';
import { Photo } from '../../domain/photo/Photo';
import { PhotoMapper, PhotoResponseDto } from '../../infrastructure/mappers/PhotoMapper';
import { PetAccessService } from '../pet/PetAccessService';
import { R2Service } from '../../infrastructure/storage/R2Service';
import { WeightEntryRepository, WEIGHT_ENTRY_REPOSITORY } from '../../domain/weight/WeightEntryRepository';
import { NotFoundError } from '../../shared/errors/AppError';
import { UniqueEntityId } from '../../domain/shared/UniqueEntityId';

export interface AttachPhotoToWeightEntryInput {
  userId: string;
  weightEntryId: string;
  buffer: Buffer;
  mimeType: string;
  takenAt: string;
  caption?: string;
}

@Service()
export class AttachPhotoToWeightEntryUseCase {
  constructor(
    @Inject(PHOTO_REPOSITORY) private readonly repo: PhotoRepository,
    @Inject(WEIGHT_ENTRY_REPOSITORY) private readonly weightEntryRepo: WeightEntryRepository,
    private readonly petAccessService: PetAccessService,
    private readonly mapper: PhotoMapper,
    private readonly r2: R2Service,
  ) {}

  async execute(input: AttachPhotoToWeightEntryInput): Promise<PhotoResponseDto> {
    const entry = await this.weightEntryRepo.findById(input.weightEntryId);
    if (!entry) throw new NotFoundError('WeightEntry');
    const pet = await this.petAccessService.assertCanAccess(entry.petId, input.userId, 'edit_photos');
    const ext = input.mimeType.split('/')[1] ?? 'jpg';
    const s3Key = `photos/${uuidv4()}.${ext}`;
    await this.r2.upload(s3Key, input.buffer, input.mimeType);
    const photo = Photo.create({
      petId: entry.petId,
      ownerId: pet.userId,
      s3Key,
      takenAt: input.takenAt,
      caption: input.caption,
      sourceType: 'weight-entry',
      sourceId: input.weightEntryId,
    }, new UniqueEntityId());
    const saved = await this.repo.save(photo);
    const url = await this.r2.getSignedUrl(saved.s3Key);
    return this.mapper.toResponse(saved, url);
  }
}
