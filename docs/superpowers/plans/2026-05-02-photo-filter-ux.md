# Photo Timeline Filter UX Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the photo timeline's two-row chip filter with a unified icon-based toolbar strip, and move source-type filtering from client-side to server-side.

**Architecture:** API gains a `sourceTypes` query param on the timeline and years endpoints (repo → use case → schema → controller). The client gets a new `FilterToolbar` component encapsulating all filter state; `PhotosPage` state inverts from "selected = include" to "excluded = hide" (empty exclusion set = show all).

**Tech Stack:** TypeScript, Express/routing-controllers, Zod, Sequelize/PostgreSQL (API); React, MUI v9, TanStack Query (client)

---

### Task 1: Add `sourceTypes` filter to PhotoRepository

**Repo:** `pet-health-tracker-api` at `~/projects/pet-health-tracker-api`

**Files:**
- Modify: `src/domain/photo/PhotoRepository.ts`
- Modify: `src/infrastructure/db/repositories/SequelizePhotoRepository.ts`

`PhotoRepository.findByPetIds` and `findYearsByOwnerId` need a `sourceTypes` parameter so use cases can filter photos at the DB level.

- [ ] **Step 1: Update PhotoRepository interface**

Replace the full content of `src/domain/photo/PhotoRepository.ts`:

```typescript
import { Photo, PhotoSourceType } from './Photo';

export const PHOTO_REPOSITORY = 'PhotoRepository';

export interface PhotoRepository {
  save(photo: Photo): Promise<Photo>;
  findById(id: string): Promise<Photo | null>;
  findByPetIds(petIds: string[], year: number, sourceTypes?: PhotoSourceType[]): Promise<Photo[]>;
  findYearsByOwnerId(ownerId: string, petIds?: string[], sourceTypes?: PhotoSourceType[]): Promise<number[]>;
  delete(id: string): Promise<void>;
}
```

- [ ] **Step 2: Update SequelizePhotoRepository**

Replace the full content of `src/infrastructure/db/repositories/SequelizePhotoRepository.ts`:

```typescript
import { Service } from 'typedi';
import { Op } from 'sequelize';
import { Photo, PhotoSourceType } from '../../../domain/photo/Photo';
import { PhotoRepository } from '../../../domain/photo/PhotoRepository';
import { PhotoModel } from '../models/PhotoModel';
import { PhotoMapper } from '../../mappers/PhotoMapper';

@Service()
export class SequelizePhotoRepository implements PhotoRepository {
  constructor(private readonly mapper: PhotoMapper) {}

  async save(photo: Photo): Promise<Photo> {
    await PhotoModel.upsert(this.mapper.toPersistence(photo) as any);
    const saved = await this.findById(photo.id.toValue());
    if (!saved) throw new Error(`Photo ${photo.id.toValue()} not found after save`);
    return saved;
  }

  async findById(id: string): Promise<Photo | null> {
    const model = await PhotoModel.findByPk(id);
    return model ? this.mapper.toDomain(model) : null;
  }

  async findByPetIds(petIds: string[], year: number, sourceTypes?: PhotoSourceType[]): Promise<Photo[]> {
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;
    const where: any = {
      petId: { [Op.in]: petIds },
      takenAt: { [Op.between]: [start, end] },
    };
    if (sourceTypes?.length) where.sourceType = { [Op.in]: sourceTypes };
    const models = await PhotoModel.findAll({
      where,
      order: [['taken_at', 'DESC']],
    });
    return models.map((m) => this.mapper.toDomain(m));
  }

  async findYearsByOwnerId(ownerId: string, petIds?: string[], sourceTypes?: PhotoSourceType[]): Promise<number[]> {
    const where: any = { ownerId };
    if (petIds?.length) where.petId = { [Op.in]: petIds };
    if (sourceTypes?.length) where.sourceType = { [Op.in]: sourceTypes };
    const models = await PhotoModel.findAll({
      attributes: [[PhotoModel.sequelize!.fn('DISTINCT', PhotoModel.sequelize!.fn('date_part', 'year', PhotoModel.sequelize!.col('taken_at'))), 'year']],
      where,
      order: [[PhotoModel.sequelize!.literal('year'), 'DESC']],
      raw: true,
    }) as any[];
    return models.map((m) => Number(m.year));
  }

  async delete(id: string): Promise<void> {
    await PhotoModel.destroy({ where: { id } });
  }
}
```

