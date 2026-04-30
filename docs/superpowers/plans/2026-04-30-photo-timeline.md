# Photo Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Photos feature with a top-level scrapbook timeline page, unified Photo entity, Cloudflare R2 storage with pre-signed URLs, and migration of existing disk-stored images.

**Architecture:** A new `Photo` domain entity replaces `imageUrls[]` on `VetVisit` and `Note`. Uploads stream to Cloudflare R2 via the S3 SDK (memory storage replaces disk storage in multer). The `GET /photos/timeline` endpoint returns photos grouped by year/month with fresh pre-signed URLs. The client gets a new top-level `/photos` page with a scrapbook year view and month drill-down grid.

**Tech Stack:** `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, Sequelize/PostgreSQL, routing-controllers, zod, React + MUI v6 + TanStack Query

---

## File Map

**New — API:**
- `src/infrastructure/storage/R2Service.ts` — S3 client wrapper (upload, sign, delete)
- `src/domain/photo/Photo.ts` — Photo entity
- `src/domain/photo/PhotoRepository.ts` — interface + `PHOTO_REPOSITORY` token
- `src/infrastructure/db/models/PhotoModel.ts` — Sequelize model
- `src/infrastructure/db/repositories/SequelizePhotoRepository.ts`
- `src/infrastructure/mappers/PhotoMapper.ts`
- `src/application/photo/UploadStandalonePhotoUseCase.ts`
- `src/application/photo/AttachPhotoToVisitUseCase.ts`
- `src/application/photo/AttachPhotoToNoteUseCase.ts`
- `src/application/photo/GetPhotoTimelineUseCase.ts`
- `src/application/photo/GetPhotoYearsUseCase.ts`
- `src/application/photo/DeletePhotoUseCase.ts`
- `src/infrastructure/http/controllers/PhotoController.ts`
- `src/infrastructure/http/schemas/photoSchemas.ts`
- `scripts/migrate-images-to-r2.ts`
- `tests/application/photo/UploadStandalonePhotoUseCase.test.ts`
- `tests/application/photo/GetPhotoTimelineUseCase.test.ts`
- `tests/application/photo/DeletePhotoUseCase.test.ts`

**Modified — API:**
- `src/domain/share/PetPermission.ts` — add `view_photos`, `edit_photos`
- `src/domain/share/PetShare.ts` — add `canViewPhotos`, `canEditPhotos` props + `hasPermission` cases
- `src/infrastructure/db/models/PetShareModel.ts` — add two boolean columns
- `src/domain/health/VetVisit.ts` — remove `imageUrls` field
- `src/domain/note/Note.ts` — remove `imageUrls` field
- `src/infrastructure/db/models/VetVisitModel.ts` — remove `imageUrls` column
- `src/infrastructure/db/models/NoteModel.ts` — remove `imageUrls` column
- `src/infrastructure/http/middleware/upload.ts` — switch to memoryStorage + MIME validation
- `src/infrastructure/db/database.ts` — register `PhotoModel`
- `src/container.ts` — register `PHOTO_REPOSITORY`
- `src/app.ts` — remove `express.static('/uploads')`, add `PhotoController`
- `.env.example` — add R2 vars

**New — Client:**
- `src/types/photo.ts`
- `src/api/photos.ts`
- `src/pages/photos/PhotosPage.tsx`
- `src/pages/photos/YearScrapbook.tsx`
- `src/pages/photos/MonthGrid.tsx`
- `src/pages/photos/PhotoLightbox.tsx`
- `src/pages/photos/UploadPhotoDialog.tsx`

**Modified — Client:**
- `src/App.tsx` — add `/photos` route
- `src/components/Layout.tsx` — add Photos nav item

---

## Phase 1: Backend Infrastructure

---

### Task 1: Install dependencies and R2Service

**Files:**
- Create: `src/infrastructure/storage/R2Service.ts`
- Modify: `.env.example`

- [ ] **Step 1: Install packages**

```bash
cd pet-health-tracker-api
pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

Expected: packages install without errors.

- [ ] **Step 2: Add env vars to `.env.example`**

Add these lines at the bottom of `.env.example`:

```
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
```

- [ ] **Step 3: Create `src/infrastructure/storage/R2Service.ts`**

```typescript
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Service } from 'typedi';

@Service()
export class R2Service {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    this.bucket = process.env.R2_BUCKET_NAME!;
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }

  async upload(key: string, buffer: Buffer, contentType: string): Promise<void> {
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }));
  }

  async getSignedUrl(key: string, ttlSeconds = 900): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: ttlSeconds },
    );
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/infrastructure/storage/R2Service.ts .env.example package.json pnpm-lock.yaml
git commit -m "feat: add R2Service for Cloudflare R2 storage"
```

---

### Task 2: Photo domain entity and repository interface

**Files:**
- Create: `src/domain/photo/Photo.ts`
- Create: `src/domain/photo/PhotoRepository.ts`

- [ ] **Step 1: Create `src/domain/photo/Photo.ts`**

```typescript
import { Entity } from '../shared/Entity';
import { UniqueEntityId } from '../shared/UniqueEntityId';

export type PhotoSourceType = 'standalone' | 'vet-visit' | 'note';

interface PhotoProps {
  petId: string;
  ownerId: string;
  s3Key: string;
  takenAt: string; // 'YYYY-MM-DD'
  caption?: string;
  sourceType: PhotoSourceType;
  sourceId?: string;
  createdAt: Date;
}

export class Photo extends Entity<PhotoProps> {
  get petId(): string { return this.props.petId; }
  get ownerId(): string { return this.props.ownerId; }
  get s3Key(): string { return this.props.s3Key; }
  get takenAt(): string { return this.props.takenAt; }
  get caption(): string | undefined { return this.props.caption; }
  get sourceType(): PhotoSourceType { return this.props.sourceType; }
  get sourceId(): string | undefined { return this.props.sourceId; }
  get createdAt(): Date { return this.props.createdAt; }

  static create(props: Omit<PhotoProps, 'createdAt'>, id?: UniqueEntityId): Photo {
    return new Photo({ ...props, createdAt: new Date() }, id);
  }

  static reconstitute(props: PhotoProps, id: UniqueEntityId): Photo {
    return new Photo(props, id);
  }
}
```

- [ ] **Step 2: Create `src/domain/photo/PhotoRepository.ts`**

```typescript
import { Photo } from './Photo';

export const PHOTO_REPOSITORY = 'PhotoRepository';

export interface PhotoRepository {
  save(photo: Photo): Promise<Photo>;
  findById(id: string): Promise<Photo | null>;
  findByPetIds(petIds: string[], year: number): Promise<Photo[]>;
  findYearsByOwnerId(ownerId: string, petIds?: string[]): Promise<number[]>;
  delete(id: string): Promise<void>;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/domain/photo/
git commit -m "feat: add Photo entity and PhotoRepository interface"
```

---

### Task 3: Add view_photos / edit_photos permission to PetShare

**Files:**
- Modify: `src/domain/share/PetPermission.ts`
- Modify: `src/domain/share/PetShare.ts`
- Modify: `src/infrastructure/db/models/PetShareModel.ts`

- [ ] **Step 1: Update `src/domain/share/PetPermission.ts`**

```typescript
export type PetPermission =
  | 'view_pet'
  | 'owner'
  | 'view_vet_visits' | 'edit_vet_visits'
  | 'view_medications' | 'edit_medications'
  | 'view_notes' | 'edit_notes'
  | 'view_weight' | 'edit_weight'
  | 'view_photos' | 'edit_photos';
```

- [ ] **Step 2: Add `canViewPhotos` / `canEditPhotos` to `PetShare.ts`**

In `PetShareProps`, add after `canEditNotes`:
```typescript
  canViewPhotos: boolean;
  canEditPhotos: boolean;
```

In the `updatePermissions` method signature, add:
```typescript
  canViewPhotos: boolean;
  canEditPhotos: boolean;
```

In the `hasPermission` method, add before `return false`:
```typescript
    if (permission === 'view_photos') return this.props.canViewPhotos || this.props.canEditPhotos;
    if (permission === 'edit_photos') return this.props.canEditPhotos;
```

