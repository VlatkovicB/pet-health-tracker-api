# Weight & Growth Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-pet weight entry logging with a Recharts line chart and log list, integrated as a new "Weight" tab on the pet health dashboard.

**Architecture:** New `weight` DDD subdomain following the exact Note feature pattern: domain entity → repository interface → 4 use cases → Sequelize model + repository → mapper → Zod-validated routing-controllers controller → React Query hooks → WeightChart + WeightEntryDialog + WeightSection components added as a tab in `PetDetailPage`.

**Tech Stack:** TypeScript, Express, routing-controllers, typedi, sequelize-typescript (PostgreSQL, `sync({alter:true})`), Zod; React, TanStack Query, MUI v9, Recharts

---

## File Map

### API (`pet-health-tracker-api`)

| Action | File |
|---|---|
| Create | `src/domain/weight/WeightEntry.ts` |
| Create | `src/domain/weight/WeightEntryRepository.ts` |
| Create | `src/infrastructure/mappers/WeightEntryMapper.ts` |
| Create | `src/application/weight/AddWeightEntryUseCase.ts` |
| Create | `src/application/weight/ListWeightEntriesUseCase.ts` |
| Create | `src/application/weight/UpdateWeightEntryUseCase.ts` |
| Create | `src/application/weight/DeleteWeightEntryUseCase.ts` |
| Create | `src/infrastructure/db/models/WeightEntryModel.ts` |
| Create | `src/infrastructure/db/repositories/SequelizeWeightEntryRepository.ts` |
| Create | `src/infrastructure/http/schemas/weightSchemas.ts` |
| Create | `src/infrastructure/http/controllers/WeightController.ts` |
| Modify | `src/infrastructure/db/database.ts` — register `WeightEntryModel` |
| Modify | `src/container.ts` — bind `WEIGHT_ENTRY_REPOSITORY` |
| Modify | `src/app.ts` — add `WeightController` to controllers array |
| Create | `tests/application/weight/AddWeightEntryUseCase.test.ts` |
| Create | `tests/application/weight/ListWeightEntriesUseCase.test.ts` |
| Create | `tests/application/weight/UpdateWeightEntryUseCase.test.ts` |
| Create | `tests/application/weight/DeleteWeightEntryUseCase.test.ts` |

### Client (`pet-health-tracker-client`)

| Action | File |
|---|---|
| Modify | `src/types/index.ts` — add `WeightEntry`, `CreateWeightEntryDto`, `UpdateWeightEntryDto` |
| Create | `src/api/weight.ts` |
| Create | `src/components/WeightChart.tsx` |
| Create | `src/components/WeightEntryDialog.tsx` |
| Create | `src/components/WeightSection.tsx` |
| Modify | `src/pages/health/PetDetailPage.tsx` — add weight tab |

---

## Task 1: Domain Entity and Repository Interface

**Files:**
- Create: `src/domain/weight/WeightEntry.ts`
- Create: `src/domain/weight/WeightEntryRepository.ts`

- [ ] **Step 1: Create the WeightEntry entity**

```typescript
// src/domain/weight/WeightEntry.ts
import { Entity } from '../shared/Entity';
import { UniqueEntityId } from '../shared/UniqueEntityId';

export type WeightUnit = 'kg' | 'lb';

interface WeightEntryProps {
  petId: string;
  date: string; // 'YYYY-MM-DD'
  value: number;
  unit: WeightUnit;
  notes?: string;
  createdAt: Date;
}

export class WeightEntry extends Entity<WeightEntryProps> {
  get petId(): string { return this.props.petId; }
  get date(): string { return this.props.date; }
  get value(): number { return this.props.value; }
  get unit(): WeightUnit { return this.props.unit; }
  get notes(): string | undefined { return this.props.notes; }
  get createdAt(): Date { return this.props.createdAt; }

  static create(props: Omit<WeightEntryProps, 'createdAt'>, id?: UniqueEntityId): WeightEntry {
    return new WeightEntry({ ...props, createdAt: new Date() }, id);
  }

  static reconstitute(props: WeightEntryProps, id: UniqueEntityId): WeightEntry {
    return new WeightEntry(props, id);
  }
}
```

- [ ] **Step 2: Create the repository interface and token**

```typescript
// src/domain/weight/WeightEntryRepository.ts
import { WeightEntry } from './WeightEntry';

export const WEIGHT_ENTRY_REPOSITORY = 'WeightEntryRepository';

export interface WeightEntryRepository {
  save(entry: WeightEntry): Promise<WeightEntry>;
  findById(id: string): Promise<WeightEntry | null>;
  findByPetId(petId: string): Promise<WeightEntry[]>;
  delete(id: string): Promise<void>;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/domain/weight/
git commit -m "feat: add WeightEntry domain entity and repository interface"
```

---

## Task 2: WeightEntry Mapper

**Files:**
- Create: `src/infrastructure/mappers/WeightEntryMapper.ts`

The mapper is defined before use cases so use case tests can import the DTO type.

- [ ] **Step 1: Create the mapper**

```typescript
// src/infrastructure/mappers/WeightEntryMapper.ts
import { Service } from 'typedi';
import { WeightEntry, WeightUnit } from '../../domain/weight/WeightEntry';
import { UniqueEntityId } from '../../domain/shared/UniqueEntityId';
import { WeightEntryModel } from '../db/models/WeightEntryModel';

export interface WeightEntryResponseDto {
  id: string;
  petId: string;
  date: string;
  value: number;
  unit: WeightUnit;
  notes?: string;
  createdAt: string;
}

@Service()
export class WeightEntryMapper {
  toDomain(model: WeightEntryModel): WeightEntry {
    return WeightEntry.reconstitute(
      {
        petId: model.petId,
        date: model.date,
        value: Number(model.value),
        unit: model.unit as WeightUnit,
        notes: model.notes ?? undefined,
        createdAt: model.createdAt,
      },
      new UniqueEntityId(model.id),
    );
  }

  toPersistence(entry: WeightEntry): object {
    return {
      id: entry.id.toValue(),
      petId: entry.petId,
      date: entry.date,
      value: entry.value,
      unit: entry.unit,
      notes: entry.notes ?? null,
      createdAt: entry.createdAt,
    };
  }

  toResponse(entry: WeightEntry): WeightEntryResponseDto {
    return {
      id: entry.id.toValue(),
      petId: entry.petId,
      date: entry.date,
      value: entry.value,
      unit: entry.unit,
      notes: entry.notes,
      createdAt: entry.createdAt.toISOString(),
    };
  }
}
```