- [ ] **Step 3: Build and verify no TypeScript errors**

```bash
pnpm build
```
Expected: clean build, no errors

- [ ] **Step 4: Commit**

```bash
git add src/domain/photo/PhotoRepository.ts src/infrastructure/db/repositories/SequelizePhotoRepository.ts
git commit -m "feat: add sourceTypes filter to PhotoRepository"
```

---

### Task 2: Add `sourceTypes` to GetPhotoTimelineUseCase

**Repo:** `pet-health-tracker-api`

**Files:**
- Modify: `src/application/photo/GetPhotoTimelineUseCase.ts`
- Modify: `tests/application/photo/GetPhotoTimelineUseCase.test.ts`

- [ ] **Step 1: Add failing test for sourceTypes**

Add this test case inside the `describe('GetPhotoTimelineUseCase')` block in `tests/application/photo/GetPhotoTimelineUseCase.test.ts`:

```typescript
it('passes sourceTypes to repo when provided', async () => {
  const pet = makePet();
  const repo: jest.Mocked<PhotoRepository> = {
    save: jest.fn(), findById: jest.fn(),
    findByPetIds: jest.fn().mockResolvedValue([]),
    findYearsByOwnerId: jest.fn(), delete: jest.fn(),
  };
  const petRepo: jest.Mocked<PetRepository> = {
    findByUserId: jest.fn().mockResolvedValue({ items: [pet], total: 1, page: 1, limit: 10000 }),
    findById: jest.fn(), findByIds: jest.fn().mockResolvedValue([]),
    save: jest.fn(), delete: jest.fn(),
  } as any;
  const petAccess = { assertCanAccess: jest.fn() } as unknown as PetAccessService;
  const r2 = { getSignedUrl: jest.fn(), upload: jest.fn(), delete: jest.fn() } as unknown as R2Service;
  const mapper = { toDomain: jest.fn(), toPersistence: jest.fn(), toResponse: jest.fn() } as any;

  const useCase = new GetPhotoTimelineUseCase(repo, petRepo, mapper, petAccess, r2);
  await useCase.execute({ userId: 'user-1', year: 2026, sourceTypes: ['vet-visit', 'note'] });

  expect(repo.findByPetIds).toHaveBeenCalledWith(['pet-1'], 2026, ['vet-visit', 'note']);
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
pnpm test -- --testPathPattern="GetPhotoTimelineUseCase" --no-coverage
```
Expected: FAIL — `findByPetIds` is called with 2 args, not 3

- [ ] **Step 3: Update GetPhotoTimelineUseCase**

Replace the full content of `src/application/photo/GetPhotoTimelineUseCase.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm test -- --testPathPattern="GetPhotoTimelineUseCase" --no-coverage
```
Expected: 4 tests pass (3 existing + 1 new)

- [ ] **Step 5: Commit**

```bash
git add src/application/photo/GetPhotoTimelineUseCase.ts tests/application/photo/GetPhotoTimelineUseCase.test.ts
git commit -m "feat: add sourceTypes to GetPhotoTimelineUseCase"
```

---

### Task 3: Add `sourceTypes` to GetPhotoYearsUseCase

**Repo:** `pet-health-tracker-api`

**Files:**
- Modify: `src/application/photo/GetPhotoYearsUseCase.ts`
- Modify: `tests/application/photo/GetPhotoYearsUseCase.test.ts`

- [ ] **Step 1: Add failing test for sourceTypes**

Add this test case inside the `describe('GetPhotoYearsUseCase')` block in `tests/application/photo/GetPhotoYearsUseCase.test.ts`:

```typescript
it('passes sourceTypes to repo when provided', async () => {
  const repo = makeRepo([2025, 2026]);
  const petAccess = { assertCanAccess: jest.fn() } as unknown as PetAccessService;
  const useCase = new GetPhotoYearsUseCase(repo, petAccess);

  await useCase.execute({ userId: 'user-1', sourceTypes: ['standalone', 'vet-visit'] });

  expect(repo.findYearsByOwnerId).toHaveBeenCalledWith('user-1', undefined, ['standalone', 'vet-visit']);
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
pnpm test -- --testPathPattern="GetPhotoYearsUseCase" --no-coverage
```
Expected: FAIL — `findYearsByOwnerId` called with 2 args, not 3

- [ ] **Step 3: Update GetPhotoYearsUseCase**

Replace the full content of `src/application/photo/GetPhotoYearsUseCase.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm test -- --testPathPattern="GetPhotoYearsUseCase" --no-coverage
```
Expected: 4 tests pass (3 existing + 1 new)

- [ ] **Step 5: Commit**

```bash
git add src/application/photo/GetPhotoYearsUseCase.ts tests/application/photo/GetPhotoYearsUseCase.test.ts
git commit -m "feat: add sourceTypes to GetPhotoYearsUseCase"
```

---

### Task 4: Expose `sourceTypes` query param on API endpoints

**Repo:** `pet-health-tracker-api`

**Files:**
- Modify: `src/infrastructure/http/schemas/photoSchemas.ts`
- Modify: `src/infrastructure/http/controllers/PhotoController.ts`

- [ ] **Step 1: Update photoSchemas.ts**

Replace the full content of `src/infrastructure/http/schemas/photoSchemas.ts`:

```typescript
import { z } from 'zod';

const uuidLike = z.string().regex(
  /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i,
  'Invalid UUID',
);

const photoSourceTypeEnum = z.enum(['standalone', 'vet-visit', 'note', 'weight-entry']);

export const UploadPhotoSchema = z.object({
  petId: uuidLike,
  takenAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'takenAt must be YYYY-MM-DD'),
  caption: z.string().optional(),
});
export type UploadPhotoBody = z.infer<typeof UploadPhotoSchema>;

export const AttachPhotoToNoteSchema = z.object({
  petId: uuidLike,
  takenAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  caption: z.string().optional(),
});
export type AttachPhotoToNoteBody = z.infer<typeof AttachPhotoToNoteSchema>;

export const AttachPhotoToVisitSchema = z.object({
  takenAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  caption: z.string().optional(),
});
export type AttachPhotoToVisitBody = z.infer<typeof AttachPhotoToVisitSchema>;

export const PhotoTimelineQuerySchema = z.object({
  year: z.string().regex(/^\d{4}$/).transform(Number),
  petIds: z
    .union([uuidLike, z.array(uuidLike)])
    .optional()
    .transform((v) => (v ? (Array.isArray(v) ? v : [v]) : undefined)),
  sourceTypes: z
    .union([photoSourceTypeEnum, z.array(photoSourceTypeEnum)])
    .optional()
    .transform((v) => (v ? (Array.isArray(v) ? v : [v]) : undefined)),
});
export type PhotoTimelineQuery = z.infer<typeof PhotoTimelineQuerySchema>;

export const PhotoYearsQuerySchema = z.object({
  petIds: z
    .union([uuidLike, z.array(uuidLike)])
    .optional()
    .transform((v) => (v ? (Array.isArray(v) ? v : [v]) : undefined)),
  sourceTypes: z
    .union([photoSourceTypeEnum, z.array(photoSourceTypeEnum)])
    .optional()
    .transform((v) => (v ? (Array.isArray(v) ? v : [v]) : undefined)),
});
export type PhotoYearsQuery = z.infer<typeof PhotoYearsQuerySchema>;
```

- [ ] **Step 2: Update PhotoController timeline and years methods**

In `src/infrastructure/http/controllers/PhotoController.ts`, replace only the `timeline` and `years` methods (leave all other methods unchanged):

