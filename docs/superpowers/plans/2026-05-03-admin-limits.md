# Admin Profile & User Limits — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin role, per-user resource limits, and a stats dashboard so admins can manage users and prevent abuse.

**Architecture:** `role` enum on `User` entity + `user_limits` table (nullable overrides, env fallbacks). A `LimitService` in the application layer enforces limits at use-case boundaries. An `AdminController` at `/api/v1/admin` is guarded by `requireAdmin` middleware.

**Tech Stack:** TypeScript, Express, routing-controllers, Sequelize + PostgreSQL, typedi, Zod, Jest

---

## File Map

### New files
| File | Purpose |
|---|---|
| `src/domain/user/UserRole.ts` | `UserRole` type |
| `src/domain/user/UserLimits.ts` | `UserLimits` entity |
| `src/domain/user/UserLimitsRepository.ts` | Repository interface + token |
| `src/domain/admin/AdminStatsRepository.ts` | Stats query interface + token |
| `src/infrastructure/db/models/UserLimitsModel.ts` | Sequelize model for `user_limits` |
| `src/infrastructure/db/repositories/SequelizeUserLimitsRepository.ts` | UserLimits repo implementation |
| `src/infrastructure/db/repositories/SequelizeAdminStatsRepository.ts` | Stats aggregation queries |
| `src/infrastructure/mappers/UserLimitsMapper.ts` | UserLimits ↔ domain ↔ response |
| `src/application/limits/LimitService.ts` | Limit checks + storage tracking |
| `src/infrastructure/http/middleware/requireAdmin.ts` | Admin guard middleware |
| `src/application/admin/ListUsersUseCase.ts` | Paginated user list for admin |
| `src/application/admin/GetUserStatsUseCase.ts` | Single user stats |
| `src/application/admin/UpdateUserRoleUseCase.ts` | Set user role |
| `src/application/admin/UpsertUserLimitsUseCase.ts` | Set per-user limits |
| `src/application/admin/DeleteUserUseCase.ts` | Admin delete user + cascade |
| `src/infrastructure/http/controllers/AdminController.ts` | Admin routes |
| `src/infrastructure/http/schemas/adminSchemas.ts` | Zod schemas for admin requests |
| `tests/application/limits/LimitService.test.ts` | LimitService unit tests |
| `tests/application/admin/UpdateUserRoleUseCase.test.ts` | Role update tests |
| `tests/infrastructure/http/middleware/requireAdmin.test.ts` | Middleware tests |

### Modified files
| File | Change |
|---|---|
| `src/domain/user/User.ts` | Add `role` field |
| `src/domain/user/UserRepository.ts` | Add `findAllPaginated`, `deleteById` |
| `src/domain/pet/PetRepository.ts` | Add `countByUserId` |
| `src/domain/vet/VetRepository.ts` | Add `countByUserId` |
| `src/domain/note/NoteRepository.ts` | Add `countByUserId` |
| `src/domain/health/HealthRecordRepository.ts` | Add `countMedicationsByUserId` |
| `src/infrastructure/db/models/UserModel.ts` | Add `role` column |
| `src/infrastructure/db/models/PhotoModel.ts` | Add `size_bytes` column |
| `src/infrastructure/db/repositories/SequelizeUserRepository.ts` | Implement `findAllPaginated`, `deleteById` |
| `src/infrastructure/db/repositories/SequelizePetRepository.ts` | Implement `countByUserId` |
| `src/infrastructure/db/repositories/SequelizeVetRepository.ts` | Implement `countByUserId` |
| `src/infrastructure/db/repositories/SequelizeNoteRepository.ts` | Implement `countByUserId` |
| `src/infrastructure/db/repositories/SequelizeHealthRecordRepository.ts` | Implement `countMedicationsByUserId` |
| `src/infrastructure/mappers/UserMapper.ts` | Include `role` in `toResponse` |
| `src/infrastructure/http/middleware/authMiddleware.ts` | Add `role` to `AuthPayload` |
| `src/application/auth/LoginUserUseCase.ts` | Include `role` in JWT |
| `src/application/pet/AddPetUseCase.ts` | Inject + call `LimitService.checkPetLimit` |
| `src/application/vet/CreateVetUseCase.ts` | Inject + call `LimitService.checkVetLimit` |
| `src/application/note/CreateNoteUseCase.ts` | Inject + call `LimitService.checkNoteLimit` |
| `src/application/health/LogMedicationUseCase.ts` | Inject + call `LimitService.checkMedicationLimit` |
| `src/application/photo/UploadStandalonePhotoUseCase.ts` | Check + increment storage |
| `src/application/photo/AttachPhotoToVisitUseCase.ts` | Check + increment storage |
| `src/application/photo/AttachPhotoToNoteUseCase.ts` | Check + increment storage |
| `src/application/photo/AttachPhotoToWeightEntryUseCase.ts` | Check + increment storage |
| `src/application/photo/DeletePhotoUseCase.ts` | Decrement storage after delete |
| `src/infrastructure/http/controllers/PetController.ts` | Check + increment storage on photo upload |
| `src/infrastructure/http/controllers/PlacesController.ts` | Inject `LimitService`, check places search limit |
| `src/infrastructure/http/controllers/UserController.ts` | Add `GET /me/limits` |
| `src/container.ts` | Register `UserLimitsRepository`, `AdminStatsRepository` |

---

## Task 1: UserRole type + User entity role field

**Files:**
- Create: `src/domain/user/UserRole.ts`
- Modify: `src/domain/user/User.ts`

- [ ] **Step 1: Create UserRole type**

```typescript
// src/domain/user/UserRole.ts
export type UserRole = 'user' | 'admin';
```

- [ ] **Step 2: Update User entity**

In `src/domain/user/User.ts`, change `UserProps` to add `role`, add getter and setter, update `create` and `reconstitute`:

```typescript
import { AggregateRoot } from '../shared/AggregateRoot';
import { UniqueEntityId } from '../shared/UniqueEntityId';
import { UserRole } from './UserRole';

export type ThemeMode = 'light' | 'dark';

interface UserProps {
  name: string;
  email: string;
  passwordHash: string;
  theme: ThemeMode;
  role: UserRole;
  createdAt: Date;
}

export class User extends AggregateRoot<UserProps> {
  get name(): string { return this.props.name; }
  get email(): string { return this.props.email; }
  get passwordHash(): string { return this.props.passwordHash; }
  get theme(): ThemeMode { return this.props.theme; }
  get role(): UserRole { return this.props.role; }
  get createdAt(): Date { return this.props.createdAt; }

  setTheme(mode: ThemeMode): void { this.props.theme = mode; }
  setRole(role: UserRole): void { this.props.role = role; }

  static create(props: Omit<UserProps, 'createdAt' | 'theme' | 'role'>, id?: UniqueEntityId): User {
    return new User({ ...props, theme: 'light', role: 'user', createdAt: new Date() }, id);
  }

  static reconstitute(props: UserProps, id: UniqueEntityId): User {
    return new User(props, id);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/domain/user/UserRole.ts src/domain/user/User.ts
git commit -m "feat(domain): add UserRole type and role field to User entity"
```

---

## Task 2: UserLimits domain entity + UserLimitsRepository interface

**Files:**
- Create: `src/domain/user/UserLimits.ts`
- Create: `src/domain/user/UserLimitsRepository.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/application/limits/LimitService.test.ts  (stub — will grow in Task 6)
import 'reflect-metadata';
import { UserLimits } from '../../../src/domain/user/UserLimits';
import { UniqueEntityId } from '../../../src/domain/shared/UniqueEntityId';

describe('UserLimits', () => {
  it('reconstitutes from raw props', () => {
    const limits = UserLimits.reconstitute(
      { userId: 'u1', maxPets: 5, maxVets: null, maxMedications: null, maxNotes: null,
        maxStorageBytes: null, storageUsedBytes: 0,
        maxPlacesSearchesMonthly: null, placesSearchesThisMonth: 0,
        placesSearchesMonth: new Date('2026-05-01'), createdAt: new Date(), updatedAt: new Date() },
      new UniqueEntityId('lim-1'),
    );
    expect(limits.maxPets).toBe(5);
    expect(limits.storageUsedBytes).toBe(0);
  });
});
```

- [ ] **Step 2: Run test — expect failure**

```bash
cd /Users/latzko/projects/pet-health-tracker-api && pnpm test -- --testPathPattern="LimitService" 2>&1 | tail -5
```

Expected: `Cannot find module '../../../src/domain/user/UserLimits'`

- [ ] **Step 3: Create UserLimits entity**

```typescript
// src/domain/user/UserLimits.ts
import { Entity } from '../shared/Entity';
import { UniqueEntityId } from '../shared/UniqueEntityId';

export interface UserLimitsProps {
  userId: string;
  maxPets: number | null;
  maxVets: number | null;
  maxMedications: number | null;
  maxNotes: number | null;
  maxStorageBytes: number | null;
  storageUsedBytes: number;
  maxPlacesSearchesMonthly: number | null;
  placesSearchesThisMonth: number;
  placesSearchesMonth: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class UserLimits extends Entity<UserLimitsProps> {
  get userId(): string { return this.props.userId; }
  get maxPets(): number | null { return this.props.maxPets; }
  get maxVets(): number | null { return this.props.maxVets; }
  get maxMedications(): number | null { return this.props.maxMedications; }
  get maxNotes(): number | null { return this.props.maxNotes; }
  get maxStorageBytes(): number | null { return this.props.maxStorageBytes; }
  get storageUsedBytes(): number { return this.props.storageUsedBytes; }
  get maxPlacesSearchesMonthly(): number | null { return this.props.maxPlacesSearchesMonthly; }
  get placesSearchesThisMonth(): number { return this.props.placesSearchesThisMonth; }
  get placesSearchesMonth(): Date { return this.props.placesSearchesMonth; }

  static create(userId: string): UserLimits {
    return new UserLimits({
      userId,
      maxPets: null, maxVets: null, maxMedications: null, maxNotes: null,
      maxStorageBytes: null, storageUsedBytes: 0,
      maxPlacesSearchesMonthly: null, placesSearchesThisMonth: 0,
      placesSearchesMonth: new Date(),
      createdAt: new Date(), updatedAt: new Date(),
    }, new UniqueEntityId());
  }

  static reconstitute(props: UserLimitsProps, id: UniqueEntityId): UserLimits {
    return new UserLimits(props, id);
  }
}
```

