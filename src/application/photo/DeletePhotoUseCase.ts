import { Inject, Service } from 'typedi';
import { PhotoRepository, PHOTO_REPOSITORY } from '../../domain/photo/PhotoRepository';
import { R2Service } from '../../infrastructure/storage/R2Service';
import { ForbiddenError, NotFoundError } from '../../shared/errors/AppError';

export interface DeletePhotoInput {
  userId: string;
  photoId: string;
}

@Service()
export class DeletePhotoUseCase {
  constructor(
    @Inject(PHOTO_REPOSITORY) private readonly repo: PhotoRepository,
    private readonly r2: R2Service,
  ) {}

  async execute(input: DeletePhotoInput): Promise<void> {
    const photo = await this.repo.findById(input.photoId);
    if (!photo) throw new NotFoundError('Photo');
    if (photo.ownerId !== input.userId) throw new ForbiddenError();
    await this.r2.delete(photo.s3Key);
    await this.repo.delete(input.photoId);
  }
}