```typescript
@Get('/timeline')
@Validate({ query: PhotoTimelineQuerySchema })
async timeline(@QueryParams() query: PhotoTimelineQuery, @CurrentUser() user: AuthPayload) {
  return this.getPhotoTimeline.execute({
    userId: user.userId,
    year: query.year,
    petIds: query.petIds,
    sourceTypes: query.sourceTypes,
  });
}

@Get('/years')
@Validate({ query: PhotoYearsQuerySchema })
async years(@QueryParams() query: PhotoYearsQuery, @CurrentUser() user: AuthPayload) {
  return this.getPhotoYears.execute({
    userId: user.userId,
    petIds: query.petIds,
    sourceTypes: query.sourceTypes,
  });
}
```

- [ ] **Step 3: Build and run all tests**

```bash
pnpm build && pnpm test --no-coverage
```
Expected: clean build, all tests pass

- [ ] **Step 4: Commit**

```bash
git add src/infrastructure/http/schemas/photoSchemas.ts src/infrastructure/http/controllers/PhotoController.ts
git commit -m "feat: expose sourceTypes query param on timeline and years endpoints"
```

---

### Task 5: Add `sourceTypes` to client API hooks

**Repo:** `pet-health-tracker-client` at `~/projects/pet-health-tracker-client`

**Files:**
- Modify: `src/api/photos.ts`

- [ ] **Step 1: Update photos.ts**

Replace the full content of `src/api/photos.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';
import type { Photo, PhotoTimeline, PhotoSourceType } from '../types/photo';

const photoApi = {
  getTimeline: (year: number, petIds?: string[], sourceTypes?: PhotoSourceType[]): Promise<PhotoTimeline> => {
    const params: Record<string, unknown> = { year };
    if (petIds?.length) params['petIds[]'] = petIds;
    if (sourceTypes?.length) params['sourceTypes[]'] = sourceTypes;
    return apiClient.get<PhotoTimeline>('/photos/timeline', { params }).then((r) => r.data);
  },
  getYears: (petIds?: string[], sourceTypes?: PhotoSourceType[]): Promise<number[]> => {
    const params: Record<string, unknown> = {};
    if (petIds?.length) params['petIds[]'] = petIds;
    if (sourceTypes?.length) params['sourceTypes[]'] = sourceTypes;
    return apiClient.get<number[]>('/photos/years', { params }).then((r) => r.data);
  },
  upload: (data: FormData): Promise<Photo> =>
    apiClient
      .post<Photo>('/photos/', data, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then((r) => r.data),
  delete: (photoId: string): Promise<void> =>
    apiClient.delete(`/photos/${photoId}`).then(() => undefined),
};

export function usePhotoTimeline(year: number, petIds?: string[], sourceTypes?: PhotoSourceType[]) {
  return useQuery({
    queryKey: ['photos', 'timeline', year, petIds, sourceTypes],
    queryFn: () => photoApi.getTimeline(year, petIds, sourceTypes),
  });
}

export function usePhotoYears(petIds?: string[], sourceTypes?: PhotoSourceType[]) {
  return useQuery({
    queryKey: ['photos', 'years', petIds, sourceTypes],
    queryFn: () => photoApi.getYears(petIds, sourceTypes),
  });
}

export function useUploadPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: FormData) => photoApi.upload(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photos'] });
    },
  });
}

export function useDeletePhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (photoId: string) => photoApi.delete(photoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photos'] });
    },
  });
}

export function useAttachPhotoToVisit(visitId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: FormData) =>
      apiClient.post<Photo>(`/photos/vet-visits/${visitId}`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then((r) => r.data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['photos'] }); },
  });
}

export function useAttachPhotoToNote(noteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: FormData) =>
      apiClient.post<Photo>(`/photos/notes/${noteId}`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then((r) => r.data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['photos'] }); },
  });
}

export function useAttachPhotoToWeightEntry(entryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: FormData) =>
      apiClient.post<Photo>(`/photos/weight-entries/${entryId}`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then((r) => r.data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['photos'] }); },
  });
}
```