Note: `WeightEntryModel` is imported here but defined in Task 7. TypeScript will report an error until Task 7 is complete — this is expected and the build order resolves it.

- [ ] **Step 2: Commit**

```bash
git add src/infrastructure/mappers/WeightEntryMapper.ts
git commit -m "feat: add WeightEntryMapper"
```

---

## Task 3: AddWeightEntryUseCase (TDD)

**Files:**
- Create: `tests/application/weight/AddWeightEntryUseCase.test.ts`
- Create: `src/application/weight/AddWeightEntryUseCase.ts`

Access control: weight entries use `view_pet` permission — any user with an accepted share on the pet can add/view weight. Granular `view_weight`/`edit_weight` permissions can be added when the sharing UI is extended.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/application/weight/AddWeightEntryUseCase.test.ts
import 'reflect-metadata';
import { AddWeightEntryUseCase } from '../../../src/application/weight/AddWeightEntryUseCase';
import { WeightEntryRepository } from '../../../src/domain/weight/WeightEntryRepository';
import { WeightEntry } from '../../../src/domain/weight/WeightEntry';
import { WeightEntryMapper, WeightEntryResponseDto } from '../../../src/infrastructure/mappers/WeightEntryMapper';
import { PetAccessService } from '../../../src/application/pet/PetAccessService';
import { Pet } from '../../../src/domain/pet/Pet';
import { UniqueEntityId } from '../../../src/domain/shared/UniqueEntityId';
import { ForbiddenError } from '../../../src/shared/errors/AppError';

function makePet(userId: string): Pet {
  return Pet.reconstitute(
    { name: 'Fluffy', species: 'cat', userId, createdAt: new Date() },
    new UniqueEntityId('pet-1'),
  );
}

function makeRepo(): jest.Mocked<WeightEntryRepository> {
  return {
    save: jest.fn((e: WeightEntry) => Promise.resolve(e)),
    findById: jest.fn(),
    findByPetId: jest.fn(),
    delete: jest.fn(),
  };
}

function makeMapper(): jest.Mocked<WeightEntryMapper> {
  return {
    toDomain: jest.fn(),
    toPersistence: jest.fn(),
    toResponse: jest.fn((e: WeightEntry): WeightEntryResponseDto => ({
      id: e.id.toValue(),
      petId: e.petId,
      date: e.date,
      value: e.value,
      unit: e.unit,
      notes: e.notes,
      createdAt: e.createdAt.toISOString(),
    })),
  } as any;
}

