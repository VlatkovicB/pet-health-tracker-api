import { Inject, Service } from 'typedi';
import { PhotoRepository, PHOTO_REPOSITORY } from '../../domain/photo/PhotoRepository';
import { PetAccessService } from '../pet/PetAccessService';
import { R2Service } from '../../infrastructure/storage/R2Service';
import { NotFoundError } from '../../shared/errors/AppError';
import { LimitService } from '../limits/LimitService';

export interface DeletePhotoInput {
  userId: string;
  photoId: string;
}

@Service()
export class DeletePhotoUseCase {
  constructor(
    @Inject(PHOTO_REPOSITORY) private readonly repo: PhotoRepository,
    private readonly petAccessService: PetAccessService,
    private readonly r2: R2Service,
    private readonly limitService: LimitService,
  ) {}

  async execute(input: DeletePhotoInput): Promise<void> {
    const photo = await this.repo.findById(input.photoId);
    if (!photo) throw new NotFoundError('Photo');
    await this.petAccessService.assertCanAccess(photo.petId, input.userId, 'edit_photos');
    await this.r2.delete(photo.s3Key);
    await this.repo.delete(input.photoId);
    await this.limitService.decrementStorage(input.userId, photo.sizeBytes);
  }
}
