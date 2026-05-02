import { Inject, Service } from 'typedi';
import { PhotoRepository, PHOTO_REPOSITORY } from '../../domain/photo/PhotoRepository';
import { PhotoSourceType } from '../../domain/photo/Photo';
import { PetRepository, PET_REPOSITORY } from '../../domain/pet/PetRepository';
import { PhotoMapper, PhotoResponseDto } from '../../infrastructure/mappers/PhotoMapper';
import { PetAccessService } from '../pet/PetAccessService';
import { R2Service } from '../../infrastructure/storage/R2Service';

export interface GetPhotoTimelineInput {
  userId: string;
  year: number;
  petIds?: string[];
  sourceTypes?: PhotoSourceType[];
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
      petIds = result.items.map((p) => p.id.toValue());
    }

    const photos = await this.repo.findByPetIds(petIds, input.year, input.sourceTypes);

    const uniquePetIds = [...new Set(photos.map((p) => p.petId))];
    const petsForPhotos = await this.petRepo.findByIds(uniquePetIds);
    const petMap = new Map(petsForPhotos.map((p) => [p.id.toValue(), { id: p.id.toValue(), name: p.name }]));

    const entries = await Promise.all(
      photos.map(async (photo) => {
        const url = await this.r2.getSignedUrl(photo.s3Key);
        const petInfo = petMap.get(photo.petId);
        return { photo, dto: this.mapper.toResponse(photo, url, petInfo) };
      }),
    );

    const timeline: PhotoTimeline = {};
    for (const { photo, dto } of entries) {
      const year = photo.takenAt.slice(0, 4);
      const month = photo.takenAt.slice(5, 7);
      if (!timeline[year]) timeline[year] = {};
      if (!timeline[year][month]) timeline[year][month] = [];
      timeline[year][month].push(dto);
    }

    return timeline;
  }
}