describe('AddWeightEntryUseCase', () => {
  it('saves and returns a weight entry DTO', async () => {
    const repo = makeRepo();
    const mapper = makeMapper();
    const petAccess = { assertCanAccess: jest.fn().mockResolvedValue(makePet('user-1')) } as unknown as PetAccessService;
    const useCase = new AddWeightEntryUseCase(repo, petAccess, mapper);

    const result = await useCase.execute({
      userId: 'user-1',
      petId: 'pet-1',
      date: '2026-04-30',
      value: 4.2,
      unit: 'kg',
    });

    expect(result.petId).toBe('pet-1');
    expect(result.value).toBe(4.2);
    expect(result.unit).toBe('kg');
    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(petAccess.assertCanAccess).toHaveBeenCalledWith('pet-1', 'user-1', 'view_pet');
  });

  it('propagates ForbiddenError when user cannot access pet', async () => {
    const repo = makeRepo();
    const mapper = makeMapper();
    const petAccess = { assertCanAccess: jest.fn().mockRejectedValue(new ForbiddenError()) } as unknown as PetAccessService;
    const useCase = new AddWeightEntryUseCase(repo, petAccess, mapper);

    await expect(
      useCase.execute({ userId: 'user-99', petId: 'pet-1', date: '2026-04-30', value: 4.2, unit: 'kg' }),
    ).rejects.toThrow(ForbiddenError);
    expect(repo.save).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test — confirm it fails**

```bash
cd /path/to/pet-health-tracker-api
pnpm test tests/application/weight/AddWeightEntryUseCase.test.ts
```

Expected: FAIL — `Cannot find module '../../../src/application/weight/AddWeightEntryUseCase'`

- [ ] **Step 3: Implement AddWeightEntryUseCase**

```typescript
// src/application/weight/AddWeightEntryUseCase.ts
import { Inject, Service } from 'typedi';
import { WeightEntryRepository, WEIGHT_ENTRY_REPOSITORY } from '../../domain/weight/WeightEntryRepository';
import { WeightEntry, WeightUnit } from '../../domain/weight/WeightEntry';
import { WeightEntryMapper, WeightEntryResponseDto } from '../../infrastructure/mappers/WeightEntryMapper';
import { PetAccessService } from '../pet/PetAccessService';

export interface AddWeightEntryInput {
  userId: string;
  petId: string;
  date: string;
  value: number;
  unit: WeightUnit;
  notes?: string;
}

@Service()
export class AddWeightEntryUseCase {
  constructor(
    @Inject(WEIGHT_ENTRY_REPOSITORY) private readonly repo: WeightEntryRepository,
    private readonly petAccess: PetAccessService,
    private readonly mapper: WeightEntryMapper,
  ) {}

  async execute(input: AddWeightEntryInput): Promise<WeightEntryResponseDto> {
    await this.petAccess.assertCanAccess(input.petId, input.userId, 'view_pet');
    const entry = WeightEntry.create({
      petId: input.petId,
      date: input.date,
      value: input.value,
      unit: input.unit,
      notes: input.notes,
    });
    const saved = await this.repo.save(entry);
    return this.mapper.toResponse(saved);
  }
}
```

- [ ] **Step 4: Run the test — confirm it passes**

```bash
pnpm test tests/application/weight/AddWeightEntryUseCase.test.ts
```

Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add tests/application/weight/AddWeightEntryUseCase.test.ts src/application/weight/AddWeightEntryUseCase.ts
git commit -m "feat: add AddWeightEntryUseCase with tests"
```

---

## Task 4: ListWeightEntriesUseCase (TDD)

**Files:**
- Create: `tests/application/weight/ListWeightEntriesUseCase.test.ts`
- Create: `src/application/weight/ListWeightEntriesUseCase.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/application/weight/ListWeightEntriesUseCase.test.ts
import 'reflect-metadata';
import { ListWeightEntriesUseCase } from '../../../src/application/weight/ListWeightEntriesUseCase';
import { WeightEntryRepository } from '../../../src/domain/weight/WeightEntryRepository';
import { WeightEntry } from '../../../src/domain/weight/WeightEntry';
import { WeightEntryMapper, WeightEntryResponseDto } from '../../../src/infrastructure/mappers/WeightEntryMapper';
import { PetAccessService } from '../../../src/application/pet/PetAccessService';
import { Pet } from '../../../src/domain/pet/Pet';
import { UniqueEntityId } from '../../../src/domain/shared/UniqueEntityId';

function makePet(): Pet {
  return Pet.reconstitute(
    { name: 'Fluffy', species: 'cat', userId: 'user-1', createdAt: new Date() },
    new UniqueEntityId('pet-1'),
  );
}

function makeEntry(value: number): WeightEntry {
  return WeightEntry.create({ petId: 'pet-1', date: '2026-04-30', value, unit: 'kg' });
}

describe('ListWeightEntriesUseCase', () => {
  it('returns DTOs for all entries belonging to the pet', async () => {
    const entries = [makeEntry(4.2), makeEntry(4.0)];
    const repo = {
      findByPetId: jest.fn().mockResolvedValue(entries),
    } as unknown as WeightEntryRepository;
    const mapper = {
      toResponse: jest.fn((e: WeightEntry): WeightEntryResponseDto => ({
        id: e.id.toValue(), petId: e.petId, date: e.date, value: e.value, unit: e.unit, createdAt: e.createdAt.toISOString(),
      })),
    } as unknown as WeightEntryMapper;
    const petAccess = { assertCanAccess: jest.fn().mockResolvedValue(makePet()) } as unknown as PetAccessService;
    const useCase = new ListWeightEntriesUseCase(repo, petAccess, mapper);

    const result = await useCase.execute({ userId: 'user-1', petId: 'pet-1' });

    expect(result).toHaveLength(2);
    expect(result[0].value).toBe(4.2);
    expect(repo.findByPetId).toHaveBeenCalledWith('pet-1');
  });
});
```

- [ ] **Step 2: Run — confirm it fails**

```bash
pnpm test tests/application/weight/ListWeightEntriesUseCase.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement ListWeightEntriesUseCase**

```typescript
// src/application/weight/ListWeightEntriesUseCase.ts
import { Inject, Service } from 'typedi';
import { WeightEntryRepository, WEIGHT_ENTRY_REPOSITORY } from '../../domain/weight/WeightEntryRepository';
import { WeightEntryMapper, WeightEntryResponseDto } from '../../infrastructure/mappers/WeightEntryMapper';
import { PetAccessService } from '../pet/PetAccessService';

export interface ListWeightEntriesInput {
  userId: string;
  petId: string;
}

@Service()
export class ListWeightEntriesUseCase {
  constructor(
    @Inject(WEIGHT_ENTRY_REPOSITORY) private readonly repo: WeightEntryRepository,
    private readonly petAccess: PetAccessService,
    private readonly mapper: WeightEntryMapper,
  ) {}

  async execute(input: ListWeightEntriesInput): Promise<WeightEntryResponseDto[]> {
    await this.petAccess.assertCanAccess(input.petId, input.userId, 'view_pet');
    const entries = await this.repo.findByPetId(input.petId);
    return entries.map((e) => this.mapper.toResponse(e));
  }
}
```

- [ ] **Step 4: Run — confirm it passes**

```bash
pnpm test tests/application/weight/ListWeightEntriesUseCase.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/application/weight/ListWeightEntriesUseCase.test.ts src/application/weight/ListWeightEntriesUseCase.ts
git commit -m "feat: add ListWeightEntriesUseCase with tests"
```

---

## Task 5: UpdateWeightEntryUseCase (TDD)

**Files:**
- Create: `tests/application/weight/UpdateWeightEntryUseCase.test.ts`
- Create: `src/application/weight/UpdateWeightEntryUseCase.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/application/weight/UpdateWeightEntryUseCase.test.ts
import 'reflect-metadata';
import { UpdateWeightEntryUseCase } from '../../../src/application/weight/UpdateWeightEntryUseCase';
import { WeightEntryRepository } from '../../../src/domain/weight/WeightEntryRepository';
import { WeightEntry } from '../../../src/domain/weight/WeightEntry';
import { WeightEntryMapper, WeightEntryResponseDto } from '../../../src/infrastructure/mappers/WeightEntryMapper';
import { UniqueEntityId } from '../../../src/domain/shared/UniqueEntityId';
import { NotFoundError, ForbiddenError } from '../../../src/shared/errors/AppError';

function makeEntry(petId: string, value: number): WeightEntry {
  return WeightEntry.reconstitute(
    { petId, date: '2026-04-30', value, unit: 'kg', createdAt: new Date() },
    new UniqueEntityId('entry-1'),
  );
}

describe('UpdateWeightEntryUseCase', () => {
  it('updates and returns the updated entry DTO', async () => {
    const entry = makeEntry('pet-1', 4.2);
    const saved: WeightEntry[] = [];
    const repo = {
      findById: jest.fn().mockResolvedValue(entry),
      save: jest.fn((e: WeightEntry) => { saved.push(e); return Promise.resolve(e); }),
    } as unknown as WeightEntryRepository;
    const mapper = {
      toResponse: jest.fn((e: WeightEntry): WeightEntryResponseDto => ({
        id: e.id.toValue(), petId: e.petId, date: e.date, value: e.value, unit: e.unit, createdAt: e.createdAt.toISOString(),
      })),
    } as unknown as WeightEntryMapper;
    const useCase = new UpdateWeightEntryUseCase(repo, mapper);

    const result = await useCase.execute({ userId: 'user-1', petId: 'pet-1', entryId: 'entry-1', value: 4.5 });

    expect(result.value).toBe(4.5);
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('throws NotFoundError when entry does not exist', async () => {
    const repo = { findById: jest.fn().mockResolvedValue(null) } as unknown as WeightEntryRepository;
    const mapper = {} as WeightEntryMapper;
    const useCase = new UpdateWeightEntryUseCase(repo, mapper);

    await expect(
      useCase.execute({ userId: 'user-1', petId: 'pet-1', entryId: 'entry-1', value: 4.5 }),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws ForbiddenError when entry belongs to a different pet', async () => {
    const entry = makeEntry('pet-other', 4.2);
    const repo = { findById: jest.fn().mockResolvedValue(entry) } as unknown as WeightEntryRepository;
    const mapper = {} as WeightEntryMapper;
    const useCase = new UpdateWeightEntryUseCase(repo, mapper);

    await expect(
      useCase.execute({ userId: 'user-1', petId: 'pet-1', entryId: 'entry-1', value: 4.5 }),
    ).rejects.toThrow(ForbiddenError);
  });
});
```

- [ ] **Step 2: Run — confirm it fails**

```bash
pnpm test tests/application/weight/UpdateWeightEntryUseCase.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement UpdateWeightEntryUseCase**

```typescript
// src/application/weight/UpdateWeightEntryUseCase.ts
import { Inject, Service } from 'typedi';
import { WeightEntryRepository, WEIGHT_ENTRY_REPOSITORY } from '../../domain/weight/WeightEntryRepository';
import { WeightEntry, WeightUnit } from '../../domain/weight/WeightEntry';
import { WeightEntryMapper, WeightEntryResponseDto } from '../../infrastructure/mappers/WeightEntryMapper';
import { UniqueEntityId } from '../../domain/shared/UniqueEntityId';
import { ForbiddenError, NotFoundError } from '../../shared/errors/AppError';

export interface UpdateWeightEntryInput {
  userId: string;
  petId: string;
  entryId: string;
  date?: string;
  value?: number;
  unit?: WeightUnit;
  notes?: string | null;
}

@Service()
export class UpdateWeightEntryUseCase {
  constructor(
    @Inject(WEIGHT_ENTRY_REPOSITORY) private readonly repo: WeightEntryRepository,
    private readonly mapper: WeightEntryMapper,
  ) {}

  async execute(input: UpdateWeightEntryInput): Promise<WeightEntryResponseDto> {
    const existing = await this.repo.findById(input.entryId);
    if (!existing) throw new NotFoundError('WeightEntry');
    if (existing.petId !== input.petId) throw new ForbiddenError();

    const updated = WeightEntry.reconstitute(
      {
        petId: existing.petId,
        date: input.date ?? existing.date,
        value: input.value ?? existing.value,
        unit: input.unit ?? existing.unit,
        notes: input.notes !== undefined ? (input.notes ?? undefined) : existing.notes,
        createdAt: existing.createdAt,
      },
      new UniqueEntityId(existing.id.toValue()),
    );

    const saved = await this.repo.save(updated);
    return this.mapper.toResponse(saved);
  }
}
```

- [ ] **Step 4: Run — confirm it passes**

```bash
pnpm test tests/application/weight/UpdateWeightEntryUseCase.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add tests/application/weight/UpdateWeightEntryUseCase.test.ts src/application/weight/UpdateWeightEntryUseCase.ts
git commit -m "feat: add UpdateWeightEntryUseCase with tests"
```

---

## Task 6: DeleteWeightEntryUseCase (TDD)

**Files:**
- Create: `tests/application/weight/DeleteWeightEntryUseCase.test.ts`
- Create: `src/application/weight/DeleteWeightEntryUseCase.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/application/weight/DeleteWeightEntryUseCase.test.ts
import 'reflect-metadata';
import { DeleteWeightEntryUseCase } from '../../../src/application/weight/DeleteWeightEntryUseCase';
import { WeightEntryRepository } from '../../../src/domain/weight/WeightEntryRepository';
import { WeightEntry } from '../../../src/domain/weight/WeightEntry';
import { UniqueEntityId } from '../../../src/domain/shared/UniqueEntityId';
import { NotFoundError, ForbiddenError } from '../../../src/shared/errors/AppError';

function makeEntry(petId: string): WeightEntry {
  return WeightEntry.reconstitute(
    { petId, date: '2026-04-30', value: 4.2, unit: 'kg', createdAt: new Date() },
    new UniqueEntityId('entry-1'),
  );
}

describe('DeleteWeightEntryUseCase', () => {
  it('deletes the entry when it exists and belongs to the pet', async () => {
    const entry = makeEntry('pet-1');
    const repo = {
      findById: jest.fn().mockResolvedValue(entry),
      delete: jest.fn().mockResolvedValue(undefined),
    } as unknown as WeightEntryRepository;
    const useCase = new DeleteWeightEntryUseCase(repo);

    await useCase.execute({ userId: 'user-1', petId: 'pet-1', entryId: 'entry-1' });

    expect(repo.delete).toHaveBeenCalledWith('entry-1');
  });

  it('throws NotFoundError when entry does not exist', async () => {
    const repo = { findById: jest.fn().mockResolvedValue(null) } as unknown as WeightEntryRepository;
    const useCase = new DeleteWeightEntryUseCase(repo);

    await expect(
      useCase.execute({ userId: 'user-1', petId: 'pet-1', entryId: 'entry-1' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws ForbiddenError when entry belongs to a different pet', async () => {
    const entry = makeEntry('pet-other');
    const repo = { findById: jest.fn().mockResolvedValue(entry) } as unknown as WeightEntryRepository;
    const useCase = new DeleteWeightEntryUseCase(repo);

    await expect(
      useCase.execute({ userId: 'user-1', petId: 'pet-1', entryId: 'entry-1' }),
    ).rejects.toThrow(ForbiddenError);
  });
});
```

- [ ] **Step 2: Run — confirm it fails**

```bash
pnpm test tests/application/weight/DeleteWeightEntryUseCase.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement DeleteWeightEntryUseCase**

```typescript
// src/application/weight/DeleteWeightEntryUseCase.ts
import { Inject, Service } from 'typedi';
import { WeightEntryRepository, WEIGHT_ENTRY_REPOSITORY } from '../../domain/weight/WeightEntryRepository';
import { ForbiddenError, NotFoundError } from '../../shared/errors/AppError';

export interface DeleteWeightEntryInput {
  userId: string;
  petId: string;
  entryId: string;
}

@Service()
export class DeleteWeightEntryUseCase {
  constructor(
    @Inject(WEIGHT_ENTRY_REPOSITORY) private readonly repo: WeightEntryRepository,
  ) {}

  async execute(input: DeleteWeightEntryInput): Promise<void> {
    const existing = await this.repo.findById(input.entryId);
    if (!existing) throw new NotFoundError('WeightEntry');
    if (existing.petId !== input.petId) throw new ForbiddenError();
    await this.repo.delete(input.entryId);
  }
}
```

- [ ] **Step 4: Run — confirm it passes**

```bash
pnpm test tests/application/weight/DeleteWeightEntryUseCase.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 5: Run all weight tests together**

```bash
pnpm test tests/application/weight/
```

Expected: PASS (8 tests total)

- [ ] **Step 6: Commit**

```bash
git add tests/application/weight/DeleteWeightEntryUseCase.test.ts src/application/weight/DeleteWeightEntryUseCase.ts
git commit -m "feat: add DeleteWeightEntryUseCase with tests"
```

---

## Task 7: Sequelize Model and Repository

**Files:**
- Create: `src/infrastructure/db/models/WeightEntryModel.ts`
- Create: `src/infrastructure/db/repositories/SequelizeWeightEntryRepository.ts`

- [ ] **Step 1: Create the Sequelize model**

```typescript
// src/infrastructure/db/models/WeightEntryModel.ts
import { BelongsTo, Column, DataType, ForeignKey, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { PetModel } from './PetModel';

@Table({ tableName: 'weight_entries', timestamps: false })
export class WeightEntryModel extends Model {
  @PrimaryKey
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => PetModel)
  @Column({ type: DataType.UUID, allowNull: false, field: 'pet_id' })
  declare petId: string;

  @Column({ type: DataType.DATEONLY, allowNull: false })
  declare date: string;

  @Column({ type: DataType.DECIMAL(10, 2), allowNull: false })
  declare value: number;

  @Column({ type: DataType.ENUM('kg', 'lb'), allowNull: false })
  declare unit: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare notes: string | null;

  @Column({ type: DataType.DATE, allowNull: false, field: 'created_at' })
  declare createdAt: Date;

  @BelongsTo(() => PetModel)
  declare pet: PetModel;
}
```

- [ ] **Step 2: Create the Sequelize repository**

```typescript
// src/infrastructure/db/repositories/SequelizeWeightEntryRepository.ts
import { Service } from 'typedi';
import { WeightEntry } from '../../../domain/weight/WeightEntry';
import { WeightEntryRepository } from '../../../domain/weight/WeightEntryRepository';
import { WeightEntryModel } from '../models/WeightEntryModel';
import { WeightEntryMapper } from '../../mappers/WeightEntryMapper';

@Service()
export class SequelizeWeightEntryRepository implements WeightEntryRepository {
  constructor(private readonly mapper: WeightEntryMapper) {}

  async save(entry: WeightEntry): Promise<WeightEntry> {
    await WeightEntryModel.upsert(this.mapper.toPersistence(entry) as any);
    const saved = await this.findById(entry.id.toValue());
    if (!saved) throw new Error(`WeightEntry ${entry.id.toValue()} not found after save`);
    return saved;
  }

  async findById(id: string): Promise<WeightEntry | null> {
    const model = await WeightEntryModel.findByPk(id);
    return model ? this.mapper.toDomain(model) : null;
  }

  async findByPetId(petId: string): Promise<WeightEntry[]> {
    const models = await WeightEntryModel.findAll({
      where: { petId },
      order: [['date', 'DESC']],
    });
    return models.map((m) => this.mapper.toDomain(m));
  }

  async delete(id: string): Promise<void> {
    await WeightEntryModel.destroy({ where: { id } });
  }
}
```

- [ ] **Step 3: Register WeightEntryModel in database.ts**

In `src/infrastructure/db/database.ts`, add the import and model registration:

```typescript
// Add import alongside the others:
import { WeightEntryModel } from './models/WeightEntryModel';

// Add to the models array:
models: [
  // ... existing models ...
  WeightEntryModel,
],
```

- [ ] **Step 4: Commit**

```bash
git add src/infrastructure/db/models/WeightEntryModel.ts src/infrastructure/db/repositories/SequelizeWeightEntryRepository.ts src/infrastructure/db/database.ts
git commit -m "feat: add WeightEntryModel and SequelizeWeightEntryRepository"
```

---

## Task 8: Zod Schemas and WeightController

**Files:**
- Create: `src/infrastructure/http/schemas/weightSchemas.ts`
- Create: `src/infrastructure/http/controllers/WeightController.ts`

- [ ] **Step 1: Create Zod schemas**

```typescript
// src/infrastructure/http/schemas/weightSchemas.ts
import { z } from 'zod';

export const AddWeightEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  value: z.number().positive(),
  unit: z.enum(['kg', 'lb']),
  notes: z.string().optional(),
});
export type AddWeightEntryBody = z.infer<typeof AddWeightEntrySchema>;

export const UpdateWeightEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  value: z.number().positive().optional(),
  unit: z.enum(['kg', 'lb']).optional(),
  notes: z.string().nullable().optional(),
});
export type UpdateWeightEntryBody = z.infer<typeof UpdateWeightEntrySchema>;
```

- [ ] **Step 2: Create WeightController**

The controller uses `@JsonController('/pets')` matching the pattern in `HealthController`. Routes are `/:petId/weight` and `/:petId/weight/:entryId`.

```typescript
// src/infrastructure/http/controllers/WeightController.ts
import { JsonController, Get, Post, Put, Delete, Body, Param, UseBefore, CurrentUser, HttpCode, OnUndefined } from 'routing-controllers';
import { Service } from 'typedi';
import { AddWeightEntryUseCase } from '../../../application/weight/AddWeightEntryUseCase';
import { ListWeightEntriesUseCase } from '../../../application/weight/ListWeightEntriesUseCase';
import { UpdateWeightEntryUseCase } from '../../../application/weight/UpdateWeightEntryUseCase';
import { DeleteWeightEntryUseCase } from '../../../application/weight/DeleteWeightEntryUseCase';
import { authMiddleware, AuthPayload } from '../middleware/authMiddleware';
import { Validate } from '../decorators/Validate';
import { AddWeightEntrySchema, AddWeightEntryBody, UpdateWeightEntrySchema, UpdateWeightEntryBody } from '../schemas/weightSchemas';

@JsonController('/pets')
@Service()
@UseBefore(authMiddleware)
export class WeightController {
  constructor(
    private readonly addEntry: AddWeightEntryUseCase,
    private readonly listEntries: ListWeightEntriesUseCase,
    private readonly updateEntry: UpdateWeightEntryUseCase,
    private readonly deleteEntry: DeleteWeightEntryUseCase,
  ) {}

  @Post('/:petId/weight')
  @HttpCode(201)
  @Validate({ body: AddWeightEntrySchema })
  async create(@Param('petId') petId: string, @Body() body: AddWeightEntryBody, @CurrentUser() user: AuthPayload) {
    return this.addEntry.execute({ userId: user.userId, petId, ...body });
  }

  @Get('/:petId/weight')
  async list(@Param('petId') petId: string, @CurrentUser() user: AuthPayload) {
    return this.listEntries.execute({ userId: user.userId, petId });
  }

  @Put('/:petId/weight/:entryId')
  @Validate({ body: UpdateWeightEntrySchema })
  async update(@Param('petId') petId: string, @Param('entryId') entryId: string, @Body() body: UpdateWeightEntryBody, @CurrentUser() user: AuthPayload) {
    return this.updateEntry.execute({ userId: user.userId, petId, entryId, ...body });
  }

  @Delete('/:petId/weight/:entryId')
  @OnUndefined(204)
  async delete(@Param('petId') petId: string, @Param('entryId') entryId: string, @CurrentUser() user: AuthPayload) {
    await this.deleteEntry.execute({ userId: user.userId, petId, entryId });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/http/schemas/weightSchemas.ts src/infrastructure/http/controllers/WeightController.ts
git commit -m "feat: add WeightController with Zod schemas"
```

---

## Task 9: Wire Up DI and Routes, Smoke Test

**Files:**
- Modify: `src/container.ts`
- Modify: `src/app.ts`

- [ ] **Step 1: Register the repository in container.ts**

Add the following to `src/container.ts`:

```typescript
// Add imports alongside existing ones:
import { SequelizeWeightEntryRepository } from './infrastructure/db/repositories/SequelizeWeightEntryRepository';
import { WEIGHT_ENTRY_REPOSITORY } from './domain/weight/WeightEntryRepository';

// Add inside registerDependencies():
Container.set(WEIGHT_ENTRY_REPOSITORY, Container.get(SequelizeWeightEntryRepository));
```

- [ ] **Step 2: Register WeightController in app.ts**

```typescript
// Add import:
import { WeightController } from './infrastructure/http/controllers/WeightController';

// Add to controllers array inside useExpressServer:
WeightController,
```

- [ ] **Step 3: Build to confirm no TypeScript errors**

```bash
pnpm build
```

Expected: 0 errors

- [ ] **Step 4: Start the server and smoke test with curl**

```bash
pnpm dev
```

In another terminal:

```bash
# Register and login to get a token, then:
curl -X POST http://localhost:3000/api/v1/pets/<your-pet-id>/weight \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{"date":"2026-04-30","value":4.2,"unit":"kg","notes":"morning"}'
# Expected: 201 with JSON body containing id, petId, date, value, unit, notes, createdAt

curl http://localhost:3000/api/v1/pets/<your-pet-id>/weight \
  -H "Authorization: Bearer <your-token>"
# Expected: 200 with array containing the entry just created
```

- [ ] **Step 5: Commit**

```bash
git add src/container.ts src/app.ts
git commit -m "feat: wire up WeightController, repository DI, and model sync"
```

---

## Task 10: Client Types

**Files:**
- Modify: `src/types/index.ts` (in `pet-health-tracker-client`)

- [ ] **Step 1: Add WeightEntry types**

Append to the end of `src/types/index.ts`:

```typescript
export type WeightUnit = 'kg' | 'lb';

export interface WeightEntry {
  id: string;
  petId: string;
  date: string; // 'YYYY-MM-DD'
  value: number;
  unit: WeightUnit;
  notes?: string;
  createdAt: string;
}

export interface CreateWeightEntryDto {
  date: string;
  value: number;
  unit: WeightUnit;
  notes?: string;
}

export interface UpdateWeightEntryDto {
  date?: string;
  value?: number;
  unit?: WeightUnit;
  notes?: string | null;
}
```

- [ ] **Step 2: Commit**

```bash
cd /path/to/pet-health-tracker-client
git add src/types/index.ts
git commit -m "feat: add WeightEntry types"
```

---

## Task 11: Client API Hooks

**Files:**
- Create: `src/api/weight.ts`

- [ ] **Step 1: Create weight API module**

```typescript
// src/api/weight.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';
import type { WeightEntry, CreateWeightEntryDto, UpdateWeightEntryDto } from '../types';

export const weightApi = {
  list: (petId: string): Promise<WeightEntry[]> =>
    apiClient.get<WeightEntry[]>(`/pets/${petId}/weight`).then((r) => r.data),

  create: (petId: string, data: CreateWeightEntryDto): Promise<WeightEntry> =>
    apiClient.post<WeightEntry>(`/pets/${petId}/weight`, data).then((r) => r.data),

  update: (petId: string, entryId: string, data: UpdateWeightEntryDto): Promise<WeightEntry> =>
    apiClient.put<WeightEntry>(`/pets/${petId}/weight/${entryId}`, data).then((r) => r.data),

  delete: (petId: string, entryId: string): Promise<void> =>
    apiClient.delete(`/pets/${petId}/weight/${entryId}`).then(() => undefined),
};

export function useWeightEntries(petId: string) {
  return useQuery({
    queryKey: ['weight', petId],
    queryFn: () => weightApi.list(petId),
    enabled: !!petId,
  });
}

export function useAddWeightEntry(petId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateWeightEntryDto) => weightApi.create(petId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weight', petId] });
    },
  });
}

export function useUpdateWeightEntry(petId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ entryId, data }: { entryId: string; data: UpdateWeightEntryDto }) =>
      weightApi.update(petId, entryId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weight', petId] });
    },
  });
}

