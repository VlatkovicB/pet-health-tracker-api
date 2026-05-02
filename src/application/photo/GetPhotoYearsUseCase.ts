import { Inject, Service } from 'typedi';
import { PhotoRepository, PHOTO_REPOSITORY } from '../../domain/photo/PhotoRepository';
import { PhotoSourceType } from '../../domain/photo/Photo';
import { PetAccessService } from '../pet/PetAccessService';

export interface GetPhotoYearsInput {
  userId: string;
  petIds?: string[];
  sourceTypes?: PhotoSourceType[];
}

@Service()
export class GetPhotoYearsUseCase {
  constructor(
    @Inject(PHOTO_REPOSITORY) private readonly repo: PhotoRepository,
    private readonly petAccessService: PetAccessService,
  ) {}

  async execute(input: GetPhotoYearsInput): Promise<number[]> {
    if (input.petIds?.length) {
      await Promise.all(
        input.petIds.map((petId) =>
          this.petAccessService.assertCanAccess(petId, input.userId, 'view_photos'),
        ),
      );
    }
    return this.repo.findYearsByOwnerId(input.userId, input.petIds, input.sourceTypes);
  }
}