In `PetShare.create`, the caller must pass `canViewPhotos: false, canEditPhotos: false` — add these to the type (they have default values, so update `create` to default them):
```typescript
  static create(
    props: Omit<PetShareProps, 'createdAt' | 'status'>,
    id?: UniqueEntityId,
  ): PetShare {
    return new PetShare({
      canViewPhotos: false,
      canEditPhotos: false,
      ...props,
      status: 'pending',
      createdAt: new Date(),
    }, id);
  }
```

- [ ] **Step 3: Add columns to `PetShareModel.ts`**

After the existing `canEditNotes` column declaration, add:

```typescript
  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false, field: 'can_view_photos' })
  declare canViewPhotos: boolean;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false, field: 'can_edit_photos' })
  declare canEditPhotos: boolean;
```

- [ ] **Step 4: Add the DB columns via sync (development)**

Run the dev server once so `sequelize.sync({ alter: true })` adds the columns (if the project uses sync). If using migrations, create a migration file instead:

Check how the project handles migrations:
```bash
grep -r "sync\|migrate" src/main.ts src/infrastructure/db/database.ts 2>/dev/null | head -5
```

If `sync({ alter: true })` is used: just run `pnpm dev` briefly to apply. If migrations are used: create `src/infrastructure/db/migrations/YYYYMMDD-add-photo-permissions-to-pet-shares.ts` following existing migration patterns.

- [ ] **Step 5: Commit**

```bash
git add src/domain/share/ src/infrastructure/db/models/PetShareModel.ts
git commit -m "feat: add view_photos/edit_photos permission to PetShare"
```

---

### Task 4: PhotoModel and database registration

**Files:**
- Create: `src/infrastructure/db/models/PhotoModel.ts`
- Modify: `src/infrastructure/db/database.ts`

- [ ] **Step 1: Create `src/infrastructure/db/models/PhotoModel.ts`**

```typescript
import { BelongsTo, Column, DataType, ForeignKey, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { PetModel } from './PetModel';
import { UserModel } from './UserModel';
import { PhotoSourceType } from '../../../domain/photo/Photo';

@Table({ tableName: 'photos', timestamps: false })
export class PhotoModel extends Model {
  @PrimaryKey
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => PetModel)
  @Column({ type: DataType.UUID, allowNull: false, field: 'pet_id' })
  declare petId: string;

  @ForeignKey(() => UserModel)
  @Column({ type: DataType.UUID, allowNull: false, field: 'owner_id' })
  declare ownerId: string;

  @Column({ type: DataType.STRING, allowNull: false, field: 's3_key' })
  declare s3Key: string;

  @Column({ type: DataType.DATEONLY, allowNull: false, field: 'taken_at' })
  declare takenAt: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare caption: string | null;

  @Column({ type: DataType.ENUM('standalone', 'vet-visit', 'note'), allowNull: false, field: 'source_type' })
  declare sourceType: PhotoSourceType;

  @Column({ type: DataType.UUID, allowNull: true, field: 'source_id' })
  declare sourceId: string | null;

  @Column({ type: DataType.DATE, allowNull: false, field: 'created_at' })
  declare createdAt: Date;

  @BelongsTo(() => PetModel)
  declare pet: PetModel;

  @BelongsTo(() => UserModel)
  declare owner: UserModel;
}
```

- [ ] **Step 2: Register `PhotoModel` in `src/infrastructure/db/database.ts`**

Add import:
```typescript
import { PhotoModel } from './models/PhotoModel';
```

Add `PhotoModel` to the `models` array in the Sequelize config.

- [ ] **Step 3: Apply schema (development sync or migration — same approach as Task 3 Step 4)**

- [ ] **Step 4: Commit**

```bash
git add src/infrastructure/db/models/PhotoModel.ts src/infrastructure/db/database.ts
git commit -m "feat: add PhotoModel and register with Sequelize"
```

---

### Task 5: PhotoMapper and SequelizePhotoRepository

**Files:**
- Create: `src/infrastructure/mappers/PhotoMapper.ts`
- Create: `src/infrastructure/db/repositories/SequelizePhotoRepository.ts`

- [ ] **Step 1: Create `src/infrastructure/mappers/PhotoMapper.ts`**

```typescript
import { Service } from 'typedi';
import { Photo, PhotoSourceType } from '../../domain/photo/Photo';
import { UniqueEntityId } from '../../domain/shared/UniqueEntityId';
import { PhotoModel } from '../db/models/PhotoModel';

export interface PhotoResponseDto {
  id: string;
  petId: string;
  ownerId: string;
  url: string; // pre-signed URL, injected by use case
  takenAt: string;
  caption?: string;
  sourceType: PhotoSourceType;
  sourceId?: string;
  createdAt: string;
}

@Service()
export class PhotoMapper {
  toDomain(model: PhotoModel): Photo {
    return Photo.reconstitute(
      {
        petId: model.petId,
        ownerId: model.ownerId,
        s3Key: model.s3Key,
        takenAt: model.takenAt,
        caption: model.caption ?? undefined,
        sourceType: model.sourceType,
        sourceId: model.sourceId ?? undefined,
        createdAt: model.createdAt,
      },
      new UniqueEntityId(model.id),
    );
  }

  toPersistence(photo: Photo): object {
    return {
      id: photo.id.toValue(),
      petId: photo.petId,
      ownerId: photo.ownerId,
      s3Key: photo.s3Key,
      takenAt: photo.takenAt,
      caption: photo.caption ?? null,
      sourceType: photo.sourceType,
      sourceId: photo.sourceId ?? null,
      createdAt: photo.createdAt,
    };
  }

  toResponse(photo: Photo, signedUrl: string): PhotoResponseDto {
    return {
      id: photo.id.toValue(),
      petId: photo.petId,
      ownerId: photo.ownerId,
      url: signedUrl,
      takenAt: photo.takenAt,
      caption: photo.caption,
      sourceType: photo.sourceType,
      sourceId: photo.sourceId,
      createdAt: photo.createdAt.toISOString(),
    };
  }
}
```

- [ ] **Step 2: Create `src/infrastructure/db/repositories/SequelizePhotoRepository.ts`**

```typescript
import { Service } from 'typedi';
import { Op } from 'sequelize';
import { Photo } from '../../../domain/photo/Photo';
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

  async findByPetIds(petIds: string[], year: number): Promise<Photo[]> {
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;
    const models = await PhotoModel.findAll({
      where: {
        petId: { [Op.in]: petIds },
        takenAt: { [Op.between]: [start, end] },
      },
      order: [['taken_at', 'DESC']],
    });
    return models.map((m) => this.mapper.toDomain(m));
  }

  async findYearsByOwnerId(ownerId: string, petIds?: string[]): Promise<number[]> {
    const where: any = { ownerId };
    if (petIds?.length) where.petId = { [Op.in]: petIds };
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

- [ ] **Step 3: Register in `src/container.ts`**

Add import:
```typescript
import { SequelizePhotoRepository } from './infrastructure/db/repositories/SequelizePhotoRepository';
import { PHOTO_REPOSITORY } from './domain/photo/PhotoRepository';
```

Add to `registerDependencies()`:
```typescript
Container.set(PHOTO_REPOSITORY, Container.get(SequelizePhotoRepository));
```

- [ ] **Step 4: Commit**

```bash
git add src/infrastructure/mappers/PhotoMapper.ts src/infrastructure/db/repositories/SequelizePhotoRepository.ts src/container.ts
git commit -m "feat: add PhotoMapper, SequelizePhotoRepository, and DI registration"
```

---

### Task 6: UploadStandalonePhotoUseCase (TDD)

**Files:**
- Create: `tests/application/photo/UploadStandalonePhotoUseCase.test.ts`
- Create: `src/application/photo/UploadStandalonePhotoUseCase.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/application/photo/UploadStandalonePhotoUseCase.test.ts`:

```typescript
import 'reflect-metadata';
import { UploadStandalonePhotoUseCase } from '../../../src/application/photo/UploadStandalonePhotoUseCase';
import { PhotoRepository } from '../../../src/domain/photo/PhotoRepository';
import { Photo } from '../../../src/domain/photo/Photo';
import { PhotoMapper } from '../../../src/infrastructure/mappers/PhotoMapper';
import { PetAccessService } from '../../../src/application/pet/PetAccessService';
import { R2Service } from '../../../src/infrastructure/storage/R2Service';
import { Pet } from '../../../src/domain/pet/Pet';
import { UniqueEntityId } from '../../../src/domain/shared/UniqueEntityId';
import { ForbiddenError } from '../../../src/shared/errors/AppError';