export function useDeleteWeightEntry(petId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entryId: string) => weightApi.delete(petId, entryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weight', petId] });
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/api/weight.ts
git commit -m "feat: add weight API hooks"
```

---

## Task 12: WeightChart Component

**Files:**
- Install: recharts
- Create: `src/components/WeightChart.tsx`

- [ ] **Step 1: Install recharts**

```bash
pnpm add recharts
```

- [ ] **Step 2: Create WeightChart**

The chart normalizes all entries to the unit of the most recent entry (by date). If there are fewer than 2 entries, it shows a placeholder message instead of an empty chart.

```typescript
// src/components/WeightChart.tsx
import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Box, Typography } from '@mui/material';
import type { WeightEntry, WeightUnit } from '../types';

function convert(value: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to) return value;
  return from === 'kg' ? value * 2.20462 : value / 2.20462;
}

interface Props {
  entries: WeightEntry[];
}

export function WeightChart({ entries }: Props) {
  const targetUnit: WeightUnit = entries.length > 0 ? entries[0].unit : 'kg';

  const data = useMemo(
    () =>
      [...entries]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((e) => ({
          date: e.date,
          weight: Number(convert(e.value, e.unit, targetUnit).toFixed(2)),
          notes: e.notes ?? '',
        })),
    [entries, targetUnit],
  );

  if (data.length < 2) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography color="text.secondary" variant="body2">
          Add at least 2 entries to see the chart.
        </Typography>
      </Box>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
        <YAxis
          tick={{ fontSize: 12 }}
          tickFormatter={(v) => `${v} ${targetUnit}`}
          width={60}
        />
        <Tooltip
          formatter={(value: number) => [`${value} ${targetUnit}`, 'Weight']}
          labelFormatter={(label) => `Date: ${label}`}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const { weight, notes } = payload[0].payload;
            return (
              <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', p: 1, borderRadius: 1 }}>
                <Typography variant="caption" display="block">{label}</Typography>
                <Typography variant="body2">{weight} {targetUnit}</Typography>
                {notes && <Typography variant="caption" color="text.secondary">{notes}</Typography>}
              </Box>
            );
          }}
        />
        <Line type="monotone" dataKey="weight" stroke="#1976d2" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/WeightChart.tsx package.json pnpm-lock.yaml
