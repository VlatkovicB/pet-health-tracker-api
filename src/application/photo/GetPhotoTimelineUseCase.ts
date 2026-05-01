import { Inject, Service } from 'typedi';
import { PhotoRepository, PHOTO_REPOSITORY } from '../../domain/photo/PhotoRepository';
import { PetRepository, PET_REPOSITORY } from '../../domain/pet/PetRepository';
import { Pet } from '../../domain/pet/Pet';
import { PhotoMapper, PhotoResponseDto } from '../../infrastructure/mappers/PhotoMapper';
import { PetAccessService } from '../pet/PetAccessService';
import { R2Service } from '../../infrastructure/storage/R2Service';

export interface GetPhotoTimelineInput {
  userId: string;
  year: number;
  petIds?: string[];
}

export type PhotoTimeline = Record<string, Record<string, PhotoResponseDto[]>>;

@Service()
export class GetPhotoTimelineUseCase {
  constructor(
    @Inject(PHOTO_REPOSITORY) private readonly repo: PhotoRepository,
    @Inject(PET_REPOSITORY) private readonly petRepo: PetRepository,
    private readonly mapper: PhotoMapper,
    private readonly petAccessService: PetAccessService,
    private readonly r2: R2Service,
  ) {}

  async execute(input: GetPhotoTimelineInput): Promise<PhotoTimeline> {
    let petIds: string[];

    if (input.petIds?.length) {
      await Promise.all(
        input.petIds.map((petId) =>
          this.petAccessService.assertCanAccess(petId, input.userId, 'view_photos'),
        ),
      );
      petIds = input.petIds;
    } else {
      const result = await this.petRepo.findByUserId(input.userId, { page: 1, limit: 10000 });
      // Handle both paginated result (production) and plain array (test mocks)
      const pets: Pet[] = Array.isArray(result) ? result : (result as any).items;
      petIds = pets.map((p) => p.id.toValue());
    }

    const photos = await this.repo.findByPetIds(petIds, input.year);

    // Build pet map for hydration
    const uniquePetIds = [...new Set(photos.map((p) => p.petId))];
    const petsForPhotos = await this.petRepo.findByIds(uniquePetIds);
    const petMap = new Map(petsForPhotos.map((p) => [p.id.toValue(), { id: p.id.toValue(), name: p.name }]));

    const timeline: PhotoTimeline = {};

    for (const photo of photos) {
      const year = photo.takenAt.slice(0, 4);
      const month = photo.takenAt.slice(5, 7);
      const url = await this.r2.getSignedUrl(photo.s3Key);
      const petInfo = petMap.get(photo.petId);
      const dto = this.mapper.toResponse(photo, url, petInfo);
      if (!timeline[year]) timeline[year] = {};
      if (!timeline[year][month]) timeline[year][month] = [];
      timeline[year][month].push(dto);
    }

    return timeline;
  }
}