- [ ] **Step 2: Build to verify no TypeScript errors**

```bash
pnpm build
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/api/photos.ts
git commit -m "feat: add sourceTypes param to photo API hooks"
```

---

### Task 6: Create FilterToolbar component

**Repo:** `pet-health-tracker-client`

**Files:**
- Create: `src/pages/photos/FilterToolbar.tsx`

The toolbar is a single horizontal strip with three zones divided by vertical dividers: pet filter on the left, icon type toggles in the centre, year nav on the right. The pet popover is MUI `Popover` anchored to the pet button. All types and pets are active by default; clicking excludes (dims + grayscale).

- [ ] **Step 1: Create FilterToolbar.tsx**

Create `src/pages/photos/FilterToolbar.tsx`:

```typescript
import { useState } from 'react';
import {
  Box, IconButton, Tooltip, Popover, Typography, CircularProgress,
} from '@mui/material';
import {
  LocalHospital, Notes, FitnessCenter, CameraAlt, ChevronLeft, ChevronRight,
} from '@mui/icons-material';
import type { Pet } from '../../types';
import type { PhotoSourceType } from '../../types/photo';

const PET_COLORS = ['#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#10b981', '#f97316'];

const SOURCE_TYPES: { type: PhotoSourceType; label: string; Icon: React.ElementType }[] = [
  { type: 'vet-visit', label: 'Vet visits', Icon: LocalHospital },
  { type: 'note', label: 'Notes', Icon: Notes },
  { type: 'weight-entry', label: 'Weight', Icon: FitnessCenter },
  { type: 'standalone', label: 'Uploads', Icon: CameraAlt },
];

interface Props {
  pets: Pet[];
  excludedPets: string[];
  excludedTypes: PhotoSourceType[];
  year: number;
  minYear: number;
  maxYear: number;
  loading: boolean;
  onTogglePet: (petId: string) => void;
  onToggleType: (type: PhotoSourceType) => void;
  onYearChange: (year: number) => void;
}

export function FilterToolbar({
  pets, excludedPets, excludedTypes, year, minYear, maxYear, loading,
  onTogglePet, onToggleType, onYearChange,
}: Props) {
  const [popoverAnchor, setPopoverAnchor] = useState<HTMLElement | null>(null);
  const popoverOpen = Boolean(popoverAnchor);

  const activePetNames = pets.filter((p) => !excludedPets.includes(p.id)).map((p) => p.name);
  const petLabel = excludedPets.length === 0 ? 'All pets' : activePetNames.join(', ') || 'No pets';

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 3,
        px: 1.5,
        py: 0.75,
        mb: 2,
      }}
    >
      {/* Left: pet filter */}
      <Box
        onClick={(e) => pets.length > 0 && setPopoverAnchor(e.currentTarget as HTMLElement)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          pr: 1.5,
          borderRight: '1px solid',
          borderColor: 'divider',
          cursor: pets.length > 0 ? 'pointer' : 'default',
          color: excludedPets.length > 0 ? 'primary.main' : 'text.secondary',
          userSelect: 'none',
          '&:hover': pets.length > 0 ? { color: 'primary.main' } : {},
        }}
      >
        <Typography variant="body2">🐾</Typography>
        <Typography variant="caption" sx={{ fontWeight: 500, whiteSpace: 'nowrap' }}>
          {petLabel}
        </Typography>
        {pets.length > 0 && (
          <Typography variant="caption" sx={{ opacity: 0.5, ml: 0.25, fontSize: '0.6rem' }}>
            ▾
          </Typography>
        )}
      </Box>

      {/* Centre: source type icon toggles */}
      <Box sx={{ display: 'flex', gap: 0.25, flex: 1, justifyContent: 'center' }}>
        {SOURCE_TYPES.map(({ type, label, Icon }) => {
          const excluded = excludedTypes.includes(type);
          return (
            <Tooltip key={type} title={label} placement="bottom">
              <IconButton
                size="small"
                onClick={() => onToggleType(type)}
                sx={{
                  opacity: excluded ? 0.3 : 1,
                  filter: excluded ? 'grayscale(1)' : 'none',
                  color: excluded ? 'text.disabled' : 'primary.main',
                  transition: 'opacity 0.15s, filter 0.15s',
                }}
              >
                <Icon fontSize="small" />
              </IconButton>
            </Tooltip>
          );
        })}
      </Box>

      {/* Right: year navigation */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.25,
          pl: 1.5,
          borderLeft: '1px solid',
          borderColor: 'divider',
        }}
      >
        <IconButton size="small" onClick={() => onYearChange(year - 1)} disabled={year <= minYear}>
          <ChevronLeft fontSize="small" />
        </IconButton>
        <Typography variant="body2" sx={{ fontWeight: 700, minWidth: 36, textAlign: 'center' }}>
          {year}
        </Typography>
        <IconButton size="small" onClick={() => onYearChange(year + 1)} disabled={year >= maxYear}>
          <ChevronRight fontSize="small" />
        </IconButton>
        {loading && <CircularProgress size={14} sx={{ ml: 0.5 }} />}
      </Box>

      {/* Pet popover */}
      <Popover
        open={popoverOpen}
        anchorEl={popoverAnchor}
        onClose={() => setPopoverAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: { sx: { mt: 0.5, p: 1.5, borderRadius: 2, display: 'flex', gap: 1 } },
        }}
      >
        {pets.map((pet, i) => {
          const excluded = excludedPets.includes(pet.id);
          const color = PET_COLORS[i % PET_COLORS.length];
          return (
            <Box
              key={pet.id}
              onClick={() => onTogglePet(pet.id)}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 0.5,
                p: 1,
                borderRadius: 1.5,
                cursor: 'pointer',
                minWidth: 60,
                border: '1.5px solid',
                borderColor: excluded ? 'transparent' : color,
                bgcolor: excluded ? 'transparent' : `${color}20`,
                opacity: excluded ? 0.35 : 1,
                transition: 'all 0.15s',
                '&:hover': { opacity: 1, borderColor: color },
              }}
            >
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  bgcolor: color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                }}
              >
                {pet.name[0].toUpperCase()}
              </Box>
              <Typography variant="caption" sx={{ fontWeight: 500 }}>
                {pet.name}
              </Typography>
            </Box>
          );
        })}
      </Popover>
    </Box>
  );
}
```

