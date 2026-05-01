import { Inject, Service } from 'typedi';
import { PhotoRepository, PHOTO_REPOSITORY } from '../../domain/photo/PhotoRepository';

export interface GetPhotoYearsInput {
  userId: string;
  petIds?: string[];
}

@Service()
export class GetPhotoYearsUseCase {
  constructor(
    @Inject(PHOTO_REPOSITORY) private readonly repo: PhotoRepository,
  ) {}

  async execute(input: GetPhotoYearsInput): Promise<number[]> {
    return this.repo.findYearsByOwnerId(input.userId, input.petIds);
  }
}