function makePet(): Pet {
  return Pet.reconstitute(
    { name: 'Buddy', species: 'dog', userId: 'user-1', createdAt: new Date() },
    new UniqueEntityId('pet-1'),
  );
}

function makeRepo(): jest.Mocked<PhotoRepository> {
  return {
    save: jest.fn((p: Photo) => Promise.resolve(p)),
    findById: jest.fn(),
    findByPetIds: jest.fn(),
    findYearsByOwnerId: jest.fn(),
    delete: jest.fn(),
  };
}

function makeMapper(): jest.Mocked<PhotoMapper> {
  return {
    toDomain: jest.fn(),
    toPersistence: jest.fn(),
    toResponse: jest.fn((_p: Photo, url: string) => ({
      id: 'photo-1',
      petId: 'pet-1',
      ownerId: 'user-1',
      url,
      takenAt: '2026-04-30',
      caption: undefined,
      sourceType: 'standalone' as const,
      sourceId: undefined,
      createdAt: new Date().toISOString(),
    })),
  } as any;
}

describe('UploadStandalonePhotoUseCase', () => {
  it('uploads to R2 and saves photo entity', async () => {
    const repo = makeRepo();
    const mapper = makeMapper();
    const petAccess = { assertCanAccess: jest.fn().mockResolvedValue(makePet()) } as unknown as PetAccessService;
    const r2 = { upload: jest.fn().mockResolvedValue(undefined), getSignedUrl: jest.fn().mockResolvedValue('https://signed.url/photo.jpg'), delete: jest.fn() } as unknown as R2Service;
    const useCase = new UploadStandalonePhotoUseCase(repo, petAccess, mapper, r2);

    const result = await useCase.execute({
      userId: 'user-1',
      petId: 'pet-1',
      buffer: Buffer.from('fake-image'),
      mimeType: 'image/jpeg',
      takenAt: '2026-04-30',
      caption: 'A sunny day',
    });

    expect(r2.upload).toHaveBeenCalledTimes(1);
    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(result.url).toBe('https://signed.url/photo.jpg');
    expect(petAccess.assertCanAccess).toHaveBeenCalledWith('pet-1', 'user-1', 'edit_photos');
  });

  it('throws ForbiddenError when user lacks edit_photos permission', async () => {
    const repo = makeRepo();
    const mapper = makeMapper();
    const petAccess = { assertCanAccess: jest.fn().mockRejectedValue(new ForbiddenError()) } as unknown as PetAccessService;
    const r2 = { upload: jest.fn(), getSignedUrl: jest.fn(), delete: jest.fn() } as unknown as R2Service;
    const useCase = new UploadStandalonePhotoUseCase(repo, petAccess, mapper, r2);

    await expect(
      useCase.execute({ userId: 'user-99', petId: 'pet-1', buffer: Buffer.from('x'), mimeType: 'image/jpeg', takenAt: '2026-04-30' }),
    ).rejects.toThrow(ForbiddenError);
    expect(r2.upload).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

```bash
pnpm test tests/application/photo/UploadStandalonePhotoUseCase.test.ts
```

Expected: FAIL — `Cannot find module '../../../src/application/photo/UploadStandalonePhotoUseCase'`

- [ ] **Step 3: Implement `src/application/photo/UploadStandalonePhotoUseCase.ts`**

```typescript
import { Inject, Service } from 'typedi';
import { v4 as uuidv4 } from 'uuid';
import { PhotoRepository, PHOTO_REPOSITORY } from '../../domain/photo/PhotoRepository';
import { Photo } from '../../domain/photo/Photo';
import { PhotoMapper, PhotoResponseDto } from '../../infrastructure/mappers/PhotoMapper';
import { PetAccessService } from '../pet/PetAccessService';
import { R2Service } from '../../infrastructure/storage/R2Service';
import { UniqueEntityId } from '../../domain/shared/UniqueEntityId';

export interface UploadStandalonePhotoInput {
  userId: string;
  petId: string;
  buffer: Buffer;
  mimeType: string;
  takenAt: string;
  caption?: string;
}

@Service()
export class UploadStandalonePhotoUseCase {
  constructor(
    @Inject(PHOTO_REPOSITORY) private readonly repo: PhotoRepository,
    private readonly petAccessService: PetAccessService,
    private readonly mapper: PhotoMapper,
    private readonly r2: R2Service,
  ) {}

  async execute(input: UploadStandalonePhotoInput): Promise<PhotoResponseDto> {
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
      sourceType: 'standalone',
    }, new UniqueEntityId());
    const saved = await this.repo.save(photo);
    const url = await this.r2.getSignedUrl(saved.s3Key);
    return this.mapper.toResponse(saved, url);
  }
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
pnpm test tests/application/photo/UploadStandalonePhotoUseCase.test.ts
```

Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/application/photo/UploadStandalonePhotoUseCase.ts tests/application/photo/UploadStandalonePhotoUseCase.test.ts
git commit -m "feat: add UploadStandalonePhotoUseCase with TDD"
```

---

### Task 7: AttachPhotoToVisitUseCase and AttachPhotoToNoteUseCase

**Files:**
- Create: `src/application/photo/AttachPhotoToVisitUseCase.ts`
- Create: `src/application/photo/AttachPhotoToNoteUseCase.ts`

*(No separate tests required — same shape as UploadStandalonePhotoUseCase; tested through the controller integration)*

- [ ] **Step 1: Create `src/application/photo/AttachPhotoToVisitUseCase.ts`**

```typescript
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
  ) {}

  async execute(input: AttachPhotoToVisitInput): Promise<PhotoResponseDto> {
    const visit = await this.healthRepo.findVetVisitById(input.visitId);
    if (!visit) throw new NotFoundError('VetVisit');
    const pet = await this.petAccessService.assertCanAccess(visit.petId, input.userId, 'edit_photos');
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
    }, new UniqueEntityId());
    const saved = await this.repo.save(photo);
    const url = await this.r2.getSignedUrl(saved.s3Key);
    return this.mapper.toResponse(saved, url);
  }
}
```

- [ ] **Step 2: Create `src/application/photo/AttachPhotoToNoteUseCase.ts`**

```typescript
import { Inject, Service } from 'typedi';
import { v4 as uuidv4 } from 'uuid';
import { PhotoRepository, PHOTO_REPOSITORY } from '../../domain/photo/PhotoRepository';
import { Photo } from '../../domain/photo/Photo';
import { PhotoMapper, PhotoResponseDto } from '../../infrastructure/mappers/PhotoMapper';
import { PetAccessService } from '../pet/PetAccessService';
import { R2Service } from '../../infrastructure/storage/R2Service';
import { NoteRepository, NOTE_REPOSITORY } from '../../domain/note/NoteRepository';
import { NotFoundError } from '../../shared/errors/AppError';
import { UniqueEntityId } from '../../domain/shared/UniqueEntityId';