- [ ] **Step 2: Build to verify no TypeScript errors**

```bash
pnpm build
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/pages/photos/FilterToolbar.tsx
git commit -m "feat: add FilterToolbar component with pet popover and icon type toggles"
```

---

### Task 7: Refactor PhotosPage to use FilterToolbar

**Repo:** `pet-health-tracker-client`

**Files:**
- Modify: `src/pages/photos/PhotosPage.tsx`

State semantics invert: `excludedPets`/`excludedTypes` default to `[]` (empty = show all). Active sets are derived and passed to hooks only when non-empty (so `undefined` goes to API when no filter is active, matching existing behaviour).

- [ ] **Step 1: Replace PhotosPage.tsx**

Replace the full content of `src/pages/photos/PhotosPage.tsx`:

```typescript
import { useState } from 'react';
import { Box, Typography, Chip, Fab } from '@mui/material';
import { Add } from '@mui/icons-material';
import { usePhotoTimeline, usePhotoYears } from '../../api/photos';
import { usePets } from '../../api/pets';
import { YearScrapbook } from './YearScrapbook';
import { MonthGrid } from './MonthGrid';
import { PhotoLightbox } from './PhotoLightbox';
import { UploadPhotoDialog } from './UploadPhotoDialog';
import { FilterToolbar } from './FilterToolbar';
import type { Photo, PhotoSourceType } from '../../types/photo';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ALL_SOURCE_TYPES: PhotoSourceType[] = ['standalone', 'vet-visit', 'note', 'weight-entry'];

export function PhotosPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [excludedPets, setExcludedPets] = useState<string[]>([]);
  const [excludedTypes, setExcludedTypes] = useState<PhotoSourceType[]>([]);

  const { data: pets = [] } = usePets();

  const activePetIds = excludedPets.length > 0
    ? pets.filter((p) => !excludedPets.includes(p.id)).map((p) => p.id)
    : undefined;

  const activeSourceTypes = excludedTypes.length > 0
    ? ALL_SOURCE_TYPES.filter((t) => !excludedTypes.includes(t))
    : undefined;

  const { data: years = [] } = usePhotoYears(activePetIds, activeSourceTypes);
  const { data: timeline, isLoading: timelineLoading } = usePhotoTimeline(year, activePetIds, activeSourceTypes);

  const togglePet = (petId: string) => {
    setExcludedPets((prev) =>
      prev.includes(petId) ? prev.filter((id) => id !== petId) : [...prev, petId],
    );
  };

  const toggleType = (type: PhotoSourceType) => {
    setExcludedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  };

  const handleYearChange = (newYear: number) => {
    setYear(newYear);
    setSelectedMonth(null);
  };

  const minYear = years.length ? Math.min(...years) : currentYear - 5;
  const maxYear = years.length ? Math.max(...years, currentYear) : currentYear;

  const monthLabel = selectedMonth
    ? `${MONTH_LABELS[parseInt(selectedMonth, 10) - 1]} ${year}`
    : null;

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 900, mx: 'auto', position: 'relative', minHeight: '100vh' }}>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>
        Photo Timeline
      </Typography>

      <FilterToolbar
        pets={pets}
        excludedPets={excludedPets}
        excludedTypes={excludedTypes}
        year={year}
        minYear={minYear}
        maxYear={maxYear}
        loading={timelineLoading}
        onTogglePet={togglePet}
        onToggleType={toggleType}
        onYearChange={handleYearChange}
      />

      {monthLabel && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Chip
            label={monthLabel}
            size="small"
            onDelete={() => setSelectedMonth(null)}
            color="primary"
          />
        </Box>
      )}

      {selectedMonth === null ? (
        <YearScrapbook
          year={year}
          timeline={timeline}
          loading={timelineLoading}
          onMonthClick={setSelectedMonth}
          selectedMonth={selectedMonth}
        />
      ) : (
        <MonthGrid
          year={year}
          month={selectedMonth}
          timeline={timeline}
          onPhotoClick={setLightboxPhoto}
        />
      )}

      <Fab
        color="primary"
        aria-label="Upload photo"
        onClick={() => setUploadOpen(true)}
        sx={{ position: 'fixed', bottom: { xs: 72, md: 32 }, right: 24 }}
      >
        <Add />
      </Fab>

      <PhotoLightbox photo={lightboxPhoto} onClose={() => setLightboxPhoto(null)} />

      <UploadPhotoDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        pets={pets}
      />
    </Box>
  );
}
```

- [ ] **Step 2: Build and verify no TypeScript errors**

```bash
pnpm build
```
Expected: no errors

- [ ] **Step 3: Manual smoke test**

Start the dev server (`pnpm dev`) and open http://localhost:5173. Navigate to the Photos page. Verify:
- A single unified toolbar strip appears; no chip rows
- "🐾 All pets ▾" on the left — clicking opens a popover with avatar buttons for each pet, all highlighted
- Click a pet avatar to exclude it — avatar dims, toolbar label updates, timeline refetches
- Four icon buttons in the centre — all coloured (active) by default
- Click a type icon to exclude it — it goes grayscale and dims; timeline refetches with server-side filter applied
- Year navigation works; loading spinner appears during fetches
- Month breadcrumb still appears on drill-in; × still dismisses it

- [ ] **Step 4: Commit**

```bash
git add src/pages/photos/PhotosPage.tsx
git commit -m "feat: refactor PhotosPage to use FilterToolbar with server-side source type filtering"
```
