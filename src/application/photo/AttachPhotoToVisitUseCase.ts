import { Inject, Service } from 'typedi';
import { v4 as uuidv4 } from 'uuid';
import { PhotoRepository, PHOTO_REPOSITORY } from '../../domain/photo/PhotoRepository';
import { Photo } from '../../domain/photo/Photo';
import { PhotoMapper, PhotoResponseDto } from '../../infrastructure/mappers/PhotoMapper';
import { PetAccessService } from '../pet/PetAccessService';
import { R2Service } from '../../infrastructure/storage/R2Service';
import { HealthRecordRepository, HEALTH_RECORD_REPOSITORY } from '../../domain/health/HealthRecordRepository';
import { NotFoundError } from '../../shared/errors/AppError';
import { UniqueEntityId } from '../../domain/shared/UniqueEntityId';
import { LimitService } from '../limits/LimitService';

export interface AttachPhotoToVisitInput {
  userId: string;
  visitId: string;
  buffer: Buffer;
  mimeType: string;
  takenAt: string;
  caption?: string;
}

@Service()
export class AttachPhotoToVisitUseCase {
  constructor(
    @Inject(PHOTO_REPOSITORY) private readonly repo: PhotoRepository,
    @Inject(HEALTH_RECORD_REPOSITORY) private readonly healthRepo: HealthRecordRepository,
    private readonly petAccessService: PetAccessService,
    private readonly mapper: PhotoMapper,
    private readonly r2: R2Service,
    private readonly limitService: LimitService,
  ) {}

  async execute(input: AttachPhotoToVisitInput): Promise<PhotoResponseDto> {
    const visit = await this.healthRepo.findVetVisitById(input.visitId);
    if (!visit) throw new NotFoundError('VetVisit');
    const pet = await this.petAccessService.assertCanAccess(visit.petId, input.userId, 'edit_photos');
    await this.limitService.checkStorageLimit(input.userId, input.buffer.length);
    const ext = input.mimeType.split('/')[1] ?? 'jpg';
    const s3Key = `photos/${uuidv4()}.${ext}`;
    await this.r2.upload(s3Key, input.buffer, input.mimeType);
    const photo = Photo.create({
      petId: visit.petId,
      ownerId: pet.userId,
      s3Key,
      takenAt: input.takenAt,
      caption: input.caption,
      sourceType: 'vet-visit',
      sourceId: input.visitId,
      sizeBytes: input.buffer.length,
    }, new UniqueEntityId());
    const saved = await this.repo.save(photo);
    await this.limitService.incrementStorage(input.userId, input.buffer.length);
    const url = await this.r2.getSignedUrl(saved.s3Key);
    return this.mapper.toResponse(saved, url);
  }
}