export interface AttachPhotoToNoteInput {
  userId: string;
  noteId: string;
  petId: string; // notes can have multiple pets — caller specifies which pet this photo belongs to
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
    if (note.userId !== input.userId) throw new NotFoundError('Note');
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
```

- [ ] **Step 4: Commit**

```bash
git add src/application/photo/AttachPhotoToVisitUseCase.ts src/application/photo/AttachPhotoToNoteUseCase.ts
git commit -m "feat: add AttachPhotoToVisitUseCase and AttachPhotoToNoteUseCase"
```

---

### Task 8: GetPhotoTimelineUseCase (TDD)

**Files:**
- Create: `tests/application/photo/GetPhotoTimelineUseCase.test.ts`
- Create: `src/application/photo/GetPhotoTimelineUseCase.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/application/photo/GetPhotoTimelineUseCase.test.ts`:

```typescript
import 'reflect-metadata';
import { GetPhotoTimelineUseCase } from '../../../src/application/photo/GetPhotoTimelineUseCase';
import { PhotoRepository } from '../../../src/domain/photo/PhotoRepository';
import { PhotoMapper } from '../../../src/infrastructure/mappers/PhotoMapper';
import { PetRepository } from '../../../src/domain/pet/PetRepository';
import { R2Service } from '../../../src/infrastructure/storage/R2Service';
import { Photo } from '../../../src/domain/photo/Photo';
import { Pet } from '../../../src/domain/pet/Pet';
import { UniqueEntityId } from '../../../src/domain/shared/UniqueEntityId';

function makePhoto(takenAt: string): Photo {
  return Photo.reconstitute(
    { petId: 'pet-1', ownerId: 'user-1', s3Key: 'photos/abc.jpg', takenAt, caption: undefined, sourceType: 'standalone', sourceId: undefined, createdAt: new Date() },
    new UniqueEntityId('photo-1'),
  );
}

function makePet(): Pet {
  return Pet.reconstitute(
    { name: 'Buddy', species: 'dog', userId: 'user-1', createdAt: new Date() },
    new UniqueEntityId('pet-1'),
  );
}

describe('GetPhotoTimelineUseCase', () => {
  it('groups photos by month and returns signed URLs', async () => {
    const repo: jest.Mocked<PhotoRepository> = {
      save: jest.fn(),
      findById: jest.fn(),
      findByPetIds: jest.fn().mockResolvedValue([makePhoto('2026-04-15'), makePhoto('2026-04-28')]),
      findYearsByOwnerId: jest.fn(),
      delete: jest.fn(),
    };
    const petRepo: jest.Mocked<PetRepository> = {
      findById: jest.fn(),
      findByUserId: jest.fn().mockResolvedValue([makePet()]),
      save: jest.fn(),
      delete: jest.fn(),
    } as any;
    const r2 = { getSignedUrl: jest.fn().mockResolvedValue('https://signed.url/photo.jpg'), upload: jest.fn(), delete: jest.fn() } as unknown as R2Service;
    const mapper: jest.Mocked<PhotoMapper> = {
      toDomain: jest.fn(),
      toPersistence: jest.fn(),
      toResponse: jest.fn((_p, url) => ({ id: 'photo-1', petId: 'pet-1', ownerId: 'user-1', url, takenAt: '2026-04-15', sourceType: 'standalone' as const, createdAt: new Date().toISOString() })),
    } as any;

    const useCase = new GetPhotoTimelineUseCase(repo, petRepo, mapper, r2);
    const result = await useCase.execute({ userId: 'user-1', year: 2026 });

    expect(result['2026']['04']).toHaveLength(2);
    expect(result['2026']['04'][0].url).toBe('https://signed.url/photo.jpg');
    expect(repo.findByPetIds).toHaveBeenCalledWith(['pet-1'], 2026);
  });

  it('filters by petIds when provided', async () => {
    const repo: jest.Mocked<PhotoRepository> = {
      save: jest.fn(), findById: jest.fn(),
      findByPetIds: jest.fn().mockResolvedValue([]),
      findYearsByOwnerId: jest.fn(), delete: jest.fn(),
    };
    const petRepo: jest.Mocked<PetRepository> = { findByUserId: jest.fn(), findById: jest.fn(), save: jest.fn(), delete: jest.fn() } as any;
    const r2 = { getSignedUrl: jest.fn(), upload: jest.fn(), delete: jest.fn() } as unknown as R2Service;
    const mapper = { toDomain: jest.fn(), toPersistence: jest.fn(), toResponse: jest.fn() } as any;

    const useCase = new GetPhotoTimelineUseCase(repo, petRepo, mapper, r2);
    await useCase.execute({ userId: 'user-1', year: 2026, petIds: ['pet-2'] });

    expect(repo.findByPetIds).toHaveBeenCalledWith(['pet-2'], 2026);
    expect(petRepo.findByUserId).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

```bash
pnpm test tests/application/photo/GetPhotoTimelineUseCase.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement `src/application/photo/GetPhotoTimelineUseCase.ts`**

```typescript
import { Inject, Service } from 'typedi';
import { PhotoRepository, PHOTO_REPOSITORY } from '../../domain/photo/PhotoRepository';
import { PetRepository, PET_REPOSITORY } from '../../domain/pet/PetRepository';
import { PhotoMapper, PhotoResponseDto } from '../../infrastructure/mappers/PhotoMapper';
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
    private readonly r2: R2Service,
  ) {}

  async execute(input: GetPhotoTimelineInput): Promise<PhotoTimeline> {
    const petIds = input.petIds?.length
      ? input.petIds
      : (await this.petRepo.findByUserId(input.userId)).map((p) => p.id.toValue());

    const photos = await this.repo.findByPetIds(petIds, input.year);
    const timeline: PhotoTimeline = {};

    for (const photo of photos) {
      const year = photo.takenAt.slice(0, 4);
      const month = photo.takenAt.slice(5, 7);
      const url = await this.r2.getSignedUrl(photo.s3Key);
      const dto = this.mapper.toResponse(photo, url);
      if (!timeline[year]) timeline[year] = {};
      if (!timeline[year][month]) timeline[year][month] = [];
      timeline[year][month].push(dto);
    }

    return timeline;
  }
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
pnpm test tests/application/photo/GetPhotoTimelineUseCase.test.ts
```

Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/application/photo/GetPhotoTimelineUseCase.ts tests/application/photo/GetPhotoTimelineUseCase.test.ts
git commit -m "feat: add GetPhotoTimelineUseCase with TDD"
```

---

### Task 9: GetPhotoYearsUseCase and DeletePhotoUseCase (TDD)

**Files:**
- Create: `tests/application/photo/DeletePhotoUseCase.test.ts`
- Create: `src/application/photo/GetPhotoYearsUseCase.ts`
- Create: `src/application/photo/DeletePhotoUseCase.ts`

- [ ] **Step 1: Write the failing test for DeletePhotoUseCase**

Create `tests/application/photo/DeletePhotoUseCase.test.ts`:

```typescript
import 'reflect-metadata';
import { DeletePhotoUseCase } from '../../../src/application/photo/DeletePhotoUseCase';
import { PhotoRepository } from '../../../src/domain/photo/PhotoRepository';
import { R2Service } from '../../../src/infrastructure/storage/R2Service';
import { Photo } from '../../../src/domain/photo/Photo';
import { UniqueEntityId } from '../../../src/domain/shared/UniqueEntityId';
import { ForbiddenError, NotFoundError } from '../../../src/shared/errors/AppError';

function makePhoto(ownerId: string): Photo {
  return Photo.reconstitute(
    { petId: 'pet-1', ownerId, s3Key: 'photos/abc.jpg', takenAt: '2026-04-30', caption: undefined, sourceType: 'standalone', sourceId: undefined, createdAt: new Date() },
    new UniqueEntityId('photo-1'),
  );
}

describe('DeletePhotoUseCase', () => {
  it('deletes photo from R2 and DB when user is owner', async () => {
    const repo: jest.Mocked<PhotoRepository> = {
      save: jest.fn(), findById: jest.fn().mockResolvedValue(makePhoto('user-1')),
      findByPetIds: jest.fn(), findYearsByOwnerId: jest.fn(), delete: jest.fn().mockResolvedValue(undefined),
    };
    const r2 = { upload: jest.fn(), getSignedUrl: jest.fn(), delete: jest.fn().mockResolvedValue(undefined) } as unknown as R2Service;
    const useCase = new DeletePhotoUseCase(repo, r2);

    await useCase.execute({ userId: 'user-1', photoId: 'photo-1' });

    expect(r2.delete).toHaveBeenCalledWith('photos/abc.jpg');
    expect(repo.delete).toHaveBeenCalledWith('photo-1');
  });

  it('throws NotFoundError when photo does not exist', async () => {
    const repo: jest.Mocked<PhotoRepository> = {
      save: jest.fn(), findById: jest.fn().mockResolvedValue(null),
      findByPetIds: jest.fn(), findYearsByOwnerId: jest.fn(), delete: jest.fn(),
    };
    const r2 = { upload: jest.fn(), getSignedUrl: jest.fn(), delete: jest.fn() } as unknown as R2Service;
    const useCase = new DeletePhotoUseCase(repo, r2);

    await expect(useCase.execute({ userId: 'user-1', photoId: 'photo-99' })).rejects.toThrow(NotFoundError);
    expect(r2.delete).not.toHaveBeenCalled();
  });

  it('throws ForbiddenError when user is not owner', async () => {
    const repo: jest.Mocked<PhotoRepository> = {
      save: jest.fn(), findById: jest.fn().mockResolvedValue(makePhoto('user-1')),
      findByPetIds: jest.fn(), findYearsByOwnerId: jest.fn(), delete: jest.fn(),
    };
    const r2 = { upload: jest.fn(), getSignedUrl: jest.fn(), delete: jest.fn() } as unknown as R2Service;
    const useCase = new DeletePhotoUseCase(repo, r2);

    await expect(useCase.execute({ userId: 'user-99', photoId: 'photo-1' })).rejects.toThrow(ForbiddenError);
    expect(r2.delete).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

```bash
pnpm test tests/application/photo/DeletePhotoUseCase.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement `src/application/photo/DeletePhotoUseCase.ts`**

```typescript
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
```

- [ ] **Step 4: Implement `src/application/photo/GetPhotoYearsUseCase.ts`**

```typescript
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
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
pnpm test tests/application/photo/DeletePhotoUseCase.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add src/application/photo/DeletePhotoUseCase.ts src/application/photo/GetPhotoYearsUseCase.ts tests/application/photo/DeletePhotoUseCase.test.ts
git commit -m "feat: add DeletePhotoUseCase and GetPhotoYearsUseCase with TDD"
```

---

### Task 10: Update upload middleware for memory storage + MIME validation

**Files:**
- Modify: `src/infrastructure/http/middleware/upload.ts`

- [ ] **Step 1: Replace disk storage with memory storage and add MIME validation**

Replace the entire contents of `src/infrastructure/http/middleware/upload.ts`:

```typescript
import multer from 'multer';
import { AppError } from '../../../shared/errors/AppError';

const ALLOWED_MIME_TYPES: Record<string, string> = {
  'ffd8ff': 'image/jpeg',
  '89504e47': 'image/png',
  '47494638': 'image/gif',
  '52494646': 'image/webp', // RIFF header — confirmed webp below
};

export function detectMimeType(buffer: Buffer): string | null {
  const hex4 = buffer.slice(0, 4).toString('hex');
  if (hex4.startsWith('ffd8ff')) return 'image/jpeg';
  if (hex4 === '89504e47') return 'image/png';
  if (hex4 === '47494638') return 'image/gif';
  // WebP: RIFF????WEBP
  if (hex4 === '52494646' && buffer.slice(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}

export function validateImageBuffer(buffer: Buffer): string {
  const mimeType = detectMimeType(buffer);
  if (!mimeType) throw new AppError('Unsupported image type. Allowed: jpeg, png, gif, webp', 415);
  return mimeType;
}

const memoryStorage = multer.memoryStorage();
const limits = { fileSize: 10 * 1024 * 1024 };

export const uploadImage = multer({ storage: memoryStorage, limits });
export const uploadPetPhoto = multer({ storage: memoryStorage, limits });
export const uploadNoteImage = multer({ storage: memoryStorage, limits });
```

- [ ] **Step 2: Build to verify TypeScript compiles**

```bash
pnpm build
```

Expected: no TypeScript errors. If existing controllers reference `req.file.filename` or `/uploads/...` paths, they will now fail to compile — fix them in Task 12.

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/http/middleware/upload.ts
git commit -m "feat: switch upload middleware to memory storage with MIME type validation"
```

---

### Task 11: PhotoController, Zod schemas, wire app.ts

**Files:**
- Create: `src/infrastructure/http/schemas/photoSchemas.ts`
- Create: `src/infrastructure/http/controllers/PhotoController.ts`
- Modify: `src/app.ts`

- [ ] **Step 1: Create `src/infrastructure/http/schemas/photoSchemas.ts`**

```typescript
import { z } from 'zod';

export const UploadPhotoSchema = z.object({
  petId: z.string().uuid(),
  takenAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'takenAt must be YYYY-MM-DD'),
  caption: z.string().optional(),
});
export type UploadPhotoBody = z.infer<typeof UploadPhotoSchema>;

export const AttachPhotoToNoteSchema = z.object({
  petId: z.string().uuid(),
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
  petIds: z.union([z.string().uuid(), z.array(z.string().uuid())]).optional().transform((v) => v ? (Array.isArray(v) ? v : [v]) : undefined),
});
export type PhotoTimelineQuery = z.infer<typeof PhotoTimelineQuerySchema>;

export const PhotoYearsQuerySchema = z.object({
  petIds: z.union([z.string().uuid(), z.array(z.string().uuid())]).optional().transform((v) => v ? (Array.isArray(v) ? v : [v]) : undefined),
});
export type PhotoYearsQuery = z.infer<typeof PhotoYearsQuerySchema>;
```

- [ ] **Step 2: Create `src/infrastructure/http/controllers/PhotoController.ts`**

```typescript
import { JsonController, Post, Delete, Get, Body, Param, QueryParams, UseBefore, CurrentUser, HttpCode, OnUndefined, Req } from 'routing-controllers';
import { Service } from 'typedi';
import { Request } from 'express';
import { authMiddleware, AuthPayload } from '../middleware/authMiddleware';
import { uploadImage } from '../middleware/upload';
import { validateImageBuffer } from '../middleware/upload';
import { Validate } from '../decorators/Validate';
import { AppError } from '../../../shared/errors/AppError';
import { UploadStandalonePhotoUseCase } from '../../../application/photo/UploadStandalonePhotoUseCase';
import { AttachPhotoToVisitUseCase } from '../../../application/photo/AttachPhotoToVisitUseCase';
import { AttachPhotoToNoteUseCase } from '../../../application/photo/AttachPhotoToNoteUseCase';
import { GetPhotoTimelineUseCase } from '../../../application/photo/GetPhotoTimelineUseCase';
import { GetPhotoYearsUseCase } from '../../../application/photo/GetPhotoYearsUseCase';
import { DeletePhotoUseCase } from '../../../application/photo/DeletePhotoUseCase';
import {
  UploadPhotoSchema, UploadPhotoBody,
  AttachPhotoToVisitSchema, AttachPhotoToVisitBody,
  AttachPhotoToNoteSchema, AttachPhotoToNoteBody,
  PhotoTimelineQuerySchema, PhotoTimelineQuery,
  PhotoYearsQuerySchema, PhotoYearsQuery,
} from '../schemas/photoSchemas';

@JsonController('/photos')
@Service()
@UseBefore(authMiddleware)
export class PhotoController {
  constructor(
    private readonly uploadStandalone: UploadStandalonePhotoUseCase,
    private readonly attachToVisit: AttachPhotoToVisitUseCase,
    private readonly attachToNote: AttachPhotoToNoteUseCase,
    private readonly getTimeline: GetPhotoTimelineUseCase,
    private readonly getYears: GetPhotoYearsUseCase,
    private readonly deletePhoto: DeletePhotoUseCase,
  ) {}

  @Post('/')
  @HttpCode(201)
  @UseBefore(uploadImage.single('file'))
  async uploadStandalonePhoto(@Req() req: Request, @Body() body: UploadPhotoBody, @CurrentUser() user: AuthPayload) {
    if (!req.file) throw new AppError('No file uploaded', 400);
    const parsed = UploadPhotoSchema.parse(req.body);
    const mimeType = validateImageBuffer(req.file.buffer);
    return this.uploadStandalone.execute({ userId: user.userId, ...parsed, buffer: req.file.buffer, mimeType });
  }

  @Post('/vet-visits/:visitId')
  @HttpCode(201)
  @UseBefore(uploadImage.single('file'))
  async attachVisitPhoto(@Param('visitId') visitId: string, @Req() req: Request, @CurrentUser() user: AuthPayload) {
    if (!req.file) throw new AppError('No file uploaded', 400);
    const parsed = AttachPhotoToVisitSchema.parse(req.body);
    const mimeType = validateImageBuffer(req.file.buffer);
    return this.attachToVisit.execute({ userId: user.userId, visitId, buffer: req.file.buffer, mimeType, ...parsed });
  }

  @Post('/notes/:noteId')
  @HttpCode(201)
  @UseBefore(uploadImage.single('file'))
  async attachNotePhoto(@Param('noteId') noteId: string, @Req() req: Request, @CurrentUser() user: AuthPayload) {
    if (!req.file) throw new AppError('No file uploaded', 400);
    const parsed = AttachPhotoToNoteSchema.parse(req.body);
    const mimeType = validateImageBuffer(req.file.buffer);
    return this.attachToNote.execute({ userId: user.userId, noteId, buffer: req.file.buffer, mimeType, ...parsed });
  }

  @Get('/timeline')
  @Validate({ query: PhotoTimelineQuerySchema })
  async timeline(@QueryParams() query: PhotoTimelineQuery, @CurrentUser() user: AuthPayload) {
    return this.getTimeline.execute({ userId: user.userId, year: query.year, petIds: query.petIds });
  }

  @Get('/years')
  @Validate({ query: PhotoYearsQuerySchema })
  async years(@QueryParams() query: PhotoYearsQuery, @CurrentUser() user: AuthPayload) {
    return this.getYears.execute({ userId: user.userId, petIds: query.petIds });
  }

  @Delete('/:photoId')
  @OnUndefined(204)
  async delete(@Param('photoId') photoId: string, @CurrentUser() user: AuthPayload) {
    await this.deletePhoto.execute({ userId: user.userId, photoId });
  }
}
```

- [ ] **Step 3: Update `src/app.ts`**

Add import:
```typescript
import { PhotoController } from './infrastructure/http/controllers/PhotoController';
```

Remove the line:
```typescript
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
```

Also remove `import path from 'path';` if no longer used elsewhere.

Add `PhotoController` to the `controllers` array.

- [ ] **Step 4: Build to verify TypeScript compiles**

```bash
pnpm build
```

Fix any compile errors. Common ones: controllers using `req.file.filename` or `/uploads/...` strings (see Task 12).

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/http/schemas/photoSchemas.ts src/infrastructure/http/controllers/PhotoController.ts src/app.ts
git commit -m "feat: add PhotoController, schemas, and wire into app"
```

---

### Task 12: Remove imageUrls from VetVisit / Note and update controllers

**Files:**
- Modify: `src/domain/health/VetVisit.ts`
- Modify: `src/domain/note/Note.ts`
- Modify: `src/infrastructure/db/models/VetVisitModel.ts`
- Modify: `src/infrastructure/db/models/NoteModel.ts`
- Modify: `src/infrastructure/http/controllers/NoteController.ts`
- Modify: `src/infrastructure/http/controllers/HealthController.ts` (or VetVisitController)

- [ ] **Step 1: Remove `imageUrls` from `VetVisit.ts`**

In `VetVisitProps`, remove `imageUrls: string[]`.

Remove the getter `get imageUrls()`.

Update `VetVisit.create` to not include `imageUrls`.

Update `VetVisit.reconstitute` to not accept `imageUrls`.

- [ ] **Step 2: Remove `imageUrls` from `Note.ts`**

In `NoteProps`, remove `imageUrls: string[]`.

Remove the getter `get imageUrls()`.

Update `Note.create` to not initialize `imageUrls: []`.

Update `Note.reconstitute` to not accept `imageUrls`.

- [ ] **Step 3: Update `VetVisitModel.ts`**

Remove the `imageUrls` column declaration.

- [ ] **Step 4: Update `NoteModel.ts`**

Remove the `imageUrls` column declaration.

- [ ] **Step 5: Remove `addImage` endpoint from NoteController**

Delete the `addImage` method and its `@Post('/:noteId/images')` route. Remove the `addNoteImage` use case dependency from the constructor (and the corresponding use case file if it only handles note images).

- [ ] **Step 6: Remove any `addImage` endpoint from VetVisit controller**

Search for upload-to-visit image routes:
```bash
grep -n "images\|addImage\|imageUrl" src/infrastructure/http/controllers/HealthController.ts src/infrastructure/http/controllers/VetVisitController.ts 2>/dev/null
```

Remove any found routes that push to `imageUrls` array.

- [ ] **Step 7: Update any mappers that reference `imageUrls`**

```bash
grep -rn "imageUrls\|imageUrl" src/infrastructure/mappers/ src/infrastructure/db/repositories/
```

Update each reference — remove `imageUrls` from mapper `toDomain` / `toPersistence` / `toResponse` methods.

- [ ] **Step 8: Build to verify TypeScript compiles clean**

```bash
pnpm build
```

Fix all remaining compile errors.

- [ ] **Step 9: Run all tests**

```bash
pnpm test
```

Expected: all existing tests pass (they may need minor updates if they referenced `imageUrls`).

- [ ] **Step 10: Commit**

```bash
git add src/domain/ src/infrastructure/
git commit -m "feat: remove imageUrls from VetVisit/Note entities — photos now owned by Photo entity"
```

---

## Phase 2: Migration Script

---

### Task 13: Migrate existing disk images to R2

**Files:**
- Create: `scripts/migrate-images-to-r2.ts`

This script is run once manually against the production database after deploying the new code.

- [ ] **Step 1: Create `scripts/migrate-images-to-r2.ts`**

```typescript
import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

import { Sequelize, QueryTypes } from 'sequelize';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

const sequelize = new Sequelize({
  dialect: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  logging: false,
});

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

async function uploadFile(localPath: string, key: string): Promise<void> {
  const buffer = fs.readFileSync(localPath);
  const ext = path.extname(localPath).toLowerCase();
  const mimeMap: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp' };
  const contentType = mimeMap[ext] ?? 'image/jpeg';
  await r2.send(new PutObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key: key, Body: buffer, ContentType: contentType }));
}

async function run() {
  console.log('Starting image migration...');

  // Migrate vet visit images
  const visits = await sequelize.query<{ id: string; pet_id: string; owner_id: string; image_urls: string[] }>(
    `SELECT vv.id, vv.pet_id, p.user_id as owner_id, vv.image_urls FROM vet_visits vv JOIN pets p ON p.id = vv.pet_id WHERE array_length(vv.image_urls, 1) > 0`,
    { type: QueryTypes.SELECT }
  );

  for (const visit of visits) {
    for (const url of visit.image_urls) {
      const filename = url.split('/').pop()!;
      const localPath = path.join(process.cwd(), 'uploads', 'vet-visits', filename);
      if (!fs.existsSync(localPath)) { console.warn(`Skipping missing file: ${localPath}`); continue; }
      const s3Key = `photos/${filename}`;
      await uploadFile(localPath, s3Key);
      const takenAt = new Date().toISOString().slice(0, 10); // fallback — no takenAt stored previously
      await sequelize.query(
        `INSERT INTO photos (id, pet_id, owner_id, s3_key, taken_at, source_type, source_id, created_at) VALUES (:id, :petId, :ownerId, :s3Key, :takenAt, 'vet-visit', :sourceId, NOW()) ON CONFLICT DO NOTHING`,
        { replacements: { id: uuidv4(), petId: visit.pet_id, ownerId: visit.owner_id, s3Key, takenAt, sourceId: visit.id }, type: QueryTypes.INSERT }
      );
      console.log(`Migrated vet-visit image: ${filename}`);
    }
  }

  // Migrate note images
  const notes = await sequelize.query<{ id: string; user_id: string; image_urls: string[]; pet_ids: string[] }>(
    `SELECT n.id, n.user_id, n.image_urls, ARRAY(SELECT pet_id FROM note_pet_tags WHERE note_id = n.id) as pet_ids FROM notes n WHERE array_length(n.image_urls, 1) > 0`,
    { type: QueryTypes.SELECT }
  );

  for (const note of notes) {
    const petId = note.pet_ids[0]; // use first tagged pet; standalone if none
    if (!petId) { console.warn(`Note ${note.id} has no pet tags — skipping images`); continue; }
    for (const url of note.image_urls) {
      const filename = url.split('/').pop()!;
      const localPath = path.join(process.cwd(), 'uploads', 'notes', filename);
      if (!fs.existsSync(localPath)) { console.warn(`Skipping missing file: ${localPath}`); continue; }
      const s3Key = `photos/${filename}`;
      await uploadFile(localPath, s3Key);
      await sequelize.query(
        `INSERT INTO photos (id, pet_id, owner_id, s3_key, taken_at, source_type, source_id, created_at) VALUES (:id, :petId, :ownerId, :s3Key, NOW()::date, 'note', :sourceId, NOW()) ON CONFLICT DO NOTHING`,
        { replacements: { id: uuidv4(), petId, ownerId: note.user_id, s3Key, sourceId: note.id }, type: QueryTypes.INSERT }
      );
      console.log(`Migrated note image: ${filename}`);
    }
  }

  console.log('Migration complete.');
  await sequelize.close();
}

run().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run migration (development only — verify it works)**

```bash
ts-node scripts/migrate-images-to-r2.ts
```

Expected: "Migration complete." with per-file log lines.

- [ ] **Step 3: Commit**

```bash
git add scripts/migrate-images-to-r2.ts
git commit -m "feat: add migration script for disk images → Cloudflare R2"
```

---

## Phase 3: Client

---

### Task 14: Client types and API hooks

**Files:**
- Create: `src/types/photo.ts` (in pet-health-tracker-client)
- Create: `src/api/photos.ts`

- [ ] **Step 1: Create `src/types/photo.ts`** (in pet-health-tracker-client)

```typescript
export type PhotoSourceType = 'standalone' | 'vet-visit' | 'note';

export interface Photo {
  id: string;
  petId: string;
  ownerId: string;
  url: string;
  takenAt: string; // 'YYYY-MM-DD'
  caption?: string;
  sourceType: PhotoSourceType;
  sourceId?: string;
  createdAt: string;
}

export type PhotoTimeline = Record<string, Record<string, Photo[]>>;
```

- [ ] **Step 2: Create `src/api/photos.ts`**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';
import type { Photo, PhotoTimeline } from '../types/photo';

const photoApi = {
  getTimeline: (year: number, petIds?: string[]): Promise<PhotoTimeline> => {
    const params: Record<string, any> = { year };
    if (petIds?.length) params['petIds[]'] = petIds;
    return apiClient.get<PhotoTimeline>('/photos/timeline', { params }).then((r) => r.data);
  },

  getYears: (petIds?: string[]): Promise<number[]> => {
    const params: Record<string, any> = {};
    if (petIds?.length) params['petIds[]'] = petIds;
    return apiClient.get<number[]>('/photos/years', { params }).then((r) => r.data);
  },

  upload: (data: FormData): Promise<Photo> =>
    apiClient.post<Photo>('/photos/', data, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data),

  delete: (photoId: string): Promise<void> =>
    apiClient.delete(`/photos/${photoId}`).then(() => undefined),
};

export function usePhotoTimeline(year: number, petIds?: string[]) {
  return useQuery({
    queryKey: ['photos', 'timeline', year, petIds],
    queryFn: () => photoApi.getTimeline(year, petIds),
  });
}

export function usePhotoYears(petIds?: string[]) {
  return useQuery({
    queryKey: ['photos', 'years', petIds],
    queryFn: () => photoApi.getYears(petIds),
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
```

- [ ] **Step 3: Commit**

```bash
cd pet-health-tracker-client
git add src/types/photo.ts src/api/photos.ts
git commit -m "feat: add Photo types and React Query hooks"
```

---

### Task 15: YearScrapbook component

**Files:**
- Create: `src/pages/photos/YearScrapbook.tsx`

- [ ] **Step 1: Create `src/pages/photos/YearScrapbook.tsx`**

```tsx
import { Box, Grid, Typography, Badge, Skeleton, Chip } from '@mui/material';
import type { PhotoTimeline } from '../../types/photo';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface Props {
  year: number;
  timeline: PhotoTimeline | undefined;
  loading: boolean;
  onMonthClick: (month: string) => void;
  selectedMonth: string | null;
}

export function YearScrapbook({ year, timeline, loading, onMonthClick, selectedMonth }: Props) {
  const monthData = timeline?.[String(year)] ?? {};

  return (
    <Grid container spacing={1.5}>
      {MONTH_LABELS.map((label, i) => {
        const month = String(i + 1).padStart(2, '0');
        const photos = monthData[month] ?? [];
        const thumb = photos[0];
        const isEmpty = photos.length === 0;
        const isSelected = selectedMonth === month;

        return (
          <Grid item xs={6} sm={4} md={3} key={month}>
            <Box
              onClick={() => !isEmpty && onMonthClick(month)}
              sx={{
                borderRadius: 2,
                overflow: 'hidden',
                border: '2px solid',
                borderColor: isSelected ? 'primary.main' : isEmpty ? 'divider' : 'transparent',
                cursor: isEmpty ? 'default' : 'pointer',
                opacity: isEmpty ? 0.4 : 1,
                transition: 'all 0.15s',
                '&:hover': isEmpty ? {} : { borderColor: 'primary.light', transform: 'scale(1.02)' },
              }}
            >
              {loading ? (
                <Skeleton variant="rectangular" height={100} />
              ) : thumb ? (
                <Box
                  component="img"
                  src={thumb.url}
                  alt={`${label} ${year}`}
                  sx={{ width: '100%', height: 100, objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <Box sx={{ height: 100, bgcolor: 'action.hover', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography variant="body2" color="text.disabled">—</Typography>
                </Box>
              )}
              <Box sx={{ px: 1, py: 0.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'background.paper' }}>
                <Typography variant="caption" fontWeight={600}>{label}</Typography>
                {photos.length > 0 && (
                  <Chip label={photos.length} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
                )}
              </Box>
            </Box>
          </Grid>
        );
      })}
    </Grid>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/photos/YearScrapbook.tsx
git commit -m "feat: add YearScrapbook component"
```

---

### Task 16: MonthGrid and PhotoLightbox

**Files:**
- Create: `src/pages/photos/MonthGrid.tsx`
- Create: `src/pages/photos/PhotoLightbox.tsx`

- [ ] **Step 1: Create `src/pages/photos/MonthGrid.tsx`**

```tsx
import { Box, Grid, Typography, Chip } from '@mui/material';
import type { Photo } from '../../types/photo';

const SOURCE_LABELS: Record<string, string> = {
  'vet-visit': 'Vet visit',
  'note': 'Note',
  'standalone': '',
};

interface Props {
  photos: Photo[];
  onPhotoClick: (photo: Photo) => void;
}

export function MonthGrid({ photos, onPhotoClick }: Props) {
  if (photos.length === 0) {
    return <Typography color="text.secondary" sx={{ mt: 2 }}>No photos this month.</Typography>;
  }

  return (
    <Grid container spacing={1.5}>
      {photos.map((photo) => (
        <Grid item xs={6} sm={4} md={3} key={photo.id}>
          <Box
            onClick={() => onPhotoClick(photo)}
            sx={{ borderRadius: 2, overflow: 'hidden', cursor: 'pointer', position: 'relative', '&:hover img': { opacity: 0.85 } }}
          >
            <Box
              component="img"
              src={photo.url}
              alt={photo.caption ?? 'Photo'}
              sx={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block', transition: 'opacity 0.15s' }}
            />
            {SOURCE_LABELS[photo.sourceType] && (
              <Chip
                label={SOURCE_LABELS[photo.sourceType]}
                size="small"
                sx={{ position: 'absolute', bottom: 6, left: 6, fontSize: '0.6rem', height: 18, bgcolor: 'rgba(0,0,0,0.6)', color: 'white' }}
              />
            )}
          </Box>
        </Grid>
      ))}
    </Grid>
  );
}
```

- [ ] **Step 2: Create `src/pages/photos/PhotoLightbox.tsx`**

```tsx
import { Dialog, DialogContent, Box, Typography, IconButton, Chip } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import type { Photo } from '../../types/photo';

const SOURCE_LABELS: Record<string, string> = { 'vet-visit': 'Vet visit', 'note': 'Note', 'standalone': 'Standalone' };

interface Props {
  photo: Photo | null;
  onClose: () => void;
}

export function PhotoLightbox({ photo, onClose }: Props) {
  if (!photo) return null;

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogContent sx={{ p: 0, position: 'relative', bgcolor: '#000' }}>
        <IconButton onClick={onClose} sx={{ position: 'absolute', top: 8, right: 8, color: 'white', zIndex: 1 }}>
          <CloseIcon />
        </IconButton>
        <Box
          component="img"
          src={photo.url}
          alt={photo.caption ?? 'Photo'}
          sx={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', display: 'block' }}
        />
        <Box sx={{ p: 2 }}>
          {photo.caption && <Typography variant="body1" gutterBottom>{photo.caption}</Typography>}
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary">{photo.takenAt}</Typography>
            <Chip label={SOURCE_LABELS[photo.sourceType]} size="small" />
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/photos/MonthGrid.tsx src/pages/photos/PhotoLightbox.tsx
git commit -m "feat: add MonthGrid and PhotoLightbox components"
```

---

### Task 17: UploadPhotoDialog

**Files:**
- Create: `src/pages/photos/UploadPhotoDialog.tsx`

- [ ] **Step 1: Create `src/pages/photos/UploadPhotoDialog.tsx`**

```tsx
import { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Box, MenuItem, Select, FormControl, InputLabel, Typography } from '@mui/material';
import { useUploadPhoto } from '../../api/photos';
import type { Pet } from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
  pets: Pet[];
}

export function UploadPhotoDialog({ open, onClose, pets }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [petId, setPetId] = useState('');
  const [takenAt, setTakenAt] = useState(new Date().toISOString().slice(0, 10));
  const [caption, setCaption] = useState('');
  const upload = useUploadPhoto();

  function handleClose() {
    setFile(null); setPetId(''); setCaption('');
    setTakenAt(new Date().toISOString().slice(0, 10));
    onClose();
  }

  async function handleSubmit() {
    if (!file || !petId || !takenAt) return;
    const form = new FormData();
    form.append('file', file);
    form.append('petId', petId);
    form.append('takenAt', takenAt);
    if (caption) form.append('caption', caption);
    await upload.mutateAsync(form);
    handleClose();
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Photo</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        <Button variant="outlined" component="label">
          {file ? file.name : 'Choose image'}
          <input hidden accept="image/*" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </Button>
        {file && (
          <Box component="img" src={URL.createObjectURL(file)} alt="preview"
            sx={{ width: '100%', maxHeight: 200, objectFit: 'contain', borderRadius: 1 }} />
        )}
        <FormControl fullWidth required>
          <InputLabel>Pet</InputLabel>
          <Select value={petId} label="Pet" onChange={(e) => setPetId(e.target.value)}>
            {pets.map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
          </Select>
        </FormControl>
        <TextField label="Date taken" type="date" value={takenAt} onChange={(e) => setTakenAt(e.target.value)} InputLabelProps={{ shrink: true }} required />
        <TextField label="Caption (optional)" value={caption} onChange={(e) => setCaption(e.target.value)} multiline rows={2} />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={!file || !petId || !takenAt || upload.isPending}>
          {upload.isPending ? 'Uploading…' : 'Upload'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/photos/UploadPhotoDialog.tsx
git commit -m "feat: add UploadPhotoDialog component"
```

---

### Task 18: PhotosPage, routing, and nav

**Files:**
- Create: `src/pages/photos/PhotosPage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/Layout.tsx`

- [ ] **Step 1: Create `src/pages/photos/PhotosPage.tsx`**

```tsx
import { useState } from 'react';
import { Box, Typography, IconButton, Fab, Stack, Chip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { usePhotoTimeline, usePhotoYears } from '../../api/photos';
import { usePets } from '../../api/pets';
import { YearScrapbook } from './YearScrapbook';
import { MonthGrid } from './MonthGrid';
import { PhotoLightbox } from './PhotoLightbox';
import { UploadPhotoDialog } from './UploadPhotoDialog';
import type { Photo } from '../../types/photo';

const MONTH_LABELS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export function PhotosPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [petFilter, setPetFilter] = useState<string[]>([]);

  const { data: pets = [] } = usePets();
  const { data: years = [] } = usePhotoYears(petFilter.length ? petFilter : undefined);
  const { data: timeline, isLoading } = usePhotoTimeline(year, petFilter.length ? petFilter : undefined);

  const monthPhotos = selectedMonth ? (timeline?.[String(year)]?.[selectedMonth] ?? []) : [];

  return (
    <Box sx={{ p: 2, maxWidth: 900, mx: 'auto' }}>
      {/* Pet filter */}
      <Stack direction="row" spacing={1} flexWrap="wrap" mb={2}>
        {pets.map((pet) => (
          <Chip
            key={pet.id}
            label={pet.name}
            onClick={() => setPetFilter((prev) => prev.includes(pet.id) ? prev.filter((id) => id !== pet.id) : [...prev, pet.id])}
            color={petFilter.includes(pet.id) ? 'primary' : 'default'}
            variant={petFilter.includes(pet.id) ? 'filled' : 'outlined'}
          />
        ))}
      </Stack>

      {/* Year navigation */}
      <Stack direction="row" alignItems="center" spacing={1} mb={2}>
        <IconButton onClick={() => setYear((y) => y - 1)}><ChevronLeftIcon /></IconButton>
        <Typography variant="h6" sx={{ minWidth: 60, textAlign: 'center' }}>{year}</Typography>
        <IconButton onClick={() => setYear((y) => y + 1)}><ChevronRightIcon /></IconButton>
        {selectedMonth && (
          <>
            <Typography variant="body2" color="text.secondary">›</Typography>
            <Chip label={MONTH_LABELS[Number(selectedMonth) - 1]} onDelete={() => setSelectedMonth(null)} />
          </>
        )}
      </Stack>

      {/* Content */}
      {selectedMonth ? (
        <MonthGrid photos={monthPhotos} onPhotoClick={setLightboxPhoto} />
      ) : (
        <YearScrapbook year={year} timeline={timeline} loading={isLoading} onMonthClick={setSelectedMonth} selectedMonth={selectedMonth} />
      )}

      {/* FAB */}
      <Fab color="primary" sx={{ position: 'fixed', bottom: 80, right: 24 }} onClick={() => setUploadOpen(true)}>
        <AddIcon />
      </Fab>

      <PhotoLightbox photo={lightboxPhoto} onClose={() => setLightboxPhoto(null)} />
      <UploadPhotoDialog open={uploadOpen} onClose={() => setUploadOpen(false)} pets={pets} />
    </Box>
  );
}
```

- [ ] **Step 2: Add `/photos` route to `src/App.tsx`**

Add import:
```tsx
import { PhotosPage } from './pages/photos/PhotosPage';
```

Add route inside `<Routes>`:
```tsx
<Route path="/photos" element={<ProtectedRoute><Layout><PhotosPage /></Layout></ProtectedRoute>} />
```

- [ ] **Step 3: Add Photos nav item to `src/components/Layout.tsx`**

Find where `navItems` is defined (around line 15) and add Photos:
```tsx
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
```

Add to nav items array:
```tsx
{ label: 'Photos', icon: <PhotoLibraryIcon />, path: '/photos' },
```

- [ ] **Step 4: Add `usePets` hook to `src/api/pets.ts`**

`petsApi.list` is paginated and returns `PaginatedResult<Pet>`. Add a simple flat hook at the bottom of `src/api/pets.ts`:

```typescript
import { useQuery } from '@tanstack/react-query';

export function usePets() {
  return useQuery({
    queryKey: ['pets', 'all'],
    queryFn: () => petsApi.list({ pageParam: 1 }).then((r) => r.items ?? r.data ?? []),
  });
}
```

Check what the paginated result key is called (`items` or `data`) by looking at the `PaginatedResult` type in `src/types/index.ts` and use the correct field name.

- [ ] **Step 5: Build the client to check for TypeScript errors**

```bash
pnpm build
```

Fix any compile errors.

- [ ] **Step 6: Start dev servers and smoke test**

```bash
# Terminal 1 — API
cd pet-health-tracker-api && pnpm dev

# Terminal 2 — Client
cd pet-health-tracker-client && pnpm dev
```

- Navigate to `http://localhost:5173/photos`
- Verify the year scrapbook renders (empty months shown as faded)
- Click the FAB, fill in the upload form, submit a test photo
- Verify the photo appears in the correct month cell
- Click the month cell, verify the grid view opens
- Click a photo, verify the lightbox opens

- [ ] **Step 7: Commit**

```bash
cd pet-health-tracker-client
git add src/pages/photos/PhotosPage.tsx src/App.tsx src/components/Layout.tsx
git commit -m "feat: add PhotosPage, routing, and nav — photo timeline feature complete"
```

---

## Done

Run all tests to verify nothing is broken:

```bash
cd pet-health-tracker-api && pnpm test
cd pet-health-tracker-client && pnpm build
```

Before going to production, run the migration script once:
```bash
cd pet-health-tracker-api && ts-node scripts/migrate-images-to-r2.ts
```