- [ ] **Step 4: Create UserLimitsRepository interface**

```typescript
// src/domain/user/UserLimitsRepository.ts
import { UserLimits, UserLimitsProps } from './UserLimits';

export interface UserLimitsRepository {
  findByUserId(userId: string): Promise<UserLimits | null>;
  upsert(userId: string, overrides: Partial<Pick<UserLimitsProps,
    'maxPets' | 'maxVets' | 'maxMedications' | 'maxNotes' |
    'maxStorageBytes' | 'maxPlacesSearchesMonthly'>>): Promise<void>;
  incrementStorage(userId: string, bytes: number): Promise<void>;
  decrementStorage(userId: string, bytes: number): Promise<void>;
  /** Resets monthly counter if stale, then increments. Throws ForbiddenError if limit exceeded. */
  checkAndIncrementPlacesSearch(userId: string, effectiveLimit: number): Promise<void>;
}

export const USER_LIMITS_REPOSITORY = 'UserLimitsRepository';
```

- [ ] **Step 5: Run test — expect pass**

```bash
pnpm test -- --testPathPattern="LimitService" 2>&1 | tail -5
```

Expected: `PASS tests/application/limits/LimitService.test.ts`

- [ ] **Step 6: Commit**

```bash
git add src/domain/user/UserLimits.ts src/domain/user/UserLimitsRepository.ts tests/application/limits/LimitService.test.ts
git commit -m "feat(domain): add UserLimits entity and UserLimitsRepository interface"
```

---

## Task 3: UserModel role column + UserLimitsModel + PhotoModel size_bytes

**Files:**
- Modify: `src/infrastructure/db/models/UserModel.ts`
- Create: `src/infrastructure/db/models/UserLimitsModel.ts`
- Modify: `src/infrastructure/db/models/PhotoModel.ts`

- [ ] **Step 1: Add role column to UserModel**

Replace the entire `UserModel.ts`:

```typescript
import { Column, DataType, HasMany, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { PetModel } from './PetModel';

@Table({ tableName: 'users', timestamps: false })
export class UserModel extends Model {
  @PrimaryKey
  @Column(DataType.UUID)
  declare id: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare name: string;

  @Column({ type: DataType.STRING, allowNull: false, unique: true })
  declare email: string;

  @Column({ type: DataType.STRING, allowNull: false, field: 'password_hash' })
  declare passwordHash: string;

  @Column({ type: DataType.ENUM('light', 'dark'), allowNull: false, defaultValue: 'light' })
  declare theme: 'light' | 'dark';

  @Column({ type: DataType.ENUM('user', 'admin'), allowNull: false, defaultValue: 'user' })
  declare role: 'user' | 'admin';

  @Column({ type: DataType.DATE, allowNull: false, field: 'created_at' })
  declare createdAt: Date;

  @HasMany(() => PetModel)
  declare pets: PetModel[];
}
```

- [ ] **Step 2: Create UserLimitsModel**

```typescript
// src/infrastructure/db/models/UserLimitsModel.ts
import { BelongsTo, Column, DataType, ForeignKey, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { UserModel } from './UserModel';

@Table({ tableName: 'user_limits', timestamps: false })
export class UserLimitsModel extends Model {
  @PrimaryKey
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => UserModel)
  @Column({ type: DataType.UUID, allowNull: false, unique: true, field: 'user_id' })
  declare userId: string;

  @Column({ type: DataType.INTEGER, allowNull: true, field: 'max_pets' })
  declare maxPets: number | null;

  @Column({ type: DataType.INTEGER, allowNull: true, field: 'max_vets' })
  declare maxVets: number | null;

  @Column({ type: DataType.INTEGER, allowNull: true, field: 'max_medications' })
  declare maxMedications: number | null;

  @Column({ type: DataType.INTEGER, allowNull: true, field: 'max_notes' })
  declare maxNotes: number | null;

  @Column({ type: DataType.BIGINT, allowNull: true, field: 'max_storage_bytes' })
  declare maxStorageBytes: string | null;  // Sequelize returns BIGINT as string

  @Column({ type: DataType.BIGINT, allowNull: false, defaultValue: 0, field: 'storage_used_bytes' })
  declare storageUsedBytes: string;

  @Column({ type: DataType.INTEGER, allowNull: true, field: 'max_places_searches_monthly' })
  declare maxPlacesSearchesMonthly: number | null;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'places_searches_this_month' })
  declare placesSearchesThisMonth: number;

  @Column({ type: DataType.DATEONLY, allowNull: false, defaultValue: DataType.NOW, field: 'places_searches_month' })
  declare placesSearchesMonth: string;

  @Column({ type: DataType.DATE, allowNull: false, field: 'created_at' })
  declare createdAt: Date;

  @Column({ type: DataType.DATE, allowNull: false, field: 'updated_at' })
  declare updatedAt: Date;

  @BelongsTo(() => UserModel)
  declare user: UserModel;
}
```

- [ ] **Step 3: Add size_bytes to PhotoModel**

In `src/infrastructure/db/models/PhotoModel.ts`, add after the `sourceId` column declaration:

```typescript
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'size_bytes' })
  declare sizeBytes: number;
```

- [ ] **Step 4: Register model in database setup**

Find where Sequelize models array is defined:

```bash
grep -rn "PhotoModel\|models:" /Users/latzko/projects/pet-health-tracker-api/src --include="*.ts" | grep -v node_modules | head -10
```

Typically `src/infrastructure/db/database.ts`. Add `UserLimitsModel` to the models array in that file, alongside the other models. Import it at the top of the file.

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/db/models/UserModel.ts src/infrastructure/db/models/UserLimitsModel.ts src/infrastructure/db/models/PhotoModel.ts
git commit -m "feat(db): add role to users, create user_limits table, add size_bytes to photos"
```

---

## Task 4: UserLimitsMapper + SequelizeUserLimitsRepository

**Files:**
- Create: `src/infrastructure/mappers/UserLimitsMapper.ts`
- Create: `src/infrastructure/db/repositories/SequelizeUserLimitsRepository.ts`

- [ ] **Step 1: Create UserLimitsMapper**

```typescript
// src/infrastructure/mappers/UserLimitsMapper.ts
import { Service } from 'typedi';
import { UserLimitsModel } from '../db/models/UserLimitsModel';
import { UserLimits } from '../../domain/user/UserLimits';
import { UniqueEntityId } from '../../domain/shared/UniqueEntityId';

@Service()
export class UserLimitsMapper {
  toDomain(model: UserLimitsModel): UserLimits {
    return UserLimits.reconstitute(
      {
        userId: model.userId,
        maxPets: model.maxPets,
        maxVets: model.maxVets,
        maxMedications: model.maxMedications,
        maxNotes: model.maxNotes,
        maxStorageBytes: model.maxStorageBytes !== null ? Number(model.maxStorageBytes) : null,
        storageUsedBytes: Number(model.storageUsedBytes),
        maxPlacesSearchesMonthly: model.maxPlacesSearchesMonthly,
        placesSearchesThisMonth: model.placesSearchesThisMonth,
        placesSearchesMonth: new Date(model.placesSearchesMonth),
        createdAt: model.createdAt,
        updatedAt: model.updatedAt,
      },
      new UniqueEntityId(model.id),
    );
  }
}
```

- [ ] **Step 2: Create SequelizeUserLimitsRepository**

```typescript
// src/infrastructure/db/repositories/SequelizeUserLimitsRepository.ts
import { Service } from 'typedi';
import { v4 as uuidv4 } from 'uuid';
import { UserLimitsModel } from '../models/UserLimitsModel';
import { UserLimitsRepository } from '../../../domain/user/UserLimitsRepository';
import { UserLimitsMapper } from '../../mappers/UserLimitsMapper';
import { UserLimits, UserLimitsProps } from '../../../domain/user/UserLimits';
import { ForbiddenError } from '../../../shared/errors/AppError';
import { sequelize } from '../database';

@Service()
export class SequelizeUserLimitsRepository implements UserLimitsRepository {
  constructor(private readonly mapper: UserLimitsMapper) {}

  async findByUserId(userId: string): Promise<UserLimits | null> {
    const model = await UserLimitsModel.findOne({ where: { userId } });
    return model ? this.mapper.toDomain(model) : null;
  }

  async upsert(userId: string, overrides: Partial<Pick<UserLimitsProps,
    'maxPets' | 'maxVets' | 'maxMedications' | 'maxNotes' |
    'maxStorageBytes' | 'maxPlacesSearchesMonthly'>>): Promise<void> {
    const now = new Date();
    const existing = await UserLimitsModel.findOne({ where: { userId } });
    if (existing) {
      await existing.update({ ...overrides, updatedAt: now });
    } else {
      await UserLimitsModel.create({
        id: uuidv4(),
        userId,
        ...overrides,
        storageUsedBytes: 0,
        placesSearchesThisMonth: 0,
        placesSearchesMonth: new Date().toISOString().slice(0, 10),
        createdAt: now,
        updatedAt: now,
      } as any);
    }
  }