git commit -m "feat: add WeightChart with Recharts"
```

---

## Task 13: WeightEntryDialog Component

**Files:**
- Create: `src/components/WeightEntryDialog.tsx`

- [ ] **Step 1: Create WeightEntryDialog**

Follows the same controlled form dialog pattern as `NoteFormDialog`. The dialog is used for both add (no `entry` prop) and edit (with `entry` prop).

```typescript
// src/components/WeightEntryDialog.tsx
import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, ToggleButton, ToggleButtonGroup, Stack,
} from '@mui/material';
import type { WeightEntry, WeightUnit } from '../types';

interface Props {
  open: boolean;
  entry?: WeightEntry | null;
  onClose: () => void;
  onSubmit: (data: { date: string; value: number; unit: WeightUnit; notes?: string }) => void;
  loading?: boolean;
}

export function WeightEntryDialog({ open, entry, onClose, onSubmit, loading }: Props) {
  const [date, setDate] = useState('');
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState<WeightUnit>('kg');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      setDate(entry?.date ?? new Date().toISOString().slice(0, 10));
      setValue(entry ? String(entry.value) : '');
      setUnit(entry?.unit ?? 'kg');
      setNotes(entry?.notes ?? '');
    }
  }, [open, entry]);

  const handleSubmit = () => {
    const num = parseFloat(value);
    if (!date || isNaN(num) || num <= 0) return;
    onSubmit({ date, value: num, unit, notes: notes.trim() || undefined });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{entry ? 'Edit Weight Entry' : 'Add Weight Entry'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            fullWidth
          />
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              label="Weight"
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              inputProps={{ min: 0, step: 0.1 }}
              sx={{ flex: 1 }}
            />
            <ToggleButtonGroup
              value={unit}
              exclusive
              onChange={(_, v) => { if (v) setUnit(v); }}
              size="small"
            >
              <ToggleButton value="kg">kg</ToggleButton>
              <ToggleButton value="lb">lb</ToggleButton>
            </ToggleButtonGroup>
          </Stack>
          <TextField
            label="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            multiline
            rows={2}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading || !date || !value}>
          {entry ? 'Save' : 'Add'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/WeightEntryDialog.tsx
git commit -m "feat: add WeightEntryDialog"
```

---

## Task 14: WeightSection Component

**Files:**
- Create: `src/components/WeightSection.tsx`

- [ ] **Step 1: Create WeightSection**

Contains the chart, add button, and log list. Edit and delete are inline on each row.

```typescript
// src/components/WeightSection.tsx
import { useState } from 'react';
import {
  Box, Button, IconButton, Stack, Typography, CircularProgress,
  List, ListItem, ListItemText, Divider,
} from '@mui/material';
import { Add, Edit, Delete } from '@mui/icons-material';
import { WeightChart } from './WeightChart';
import { WeightEntryDialog } from './WeightEntryDialog';
import { useWeightEntries, useAddWeightEntry, useUpdateWeightEntry, useDeleteWeightEntry } from '../api/weight';
import type { WeightEntry } from '../types';

interface Props {
  petId: string;
  canEdit: boolean;
}

export function WeightSection({ petId, canEdit }: Props) {
  const { data: entries = [], isLoading } = useWeightEntries(petId);
  const addMutation = useAddWeightEntry(petId);
  const updateMutation = useUpdateWeightEntry(petId);
  const deleteMutation = useDeleteWeightEntry(petId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<WeightEntry | null>(null);

  const handleSubmit = (data: Parameters<typeof addMutation.mutate>[0]) => {
    if (editEntry) {
      updateMutation.mutate(
        { entryId: editEntry.id, data },
        { onSuccess: () => { setDialogOpen(false); setEditEntry(null); } },
      );
    } else {
      addMutation.mutate(data, { onSuccess: () => setDialogOpen(false) });
    }
  };

  const handleEdit = (entry: WeightEntry) => {
    setEditEntry(entry);
    setDialogOpen(true);
  };

  const handleDelete = (entryId: string) => {
    deleteMutation.mutate(entryId);
  };

  if (isLoading) return <CircularProgress size={24} />;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Weight</Typography>
        {canEdit && (
          <Button startIcon={<Add />} variant="outlined" size="small" onClick={() => { setEditEntry(null); setDialogOpen(true); }}>
            Add Entry
          </Button>
        )}
      </Stack>

      <WeightChart entries={entries} />

      {entries.length > 0 && (
        <List dense sx={{ mt: 1 }}>
          {entries.map((entry, idx) => (
            <Box key={entry.id}>
              {idx > 0 && <Divider />}
              <ListItem
                secondaryAction={
                  canEdit && (
                    <Stack direction="row">
                      <IconButton size="small" onClick={() => handleEdit(entry)}><Edit fontSize="small" /></IconButton>
                      <IconButton size="small" onClick={() => handleDelete(entry.id)}><Delete fontSize="small" /></IconButton>
                    </Stack>
                  )
                }
              >
                <ListItemText
                  primary={`${entry.value} ${entry.unit}`}
                  secondary={`${entry.date}${entry.notes ? ` · ${entry.notes}` : ''}`}
                />
              </ListItem>
            </Box>
          ))}
        </List>
      )}

      <WeightEntryDialog
        open={dialogOpen}
        entry={editEntry}
        onClose={() => { setDialogOpen(false); setEditEntry(null); }}
        onSubmit={handleSubmit}
        loading={addMutation.isPending || updateMutation.isPending}
      />
    </Box>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/WeightSection.tsx
git commit -m "feat: add WeightSection component"
```

---

## Task 15: Integrate WeightSection into PetDetailPage

**Files:**
- Modify: `src/pages/health/PetDetailPage.tsx`

The page uses a `TabValue` union type and tab-controlled rendering. Add `'weight'` to the union and wire up `WeightSection`.

- [ ] **Step 1: Update TabValue type**

Find this line in `PetDetailPage.tsx`:
```typescript
type TabValue = 'vet-visits' | 'medications' | 'notes' | 'sharing';
```
Replace with:
```typescript
type TabValue = 'vet-visits' | 'medications' | 'notes' | 'weight' | 'sharing';
```

- [ ] **Step 2: Add weight to tab resolution logic**

In the tab resolution block (around line 133), add weight before sharing:
```typescript
if (rawTab === 'weight') return 'weight';
```

- [ ] **Step 3: Import WeightSection**

```typescript
import { WeightSection } from '../../components/WeightSection';
```

- [ ] **Step 4: Add the Weight tab to the Tabs bar**

After the Notes tab:
```tsx
<Tab value="weight" label="Weight" />
```

- [ ] **Step 5: Add the Weight tab panel**

Find where the `tab === 'notes'` panel is rendered and add a weight panel alongside it:
```tsx
{tab === 'weight' && (
  <WeightSection petId={petId!} canEdit={isOwner} />
)}
```

- [ ] **Step 6: Start the dev server and verify**

```bash
pnpm dev
```

Navigate to a pet's health page. Confirm:
- "Weight" tab is visible
- Clicking it shows the WeightSection
- "Add Entry" button opens the dialog
- Submitting creates an entry (visible in the log list)
- With 2+ entries, the chart renders
- Edit and delete work correctly

- [ ] **Step 7: Commit**

```bash
git add src/pages/health/PetDetailPage.tsx
git commit -m "feat: integrate WeightSection into PetDetailPage as Weight tab"
```

---

## Done

All tasks complete. The weight tracking feature is fully implemented:
- API: domain → use cases (tested) → repository → controller
- Client: types → hooks → chart → dialog → section → tab integration