  async incrementStorage(userId: string, bytes: number): Promise<void> {
    const now = new Date();
    const [row, created] = await UserLimitsModel.findOrCreate({
      where: { userId },
      defaults: {
        id: uuidv4(), userId, storageUsedBytes: 0,
        placesSearchesThisMonth: 0,
        placesSearchesMonth: now.toISOString().slice(0, 10),
        createdAt: now, updatedAt: now,
      } as any,
    });
    if (created) {
      await row.update({ storageUsedBytes: bytes, updatedAt: now });
    } else {
      await UserLimitsModel.increment('storageUsedBytes', { by: bytes, where: { userId } });
    }
  }

  async decrementStorage(userId: string, bytes: number): Promise<void> {
    await UserLimitsModel.decrement('storageUsedBytes', { by: bytes, where: { userId } });
  }

  async checkAndIncrementPlacesSearch(userId: string, effectiveLimit: number): Promise<void> {
    await sequelize.transaction(async (t) => {
      const currentMonth = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
      let row = await UserLimitsModel.findOne({ where: { userId }, transaction: t, lock: true });

      if (!row) {
        const now = new Date();
        row = await UserLimitsModel.create({
          id: uuidv4(), userId, storageUsedBytes: 0,
          placesSearchesThisMonth: 0,
          placesSearchesMonth: now.toISOString().slice(0, 10),
          createdAt: now, updatedAt: now,
        } as any, { transaction: t });
      }

      const rowMonth = row.placesSearchesMonth.slice(0, 7);
      if (rowMonth !== currentMonth) {
        await row.update({ placesSearchesThisMonth: 0, placesSearchesMonth: new Date().toISOString().slice(0, 10) }, { transaction: t });
        row.placesSearchesThisMonth = 0;
      }

      if (row.placesSearchesThisMonth >= effectiveLimit) {
        throw new ForbiddenError(`Monthly Places search limit reached (${effectiveLimit}/month)`);
      }

      await row.increment('placesSearchesThisMonth', { by: 1, transaction: t });
    });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/mappers/UserLimitsMapper.ts src/infrastructure/db/repositories/SequelizeUserLimitsRepository.ts
git commit -m "feat(infra): add UserLimitsMapper and SequelizeUserLimitsRepository"
```

---

## Task 5: Add countByUserId to repository interfaces + implementations

**Files:**
- Modify: `src/domain/pet/PetRepository.ts`
- Modify: `src/domain/vet/VetRepository.ts`
- Modify: `src/domain/note/NoteRepository.ts`
- Modify: `src/domain/health/HealthRecordRepository.ts`
- Modify: `src/infrastructure/db/repositories/SequelizePetRepository.ts`
- Modify: `src/infrastructure/db/repositories/SequelizeVetRepository.ts`
- Modify: `src/infrastructure/db/repositories/SequelizeNoteRepository.ts`
- Modify: `src/infrastructure/db/repositories/SequelizeHealthRecordRepository.ts`

- [ ] **Step 1: Add to PetRepository interface**

In `src/domain/pet/PetRepository.ts`, add to the interface:
```typescript
  countByUserId(userId: string): Promise<number>;
```

- [ ] **Step 2: Add to VetRepository interface**

In `src/domain/vet/VetRepository.ts`, add to the interface:
```typescript
  countByUserId(userId: string): Promise<number>;
```

- [ ] **Step 3: Add to NoteRepository interface**

In `src/domain/note/NoteRepository.ts`, add to the interface:
```typescript
  countByUserId(userId: string): Promise<number>;
```

- [ ] **Step 4: Add to HealthRecordRepository interface**

In `src/domain/health/HealthRecordRepository.ts`, add under `// Medications`:
```typescript
  countMedicationsByUserId(userId: string): Promise<number>;
```

- [ ] **Step 5: Implement in SequelizePetRepository**

Add to `SequelizePetRepository`:
```typescript
  async countByUserId(userId: string): Promise<number> {
    return PetModel.count({ where: { userId } });
  }
```

- [ ] **Step 6: Implement in SequelizeVetRepository**

Add to `SequelizeVetRepository`:
```typescript
  async countByUserId(userId: string): Promise<number> {
    return VetModel.count({ where: { userId } });
  }
```

- [ ] **Step 7: Implement in SequelizeNoteRepository**

Add to `SequelizeNoteRepository`:
```typescript
  async countByUserId(userId: string): Promise<number> {
    return NoteModel.count({ where: { userId } });
  }
```

- [ ] **Step 8: Implement in SequelizeHealthRecordRepository**

Add to `SequelizeHealthRecordRepository`. Medications are per-pet, so join through pets:
```typescript
  async countMedicationsByUserId(userId: string): Promise<number> {
    return MedicationModel.count({
      include: [{ model: PetModel, where: { userId }, required: true }],
    });
  }
```

Make sure `PetModel` is imported in `SequelizeHealthRecordRepository.ts`. Check existing imports — add if missing.

- [ ] **Step 9: Run TypeScript check**

```bash
pnpm build 2>&1 | grep -E "error TS" | head -20
```

Expected: no new errors related to these methods.

- [ ] **Step 10: Commit**

```bash
git add src/domain/pet/PetRepository.ts src/domain/vet/VetRepository.ts src/domain/note/NoteRepository.ts src/domain/health/HealthRecordRepository.ts src/infrastructure/db/repositories/SequelizePetRepository.ts src/infrastructure/db/repositories/SequelizeVetRepository.ts src/infrastructure/db/repositories/SequelizeNoteRepository.ts src/infrastructure/db/repositories/SequelizeHealthRecordRepository.ts
git commit -m "feat(repos): add countByUserId methods for limit enforcement"
```

---

## Task 6: LimitService + tests

**Files:**
- Create: `src/application/limits/LimitService.ts`
- Modify: `tests/application/limits/LimitService.test.ts`

- [ ] **Step 1: Write failing tests**

Replace the stub in `tests/application/limits/LimitService.test.ts`:

```typescript
import 'reflect-metadata';
import { LimitService, EffectiveLimits, LimitsWithUsage } from '../../../src/application/limits/LimitService';
import { UserLimitsRepository } from '../../../src/domain/user/UserLimitsRepository';
import { PetRepository } from '../../../src/domain/pet/PetRepository';
import { VetRepository } from '../../../src/domain/vet/VetRepository';
import { NoteRepository } from '../../../src/domain/note/NoteRepository';
import { HealthRecordRepository } from '../../../src/domain/health/HealthRecordRepository';
import { UserLimits } from '../../../src/domain/user/UserLimits';
import { UniqueEntityId } from '../../../src/domain/shared/UniqueEntityId';
import { ForbiddenError } from '../../../src/shared/errors/AppError';

function makeLimitsRow(overrides: Partial<{
  maxPets: number | null; maxVets: number | null;
  maxMedications: number | null; maxNotes: number | null;
  maxStorageBytes: number | null; storageUsedBytes: number;
  maxPlacesSearchesMonthly: number | null; placesSearchesThisMonth: number;
}> = {}): UserLimits {
  return UserLimits.reconstitute(
    {
      userId: 'u1',
      maxPets: overrides.maxPets ?? null,
      maxVets: overrides.maxVets ?? null,
      maxMedications: overrides.maxMedications ?? null,
      maxNotes: overrides.maxNotes ?? null,
      maxStorageBytes: overrides.maxStorageBytes ?? null,
      storageUsedBytes: overrides.storageUsedBytes ?? 0,
      maxPlacesSearchesMonthly: overrides.maxPlacesSearchesMonthly ?? null,
      placesSearchesThisMonth: overrides.placesSearchesThisMonth ?? 0,
      placesSearchesMonth: new Date(),
      createdAt: new Date(), updatedAt: new Date(),
    },
    new UniqueEntityId('lim-1'),
  );
}

function makeService(limitsRow: UserLimits | null, counts: {
  pets?: number; vets?: number; medications?: number; notes?: number;
} = {}, env: Record<string, string> = {}): LimitService {
  const limitsRepo = {
    findByUserId: jest.fn().mockResolvedValue(limitsRow),
    incrementStorage: jest.fn().mockResolvedValue(undefined),
    decrementStorage: jest.fn().mockResolvedValue(undefined),
    checkAndIncrementPlacesSearch: jest.fn().mockResolvedValue(undefined),
    upsert: jest.fn().mockResolvedValue(undefined),
  } as unknown as UserLimitsRepository;

  const petRepo = { countByUserId: jest.fn().mockResolvedValue(counts.pets ?? 0) } as unknown as PetRepository;
  const vetRepo = { countByUserId: jest.fn().mockResolvedValue(counts.vets ?? 0) } as unknown as VetRepository;
  const noteRepo = { countByUserId: jest.fn().mockResolvedValue(counts.notes ?? 0) } as unknown as NoteRepository;
  const healthRepo = { countMedicationsByUserId: jest.fn().mockResolvedValue(counts.medications ?? 0) } as unknown as HealthRecordRepository;

  Object.entries(env).forEach(([k, v]) => { process.env[k] = v; });

  return new LimitService(limitsRepo, petRepo, vetRepo, noteRepo, healthRepo);
}

describe('LimitService', () => {
  afterEach(() => {
    delete process.env.DEFAULT_MAX_PETS;
    delete process.env.DEFAULT_MAX_VETS;
    delete process.env.DEFAULT_MAX_MEDICATIONS;
    delete process.env.DEFAULT_MAX_NOTES;
    delete process.env.DEFAULT_MAX_STORAGE_BYTES;
    delete process.env.DEFAULT_MAX_PLACES_SEARCHES_MONTHLY;
  });

  describe('checkPetLimit', () => {
    it('allows when under per-user limit', async () => {
      const svc = makeService(makeLimitsRow({ maxPets: 5 }), { pets: 3 });
      await expect(svc.checkPetLimit('u1')).resolves.not.toThrow();
    });

    it('throws ForbiddenError when at per-user limit', async () => {
      const svc = makeService(makeLimitsRow({ maxPets: 5 }), { pets: 5 });
      await expect(svc.checkPetLimit('u1')).rejects.toThrow(ForbiddenError);
    });

    it('falls back to env default when no per-user override', async () => {
      const svc = makeService(null, { pets: 10 }, { DEFAULT_MAX_PETS: '10' });
      await expect(svc.checkPetLimit('u1')).rejects.toThrow(ForbiddenError);
    });

    it('allows when no limit configured and no env default', async () => {
      const svc = makeService(null, { pets: 9999 });
      await expect(svc.checkPetLimit('u1')).resolves.not.toThrow();
    });
  });

  describe('checkStorageLimit', () => {
    it('throws when storageUsed + new bytes exceeds limit', async () => {
      const svc = makeService(makeLimitsRow({ maxStorageBytes: 100, storageUsedBytes: 90 }));
      await expect(svc.checkStorageLimit('u1', 20)).rejects.toThrow(ForbiddenError);
    });

    it('allows when within limit', async () => {
      const svc = makeService(makeLimitsRow({ maxStorageBytes: 100, storageUsedBytes: 50 }));
      await expect(svc.checkStorageLimit('u1', 20)).resolves.not.toThrow();
    });
  });

  describe('getLimitsWithUsage', () => {
    it('returns usage and effective limits', async () => {
      const svc = makeService(
        makeLimitsRow({ maxPets: 5, storageUsedBytes: 1000 }),
        { pets: 3, vets: 1, medications: 0, notes: 2 },
        { DEFAULT_MAX_VETS: '20', DEFAULT_MAX_STORAGE_BYTES: '104857600' },
      );
      const result = await svc.getLimitsWithUsage('u1');
      expect(result.pets).toEqual({ used: 3, max: 5 });
      expect(result.vets).toEqual({ used: 1, max: 20 });
      expect(result.storage).toEqual({ usedBytes: 1000, maxBytes: 104857600 });
    });
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
pnpm test -- --testPathPattern="LimitService" 2>&1 | tail -10
```

Expected: `Cannot find module '../../../src/application/limits/LimitService'`

- [ ] **Step 3: Implement LimitService**

```typescript
// src/application/limits/LimitService.ts
import { Inject, Service } from 'typedi';
import { UserLimitsRepository, USER_LIMITS_REPOSITORY } from '../../domain/user/UserLimitsRepository';
import { PetRepository, PET_REPOSITORY } from '../../domain/pet/PetRepository';
import { VetRepository, VET_REPOSITORY } from '../../domain/vet/VetRepository';
import { NoteRepository, NOTE_REPOSITORY } from '../../domain/note/NoteRepository';
import { HealthRecordRepository, HEALTH_RECORD_REPOSITORY } from '../../domain/health/HealthRecordRepository';
import { ForbiddenError } from '../../shared/errors/AppError';

export interface EffectiveLimits {
  maxPets: number | null;
  maxVets: number | null;
  maxMedications: number | null;
  maxNotes: number | null;
  maxStorageBytes: number | null;
  maxPlacesSearchesMonthly: number | null;
}

export interface LimitsWithUsage {
  pets: { used: number; max: number | null };
  vets: { used: number; max: number | null };
  medications: { used: number; max: number | null };
  notes: { used: number; max: number | null };
  storage: { usedBytes: number; maxBytes: number | null };
  placesSearches: { usedThisMonth: number; max: number | null };
}

@Service()
export class LimitService {
  constructor(
    @Inject(USER_LIMITS_REPOSITORY) private readonly limitsRepo: UserLimitsRepository,
    @Inject(PET_REPOSITORY) private readonly petRepo: PetRepository,
    @Inject(VET_REPOSITORY) private readonly vetRepo: VetRepository,
    @Inject(NOTE_REPOSITORY) private readonly noteRepo: NoteRepository,
    @Inject(HEALTH_RECORD_REPOSITORY) private readonly healthRepo: HealthRecordRepository,
  ) {}

  async resolveEffectiveLimits(userId: string): Promise<EffectiveLimits> {
    const row = await this.limitsRepo.findByUserId(userId);
    const env = (key: string) => process.env[key] ? Number(process.env[key]) : null;
    return {
      maxPets: row?.maxPets ?? env('DEFAULT_MAX_PETS'),
      maxVets: row?.maxVets ?? env('DEFAULT_MAX_VETS'),
      maxMedications: row?.maxMedications ?? env('DEFAULT_MAX_MEDICATIONS'),
      maxNotes: row?.maxNotes ?? env('DEFAULT_MAX_NOTES'),
      maxStorageBytes: row?.maxStorageBytes ?? env('DEFAULT_MAX_STORAGE_BYTES'),
      maxPlacesSearchesMonthly: row?.maxPlacesSearchesMonthly ?? env('DEFAULT_MAX_PLACES_SEARCHES_MONTHLY'),
    };
  }

  async checkPetLimit(userId: string): Promise<void> {
    const { maxPets } = await this.resolveEffectiveLimits(userId);
    if (maxPets === null) return;
    const count = await this.petRepo.countByUserId(userId);
    if (count >= maxPets) throw new ForbiddenError(`Pet limit reached (${maxPets})`);
  }

  async checkVetLimit(userId: string): Promise<void> {
    const { maxVets } = await this.resolveEffectiveLimits(userId);
    if (maxVets === null) return;
    const count = await this.vetRepo.countByUserId(userId);
    if (count >= maxVets) throw new ForbiddenError(`Vet limit reached (${maxVets})`);
  }

  async checkMedicationLimit(userId: string): Promise<void> {
    const { maxMedications } = await this.resolveEffectiveLimits(userId);
    if (maxMedications === null) return;
    const count = await this.healthRepo.countMedicationsByUserId(userId);
    if (count >= maxMedications) throw new ForbiddenError(`Medication limit reached (${maxMedications})`);
  }

  async checkNoteLimit(userId: string): Promise<void> {
    const { maxNotes } = await this.resolveEffectiveLimits(userId);
    if (maxNotes === null) return;
    const count = await this.noteRepo.countByUserId(userId);
    if (count >= maxNotes) throw new ForbiddenError(`Note limit reached (${maxNotes})`);
  }

  async checkStorageLimit(userId: string, newBytes: number): Promise<void> {
    const { maxStorageBytes } = await this.resolveEffectiveLimits(userId);
    if (maxStorageBytes === null) return;
    const row = await this.limitsRepo.findByUserId(userId);
    const usedBytes = row ? row.storageUsedBytes : 0;
    if (usedBytes + newBytes > maxStorageBytes) {
      throw new ForbiddenError(`Storage limit reached (${(maxStorageBytes / 1024 / 1024).toFixed(0)} MB)`);
    }
  }

  async incrementStorage(userId: string, bytes: number): Promise<void> {
    await this.limitsRepo.incrementStorage(userId, bytes);
  }

  async decrementStorage(userId: string, bytes: number): Promise<void> {
    await this.limitsRepo.decrementStorage(userId, bytes);
  }

  async checkAndIncrementPlacesSearch(userId: string): Promise<void> {
    const { maxPlacesSearchesMonthly } = await this.resolveEffectiveLimits(userId);
    if (maxPlacesSearchesMonthly === null) return;
    await this.limitsRepo.checkAndIncrementPlacesSearch(userId, maxPlacesSearchesMonthly);
  }

  async getLimitsWithUsage(userId: string): Promise<LimitsWithUsage> {
    const [limits, row, pets, vets, medications, notes] = await Promise.all([
      this.resolveEffectiveLimits(userId),
      this.limitsRepo.findByUserId(userId),
      this.petRepo.countByUserId(userId),
      this.vetRepo.countByUserId(userId),
      this.healthRepo.countMedicationsByUserId(userId),
      this.noteRepo.countByUserId(userId),
    ]);
    return {
      pets: { used: pets, max: limits.maxPets },
      vets: { used: vets, max: limits.maxVets },
      medications: { used: medications, max: limits.maxMedications },
      notes: { used: notes, max: limits.maxNotes },
      storage: { usedBytes: row?.storageUsedBytes ?? 0, maxBytes: limits.maxStorageBytes },
      placesSearches: {
        usedThisMonth: row?.placesSearchesThisMonth ?? 0,
        max: limits.maxPlacesSearchesMonthly,
      },
    };
  }
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
pnpm test -- --testPathPattern="LimitService" 2>&1 | tail -10
```

Expected: `PASS tests/application/limits/LimitService.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/application/limits/LimitService.ts tests/application/limits/LimitService.test.ts
git commit -m "feat(application): add LimitService with limit checks and storage tracking"
```

---

## Task 7: Auth — JWT role + UserMapper + LoginUseCase

**Files:**
- Modify: `src/infrastructure/http/middleware/authMiddleware.ts`
- Modify: `src/application/auth/LoginUserUseCase.ts`
- Modify: `src/infrastructure/mappers/UserMapper.ts`

- [ ] **Step 1: Add role to AuthPayload**

In `src/infrastructure/http/middleware/authMiddleware.ts`, update `AuthPayload` and `jwt.verify` cast:

```typescript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../../../shared/errors/AppError';
import { UserRole } from '../../../domain/user/UserRole';

export interface AuthPayload {
  userId: string;
  email: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      auth: AuthPayload;
    }
  }
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new UnauthorizedError());
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload;
    req.auth = payload;
    next();
  } catch {
    next(new UnauthorizedError('Invalid or expired token'));
  }
}
```

- [ ] **Step 2: Include role in JWT**

In `src/application/auth/LoginUserUseCase.ts`, update the `jwt.sign` call:

```typescript
    const token = jwt.sign(
      { userId: user.id.toValue(), email: user.email, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: (process.env.JWT_EXPIRES_IN ?? '7d') as any },
    );
```

- [ ] **Step 3: Include role in UserMapper.toResponse**

In `src/infrastructure/mappers/UserMapper.ts`, update `UserResponseDto` and `toResponse`:

```typescript
import { UserRole } from '../../domain/user/UserRole';

export interface UserResponseDto {
  id: string;
  name: string;
  email: string;
  theme: 'light' | 'dark';
  role: UserRole;
  createdAt: string;
}
```

And in `toResponse`:
```typescript
  toResponse(user: User): UserResponseDto {
    return {
      id: user.id.toValue(),
      name: user.name,
      email: user.email,
      theme: user.theme,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
    };
  }
```

Also update `toDomain` to include `role`:
```typescript
  toDomain(model: UserModel): User {
    return User.reconstitute(
      {
        name: model.name,
        email: model.email,
        passwordHash: model.passwordHash,
        theme: model.theme ?? 'light',
        role: (model.role ?? 'user') as any,
        createdAt: model.createdAt,
      },
      new UniqueEntityId(model.id),
    );
  }
```

- [ ] **Step 4: TypeScript check**

```bash
pnpm build 2>&1 | grep "error TS" | head -10
```

Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/http/middleware/authMiddleware.ts src/application/auth/LoginUserUseCase.ts src/infrastructure/mappers/UserMapper.ts
git commit -m "feat(auth): include role in JWT payload and user response"
```

---

## Task 8: requireAdmin middleware + test

**Files:**
- Create: `src/infrastructure/http/middleware/requireAdmin.ts`
- Create: `tests/infrastructure/http/middleware/requireAdmin.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/infrastructure/http/middleware/requireAdmin.test.ts
import 'reflect-metadata';
import { Request, Response, NextFunction } from 'express';
import { requireAdmin } from '../../../../src/infrastructure/http/middleware/requireAdmin';
import { ForbiddenError } from '../../../../src/shared/errors/AppError';

function makeReq(role: string): Request {
  return { auth: { userId: 'u1', email: 'a@b.com', role } } as unknown as Request;
}

describe('requireAdmin', () => {
  it('calls next() for admin users', () => {
    const next = jest.fn() as unknown as NextFunction;
    requireAdmin(makeReq('admin'), {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('calls next(ForbiddenError) for non-admin users', () => {
    const next = jest.fn() as unknown as NextFunction;
    requireAdmin(makeReq('user'), {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });
});
```

- [ ] **Step 2: Run test — expect failure**

```bash
pnpm test -- --testPathPattern="requireAdmin" 2>&1 | tail -5
```

Expected: `Cannot find module '../../../../src/infrastructure/http/middleware/requireAdmin'`

- [ ] **Step 3: Implement requireAdmin**

```typescript
// src/infrastructure/http/middleware/requireAdmin.ts
import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../../../shared/errors/AppError';

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (req.auth?.role !== 'admin') {
    return next(new ForbiddenError('Admin access required'));
  }
  next();
}
```

- [ ] **Step 4: Run test — expect pass**

```bash
pnpm test -- --testPathPattern="requireAdmin" 2>&1 | tail -5
```

Expected: `PASS`

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/http/middleware/requireAdmin.ts tests/infrastructure/http/middleware/requireAdmin.test.ts
git commit -m "feat(middleware): add requireAdmin middleware"
```

---

## Task 9: UserRepository + SequelizeUserRepository — admin methods

**Files:**
- Modify: `src/domain/user/UserRepository.ts`
- Modify: `src/infrastructure/db/repositories/SequelizeUserRepository.ts`

- [ ] **Step 1: Add findAllPaginated + deleteById to UserRepository interface**

```typescript
import { User, ThemeMode } from './User';
import { UserRole } from './UserRole';
import { PaginationParams, PaginatedResult } from '../../shared/types/Pagination';

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByIds(ids: string[]): Promise<User[]>;
  findByEmail(email: string): Promise<User | null>;
  save(user: User): Promise<void>;
  updateTheme(userId: string, theme: ThemeMode): Promise<void>;
  updateRole(userId: string, role: UserRole): Promise<void>;
  findAllPaginated(pagination: PaginationParams): Promise<PaginatedResult<User>>;
  deleteById(userId: string): Promise<void>;
}

export const USER_REPOSITORY = 'UserRepository';
```

- [ ] **Step 2: Implement in SequelizeUserRepository**

Add the two new methods:

```typescript
  async updateRole(userId: string, role: UserRole): Promise<void> {
    await UserModel.update({ role }, { where: { id: userId } });
  }

  async findAllPaginated({ page, limit }: PaginationParams): Promise<PaginatedResult<User>> {
    const { count, rows } = await UserModel.findAndCountAll({
      limit,
      offset: (page - 1) * limit,
      order: [['created_at', 'ASC']],
    });
    return {
      items: rows.map((m) => this.mapper.toDomain(m)),
      total: count,
      nextPage: (page - 1) * limit + rows.length < count ? page + 1 : null,
    };
  }

  async deleteById(userId: string): Promise<void> {
    await UserModel.destroy({ where: { id: userId } });
  }
```

Add `import { UserRole } from '../../../domain/user/UserRole';` if not already present.

> **Cascade note:** `UserModel.destroy` will cascade to related tables only if foreign keys are defined with `ON DELETE CASCADE`. The project uses Sequelize `sync({ alter: true })` which does not add cascade constraints by default. Verify that `PetModel`, `UserLimitsModel`, and other FK-referencing models have `{ onDelete: 'CASCADE' }` on their `@ForeignKey` columns. If missing, add it and let `sync({ alter: true })` update the schema on next startup.

- [ ] **Step 3: Commit**

```bash
git add src/domain/user/UserRepository.ts src/infrastructure/db/repositories/SequelizeUserRepository.ts
git commit -m "feat(repos): add admin methods to UserRepository"
```

---

## Task 10: AdminStatsRepository

**Files:**
- Create: `src/domain/admin/AdminStatsRepository.ts`
- Create: `src/infrastructure/db/repositories/SequelizeAdminStatsRepository.ts`

- [ ] **Step 1: Create AdminStatsRepository interface**

```typescript
// src/domain/admin/AdminStatsRepository.ts
export interface AdminUserStats {
  pets: number;
  vets: number;
  vetVisits: number;
  medications: number;
  symptoms: number;
  healthChecks: number;
  notes: number;
  photos: number;
  reminders: number;
  storageUsedBytes: number;
  placesSearchesThisMonth: number;
}

export interface AdminStatsRepository {
  getUserStats(userId: string): Promise<AdminUserStats>;
}

export const ADMIN_STATS_REPOSITORY = 'AdminStatsRepository';
```

- [ ] **Step 2: Create SequelizeAdminStatsRepository**

First check which models exist for symptoms, health checks, reminders:
```bash
ls /Users/latzko/projects/pet-health-tracker-api/src/infrastructure/db/models/
```

Then implement (adjust model names if different):

```typescript
// src/infrastructure/db/repositories/SequelizeAdminStatsRepository.ts
import { Service } from 'typedi';
import { AdminStatsRepository, AdminUserStats } from '../../../domain/admin/AdminStatsRepository';
import { PetModel } from '../models/PetModel';
import { VetModel } from '../models/VetModel';
import { VetVisitModel } from '../models/VetVisitModel';
import { MedicationModel } from '../models/MedicationModel';
import { SymptomModel } from '../models/SymptomModel';
import { HealthCheckModel } from '../models/HealthCheckModel';
import { NoteModel } from '../models/NoteModel';
import { PhotoModel } from '../models/PhotoModel';
import { ReminderModel } from '../models/ReminderModel';
import { UserLimitsModel } from '../models/UserLimitsModel';

@Service()
export class SequelizeAdminStatsRepository implements AdminStatsRepository {
  async getUserStats(userId: string): Promise<AdminUserStats> {
    const [pets, vets, notes, photos, limitsRow] = await Promise.all([
      PetModel.count({ where: { userId } }),
      VetModel.count({ where: { userId } }),
      NoteModel.count({ where: { userId } }),
      PhotoModel.count({ where: { ownerId: userId } }),
      UserLimitsModel.findOne({ where: { userId } }),
    ]);

    // Counts through pet join
    const petIds = (await PetModel.findAll({ where: { userId }, attributes: ['id'] })).map(p => p.id);

    const [vetVisits, medications, symptoms, healthChecks] = petIds.length > 0
      ? await Promise.all([
          VetVisitModel.count({ where: { petId: petIds } }),
          MedicationModel.count({ where: { petId: petIds } }),
          SymptomModel.count({ where: { petId: petIds } }),
          HealthCheckModel.count({ where: { petId: petIds } }),
        ])
      : [0, 0, 0, 0];

    const reminders = await ReminderModel.count({ where: { createdBy: userId } });

    return {
      pets, vets, vetVisits, medications, symptoms, healthChecks,
      notes, photos, reminders,
      storageUsedBytes: limitsRow ? Number(limitsRow.storageUsedBytes) : 0,
      placesSearchesThisMonth: limitsRow?.placesSearchesThisMonth ?? 0,
    };
  }
}
```

> **Note:** If `SymptomModel` or `HealthCheckModel` have `petId` under a different field name, check the model definitions and adjust `where` clauses accordingly.

- [ ] **Step 3: Commit**

```bash
git add src/domain/admin/AdminStatsRepository.ts src/infrastructure/db/repositories/SequelizeAdminStatsRepository.ts
git commit -m "feat(infra): add AdminStatsRepository for user stats aggregation"
```

---

## Task 11: Admin use cases

**Files:**
- Create: `src/application/admin/ListUsersUseCase.ts`
- Create: `src/application/admin/GetUserStatsUseCase.ts`
- Create: `src/application/admin/UpdateUserRoleUseCase.ts`
- Create: `src/application/admin/UpsertUserLimitsUseCase.ts`
- Create: `src/application/admin/DeleteUserUseCase.ts`
- Create: `tests/application/admin/UpdateUserRoleUseCase.test.ts`

- [ ] **Step 1: Write failing test for UpdateUserRoleUseCase**

```typescript
// tests/application/admin/UpdateUserRoleUseCase.test.ts
import 'reflect-metadata';
import { UpdateUserRoleUseCase } from '../../../src/application/admin/UpdateUserRoleUseCase';
import { UserRepository } from '../../../src/domain/user/UserRepository';
import { NotFoundError, ForbiddenError } from '../../../src/shared/errors/AppError';
import { User } from '../../../src/domain/user/User';
import { UniqueEntityId } from '../../../src/domain/shared/UniqueEntityId';

function makeUser(id: string, role: 'user' | 'admin' = 'user'): User {
  return User.reconstitute(
    { name: 'Test', email: 'test@test.com', passwordHash: 'hash', theme: 'light', role, createdAt: new Date() },
    new UniqueEntityId(id),
  );
}

function makeUseCase(user: User | null): UpdateUserRoleUseCase {
  const repo = {
    findById: jest.fn().mockResolvedValue(user),
    updateRole: jest.fn().mockResolvedValue(undefined),
  } as unknown as UserRepository;
  return new UpdateUserRoleUseCase(repo);
}

describe('UpdateUserRoleUseCase', () => {
  it('throws NotFoundError when user not found', async () => {
    const uc = makeUseCase(null);
    await expect(uc.execute({ targetUserId: 'u1', role: 'admin', requestingUserId: 'admin1' }))
      .rejects.toThrow(NotFoundError);
  });

  it('throws ForbiddenError when trying to change own role', async () => {
    const admin = makeUser('admin1', 'admin');
    const uc = makeUseCase(admin);
    await expect(uc.execute({ targetUserId: 'admin1', role: 'user', requestingUserId: 'admin1' }))
      .rejects.toThrow(ForbiddenError);
  });

  it('updates role successfully', async () => {
    const user = makeUser('u1');
    const repo = {
      findById: jest.fn().mockResolvedValue(user),
      updateRole: jest.fn().mockResolvedValue(undefined),
    } as unknown as UserRepository;
    const uc = new UpdateUserRoleUseCase(repo);
    await expect(uc.execute({ targetUserId: 'u1', role: 'admin', requestingUserId: 'admin1' }))
      .resolves.not.toThrow();
    expect(repo.updateRole).toHaveBeenCalledWith('u1', 'admin');
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
pnpm test -- --testPathPattern="UpdateUserRoleUseCase" 2>&1 | tail -5
```

- [ ] **Step 3: Implement all admin use cases**

```typescript
// src/application/admin/ListUsersUseCase.ts
import { Inject, Service } from 'typedi';
import { UserRepository, USER_REPOSITORY } from '../../domain/user/UserRepository';
import { AdminStatsRepository, ADMIN_STATS_REPOSITORY } from '../../domain/admin/AdminStatsRepository';
import { UserMapper } from '../../infrastructure/mappers/UserMapper';
import { PaginationParams } from '../../shared/types/Pagination';

@Service()
export class ListUsersUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(ADMIN_STATS_REPOSITORY) private readonly statsRepo: AdminStatsRepository,
    private readonly userMapper: UserMapper,
  ) {}

  async execute(pagination: PaginationParams) {
    const result = await this.userRepo.findAllPaginated(pagination);
    const statsAll = await Promise.all(result.items.map(u => this.statsRepo.getUserStats(u.id.toValue())));
    return {
      ...result,
      items: result.items.map((u, i) => ({ ...this.userMapper.toResponse(u), stats: statsAll[i] })),
    };
  }
}
```

```typescript
// src/application/admin/GetUserStatsUseCase.ts
import { Inject, Service } from 'typedi';
import { UserRepository, USER_REPOSITORY } from '../../domain/user/UserRepository';
import { AdminStatsRepository, ADMIN_STATS_REPOSITORY } from '../../domain/admin/AdminStatsRepository';
import { UserLimitsRepository, USER_LIMITS_REPOSITORY } from '../../domain/user/UserLimitsRepository';
import { UserMapper } from '../../infrastructure/mappers/UserMapper';
import { NotFoundError } from '../../shared/errors/AppError';

@Service()
export class GetUserStatsUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(ADMIN_STATS_REPOSITORY) private readonly statsRepo: AdminStatsRepository,
    @Inject(USER_LIMITS_REPOSITORY) private readonly limitsRepo: UserLimitsRepository,
    private readonly userMapper: UserMapper,
  ) {}

  async execute(userId: string) {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundError('User');
    const [stats, limits] = await Promise.all([
      this.statsRepo.getUserStats(userId),
      this.limitsRepo.findByUserId(userId),
    ]);
    return { ...this.userMapper.toResponse(user), stats, limits: limits ?? null };
  }
}
```

```typescript
// src/application/admin/UpdateUserRoleUseCase.ts
import { Inject, Service } from 'typedi';
import { UserRepository, USER_REPOSITORY } from '../../domain/user/UserRepository';
import { UserRole } from '../../domain/user/UserRole';
import { NotFoundError, ForbiddenError } from '../../shared/errors/AppError';

interface UpdateUserRoleInput {
  targetUserId: string;
  role: UserRole;
  requestingUserId: string;
}

@Service()
export class UpdateUserRoleUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly userRepo: UserRepository) {}

  async execute(input: UpdateUserRoleInput): Promise<void> {
    if (input.targetUserId === input.requestingUserId) {
      throw new ForbiddenError('Cannot change your own role');
    }
    const user = await this.userRepo.findById(input.targetUserId);
    if (!user) throw new NotFoundError('User');
    await this.userRepo.updateRole(input.targetUserId, input.role);
  }
}
```

```typescript
// src/application/admin/UpsertUserLimitsUseCase.ts
import { Inject, Service } from 'typedi';
import { UserRepository, USER_REPOSITORY } from '../../domain/user/UserRepository';
import { UserLimitsRepository, USER_LIMITS_REPOSITORY } from '../../domain/user/UserLimitsRepository';
import { UserLimitsProps } from '../../domain/user/UserLimits';
import { NotFoundError } from '../../shared/errors/AppError';

type LimitOverrides = Partial<Pick<UserLimitsProps,
  'maxPets' | 'maxVets' | 'maxMedications' | 'maxNotes' |
  'maxStorageBytes' | 'maxPlacesSearchesMonthly'>>;

interface UpsertUserLimitsInput {
  targetUserId: string;
  limits: LimitOverrides;
}

@Service()
export class UpsertUserLimitsUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(USER_LIMITS_REPOSITORY) private readonly limitsRepo: UserLimitsRepository,
  ) {}

  async execute(input: UpsertUserLimitsInput): Promise<void> {
    const user = await this.userRepo.findById(input.targetUserId);
    if (!user) throw new NotFoundError('User');
    await this.limitsRepo.upsert(input.targetUserId, input.limits);
  }
}
```

```typescript
// src/application/admin/DeleteUserUseCase.ts
import { Inject, Service } from 'typedi';
import { UserRepository, USER_REPOSITORY } from '../../domain/user/UserRepository';
import { NotFoundError, ForbiddenError } from '../../shared/errors/AppError';

interface DeleteUserInput {
  targetUserId: string;
  requestingUserId: string;
}

@Service()
export class DeleteUserUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly userRepo: UserRepository) {}

  async execute(input: DeleteUserInput): Promise<void> {
    if (input.targetUserId === input.requestingUserId) {
      throw new ForbiddenError('Cannot delete your own account');
    }
    const user = await this.userRepo.findById(input.targetUserId);
    if (!user) throw new NotFoundError('User');
    await this.userRepo.deleteById(input.targetUserId);
  }
}
```

- [ ] **Step 4: Run test — expect pass**

```bash
pnpm test -- --testPathPattern="UpdateUserRoleUseCase" 2>&1 | tail -5
```

Expected: `PASS`

- [ ] **Step 5: Commit**

```bash
git add src/application/admin/ tests/application/admin/
git commit -m "feat(application): add admin use cases (list, stats, role, limits, delete)"
```

---

## Task 12: AdminController + schemas

**Files:**
- Create: `src/infrastructure/http/schemas/adminSchemas.ts`
- Create: `src/infrastructure/http/controllers/AdminController.ts`

- [ ] **Step 1: Create admin Zod schemas**

```typescript
// src/infrastructure/http/schemas/adminSchemas.ts
import { z } from 'zod';

export const UpdateUserRoleSchema = z.object({
  role: z.enum(['user', 'admin']),
});
export type UpdateUserRoleBody = z.infer<typeof UpdateUserRoleSchema>;

export const UpsertUserLimitsSchema = z.object({
  maxPets: z.number().int().positive().nullable().optional(),
  maxVets: z.number().int().positive().nullable().optional(),
  maxMedications: z.number().int().positive().nullable().optional(),
  maxNotes: z.number().int().positive().nullable().optional(),
  maxStorageBytes: z.number().int().positive().nullable().optional(),
  maxPlacesSearchesMonthly: z.number().int().positive().nullable().optional(),
});
export type UpsertUserLimitsBody = z.infer<typeof UpsertUserLimitsSchema>;
```

- [ ] **Step 2: Create AdminController**

```typescript
// src/infrastructure/http/controllers/AdminController.ts
import {
  JsonController, Get, Patch, Put, Delete,
  Param, Body, QueryParams, UseBefore, CurrentUser, OnUndefined, HttpCode,
} from 'routing-controllers';
import { Service } from 'typedi';
import { authMiddleware, AuthPayload } from '../middleware/authMiddleware';
import { requireAdmin } from '../middleware/requireAdmin';
import { Validate } from '../decorators/Validate';
import { ListUsersUseCase } from '../../../application/admin/ListUsersUseCase';
import { GetUserStatsUseCase } from '../../../application/admin/GetUserStatsUseCase';
import { UpdateUserRoleUseCase } from '../../../application/admin/UpdateUserRoleUseCase';
import { UpsertUserLimitsUseCase } from '../../../application/admin/UpsertUserLimitsUseCase';
import { DeleteUserUseCase } from '../../../application/admin/DeleteUserUseCase';
import { UpdateUserRoleSchema, UpdateUserRoleBody, UpsertUserLimitsSchema, UpsertUserLimitsBody } from '../schemas/adminSchemas';
import { PaginationQuerySchema, PaginationQuery } from '../schemas/petSchemas';

@JsonController('/admin')
@Service()
@UseBefore(authMiddleware, requireAdmin)
export class AdminController {
  constructor(
    private readonly listUsers: ListUsersUseCase,
    private readonly getUserStats: GetUserStatsUseCase,
    private readonly updateRole: UpdateUserRoleUseCase,
    private readonly upsertLimits: UpsertUserLimitsUseCase,
    private readonly deleteUser: DeleteUserUseCase,
  ) {}

  @Get('/users')
  @Validate({ query: PaginationQuerySchema })
  async list(@QueryParams() query: PaginationQuery) {
    return this.listUsers.execute(query);
  }

  @Get('/users/:userId')
  async getUser(@Param('userId') userId: string) {
    return this.getUserStats.execute(userId);
  }

  @Patch('/users/:userId/role')
  @Validate({ body: UpdateUserRoleSchema })
  async setRole(
    @Param('userId') userId: string,
    @Body() body: UpdateUserRoleBody,
    @CurrentUser() user: AuthPayload,
  ) {
    await this.updateRole.execute({ targetUserId: userId, role: body.role, requestingUserId: user.userId });
    return { success: true };
  }

  @Put('/users/:userId/limits')
  @Validate({ body: UpsertUserLimitsSchema })
  async setLimits(@Param('userId') userId: string, @Body() body: UpsertUserLimitsBody) {
    await this.upsertLimits.execute({ targetUserId: userId, limits: body });
    return { success: true };
  }

  @Delete('/users/:userId')
  @OnUndefined(204)
  async delete(@Param('userId') userId: string, @CurrentUser() user: AuthPayload) {
    await this.deleteUser.execute({ targetUserId: userId, requestingUserId: user.userId });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/http/schemas/adminSchemas.ts src/infrastructure/http/controllers/AdminController.ts
git commit -m "feat(http): add AdminController with user management routes"
```

---

## Task 13: GET /users/me/limits endpoint

**Files:**
- Modify: `src/infrastructure/http/controllers/UserController.ts`

- [ ] **Step 1: Add limits endpoint to UserController**

Add `LimitService` injection and new route:

```typescript
import { JsonController, Get, Patch, Body, UseBefore, CurrentUser } from 'routing-controllers';
import { Service, Inject } from 'typedi';
import { UserRepository, USER_REPOSITORY } from '../../../domain/user/UserRepository';
import { UserMapper } from '../../mappers/UserMapper';
import { LimitService } from '../../../application/limits/LimitService';
import { NotFoundError } from '../../../shared/errors/AppError';
import { authMiddleware, AuthPayload } from '../middleware/authMiddleware';
import { Validate } from '../decorators/Validate';
import { UpdateThemeSchema, UpdateThemeBody } from '../schemas/userSchemas';

@JsonController('/users')
@Service()
@UseBefore(authMiddleware)
export class UserController {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    private readonly userMapper: UserMapper,
    private readonly limitService: LimitService,
  ) {}

  @Get('/me')
  async getMe(@CurrentUser() user: AuthPayload) {
    const found = await this.userRepo.findById(user.userId);
    if (!found) throw new NotFoundError('User');
    return this.userMapper.toResponse(found);
  }

  @Get('/me/limits')
  async getMyLimits(@CurrentUser() user: AuthPayload) {
    return this.limitService.getLimitsWithUsage(user.userId);
  }

  @Patch('/me')
  @Validate({ body: UpdateThemeSchema })
  async updateTheme(@Body() body: UpdateThemeBody, @CurrentUser() user: AuthPayload) {
    await this.userRepo.updateTheme(user.userId, body.theme);
    return { theme: body.theme };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/infrastructure/http/controllers/UserController.ts
git commit -m "feat(http): add GET /users/me/limits endpoint"
```

---

## Task 14: Limit enforcement in use cases

**Files:**
- Modify: `src/application/pet/AddPetUseCase.ts`
- Modify: `src/application/vet/CreateVetUseCase.ts`
- Modify: `src/application/note/CreateNoteUseCase.ts`
- Modify: `src/application/health/LogMedicationUseCase.ts`

- [ ] **Step 1: AddPetUseCase — check pet limit**

Add `LimitService` injection and call before saving:

```typescript
import { Inject, Service } from 'typedi';
import { PetRepository, PET_REPOSITORY } from '../../domain/pet/PetRepository';
import { Pet } from '../../domain/pet/Pet';
import type { PetSpecies } from '../../domain/pet/PetSpecies';
import { LimitService } from '../limits/LimitService';

interface AddPetInput {
  name: string;
  species: PetSpecies;
  breed?: string;
  birthDate?: Date;
  requestingUserId: string;
}

@Service()
export class AddPetUseCase {
  constructor(
    @Inject(PET_REPOSITORY) private readonly petRepository: PetRepository,
    private readonly limitService: LimitService,
  ) {}

  async execute(input: AddPetInput): Promise<Pet> {
    await this.limitService.checkPetLimit(input.requestingUserId);

    const pet = Pet.create({
      name: input.name,
      species: input.species,
      breed: input.breed,
      birthDate: input.birthDate,
      userId: input.requestingUserId,
    });

    await this.petRepository.save(pet);
    return pet;
  }
}
```

- [ ] **Step 2: CreateVetUseCase — check vet limit**

Add `LimitService` injection and call before saving:

```typescript
import { Inject, Service } from 'typedi';
import { VetRepository, VET_REPOSITORY } from '../../domain/vet/VetRepository';
import { Vet, VetWorkHoursProps } from '../../domain/vet/Vet';
import { LimitService } from '../limits/LimitService';

// ... (keep existing interface unchanged)

@Service()
export class CreateVetUseCase {
  constructor(
    @Inject(VET_REPOSITORY) private readonly vetRepository: VetRepository,
    private readonly limitService: LimitService,
  ) {}

  async execute(input: CreateVetInput): Promise<Vet> {
    await this.limitService.checkVetLimit(input.requestingUserId);

    const vet = Vet.create({
      userId: input.requestingUserId,
      name: input.name,
      address: input.address,
      phone: input.phone,
      workHours: input.workHours,
      googleMapsUrl: input.googleMapsUrl,
      rating: input.rating,
      placeId: input.placeId,
      notes: input.notes,
    });

    await this.vetRepository.save(vet);
    return vet;
  }
}
```

- [ ] **Step 3: CreateNoteUseCase — check note limit**

In `src/application/note/CreateNoteUseCase.ts`, add `LimitService` to imports and constructor:

```typescript
import { LimitService } from '../limits/LimitService';

@Service()
export class CreateNoteUseCase {
  constructor(
    @Inject(NOTE_REPOSITORY) private readonly noteRepository: NoteRepository,
    private readonly noteMapper: NoteMapper,
    private readonly petAccessService: PetAccessService,
    private readonly limitService: LimitService,
  ) {}

  async execute(input: CreateNoteInput): Promise<NoteResponseDto> {
    await this.limitService.checkNoteLimit(input.userId);

    for (const petId of input.petIds ?? []) {
      await this.petAccessService.assertCanAccess(petId, input.userId, 'edit_notes');
    }

    const note = Note.create({
      userId: input.userId,
      title: input.title,
      description: input.description,
      noteDate: input.noteDate,
      petIds: input.petIds ?? [],
    });

    const saved = await this.noteRepository.save(note);
    return this.noteMapper.toResponse(saved);
  }
}
```

- [ ] **Step 4: LogMedicationUseCase — check medication limit**

In `src/application/health/LogMedicationUseCase.ts`, add `LimitService` to imports and constructor:

```typescript
import { LimitService } from '../limits/LimitService';

@Service()
export class LogMedicationUseCase {
  constructor(
    @Inject(HEALTH_RECORD_REPOSITORY) private readonly healthRepo: HealthRecordRepository,
    private readonly petAccessService: PetAccessService,
    @Inject(REMINDER_REPOSITORY) private readonly reminderRepo: ReminderRepository,
    private readonly reminderScheduler: ReminderSchedulerService,
    private readonly limitService: LimitService,
  ) {}

  async execute(input: LogMedicationInput): Promise<Medication> {
    if (!input.name?.trim()) throw new ValidationError('Medication name is required');
    if (input.dosageAmount == null || isNaN(input.dosageAmount)) throw new ValidationError('Dosage amount is required');
    if (!input.dosageUnit?.trim()) throw new ValidationError('Dosage unit is required');
    if (!input.schedule) throw new ValidationError('Schedule is required');
    if (!input.startDate) throw new ValidationError('Start date is required');

    const pet = await this.petAccessService.assertCanAccess(input.petId, input.requestingUserId, 'edit_medications');
    await this.limitService.checkMedicationLimit(input.requestingUserId);

    // ... rest of the existing execute body unchanged (schedule, medication.create, healthRepo.saveMedication, reminder logic)
  }
}
```

Keep the rest of `execute` identical to the current file. Only add the `checkMedicationLimit` call after `assertCanAccess`.

- [ ] **Step 5: TypeScript check**

```bash
pnpm build 2>&1 | grep "error TS" | head -10
```

- [ ] **Step 6: Commit**

```bash
git add src/application/pet/AddPetUseCase.ts src/application/vet/CreateVetUseCase.ts src/application/note/CreateNoteUseCase.ts src/application/health/LogMedicationUseCase.ts
git commit -m "feat(application): enforce resource limits in use cases"
```

---

## Task 15: Storage limit enforcement in photo uploads

**Files:**
- Modify: `src/application/photo/UploadStandalonePhotoUseCase.ts`
- Modify: `src/application/photo/AttachPhotoToVisitUseCase.ts`
- Modify: `src/application/photo/AttachPhotoToNoteUseCase.ts`
- Modify: `src/application/photo/AttachPhotoToWeightEntryUseCase.ts`
- Modify: `src/application/photo/DeletePhotoUseCase.ts`
- Modify: `src/infrastructure/http/controllers/PetController.ts`

- [ ] **Step 1: UploadStandalonePhotoUseCase — check + track storage**

Add `LimitService` to constructor. Before `r2.upload`, call `await this.limitService.checkStorageLimit(input.userId, input.buffer.length)`. After `repo.save`, call `await this.limitService.incrementStorage(input.userId, input.buffer.length)`.

Also pass `sizeBytes: input.buffer.length` when calling `Photo.create` (the `Photo` entity will need this field — check `src/domain/photo/Photo.ts` and add if missing).

Since `Photo.create` persists `sizeBytes` through `PhotoMapper.toPersistence`, the DB row stores the size. This allows `DeletePhotoUseCase` to decrement correctly.

- [ ] **Step 2: Check Photo domain entity for sizeBytes field**

```bash
grep -n "sizeBytes\|size_bytes" /Users/latzko/projects/pet-health-tracker-api/src/domain/photo/Photo.ts
```

If `sizeBytes` is not present in the `Photo` entity, add it to `PhotoProps` and expose a `sizeBytes` getter:
```typescript
// in PhotoProps
sizeBytes: number;
// getter
get sizeBytes(): number { return this.props.sizeBytes; }
```

Update `Photo.create` to accept `sizeBytes?: number` (default 0) and `Photo.reconstitute` to pass it through.

Update `PhotoMapper.toDomain` to map `model.sizeBytes`, `toPersistence` to include `sizeBytes`, and `toResponse` to optionally include it.

- [ ] **Step 3: AttachPhotoToVisitUseCase — check + track storage**

In `src/application/photo/AttachPhotoToVisitUseCase.ts`, add `LimitService` to constructor:

```typescript
import { LimitService } from '../limits/LimitService';

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
      sourceId: visit.id.toValue(),
      sizeBytes: input.buffer.length,
    }, new UniqueEntityId());
    const saved = await this.repo.save(photo);
    await this.limitService.incrementStorage(input.userId, input.buffer.length);
    const url = await this.r2.getSignedUrl(saved.s3Key);
    return this.mapper.toResponse(saved, url);
  }
}
```

- [ ] **Step 4: AttachPhotoToNoteUseCase — check + track storage**

In `src/application/photo/AttachPhotoToNoteUseCase.ts`, read the existing file to understand the full constructor and execute body, then add `LimitService` the same way:
- Add `private readonly limitService: LimitService` to constructor
- Call `await this.limitService.checkStorageLimit(input.userId, input.buffer.length)` before `r2.upload`
- Pass `sizeBytes: input.buffer.length` in `Photo.create`
- Call `await this.limitService.incrementStorage(input.userId, input.buffer.length)` after `repo.save`

- [ ] **Step 5: AttachPhotoToWeightEntryUseCase — check + track storage**

In `src/application/photo/AttachPhotoToWeightEntryUseCase.ts`, read the existing file, then apply the same four changes as Step 4.

- [ ] **Step 6: DeletePhotoUseCase — decrement storage**

Add `LimitService` injection. After `r2.delete` and `repo.delete`, call:
```typescript
await this.limitService.decrementStorage(input.userId, photo.sizeBytes);
```

The `photo` entity is already loaded (`findById`), so `photo.sizeBytes` is available.

- [ ] **Step 7: PetController.uploadPhoto — check + track storage**

In `PetController`, inject `LimitService`. In `uploadPhoto` handler, after checking `req.file`:

```typescript
await this.limitService.checkStorageLimit(user.userId, req.file.buffer.length);
// ... existing upload logic ...
await this.limitService.incrementStorage(user.userId, req.file.buffer.length);
```

Pet photos don't have a `Photo` record, so only the running counter in `user_limits` tracks them.

- [ ] **Step 8: TypeScript check**

```bash
pnpm build 2>&1 | grep "error TS" | head -10
```

- [ ] **Step 9: Commit**

```bash
git add src/application/photo/ src/infrastructure/http/controllers/PetController.ts src/domain/photo/Photo.ts src/infrastructure/mappers/PhotoMapper.ts
git commit -m "feat(photos): enforce storage limits and track usage on uploads/deletes"
```

---

## Task 16: Places search limit enforcement

**Files:**
- Modify: `src/infrastructure/http/controllers/PlacesController.ts`

- [ ] **Step 1: Inject LimitService and check on search**

```typescript
import { JsonController, Get, QueryParams, UseBefore, CurrentUser } from 'routing-controllers';
import { Service } from 'typedi';
import { GooglePlacesClient } from '../../external/GooglePlacesClient';
import { LimitService } from '../../../application/limits/LimitService';
import { authMiddleware, AuthPayload } from '../middleware/authMiddleware';
import { Validate } from '../decorators/Validate';
import {
  PlacesSearchQuerySchema, PlacesSearchQuery,
  PlacesDetailsQuerySchema, PlacesDetailsQuery,
} from '../schemas/placesSchemas';

@JsonController('/places')
@Service()
@UseBefore(authMiddleware)
export class PlacesController {
  constructor(
    private readonly placesClient: GooglePlacesClient,
    private readonly limitService: LimitService,
  ) {}

  @Get('/search')
  @Validate({ query: PlacesSearchQuerySchema })
  async search(@QueryParams() query: PlacesSearchQuery, @CurrentUser() user: AuthPayload) {
    await this.limitService.checkAndIncrementPlacesSearch(user.userId);
    return this.placesClient.search(query.q);
  }

  @Get('/details')
  @Validate({ query: PlacesDetailsQuerySchema })
  async details(@QueryParams() query: PlacesDetailsQuery) {
    return this.placesClient.details(query.placeId);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/infrastructure/http/controllers/PlacesController.ts
git commit -m "feat(http): enforce monthly Places search limit"
```

---

## Task 17: container.ts registration

**Files:**
- Modify: `src/container.ts`

- [ ] **Step 1: Register new repositories**

```typescript
import { SequelizeUserLimitsRepository } from './infrastructure/db/repositories/SequelizeUserLimitsRepository';
import { SequelizeAdminStatsRepository } from './infrastructure/db/repositories/SequelizeAdminStatsRepository';
import { USER_LIMITS_REPOSITORY } from './domain/user/UserLimitsRepository';
import { ADMIN_STATS_REPOSITORY } from './domain/admin/AdminStatsRepository';

// inside registerDependencies():
Container.set(USER_LIMITS_REPOSITORY, Container.get(SequelizeUserLimitsRepository));
Container.set(ADMIN_STATS_REPOSITORY, Container.get(SequelizeAdminStatsRepository));
```

- [ ] **Step 2: Verify all tests pass**

```bash
pnpm test 2>&1 | tail -15
```

Expected: all test suites pass.

- [ ] **Step 3: TypeScript full build**

```bash
pnpm build 2>&1 | grep "error TS" | head -20
```

Expected: zero errors.

- [ ] **Step 4: Final commit**

```bash
git add src/container.ts
git commit -m "feat(di): register UserLimitsRepository and AdminStatsRepository"
```

---

## Done

All tasks complete when:
- `pnpm test` passes with no failures
- `pnpm build` produces zero TypeScript errors
- `GET /api/v1/users/me/limits` returns usage + limits
- `GET /api/v1/admin/users` returns paginated user list with stats (requires admin JWT)
- Creating a pet/vet/note/medication throws 403 when at limit
- Uploading photos throws 403 when over storage limit
- Searching Places throws 403 when monthly limit exceeded
