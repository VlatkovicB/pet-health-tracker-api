# Pet Sharing & Ownership Transfer — Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement pet sharing and ownership transfer in the pet-health-tracker API, enabling users to share pets with per-resource permissions and transfer ownership with acceptance flows.

**Architecture:** Central `PetAccessService` replaces all inline `pet.userId !== requestingUserId` guards. Two new domain aggregates (`PetShare`, `PetOwnershipTransfer`) follow the existing DDD pattern. Transfer expiry uses a one-shot BullMQ delayed job (job ID `transfer--{id}`, following the `--` separator rule).

**Tech Stack:** TypeScript, Express, sequelize-typescript (Postgres), typedi, BullMQ, Resend (EmailService), Jest + ts-jest (new)

**Note:** Frontend client plan is separate — implement this backend plan first.

---

## File Structure

### New files
```
src/
  domain/
    share/
      PetPermission.ts
      PetShare.ts
      PetShareRepository.ts
    transfer/
      PetOwnershipTransfer.ts
      PetOwnershipTransferRepository.ts
  application/
    pet/
      PetAccessService.ts
    share/
      SharePetUseCase.ts
      UpdateSharePermissionsUseCase.ts
      RevokeShareUseCase.ts
      ListPetSharesUseCase.ts
      ListPendingSharesUseCase.ts
      AcceptShareUseCase.ts
      DeclineShareUseCase.ts
      ListSharedPetsUseCase.ts
    transfer/
      InitiateOwnershipTransferUseCase.ts
      CancelOwnershipTransferUseCase.ts
      ListPendingTransfersUseCase.ts
      AcceptOwnershipTransferUseCase.ts
      DeclineOwnershipTransferUseCase.ts
      ExpireOwnershipTransferUseCase.ts
  infrastructure/
    db/
      models/
        PetShareModel.ts
        PetOwnershipTransferModel.ts
      repositories/
        SequelizePetShareRepository.ts
        SequelizePetOwnershipTransferRepository.ts
    mappers/
      PetShareMapper.ts
      PetOwnershipTransferMapper.ts
    http/
      controllers/
        ShareController.ts
        TransferController.ts
      routes/
        shareRoutes.ts        (mounted at /pets — handles /pets/:petId/shares + /pets/shared-with-me)
        petShareInboxRoutes.ts (mounted at /pet-shares)
        transferRoutes.ts     (mounted at /pets — handles /pets/:petId/transfer)
        petTransferInboxRoutes.ts (mounted at /pet-ownership-transfers)
    queue/
      TransferExpiryQueue.ts
      TransferExpiryWorker.ts
    email/
      templates/
        petShareInvite.ts
        petShareNotification.ts
        petTransferInvite.ts
        petTransferNotification.ts
tests/
  domain/
    PetShare.test.ts
    PetOwnershipTransfer.test.ts
  application/
    PetAccessService.test.ts
    share/
      SharePetUseCase.test.ts
      AcceptShareUseCase.test.ts
    transfer/
      AcceptOwnershipTransferUseCase.test.ts
```

### Modified files
```
src/domain/pet/Pet.ts                                      add transferOwnership()
src/domain/pet/PetRepository.ts                            add findByIds()
src/application/pet/GetPetUseCase.ts                       use PetAccessService (view_pet)
src/application/pet/UpdatePetUseCase.ts                    use PetAccessService (owner)
src/application/health/ListVetVisitsUseCase.ts             use PetAccessService (view_vet_visits)
src/application/health/ListVetVisitsByDateRangeUseCase.ts  use PetAccessService (view_vet_visits)
src/application/health/AddVetVisitUseCase.ts               use PetAccessService (edit_vet_visits)
src/application/health/UpdateVetVisitUseCase.ts            use PetAccessService (edit_vet_visits)
src/application/health/CompleteVetVisitUseCase.ts          use PetAccessService (edit_vet_visits)
src/application/health/AddVetVisitImageUseCase.ts          use PetAccessService (edit_vet_visits)
src/application/health/ListMedicationsUseCase.ts           use PetAccessService (view_medications)
src/application/health/LogMedicationUseCase.ts             use PetAccessService (edit_medications)
src/application/health/UpdateMedicationUseCase.ts          use PetAccessService (edit_medications)
src/application/note/ListNotesUseCase.ts                   check view_notes when petId filter used
src/application/note/CreateNoteUseCase.ts                  check edit_notes for each tagged pet
src/application/note/UpdateNoteUseCase.ts                  no change (note owner only)
src/application/note/DeleteNoteUseCase.ts                  no change (note owner only)
src/application/auth/RegisterUserUseCase.ts                link pending invites on registration
src/infrastructure/db/database.ts                          add new models
src/infrastructure/db/repositories/SequelizePetRepository.ts  add findByIds()
src/infrastructure/http/routes/index.ts                    mount new routes
src/container.ts                                           register new tokens
src/main.ts                                                start TransferExpiryWorker
```

---

## Task 1: Jest + ts-jest test infrastructure

**Files:**
- Create: `jest.config.js`
- Create: `tests/tsconfig.json`
- Modify: `package.json` (scripts only)

- [ ] **Step 1: Install test dependencies**

```bash
pnpm add -D jest @types/jest ts-jest
```

Expected: packages installed, no errors.

- [ ] **Step 2: Create jest.config.js**

```js
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  setupFiles: ['reflect-metadata'],
  globals: {
    'ts-jest': {
      tsconfig: {
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        strict: true,
        esModuleInterop: true,
      },
    },
  },
};
```

- [ ] **Step 3: Add test script to package.json**

In `package.json`, add to `"scripts"`:
```json
"test": "jest",
"test:watch": "jest --watch"
```

- [ ] **Step 4: Create tests directory smoke test**

Create `tests/smoke.test.ts`:
```typescript
describe('test setup', () => {
  it('works', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run to verify**

```bash
pnpm test
```
Expected: `PASS tests/smoke.test.ts` — 1 test passing.

- [ ] **Step 6: Delete smoke test and commit**

```bash
rm tests/smoke.test.ts
git add jest.config.js package.json
git commit -m "chore: add Jest + ts-jest test infrastructure"
```

---

## Task 2: Domain — PetPermission type + PetShare aggregate + PetShareRepository

**Files:**
- Create: `src/domain/share/PetPermission.ts`
- Create: `src/domain/share/PetShare.ts`
- Create: `src/domain/share/PetShareRepository.ts`
- Create: `tests/domain/PetShare.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/domain/PetShare.test.ts`:
```typescript
import 'reflect-metadata';
import { PetShare } from '../../src/domain/share/PetShare';

const base = {
  petId: 'pet-1',
  ownerId: 'owner-1',
  sharedWithUserId: 'user-1',
  invitedEmail: 'user@example.com',
  canViewVetVisits: false,
  canEditVetVisits: false,
  canViewMedications: false,
  canEditMedications: false,
  canViewNotes: false,
  canEditNotes: false,
};

describe('PetShare', () => {
  it('creates with pending status', () => {
    const share = PetShare.create(base);
    expect(share.status).toBe('pending');
  });

  it('accept() sets status to accepted', () => {
    const share = PetShare.create(base);
    share.accept();
    expect(share.status).toBe('accepted');
  });

  it('hasPermission("owner") always returns false', () => {
    const share = PetShare.create({ ...base, canViewVetVisits: true });
    expect(share.hasPermission('owner')).toBe(false);
  });

  it('hasPermission("view_pet") returns true for accepted share', () => {
    const share = PetShare.create(base);
    share.accept();
    expect(share.hasPermission('view_pet')).toBe(true);
  });

  it('canEdit grants canView automatically', () => {
    const share = PetShare.create({ ...base, canEditVetVisits: true });
    expect(share.hasPermission('view_vet_visits')).toBe(true);
    expect(share.hasPermission('edit_vet_visits')).toBe(true);
  });

  it('canView alone does not grant canEdit', () => {
    const share = PetShare.create({ ...base, canViewVetVisits: true });
    expect(share.hasPermission('view_vet_visits')).toBe(true);
    expect(share.hasPermission('edit_vet_visits')).toBe(false);
  });

  it('hasPermission returns false when permission not granted', () => {
    const share = PetShare.create(base);
    expect(share.hasPermission('view_medications')).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify tests fail**

```bash
pnpm test tests/domain/PetShare.test.ts
```
Expected: FAIL — `Cannot find module '../../src/domain/share/PetShare'`

- [ ] **Step 3: Create PetPermission.ts**

```typescript
// src/domain/share/PetPermission.ts
export type PetPermission =
  | 'view_pet'
  | 'owner'
  | 'view_vet_visits' | 'edit_vet_visits'
  | 'view_medications' | 'edit_medications'
  | 'view_notes' | 'edit_notes';
```

- [ ] **Step 4: Create PetShare.ts**

```typescript
// src/domain/share/PetShare.ts
import { AggregateRoot } from '../shared/AggregateRoot';
import { UniqueEntityId } from '../shared/UniqueEntityId';
import { PetPermission } from './PetPermission';

interface PetShareProps {
  petId: string;
  ownerId: string;
  sharedWithUserId: string | null;
  invitedEmail: string;
  status: 'pending' | 'accepted';
  canViewVetVisits: boolean;
  canEditVetVisits: boolean;
  canViewMedications: boolean;
  canEditMedications: boolean;
  canViewNotes: boolean;
  canEditNotes: boolean;
  createdAt: Date;
}

export class PetShare extends AggregateRoot<PetShareProps> {
  get petId(): string { return this.props.petId; }
  get ownerId(): string { return this.props.ownerId; }
  get sharedWithUserId(): string | null { return this.props.sharedWithUserId; }
  get invitedEmail(): string { return this.props.invitedEmail; }
  get status(): 'pending' | 'accepted' { return this.props.status; }
  get canViewVetVisits(): boolean { return this.props.canViewVetVisits; }
  get canEditVetVisits(): boolean { return this.props.canEditVetVisits; }
  get canViewMedications(): boolean { return this.props.canViewMedications; }
  get canEditMedications(): boolean { return this.props.canEditMedications; }
  get canViewNotes(): boolean { return this.props.canViewNotes; }
  get canEditNotes(): boolean { return this.props.canEditNotes; }
  get createdAt(): Date { return this.props.createdAt; }

  accept(): void { this.props.status = 'accepted'; }

  linkUser(userId: string): void { this.props.sharedWithUserId = userId; }

  hasPermission(permission: PetPermission): boolean {
    if (permission === 'owner') return false;
    if (permission === 'view_pet') return true;
    if (permission === 'view_vet_visits') return this.props.canViewVetVisits || this.props.canEditVetVisits;
    if (permission === 'edit_vet_visits') return this.props.canEditVetVisits;
    if (permission === 'view_medications') return this.props.canViewMedications || this.props.canEditMedications;
    if (permission === 'edit_medications') return this.props.canEditMedications;
    if (permission === 'view_notes') return this.props.canViewNotes || this.props.canEditNotes;
    if (permission === 'edit_notes') return this.props.canEditNotes;
    return false;
  }

  static create(
    props: Omit<PetShareProps, 'createdAt' | 'status'>,
    id?: UniqueEntityId,
  ): PetShare {
    return new PetShare({ ...props, status: 'pending', createdAt: new Date() }, id);
  }

  static reconstitute(props: PetShareProps, id: UniqueEntityId): PetShare {
    return new PetShare(props, id);
  }
}
```

- [ ] **Step 5: Create PetShareRepository.ts**

```typescript
// src/domain/share/PetShareRepository.ts
import { PetShare } from './PetShare';

export interface PetShareRepository {
  findById(id: string): Promise<PetShare | null>;
  findByPetId(petId: string): Promise<PetShare[]>;
  findPendingForUser(userId: string): Promise<PetShare[]>;
  findByPetIdAndEmail(petId: string, email: string): Promise<PetShare | null>;
  findAcceptedByPetIdAndUserId(petId: string, userId: string): Promise<PetShare | null>;
  findAcceptedForUser(userId: string): Promise<PetShare[]>;
  linkInvitedUser(email: string, userId: string): Promise<void>;
  save(share: PetShare): Promise<void>;
  delete(id: string): Promise<void>;
}

export const PET_SHARE_REPOSITORY = 'PetShareRepository';
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
pnpm test tests/domain/PetShare.test.ts
```
Expected: PASS — 7 tests passing.

- [ ] **Step 7: Commit**

```bash
git add src/domain/share/ tests/domain/PetShare.test.ts
git commit -m "feat: add PetShare domain aggregate"
```

---

## Task 3: Domain — PetOwnershipTransfer aggregate + PetOwnershipTransferRepository

**Files:**
- Create: `src/domain/transfer/PetOwnershipTransfer.ts`
- Create: `src/domain/transfer/PetOwnershipTransferRepository.ts`
- Create: `tests/domain/PetOwnershipTransfer.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/domain/PetOwnershipTransfer.test.ts`:
```typescript
import 'reflect-metadata';
import { PetOwnershipTransfer } from '../../src/domain/transfer/PetOwnershipTransfer';

const base = {
  petId: 'pet-1',
  fromUserId: 'owner-1',
  toUserId: 'user-2',
  invitedEmail: 'user@example.com',
};

describe('PetOwnershipTransfer', () => {
  it('creates with pending status and 7-day expiry', () => {
    const transfer = PetOwnershipTransfer.create(base);
    expect(transfer.status).toBe('pending');
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    expect(transfer.expiresAt.getTime() - Date.now()).toBeCloseTo(sevenDays, -3);
  });

  it('cancel() sets status to cancelled', () => {
    const transfer = PetOwnershipTransfer.create(base);
    transfer.cancel();
    expect(transfer.status).toBe('cancelled');
  });

  it('expire() sets status to expired', () => {
    const transfer = PetOwnershipTransfer.create(base);
    transfer.expire();
    expect(transfer.status).toBe('expired');
  });

  it('accept() sets status to accepted', () => {
    const transfer = PetOwnershipTransfer.create(base);
    transfer.accept();
    expect(transfer.status).toBe('accepted');
  });

  it('decline() sets status to declined', () => {
    const transfer = PetOwnershipTransfer.create(base);
    transfer.decline();
    expect(transfer.status).toBe('declined');
  });

  it('linkRecipient() sets toUserId', () => {
    const transfer = PetOwnershipTransfer.create({ ...base, toUserId: null });
    transfer.linkRecipient('new-user-id');
    expect(transfer.toUserId).toBe('new-user-id');
  });
});
```

- [ ] **Step 2: Run to verify tests fail**

```bash
pnpm test tests/domain/PetOwnershipTransfer.test.ts
```
Expected: FAIL — `Cannot find module '../../src/domain/transfer/PetOwnershipTransfer'`

- [ ] **Step 3: Create PetOwnershipTransfer.ts**

```typescript
// src/domain/transfer/PetOwnershipTransfer.ts
import { AggregateRoot } from '../shared/AggregateRoot';
import { UniqueEntityId } from '../shared/UniqueEntityId';

export type TransferStatus = 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired';

interface PetOwnershipTransferProps {
  petId: string;
  fromUserId: string;
  toUserId: string | null;
  invitedEmail: string;
  status: TransferStatus;
  expiresAt: Date;
  createdAt: Date;
}

export class PetOwnershipTransfer extends AggregateRoot<PetOwnershipTransferProps> {
  get petId(): string { return this.props.petId; }
  get fromUserId(): string { return this.props.fromUserId; }
  get toUserId(): string | null { return this.props.toUserId; }
  get invitedEmail(): string { return this.props.invitedEmail; }
  get status(): TransferStatus { return this.props.status; }
  get expiresAt(): Date { return this.props.expiresAt; }
  get createdAt(): Date { return this.props.createdAt; }

  cancel(): void { this.props.status = 'cancelled'; }
  expire(): void { this.props.status = 'expired'; }
  accept(): void { this.props.status = 'accepted'; }
  decline(): void { this.props.status = 'declined'; }
  linkRecipient(userId: string): void { this.props.toUserId = userId; }

  static create(
    props: Omit<PetOwnershipTransferProps, 'createdAt' | 'status' | 'expiresAt'>,
    id?: UniqueEntityId,
  ): PetOwnershipTransfer {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    return new PetOwnershipTransfer(
      { ...props, status: 'pending', expiresAt, createdAt: new Date() },
      id,
    );
  }

  static reconstitute(props: PetOwnershipTransferProps, id: UniqueEntityId): PetOwnershipTransfer {
    return new PetOwnershipTransfer(props, id);
  }
}
```

- [ ] **Step 4: Create PetOwnershipTransferRepository.ts**

```typescript
// src/domain/transfer/PetOwnershipTransferRepository.ts
import { PetOwnershipTransfer } from './PetOwnershipTransfer';

export interface PetOwnershipTransferRepository {
  findById(id: string): Promise<PetOwnershipTransfer | null>;
  findActivePendingByPetId(petId: string): Promise<PetOwnershipTransfer | null>;
  findPendingForUser(userId: string): Promise<PetOwnershipTransfer[]>;
  linkInvitedUser(email: string, userId: string): Promise<void>;
  save(transfer: PetOwnershipTransfer): Promise<void>;
}

export const PET_OWNERSHIP_TRANSFER_REPOSITORY = 'PetOwnershipTransferRepository';
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm test tests/domain/PetOwnershipTransfer.test.ts
```
Expected: PASS — 6 tests passing.

- [ ] **Step 6: Commit**

```bash
git add src/domain/transfer/ tests/domain/PetOwnershipTransfer.test.ts
git commit -m "feat: add PetOwnershipTransfer domain aggregate"
```

---

## Task 4: Domain — Pet.transferOwnership() + PetRepository.findByIds()

**Files:**
- Modify: `src/domain/pet/Pet.ts`
- Modify: `src/domain/pet/PetRepository.ts`
- Modify: `src/infrastructure/db/repositories/SequelizePetRepository.ts`

- [ ] **Step 1: Add transferOwnership() to Pet**

In `src/domain/pet/Pet.ts`, add the method after the getters:
```typescript
transferOwnership(newOwnerId: string): void {
  this.props.userId = newOwnerId;
}
```

- [ ] **Step 2: Add findByIds() to PetRepository interface**

In `src/domain/pet/PetRepository.ts`, add to the interface:
```typescript
findByIds(ids: string[]): Promise<Pet[]>;
```

- [ ] **Step 3: Implement findByIds() in SequelizePetRepository**

In `src/infrastructure/db/repositories/SequelizePetRepository.ts`, add:
```typescript
async findByIds(ids: string[]): Promise<Pet[]> {
  const { Op } = await import('sequelize');
  const models = await PetModel.findAll({ where: { id: { [Op.in]: ids } } });
  return models.map((m) => this.mapper.toDomain(m));
}
```

- [ ] **Step 4: Build to verify no type errors**

```bash
pnpm build
```
Expected: completes without TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/domain/pet/Pet.ts src/domain/pet/PetRepository.ts src/infrastructure/db/repositories/SequelizePetRepository.ts
git commit -m "feat: add Pet.transferOwnership() and PetRepository.findByIds()"
```

---

## Task 5: Infrastructure — DB models for pet_shares and pet_ownership_transfers

**Files:**
- Create: `src/infrastructure/db/models/PetShareModel.ts`
- Create: `src/infrastructure/db/models/PetOwnershipTransferModel.ts`
- Modify: `src/infrastructure/db/database.ts`

- [ ] **Step 1: Create PetShareModel.ts**

```typescript
// src/infrastructure/db/models/PetShareModel.ts
import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
  Unique,
} from 'sequelize-typescript';
import { UserModel } from './UserModel';
import { PetModel } from './PetModel';

@Table({ tableName: 'pet_shares', timestamps: false })
export class PetShareModel extends Model {
  @PrimaryKey
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => PetModel)
  @Column({ type: DataType.UUID, allowNull: false, field: 'pet_id' })
  declare petId: string;

  @ForeignKey(() => UserModel)
  @Column({ type: DataType.UUID, allowNull: false, field: 'owner_id' })
  declare ownerId: string;

  @ForeignKey(() => UserModel)
  @Column({ type: DataType.UUID, allowNull: true, field: 'shared_with_user_id' })
  declare sharedWithUserId: string | null;

  @Column({ type: DataType.STRING, allowNull: false, field: 'invited_email' })
  declare invitedEmail: string;

  @Column({ type: DataType.STRING, allowNull: false, defaultValue: 'pending' })
  declare status: string;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false, field: 'can_view_vet_visits' })
  declare canViewVetVisits: boolean;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false, field: 'can_edit_vet_visits' })
  declare canEditVetVisits: boolean;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false, field: 'can_view_medications' })
  declare canViewMedications: boolean;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false, field: 'can_edit_medications' })
  declare canEditMedications: boolean;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false, field: 'can_view_notes' })
  declare canViewNotes: boolean;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false, field: 'can_edit_notes' })
  declare canEditNotes: boolean;

  @Column({ type: DataType.DATE, allowNull: false, field: 'created_at' })
  declare createdAt: Date;

  @BelongsTo(() => PetModel)
  declare pet: PetModel;
}
```

- [ ] **Step 2: Create PetOwnershipTransferModel.ts**

```typescript
// src/infrastructure/db/models/PetOwnershipTransferModel.ts
import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { UserModel } from './UserModel';
import { PetModel } from './PetModel';

@Table({ tableName: 'pet_ownership_transfers', timestamps: false })
export class PetOwnershipTransferModel extends Model {
  @PrimaryKey
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => PetModel)
  @Column({ type: DataType.UUID, allowNull: false, field: 'pet_id' })
  declare petId: string;

  @ForeignKey(() => UserModel)
  @Column({ type: DataType.UUID, allowNull: false, field: 'from_user_id' })
  declare fromUserId: string;

  @ForeignKey(() => UserModel)
  @Column({ type: DataType.UUID, allowNull: true, field: 'to_user_id' })
  declare toUserId: string | null;

  @Column({ type: DataType.STRING, allowNull: false, field: 'invited_email' })
  declare invitedEmail: string;

  @Column({ type: DataType.STRING, allowNull: false, defaultValue: 'pending' })
  declare status: string;

  @Column({ type: DataType.DATE, allowNull: false, field: 'expires_at' })
  declare expiresAt: Date;

  @Column({ type: DataType.DATE, allowNull: false, field: 'created_at' })
  declare createdAt: Date;

  @BelongsTo(() => PetModel)
  declare pet: PetModel;
}
```

- [ ] **Step 3: Register models in database.ts**

In `src/infrastructure/db/database.ts`, add imports and add models to the array:
```typescript
import { PetShareModel } from './models/PetShareModel';
import { PetOwnershipTransferModel } from './models/PetOwnershipTransferModel';
```
Add `PetShareModel` and `PetOwnershipTransferModel` to the `models` array in the Sequelize constructor.

- [ ] **Step 4: Build to verify no type errors**

```bash
pnpm build
```
Expected: no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/db/models/PetShareModel.ts src/infrastructure/db/models/PetOwnershipTransferModel.ts src/infrastructure/db/database.ts
git commit -m "feat: add PetShareModel and PetOwnershipTransferModel"
```

---

## Task 6: Infrastructure — PetShareMapper + SequelizePetShareRepository

**Files:**
- Create: `src/infrastructure/mappers/PetShareMapper.ts`
- Create: `src/infrastructure/db/repositories/SequelizePetShareRepository.ts`

- [ ] **Step 1: Create PetShareMapper.ts**

```typescript
// src/infrastructure/mappers/PetShareMapper.ts
import { Service } from 'typedi';
import { PetShareModel } from '../db/models/PetShareModel';
import { PetShare } from '../../domain/share/PetShare';
import { UniqueEntityId } from '../../domain/shared/UniqueEntityId';

export interface SharePermissionsDto {
  canViewVetVisits: boolean;
  canEditVetVisits: boolean;
  canViewMedications: boolean;
  canEditMedications: boolean;
  canViewNotes: boolean;
  canEditNotes: boolean;
}

export interface PetShareResponseDto {
  id: string;
  petId: string;
  ownerId: string;
  sharedWithUserId: string | null;
  invitedEmail: string;
  status: string;
  permissions: SharePermissionsDto;
  createdAt: string;
}

@Service()
export class PetShareMapper {
  toDomain(model: PetShareModel): PetShare {
    return PetShare.reconstitute(
      {
        petId: model.petId,
        ownerId: model.ownerId,
        sharedWithUserId: model.sharedWithUserId,
        invitedEmail: model.invitedEmail,
        status: model.status as 'pending' | 'accepted',
        canViewVetVisits: model.canViewVetVisits,
        canEditVetVisits: model.canEditVetVisits,
        canViewMedications: model.canViewMedications,
        canEditMedications: model.canEditMedications,
        canViewNotes: model.canViewNotes,
        canEditNotes: model.canEditNotes,
        createdAt: model.createdAt,
      },
      new UniqueEntityId(model.id),
    );
  }

  toPersistence(share: PetShare): object {
    return {
      id: share.id.toValue(),
      petId: share.petId,
      ownerId: share.ownerId,
      sharedWithUserId: share.sharedWithUserId,
      invitedEmail: share.invitedEmail,
      status: share.status,
      canViewVetVisits: share.canViewVetVisits,
      canEditVetVisits: share.canEditVetVisits,
      canViewMedications: share.canViewMedications,
      canEditMedications: share.canEditMedications,
      canViewNotes: share.canViewNotes,
      canEditNotes: share.canEditNotes,
      createdAt: share.createdAt,
    };
  }

  toResponse(share: PetShare): PetShareResponseDto {
    return {
      id: share.id.toValue(),
      petId: share.petId,
      ownerId: share.ownerId,
      sharedWithUserId: share.sharedWithUserId,
      invitedEmail: share.invitedEmail,
      status: share.status,
      permissions: {
        canViewVetVisits: share.canViewVetVisits,
        canEditVetVisits: share.canEditVetVisits,
        canViewMedications: share.canViewMedications,
        canEditMedications: share.canEditMedications,
        canViewNotes: share.canViewNotes,
        canEditNotes: share.canEditNotes,
      },
      createdAt: share.createdAt.toISOString(),
    };
  }
}
```

- [ ] **Step 2: Create SequelizePetShareRepository.ts**

```typescript
// src/infrastructure/db/repositories/SequelizePetShareRepository.ts
import { Service } from 'typedi';
import { Op } from 'sequelize';
import { PetShareModel } from '../models/PetShareModel';
import { PetShareRepository } from '../../../domain/share/PetShareRepository';
import { PetShare } from '../../../domain/share/PetShare';
import { PetShareMapper } from '../../mappers/PetShareMapper';

@Service()
export class SequelizePetShareRepository implements PetShareRepository {
  constructor(private readonly mapper: PetShareMapper) {}

  async findById(id: string): Promise<PetShare | null> {
    const model = await PetShareModel.findByPk(id);
    return model ? this.mapper.toDomain(model) : null;
  }

  async findByPetId(petId: string): Promise<PetShare[]> {
    const models = await PetShareModel.findAll({ where: { petId } });
    return models.map((m) => this.mapper.toDomain(m));
  }

  async findPendingForUser(userId: string): Promise<PetShare[]> {
    const models = await PetShareModel.findAll({
      where: { sharedWithUserId: userId, status: 'pending' },
    });
    return models.map((m) => this.mapper.toDomain(m));
  }

  async findByPetIdAndEmail(petId: string, email: string): Promise<PetShare | null> {
    const model = await PetShareModel.findOne({
      where: { petId, invitedEmail: email, status: { [Op.ne]: 'declined' } },
    });
    return model ? this.mapper.toDomain(model) : null;
  }

  async findAcceptedByPetIdAndUserId(petId: string, userId: string): Promise<PetShare | null> {
    const model = await PetShareModel.findOne({
      where: { petId, sharedWithUserId: userId, status: 'accepted' },
    });
    return model ? this.mapper.toDomain(model) : null;
  }

  async findAcceptedForUser(userId: string): Promise<PetShare[]> {
    const models = await PetShareModel.findAll({
      where: { sharedWithUserId: userId, status: 'accepted' },
    });
    return models.map((m) => this.mapper.toDomain(m));
  }

  async linkInvitedUser(email: string, userId: string): Promise<void> {
    await PetShareModel.update(
      { sharedWithUserId: userId },
      { where: { invitedEmail: email, sharedWithUserId: null } },
    );
  }

  async save(share: PetShare): Promise<void> {
    await PetShareModel.upsert(this.mapper.toPersistence(share) as any);
  }

  async delete(id: string): Promise<void> {
    await PetShareModel.destroy({ where: { id } });
  }
}
```

- [ ] **Step 3: Build to verify no type errors**

```bash
pnpm build
```
Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/infrastructure/mappers/PetShareMapper.ts src/infrastructure/db/repositories/SequelizePetShareRepository.ts
git commit -m "feat: add PetShareMapper and SequelizePetShareRepository"
```

---

## Task 7: Infrastructure — PetOwnershipTransferMapper + SequelizePetOwnershipTransferRepository

**Files:**
- Create: `src/infrastructure/mappers/PetOwnershipTransferMapper.ts`
- Create: `src/infrastructure/db/repositories/SequelizePetOwnershipTransferRepository.ts`

- [ ] **Step 1: Create PetOwnershipTransferMapper.ts**

```typescript
// src/infrastructure/mappers/PetOwnershipTransferMapper.ts
import { Service } from 'typedi';
import { PetOwnershipTransferModel } from '../db/models/PetOwnershipTransferModel';
import { PetOwnershipTransfer, TransferStatus } from '../../domain/transfer/PetOwnershipTransfer';
import { UniqueEntityId } from '../../domain/shared/UniqueEntityId';

export interface PetOwnershipTransferResponseDto {
  id: string;
  petId: string;
  fromUserId: string;
  toUserId: string | null;
  invitedEmail: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

@Service()
export class PetOwnershipTransferMapper {
  toDomain(model: PetOwnershipTransferModel): PetOwnershipTransfer {
    return PetOwnershipTransfer.reconstitute(
      {
        petId: model.petId,
        fromUserId: model.fromUserId,
        toUserId: model.toUserId,
        invitedEmail: model.invitedEmail,
        status: model.status as TransferStatus,
        expiresAt: model.expiresAt,
        createdAt: model.createdAt,
      },
      new UniqueEntityId(model.id),
    );
  }

  toPersistence(transfer: PetOwnershipTransfer): object {
    return {
      id: transfer.id.toValue(),
      petId: transfer.petId,
      fromUserId: transfer.fromUserId,
      toUserId: transfer.toUserId,
      invitedEmail: transfer.invitedEmail,
      status: transfer.status,
      expiresAt: transfer.expiresAt,
      createdAt: transfer.createdAt,
    };
  }

  toResponse(transfer: PetOwnershipTransfer): PetOwnershipTransferResponseDto {
    return {
      id: transfer.id.toValue(),
      petId: transfer.petId,
      fromUserId: transfer.fromUserId,
      toUserId: transfer.toUserId,
      invitedEmail: transfer.invitedEmail,
      status: transfer.status,
      expiresAt: transfer.expiresAt.toISOString(),
      createdAt: transfer.createdAt.toISOString(),
    };
  }
}
```

- [ ] **Step 2: Create SequelizePetOwnershipTransferRepository.ts**

```typescript
// src/infrastructure/db/repositories/SequelizePetOwnershipTransferRepository.ts
import { Service } from 'typedi';
import { PetOwnershipTransferModel } from '../models/PetOwnershipTransferModel';
import { PetOwnershipTransferRepository } from '../../../domain/transfer/PetOwnershipTransferRepository';
import { PetOwnershipTransfer } from '../../../domain/transfer/PetOwnershipTransfer';
import { PetOwnershipTransferMapper } from '../../mappers/PetOwnershipTransferMapper';

@Service()
export class SequelizePetOwnershipTransferRepository implements PetOwnershipTransferRepository {
  constructor(private readonly mapper: PetOwnershipTransferMapper) {}

  async findById(id: string): Promise<PetOwnershipTransfer | null> {
    const model = await PetOwnershipTransferModel.findByPk(id);
    return model ? this.mapper.toDomain(model) : null;
  }

  async findActivePendingByPetId(petId: string): Promise<PetOwnershipTransfer | null> {
    const model = await PetOwnershipTransferModel.findOne({
      where: { petId, status: 'pending' },
    });
    return model ? this.mapper.toDomain(model) : null;
  }

  async findPendingForUser(userId: string): Promise<PetOwnershipTransfer[]> {
    const models = await PetOwnershipTransferModel.findAll({
      where: { toUserId: userId, status: 'pending' },
    });
    return models.map((m) => this.mapper.toDomain(m));
  }

  async linkInvitedUser(email: string, userId: string): Promise<void> {
    await PetOwnershipTransferModel.update(
      { toUserId: userId },
      { where: { invitedEmail: email, toUserId: null, status: 'pending' } },
    );
  }

  async save(transfer: PetOwnershipTransfer): Promise<void> {
    await PetOwnershipTransferModel.upsert(this.mapper.toPersistence(transfer) as any);
  }
}
```

- [ ] **Step 3: Build and commit**

```bash
pnpm build
git add src/infrastructure/mappers/PetOwnershipTransferMapper.ts src/infrastructure/db/repositories/SequelizePetOwnershipTransferRepository.ts
git commit -m "feat: add PetOwnershipTransferMapper and SequelizePetOwnershipTransferRepository"
```

---

## Task 8: DI container wiring

**Files:**
- Modify: `src/container.ts`

- [ ] **Step 1: Register new tokens in container.ts**

Add imports and registrations to `src/container.ts`:
```typescript
import { SequelizePetShareRepository } from './infrastructure/db/repositories/SequelizePetShareRepository';
import { SequelizePetOwnershipTransferRepository } from './infrastructure/db/repositories/SequelizePetOwnershipTransferRepository';
import { PET_SHARE_REPOSITORY } from './domain/share/PetShareRepository';
import { PET_OWNERSHIP_TRANSFER_REPOSITORY } from './domain/transfer/PetOwnershipTransferRepository';
```

Inside `registerDependencies()`, add:
```typescript
Container.set(PET_SHARE_REPOSITORY, Container.get(SequelizePetShareRepository));
Container.set(PET_OWNERSHIP_TRANSFER_REPOSITORY, Container.get(SequelizePetOwnershipTransferRepository));
```

- [ ] **Step 2: Build and commit**

```bash
pnpm build
git add src/container.ts
git commit -m "feat: register PetShare and PetOwnershipTransfer DI tokens"
```

---

## Task 9: Application — PetAccessService

**Files:**
- Create: `src/application/pet/PetAccessService.ts`
- Create: `tests/application/PetAccessService.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/application/PetAccessService.test.ts`:
```typescript
import 'reflect-metadata';
import { PetAccessService } from '../../src/application/pet/PetAccessService';
import { PetRepository } from '../../src/domain/pet/PetRepository';
import { PetShareRepository } from '../../src/domain/share/PetShareRepository';
import { Pet } from '../../src/domain/pet/Pet';
import { PetShare } from '../../src/domain/share/PetShare';
import { UniqueEntityId } from '../../src/domain/shared/UniqueEntityId';
import { ForbiddenError, NotFoundError } from '../../src/shared/errors/AppError';

function makePet(userId: string): Pet {
  return Pet.reconstitute(
    { name: 'Rex', species: 'dog', userId, createdAt: new Date() },
    new UniqueEntityId('pet-1'),
  );
}

function makeShare(overrides: Partial<Parameters<typeof PetShare.create>[0]> = {}): PetShare {
  const share = PetShare.create({
    petId: 'pet-1',
    ownerId: 'owner-1',
    sharedWithUserId: 'user-2',
    invitedEmail: 'user@example.com',
    canViewVetVisits: false,
    canEditVetVisits: false,
    canViewMedications: false,
    canEditMedications: false,
    canViewNotes: false,
    canEditNotes: false,
    ...overrides,
  });
  share.accept();
  return share;
}

function makeService(pet: Pet | null, share: PetShare | null): PetAccessService {
  const petRepo = { findById: jest.fn().mockResolvedValue(pet) } as unknown as PetRepository;
  const shareRepo = {
    findAcceptedByPetIdAndUserId: jest.fn().mockResolvedValue(share),
  } as unknown as PetShareRepository;
  return new PetAccessService(petRepo, shareRepo);
}

describe('PetAccessService', () => {
  it('throws NotFoundError when pet does not exist', async () => {
    const svc = makeService(null, null);
    await expect(svc.assertCanAccess('pet-1', 'user-1', 'view_pet')).rejects.toThrow(NotFoundError);
  });

  it('allows owner for any permission', async () => {
    const pet = makePet('owner-1');
    const svc = makeService(pet, null);
    await expect(svc.assertCanAccess('pet-1', 'owner-1', 'owner')).resolves.toBe(pet);
    await expect(svc.assertCanAccess('pet-1', 'owner-1', 'edit_vet_visits')).resolves.toBe(pet);
  });

  it('throws ForbiddenError when no accepted share exists', async () => {
    const pet = makePet('owner-1');
    const svc = makeService(pet, null);
    await expect(svc.assertCanAccess('pet-1', 'user-2', 'view_pet')).rejects.toThrow(ForbiddenError);
  });

  it('throws ForbiddenError when sharer requests owner permission', async () => {
    const pet = makePet('owner-1');
    const share = makeShare();
    const svc = makeService(pet, share);
    await expect(svc.assertCanAccess('pet-1', 'user-2', 'owner')).rejects.toThrow(ForbiddenError);
  });

  it('allows sharer with correct permission', async () => {
    const pet = makePet('owner-1');
    const share = makeShare({ canViewVetVisits: true });
    const svc = makeService(pet, share);
    await expect(svc.assertCanAccess('pet-1', 'user-2', 'view_vet_visits')).resolves.toBe(pet);
  });

  it('denies sharer without required permission', async () => {
    const pet = makePet('owner-1');
    const share = makeShare({ canViewVetVisits: false });
    const svc = makeService(pet, share);
    await expect(svc.assertCanAccess('pet-1', 'user-2', 'view_vet_visits')).rejects.toThrow(ForbiddenError);
  });
});
```

- [ ] **Step 2: Run to verify tests fail**

```bash
pnpm test tests/application/PetAccessService.test.ts
```
Expected: FAIL — `Cannot find module '../../src/application/pet/PetAccessService'`

- [ ] **Step 3: Create PetAccessService.ts**

```typescript
// src/application/pet/PetAccessService.ts
import { Inject, Service } from 'typedi';
import { PetRepository, PET_REPOSITORY } from '../../domain/pet/PetRepository';
import { PetShareRepository, PET_SHARE_REPOSITORY } from '../../domain/share/PetShareRepository';
import { PetPermission } from '../../domain/share/PetPermission';
import { Pet } from '../../domain/pet/Pet';
import { ForbiddenError, NotFoundError } from '../../shared/errors/AppError';

@Service()
export class PetAccessService {
  constructor(
    @Inject(PET_REPOSITORY) private readonly petRepo: PetRepository,
    @Inject(PET_SHARE_REPOSITORY) private readonly shareRepo: PetShareRepository,
  ) {}

  async assertCanAccess(petId: string, userId: string, permission: PetPermission): Promise<Pet> {
    const pet = await this.petRepo.findById(petId);
    if (!pet) throw new NotFoundError('Pet');
    if (pet.userId === userId) return pet;

    const share = await this.shareRepo.findAcceptedByPetIdAndUserId(petId, userId);
    if (!share) throw new ForbiddenError();
    if (!share.hasPermission(permission)) throw new ForbiddenError();
    return pet;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test tests/application/PetAccessService.test.ts
```
Expected: PASS — 6 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/application/pet/PetAccessService.ts tests/application/PetAccessService.test.ts
git commit -m "feat: add PetAccessService for centralized pet permission checks"
```

---

## Task 10: Update all existing use cases to use PetAccessService

For each use case below, replace the manual pet fetch + ownership check with `await this.petAccessService.assertCanAccess(...)`. The pattern is identical across all of them.

**Current pattern (to replace in every use case):**
```typescript
const pet = await this.petRepository.findById(input.petId);
if (!pet) throw new NotFoundError('Pet');
if (pet.userId !== input.requestingUserId) throw new ForbiddenError('Not your pet');
```

**New pattern:**
```typescript
const pet = await this.petAccessService.assertCanAccess(input.petId, input.requestingUserId, '<permission>');
```

Add `PetAccessService` to each constructor:
```typescript
private readonly petAccessService: PetAccessService,
```

(typedi resolves it automatically — no `@Inject` needed for `@Service()` classes.)

Remove the `PET_REPOSITORY` injection and import from any use case that no longer needs it for other purposes after this change.

**Files and their required permissions:**

| File | Permission |
|---|---|
| `src/application/pet/GetPetUseCase.ts` | `'view_pet'` |
| `src/application/pet/UpdatePetUseCase.ts` | `'owner'` |
| `src/application/health/ListVetVisitsUseCase.ts` | `'view_vet_visits'` |
| `src/application/health/ListVetVisitsByDateRangeUseCase.ts` | `'view_vet_visits'` |
| `src/application/health/AddVetVisitUseCase.ts` | `'edit_vet_visits'` |
| `src/application/health/UpdateVetVisitUseCase.ts` | `'edit_vet_visits'` |
| `src/application/health/CompleteVetVisitUseCase.ts` | `'edit_vet_visits'` |
| `src/application/health/AddVetVisitImageUseCase.ts` | `'edit_vet_visits'` |
| `src/application/health/ListMedicationsUseCase.ts` | `'view_medications'` |
| `src/application/health/LogMedicationUseCase.ts` | `'edit_medications'` |
| `src/application/health/UpdateMedicationUseCase.ts` | `'edit_medications'` |
| `src/application/reminder/ConfigureMedicationReminderUseCase.ts` | `'view_pet'` |
| `src/application/reminder/ToggleMedicationReminderUseCase.ts` | `'view_pet'` |
| `src/application/reminder/ConfigureVetVisitReminderUseCase.ts` | `'view_pet'` |

- [ ] **Step 1: Update GetPetUseCase**

Replace entire file content:
```typescript
// src/application/pet/GetPetUseCase.ts
import { Service } from 'typedi';
import { Pet } from '../../domain/pet/Pet';
import { PetAccessService } from './PetAccessService';

@Service()
export class GetPetUseCase {
  constructor(private readonly petAccessService: PetAccessService) {}

  async execute(petId: string, requestingUserId: string): Promise<Pet> {
    return this.petAccessService.assertCanAccess(petId, requestingUserId, 'view_pet');
  }
}
```

- [ ] **Step 2: Update UpdatePetUseCase**

Add `PetAccessService` to constructor and replace the ownership check line. The full new constructor and execute start:
```typescript
constructor(
  @Inject(PET_REPOSITORY) private readonly petRepository: PetRepository,
  private readonly petAccessService: PetAccessService,
) {}

async execute(input: UpdatePetInput): Promise<Pet> {
  const pet = await this.petAccessService.assertCanAccess(input.petId, input.requestingUserId, 'owner');
  // rest of method unchanged — applies updates to pet, calls petRepository.save(pet)
```

- [ ] **Step 3: Update all health use cases**

For each file in the table above (health category), apply the same change:

**ListVetVisitsUseCase** — new constructor + execute start:
```typescript
constructor(
  @Inject(HEALTH_RECORD_REPOSITORY) private readonly healthRepo: HealthRecordRepository,
  private readonly petAccessService: PetAccessService,
) {}

async execute(petId: string, requestingUserId: string, pagination: PaginationParams): Promise<PaginatedResult<VetVisit>> {
  await this.petAccessService.assertCanAccess(petId, requestingUserId, 'view_vet_visits');
  return this.healthRepo.findVetVisitsByPetId(petId, pagination);
}
```

For `AddVetVisitUseCase` — replace the 3-line check with:
```typescript
const pet = await this.petAccessService.assertCanAccess(input.petId, input.requestingUserId, 'edit_vet_visits');
```
Remove the `PET_REPOSITORY` injection and import (pet is still used for `pet.name` in reminders — keep the variable).

Apply the same pattern to each remaining health use case. Remove the `PET_REPOSITORY` injection from use cases that no longer need it for anything else. Keep it in `AddVetVisitUseCase` since `pet.name` is used for reminder scheduling.

- [ ] **Step 4: Update note use cases**

`ListNotesUseCase` — when `petId` filter is provided, verify the user has access. Add `PetAccessService` to constructor:
```typescript
constructor(
  @Inject(NOTE_REPOSITORY) private readonly noteRepository: NoteRepository,
  private readonly noteMapper: NoteMapper,
  private readonly petAccessService: PetAccessService,
) {}

async execute(input: ListNotesInput): Promise<NoteResponseDto[]> {
  if (input.petId) {
    await this.petAccessService.assertCanAccess(input.petId, input.userId, 'view_notes');
  }
  const notes = await this.noteRepository.findByUserId(input.userId, {
    petId: input.petId,
    from: input.from,
    to: input.to,
  });
  return notes.map((n) => this.noteMapper.toResponse(n));
}
```

`CreateNoteUseCase` — check `edit_notes` for each tagged pet:
```typescript
constructor(
  @Inject(NOTE_REPOSITORY) private readonly noteRepository: NoteRepository,
  private readonly noteMapper: NoteMapper,
  private readonly petAccessService: PetAccessService,
) {}

async execute(input: CreateNoteInput): Promise<NoteResponseDto> {
  for (const petId of input.petIds ?? []) {
    await this.petAccessService.assertCanAccess(petId, input.userId, 'edit_notes');
  }
  // rest unchanged
```

- [ ] **Step 5: Build to verify no type errors**

```bash
pnpm build
```
Expected: no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/application/pet/GetPetUseCase.ts src/application/pet/UpdatePetUseCase.ts src/application/health/ src/application/note/ListNotesUseCase.ts src/application/note/CreateNoteUseCase.ts
git commit -m "feat: replace inline ownership checks with PetAccessService"
```

---

## Task 11: RegisterUserUseCase — link pending invites on registration

**Files:**
- Modify: `src/application/auth/RegisterUserUseCase.ts`

- [ ] **Step 1: Add invite linking to RegisterUserUseCase**

Replace entire file:
```typescript
// src/application/auth/RegisterUserUseCase.ts
import { Inject, Service } from 'typedi';
import bcrypt from 'bcryptjs';
import { UserRepository, USER_REPOSITORY } from '../../domain/user/UserRepository';
import { PetShareRepository, PET_SHARE_REPOSITORY } from '../../domain/share/PetShareRepository';
import { PetOwnershipTransferRepository, PET_OWNERSHIP_TRANSFER_REPOSITORY } from '../../domain/transfer/PetOwnershipTransferRepository';
import { User } from '../../domain/user/User';
import { AppError } from '../../shared/errors/AppError';

interface RegisterUserInput {
  name: string;
  email: string;
  password: string;
}

@Service()
export class RegisterUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(PET_SHARE_REPOSITORY) private readonly shareRepo: PetShareRepository,
    @Inject(PET_OWNERSHIP_TRANSFER_REPOSITORY) private readonly transferRepo: PetOwnershipTransferRepository,
  ) {}

  async execute(input: RegisterUserInput): Promise<{ id: string }> {
    const existing = await this.userRepository.findByEmail(input.email);
    if (existing) throw new AppError('Email already in use', 409);

    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = User.create({ name: input.name, email: input.email, passwordHash });

    await this.userRepository.save(user);

    const userId = user.id.toValue();
    await this.shareRepo.linkInvitedUser(input.email, userId);
    await this.transferRepo.linkInvitedUser(input.email, userId);

    return { id: userId };
  }
}
```

- [ ] **Step 2: Build and commit**

```bash
pnpm build
git add src/application/auth/RegisterUserUseCase.ts
git commit -m "feat: link pending share/transfer invites when new user registers"
```

---

## Task 12: Share use cases — owner side

**Files:**
- Create: `src/application/share/SharePetUseCase.ts`
- Create: `src/application/share/UpdateSharePermissionsUseCase.ts`
- Create: `src/application/share/RevokeShareUseCase.ts`
- Create: `src/application/share/ListPetSharesUseCase.ts`
- Create: `tests/application/share/SharePetUseCase.test.ts`

- [ ] **Step 1: Write the failing test for SharePetUseCase**

Create `tests/application/share/SharePetUseCase.test.ts`:
```typescript
import 'reflect-metadata';
import { SharePetUseCase } from '../../../src/application/share/SharePetUseCase';
import { PetAccessService } from '../../../src/application/pet/PetAccessService';
import { UserRepository } from '../../../src/domain/user/UserRepository';
import { PetShareRepository } from '../../../src/domain/share/PetShareRepository';
import { EmailService } from '../../../src/infrastructure/email/EmailService';
import { Pet } from '../../../src/domain/pet/Pet';
import { UniqueEntityId } from '../../../src/domain/shared/UniqueEntityId';
import { AppError } from '../../../src/shared/errors/AppError';

const mockPet = Pet.reconstitute(
  { name: 'Rex', species: 'dog', userId: 'owner-1', createdAt: new Date() },
  new UniqueEntityId('pet-1'),
);

const basePermissions = {
  canViewVetVisits: true,
  canEditVetVisits: false,
  canViewMedications: false,
  canEditMedications: false,
  canViewNotes: false,
  canEditNotes: false,
};

function makeUseCase(existingShare: any = null, targetUser: any = null) {
  const petAccessService = { assertCanAccess: jest.fn().mockResolvedValue(mockPet) } as unknown as PetAccessService;
  const userRepo = { findByEmail: jest.fn().mockResolvedValue(targetUser) } as unknown as UserRepository;
  const shareRepo = {
    findByPetIdAndEmail: jest.fn().mockResolvedValue(existingShare),
    save: jest.fn().mockResolvedValue(undefined),
  } as unknown as PetShareRepository;
  const emailService = { send: jest.fn().mockResolvedValue(undefined) } as unknown as EmailService;
  return { useCase: new SharePetUseCase(petAccessService, userRepo, shareRepo, emailService), shareRepo, emailService };
}

describe('SharePetUseCase', () => {
  it('creates a share and sends notification when user exists', async () => {
    const targetUser = { id: new UniqueEntityId('user-2') };
    const { useCase, shareRepo, emailService } = makeUseCase(null, targetUser);
    await useCase.execute({ petId: 'pet-1', requestingUserId: 'owner-1', email: 'user@example.com', permissions: basePermissions });
    expect(shareRepo.save).toHaveBeenCalledTimes(1);
    expect(emailService.send).toHaveBeenCalledTimes(1);
  });

  it('creates a share and sends invite when user does not exist', async () => {
    const { useCase, shareRepo, emailService } = makeUseCase(null, null);
    await useCase.execute({ petId: 'pet-1', requestingUserId: 'owner-1', email: 'new@example.com', permissions: basePermissions });
    expect(shareRepo.save).toHaveBeenCalledTimes(1);
    expect(emailService.send).toHaveBeenCalledTimes(1);
  });

  it('throws 409 when pet already shared with that email', async () => {
    const existing = {};
    const { useCase } = makeUseCase(existing, null);
    await expect(
      useCase.execute({ petId: 'pet-1', requestingUserId: 'owner-1', email: 'user@example.com', permissions: basePermissions }),
    ).rejects.toThrow(AppError);
  });
});
```

- [ ] **Step 2: Run to verify tests fail**

```bash
pnpm test tests/application/share/SharePetUseCase.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Create SharePetUseCase.ts**

```typescript
// src/application/share/SharePetUseCase.ts
import { Inject, Service } from 'typedi';
import { PetAccessService } from '../pet/PetAccessService';
import { UserRepository, USER_REPOSITORY } from '../../domain/user/UserRepository';
import { PetShareRepository, PET_SHARE_REPOSITORY } from '../../domain/share/PetShareRepository';
import { PetShare } from '../../domain/share/PetShare';
import { EmailService } from '../../infrastructure/email/EmailService';
import { AppError } from '../../shared/errors/AppError';
import { petShareNotificationHtml } from '../../infrastructure/email/templates/petShareNotification';
import { petShareInviteHtml } from '../../infrastructure/email/templates/petShareInvite';

interface SharePermissionsInput {
  canViewVetVisits: boolean;
  canEditVetVisits: boolean;
  canViewMedications: boolean;
  canEditMedications: boolean;
  canViewNotes: boolean;
  canEditNotes: boolean;
}

interface SharePetInput {
  petId: string;
  requestingUserId: string;
  email: string;
  permissions: SharePermissionsInput;
}

@Service()
export class SharePetUseCase {
  constructor(
    private readonly petAccessService: PetAccessService,
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(PET_SHARE_REPOSITORY) private readonly shareRepo: PetShareRepository,
    private readonly emailService: EmailService,
  ) {}

  async execute(input: SharePetInput): Promise<PetShare> {
    const pet = await this.petAccessService.assertCanAccess(input.petId, input.requestingUserId, 'owner');

    const existing = await this.shareRepo.findByPetIdAndEmail(input.petId, input.email);
    if (existing) throw new AppError('Pet already shared with this email', 409);

    const targetUser = await this.userRepo.findByEmail(input.email);

    const share = PetShare.create({
      petId: input.petId,
      ownerId: input.requestingUserId,
      sharedWithUserId: targetUser?.id.toValue() ?? null,
      invitedEmail: input.email,
      ...input.permissions,
    });

    await this.shareRepo.save(share);

    if (targetUser) {
      await this.emailService.send({
        to: input.email,
        subject: `${pet.name} has been shared with you`,
        html: petShareNotificationHtml({ petName: pet.name }),
      });
    } else {
      await this.emailService.send({
        to: input.email,
        subject: `You've been invited to care for a pet`,
        html: petShareInviteHtml({ petName: pet.name }),
      });
    }

    return share;
  }
}
```

- [ ] **Step 4: Add updatePermissions() to PetShare domain + create UpdateSharePermissionsUseCase**

First, add this method to `src/domain/share/PetShare.ts` after `accept()`:
```typescript
updatePermissions(perms: {
  canViewVetVisits: boolean;
  canEditVetVisits: boolean;
  canViewMedications: boolean;
  canEditMedications: boolean;
  canViewNotes: boolean;
  canEditNotes: boolean;
}): void {
  this.props.canViewVetVisits = perms.canViewVetVisits;
  this.props.canEditVetVisits = perms.canEditVetVisits;
  this.props.canViewMedications = perms.canViewMedications;
  this.props.canEditMedications = perms.canEditMedications;
  this.props.canViewNotes = perms.canViewNotes;
  this.props.canEditNotes = perms.canEditNotes;
}
```

Then create `src/application/share/UpdateSharePermissionsUseCase.ts`:
```typescript
import { Inject, Service } from 'typedi';
import { PetAccessService } from '../pet/PetAccessService';
import { PetShareRepository, PET_SHARE_REPOSITORY } from '../../domain/share/PetShareRepository';
import { PetShare } from '../../domain/share/PetShare';
import { ForbiddenError, NotFoundError } from '../../shared/errors/AppError';

interface UpdatePermissionsInput {
  petId: string;
  shareId: string;
  requestingUserId: string;
  canViewVetVisits: boolean;
  canEditVetVisits: boolean;
  canViewMedications: boolean;
  canEditMedications: boolean;
  canViewNotes: boolean;
  canEditNotes: boolean;
}

@Service()
export class UpdateSharePermissionsUseCase {
  constructor(
    private readonly petAccessService: PetAccessService,
    @Inject(PET_SHARE_REPOSITORY) private readonly shareRepo: PetShareRepository,
  ) {}

  async execute(input: UpdatePermissionsInput): Promise<PetShare> {
    await this.petAccessService.assertCanAccess(input.petId, input.requestingUserId, 'owner');
    const share = await this.shareRepo.findById(input.shareId);
    if (!share) throw new NotFoundError('Share');
    if (share.petId !== input.petId) throw new ForbiddenError();
    share.updatePermissions({
      canViewVetVisits: input.canViewVetVisits,
      canEditVetVisits: input.canEditVetVisits,
      canViewMedications: input.canViewMedications,
      canEditMedications: input.canEditMedications,
      canViewNotes: input.canViewNotes,
      canEditNotes: input.canEditNotes,
    });
    await this.shareRepo.save(share);
    return share;
  }
}
```

- [ ] **Step 5: Create RevokeShareUseCase.ts**

```typescript
// src/application/share/RevokeShareUseCase.ts
import { Inject, Service } from 'typedi';
import { PetAccessService } from '../pet/PetAccessService';
import { PetShareRepository, PET_SHARE_REPOSITORY } from '../../domain/share/PetShareRepository';
import { ForbiddenError, NotFoundError } from '../../shared/errors/AppError';

@Service()
export class RevokeShareUseCase {
  constructor(
    private readonly petAccessService: PetAccessService,
    @Inject(PET_SHARE_REPOSITORY) private readonly shareRepo: PetShareRepository,
  ) {}

  async execute(petId: string, shareId: string, requestingUserId: string): Promise<void> {
    await this.petAccessService.assertCanAccess(petId, requestingUserId, 'owner');
    const share = await this.shareRepo.findById(shareId);
    if (!share) throw new NotFoundError('Share');
    if (share.petId !== petId) throw new ForbiddenError();
    await this.shareRepo.delete(shareId);
  }
}
```

- [ ] **Step 6: Create ListPetSharesUseCase.ts**

```typescript
// src/application/share/ListPetSharesUseCase.ts
import { Inject, Service } from 'typedi';
import { PetAccessService } from '../pet/PetAccessService';
import { PetShareRepository, PET_SHARE_REPOSITORY } from '../../domain/share/PetShareRepository';
import { PetShare } from '../../domain/share/PetShare';

@Service()
export class ListPetSharesUseCase {
  constructor(
    private readonly petAccessService: PetAccessService,
    @Inject(PET_SHARE_REPOSITORY) private readonly shareRepo: PetShareRepository,
  ) {}

  async execute(petId: string, requestingUserId: string): Promise<PetShare[]> {
    await this.petAccessService.assertCanAccess(petId, requestingUserId, 'owner');
    return this.shareRepo.findByPetId(petId);
  }
}
```

- [ ] **Step 7: Run SharePetUseCase tests and build**

```bash
pnpm test tests/application/share/SharePetUseCase.test.ts
pnpm build
```
Expected: tests PASS, build succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/application/share/ src/domain/share/PetShare.ts tests/application/share/SharePetUseCase.test.ts
git commit -m "feat: add owner-side share use cases"
```

---

## Task 13: Share use cases — recipient side

**Files:**
- Create: `src/application/share/ListPendingSharesUseCase.ts`
- Create: `src/application/share/AcceptShareUseCase.ts`
- Create: `src/application/share/DeclineShareUseCase.ts`
- Create: `src/application/share/ListSharedPetsUseCase.ts`
- Create: `tests/application/share/AcceptShareUseCase.test.ts`

- [ ] **Step 1: Write failing test for AcceptShareUseCase**

Create `tests/application/share/AcceptShareUseCase.test.ts`:
```typescript
import 'reflect-metadata';
import { AcceptShareUseCase } from '../../../src/application/share/AcceptShareUseCase';
import { PetShareRepository } from '../../../src/domain/share/PetShareRepository';
import { PetShare } from '../../../src/domain/share/PetShare';
import { UniqueEntityId } from '../../../src/domain/shared/UniqueEntityId';
import { ForbiddenError, NotFoundError } from '../../../src/shared/errors/AppError';

function makeShare(userId: string): PetShare {
  return PetShare.reconstitute(
    {
      petId: 'pet-1', ownerId: 'owner-1', sharedWithUserId: userId,
      invitedEmail: 'user@example.com', status: 'pending',
      canViewVetVisits: false, canEditVetVisits: false,
      canViewMedications: false, canEditMedications: false,
      canViewNotes: false, canEditNotes: false,
      createdAt: new Date(),
    },
    new UniqueEntityId('share-1'),
  );
}

describe('AcceptShareUseCase', () => {
  it('accepts the share and saves it', async () => {
    const share = makeShare('user-2');
    const shareRepo = { findById: jest.fn().mockResolvedValue(share), save: jest.fn() } as unknown as PetShareRepository;
    const useCase = new AcceptShareUseCase(shareRepo);
    await useCase.execute('share-1', 'user-2');
    expect(share.status).toBe('accepted');
    expect(shareRepo.save).toHaveBeenCalledWith(share);
  });

  it('throws NotFoundError when share not found', async () => {
    const shareRepo = { findById: jest.fn().mockResolvedValue(null) } as unknown as PetShareRepository;
    const useCase = new AcceptShareUseCase(shareRepo);
    await expect(useCase.execute('share-1', 'user-2')).rejects.toThrow(NotFoundError);
  });

  it('throws ForbiddenError when share belongs to different user', async () => {
    const share = makeShare('user-2');
    const shareRepo = { findById: jest.fn().mockResolvedValue(share) } as unknown as PetShareRepository;
    const useCase = new AcceptShareUseCase(shareRepo);
    await expect(useCase.execute('share-1', 'user-99')).rejects.toThrow(ForbiddenError);
  });
});
```

- [ ] **Step 2: Run to verify tests fail**

```bash
pnpm test tests/application/share/AcceptShareUseCase.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Create AcceptShareUseCase.ts**

```typescript
// src/application/share/AcceptShareUseCase.ts
import { Inject, Service } from 'typedi';
import { PetShareRepository, PET_SHARE_REPOSITORY } from '../../domain/share/PetShareRepository';
import { ForbiddenError, NotFoundError } from '../../shared/errors/AppError';

@Service()
export class AcceptShareUseCase {
  constructor(@Inject(PET_SHARE_REPOSITORY) private readonly shareRepo: PetShareRepository) {}

  async execute(shareId: string, requestingUserId: string): Promise<void> {
    const share = await this.shareRepo.findById(shareId);
    if (!share) throw new NotFoundError('Share');
    if (share.sharedWithUserId !== requestingUserId) throw new ForbiddenError();
    share.accept();
    await this.shareRepo.save(share);
  }
}
```

- [ ] **Step 4: Create DeclineShareUseCase.ts**

```typescript
// src/application/share/DeclineShareUseCase.ts
import { Inject, Service } from 'typedi';
import { PetShareRepository, PET_SHARE_REPOSITORY } from '../../domain/share/PetShareRepository';
import { ForbiddenError, NotFoundError } from '../../shared/errors/AppError';

@Service()
export class DeclineShareUseCase {
  constructor(@Inject(PET_SHARE_REPOSITORY) private readonly shareRepo: PetShareRepository) {}

  async execute(shareId: string, requestingUserId: string): Promise<void> {
    const share = await this.shareRepo.findById(shareId);
    if (!share) throw new NotFoundError('Share');
    if (share.sharedWithUserId !== requestingUserId) throw new ForbiddenError();
    await this.shareRepo.delete(shareId);
  }
}
```

- [ ] **Step 5: Create ListPendingSharesUseCase.ts**

```typescript
// src/application/share/ListPendingSharesUseCase.ts
import { Inject, Service } from 'typedi';
import { PetShareRepository, PET_SHARE_REPOSITORY } from '../../domain/share/PetShareRepository';
import { PetShare } from '../../domain/share/PetShare';

@Service()
export class ListPendingSharesUseCase {
  constructor(@Inject(PET_SHARE_REPOSITORY) private readonly shareRepo: PetShareRepository) {}

  async execute(userId: string): Promise<PetShare[]> {
    return this.shareRepo.findPendingForUser(userId);
  }
}
```

- [ ] **Step 6: Create ListSharedPetsUseCase.ts**

```typescript
// src/application/share/ListSharedPetsUseCase.ts
import { Inject, Service } from 'typedi';
import { PetShareRepository, PET_SHARE_REPOSITORY } from '../../domain/share/PetShareRepository';
import { PetRepository, PET_REPOSITORY } from '../../domain/pet/PetRepository';
import { Pet } from '../../domain/pet/Pet';
import { PetShare } from '../../domain/share/PetShare';

export interface SharedPetResult {
  pet: Pet;
  share: PetShare;
}

@Service()
export class ListSharedPetsUseCase {
  constructor(
    @Inject(PET_SHARE_REPOSITORY) private readonly shareRepo: PetShareRepository,
    @Inject(PET_REPOSITORY) private readonly petRepo: PetRepository,
  ) {}

  async execute(userId: string): Promise<SharedPetResult[]> {
    const shares = await this.shareRepo.findAcceptedForUser(userId);
    if (shares.length === 0) return [];

    const petIds = shares.map((s) => s.petId);
    const pets = await this.petRepo.findByIds(petIds);
    const petMap = new Map(pets.map((p) => [p.id.toValue(), p]));

    return shares
      .map((share) => ({ pet: petMap.get(share.petId), share }))
      .filter((r): r is SharedPetResult => r.pet !== undefined);
  }
}
```

- [ ] **Step 7: Run tests and build**

```bash
pnpm test tests/application/share/AcceptShareUseCase.test.ts
pnpm build
```
Expected: tests PASS, build succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/application/share/ListPendingSharesUseCase.ts src/application/share/AcceptShareUseCase.ts src/application/share/DeclineShareUseCase.ts src/application/share/ListSharedPetsUseCase.ts tests/application/share/AcceptShareUseCase.test.ts
git commit -m "feat: add recipient-side share use cases"
```

---

## Task 14: Transfer use cases — owner side + expiry

**Files:**
- Create: `src/application/transfer/InitiateOwnershipTransferUseCase.ts`
- Create: `src/application/transfer/CancelOwnershipTransferUseCase.ts`
- Create: `src/application/transfer/ListPendingTransfersUseCase.ts`
- Create: `src/application/transfer/ExpireOwnershipTransferUseCase.ts`

- [ ] **Step 1: Create InitiateOwnershipTransferUseCase.ts**

```typescript
// src/application/transfer/InitiateOwnershipTransferUseCase.ts
import { Inject, Service } from 'typedi';
import { PetAccessService } from '../pet/PetAccessService';
import { UserRepository, USER_REPOSITORY } from '../../domain/user/UserRepository';
import { PetOwnershipTransferRepository, PET_OWNERSHIP_TRANSFER_REPOSITORY } from '../../domain/transfer/PetOwnershipTransferRepository';
import { PetOwnershipTransfer } from '../../domain/transfer/PetOwnershipTransfer';
import { EmailService } from '../../infrastructure/email/EmailService';
import { AppError } from '../../shared/errors/AppError';
import { scheduleTransferExpiry } from '../../infrastructure/queue/TransferExpiryQueue';
import { petTransferNotificationHtml } from '../../infrastructure/email/templates/petTransferNotification';
import { petTransferInviteHtml } from '../../infrastructure/email/templates/petTransferInvite';

@Service()
export class InitiateOwnershipTransferUseCase {
  constructor(
    private readonly petAccessService: PetAccessService,
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(PET_OWNERSHIP_TRANSFER_REPOSITORY) private readonly transferRepo: PetOwnershipTransferRepository,
    private readonly emailService: EmailService,
  ) {}

  async execute(petId: string, requestingUserId: string, email: string): Promise<PetOwnershipTransfer> {
    const pet = await this.petAccessService.assertCanAccess(petId, requestingUserId, 'owner');

    const existing = await this.transferRepo.findActivePendingByPetId(petId);
    if (existing) throw new AppError('A pending transfer already exists for this pet', 409);

    const targetUser = await this.userRepo.findByEmail(email);

    const transfer = PetOwnershipTransfer.create({
      petId,
      fromUserId: requestingUserId,
      toUserId: targetUser?.id.toValue() ?? null,
      invitedEmail: email,
    });

    await this.transferRepo.save(transfer);
    await scheduleTransferExpiry(transfer.id.toValue(), transfer.expiresAt);

    if (targetUser) {
      await this.emailService.send({
        to: email,
        subject: `${pet.name} ownership transfer request`,
        html: petTransferNotificationHtml({ petName: pet.name }),
      });
    } else {
      await this.emailService.send({
        to: email,
        subject: `You've been invited to take ownership of a pet`,
        html: petTransferInviteHtml({ petName: pet.name }),
      });
    }

    return transfer;
  }
}
```

- [ ] **Step 2: Create CancelOwnershipTransferUseCase.ts**

```typescript
// src/application/transfer/CancelOwnershipTransferUseCase.ts
import { Inject, Service } from 'typedi';
import { PetAccessService } from '../pet/PetAccessService';
import { PetOwnershipTransferRepository, PET_OWNERSHIP_TRANSFER_REPOSITORY } from '../../domain/transfer/PetOwnershipTransferRepository';
import { AppError, NotFoundError } from '../../shared/errors/AppError';

@Service()
export class CancelOwnershipTransferUseCase {
  constructor(
    private readonly petAccessService: PetAccessService,
    @Inject(PET_OWNERSHIP_TRANSFER_REPOSITORY) private readonly transferRepo: PetOwnershipTransferRepository,
  ) {}

  async execute(petId: string, requestingUserId: string): Promise<void> {
    await this.petAccessService.assertCanAccess(petId, requestingUserId, 'owner');
    const transfer = await this.transferRepo.findActivePendingByPetId(petId);
    if (!transfer) throw new NotFoundError('Transfer');
    if (transfer.status !== 'pending') throw new AppError('Transfer is no longer pending', 400);
    transfer.cancel();
    await this.transferRepo.save(transfer);
  }
}
```

- [ ] **Step 3: Create ListPendingTransfersUseCase.ts**

```typescript
// src/application/transfer/ListPendingTransfersUseCase.ts
import { Inject, Service } from 'typedi';
import { PetOwnershipTransferRepository, PET_OWNERSHIP_TRANSFER_REPOSITORY } from '../../domain/transfer/PetOwnershipTransferRepository';
import { PetOwnershipTransfer } from '../../domain/transfer/PetOwnershipTransfer';

@Service()
export class ListPendingTransfersUseCase {
  constructor(
    @Inject(PET_OWNERSHIP_TRANSFER_REPOSITORY) private readonly transferRepo: PetOwnershipTransferRepository,
  ) {}

  async execute(userId: string): Promise<PetOwnershipTransfer[]> {
    return this.transferRepo.findPendingForUser(userId);
  }
}
```

- [ ] **Step 4: Create ExpireOwnershipTransferUseCase.ts**

```typescript
// src/application/transfer/ExpireOwnershipTransferUseCase.ts
import { Inject, Service } from 'typedi';
import { PetOwnershipTransferRepository, PET_OWNERSHIP_TRANSFER_REPOSITORY } from '../../domain/transfer/PetOwnershipTransferRepository';

@Service()
export class ExpireOwnershipTransferUseCase {
  constructor(
    @Inject(PET_OWNERSHIP_TRANSFER_REPOSITORY) private readonly transferRepo: PetOwnershipTransferRepository,
  ) {}

  async execute(transferId: string): Promise<void> {
    const transfer = await this.transferRepo.findById(transferId);
    if (!transfer || transfer.status !== 'pending') return;
    transfer.expire();
    await this.transferRepo.save(transfer);
  }
}
```

- [ ] **Step 5: Build and commit**

```bash
pnpm build
git add src/application/transfer/InitiateOwnershipTransferUseCase.ts src/application/transfer/CancelOwnershipTransferUseCase.ts src/application/transfer/ListPendingTransfersUseCase.ts src/application/transfer/ExpireOwnershipTransferUseCase.ts
git commit -m "feat: add owner-side transfer use cases and expiry"
```

---

## Task 15: Transfer use cases — recipient side

**Files:**
- Create: `src/application/transfer/AcceptOwnershipTransferUseCase.ts`
- Create: `src/application/transfer/DeclineOwnershipTransferUseCase.ts`
- Create: `tests/application/transfer/AcceptOwnershipTransferUseCase.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/application/transfer/AcceptOwnershipTransferUseCase.test.ts`:
```typescript
import 'reflect-metadata';
import { AcceptOwnershipTransferUseCase } from '../../../src/application/transfer/AcceptOwnershipTransferUseCase';
import { PetOwnershipTransferRepository } from '../../../src/domain/transfer/PetOwnershipTransferRepository';
import { PetRepository } from '../../../src/domain/pet/PetRepository';
import { PetShareRepository } from '../../../src/domain/share/PetShareRepository';
import { UserRepository } from '../../../src/domain/user/UserRepository';
import { PetOwnershipTransfer } from '../../../src/domain/transfer/PetOwnershipTransfer';
import { Pet } from '../../../src/domain/pet/Pet';
import { User } from '../../../src/domain/user/User';
import { UniqueEntityId } from '../../../src/domain/shared/UniqueEntityId';
import { ForbiddenError, NotFoundError } from '../../../src/shared/errors/AppError';

function makeTransfer(toUserId: string): PetOwnershipTransfer {
  return PetOwnershipTransfer.reconstitute(
    {
      petId: 'pet-1', fromUserId: 'owner-1', toUserId,
      invitedEmail: 'new@example.com', status: 'pending',
      expiresAt: new Date(Date.now() + 7 * 86400000), createdAt: new Date(),
    },
    new UniqueEntityId('transfer-1'),
  );
}

function makePet(): Pet {
  return Pet.reconstitute(
    { name: 'Rex', species: 'dog', userId: 'owner-1', createdAt: new Date() },
    new UniqueEntityId('pet-1'),
  );
}

function makeUseCase(transfer: PetOwnershipTransfer | null, pet: Pet | null) {
  const transferRepo = { findById: jest.fn().mockResolvedValue(transfer), save: jest.fn() } as unknown as PetOwnershipTransferRepository;
  const petRepo = { findById: jest.fn().mockResolvedValue(pet), save: jest.fn() } as unknown as PetRepository;
  const shareRepo = { save: jest.fn() } as unknown as PetShareRepository;
  const userRepo = { findById: jest.fn().mockResolvedValue(
    User.reconstitute({ name: 'Old', email: 'old@example.com', passwordHash: 'x', theme: 'light', createdAt: new Date() }, new UniqueEntityId('owner-1'))
  ) } as unknown as UserRepository;
  return { useCase: new AcceptOwnershipTransferUseCase(transferRepo, petRepo, shareRepo, userRepo), transferRepo, petRepo, shareRepo };
}

describe('AcceptOwnershipTransferUseCase', () => {
  it('transfers ownership and accepts transfer', async () => {
    const transfer = makeTransfer('user-2');
    const pet = makePet();
    const { useCase, petRepo, transferRepo } = makeUseCase(transfer, pet);
    await useCase.execute('transfer-1', 'user-2', false);
    expect(pet.userId).toBe('user-2');
    expect(transfer.status).toBe('accepted');
    expect(petRepo.save).toHaveBeenCalledWith(pet);
    expect(transferRepo.save).toHaveBeenCalledWith(transfer);
  });

  it('creates share for original owner when retainAccess=true', async () => {
    const transfer = makeTransfer('user-2');
    const pet = makePet();
    const { useCase, shareRepo } = makeUseCase(transfer, pet);
    await useCase.execute('transfer-1', 'user-2', true);
    expect(shareRepo.save).toHaveBeenCalledTimes(1);
  });

  it('throws NotFoundError when transfer not found', async () => {
    const { useCase } = makeUseCase(null, null);
    await expect(useCase.execute('transfer-1', 'user-2', false)).rejects.toThrow(NotFoundError);
  });

  it('throws ForbiddenError when wrong user accepts', async () => {
    const transfer = makeTransfer('user-2');
    const pet = makePet();
    const { useCase } = makeUseCase(transfer, pet);
    await expect(useCase.execute('transfer-1', 'user-99', false)).rejects.toThrow(ForbiddenError);
  });
});
```

- [ ] **Step 2: Run to verify tests fail**

```bash
pnpm test tests/application/transfer/AcceptOwnershipTransferUseCase.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Create AcceptOwnershipTransferUseCase.ts**

```typescript
// src/application/transfer/AcceptOwnershipTransferUseCase.ts
import { Inject, Service } from 'typedi';
import { PetOwnershipTransferRepository, PET_OWNERSHIP_TRANSFER_REPOSITORY } from '../../domain/transfer/PetOwnershipTransferRepository';
import { PetRepository, PET_REPOSITORY } from '../../domain/pet/PetRepository';
import { PetShareRepository, PET_SHARE_REPOSITORY } from '../../domain/share/PetShareRepository';
import { UserRepository, USER_REPOSITORY } from '../../domain/user/UserRepository';
import { PetShare } from '../../domain/share/PetShare';
import { AppError, ForbiddenError, NotFoundError } from '../../shared/errors/AppError';

@Service()
export class AcceptOwnershipTransferUseCase {
  constructor(
    @Inject(PET_OWNERSHIP_TRANSFER_REPOSITORY) private readonly transferRepo: PetOwnershipTransferRepository,
    @Inject(PET_REPOSITORY) private readonly petRepo: PetRepository,
    @Inject(PET_SHARE_REPOSITORY) private readonly shareRepo: PetShareRepository,
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
  ) {}

  async execute(transferId: string, requestingUserId: string, retainAccessForOriginalOwner: boolean): Promise<void> {
    const transfer = await this.transferRepo.findById(transferId);
    if (!transfer) throw new NotFoundError('Transfer');
    if (transfer.toUserId !== requestingUserId) throw new ForbiddenError();
    if (transfer.status !== 'pending') throw new AppError('Transfer is no longer pending', 400);

    const pet = await this.petRepo.findById(transfer.petId);
    if (!pet) throw new NotFoundError('Pet');

    const originalOwnerId = transfer.fromUserId;
    transfer.accept();
    pet.transferOwnership(requestingUserId);

    await this.transferRepo.save(transfer);
    await this.petRepo.save(pet);

    if (retainAccessForOriginalOwner) {
      const originalOwner = await this.userRepo.findById(originalOwnerId);
      const share = PetShare.create({
        petId: pet.id.toValue(),
        ownerId: requestingUserId,
        sharedWithUserId: originalOwnerId,
        invitedEmail: originalOwner?.email ?? '',
        canViewVetVisits: true,
        canEditVetVisits: true,
        canViewMedications: true,
        canEditMedications: true,
        canViewNotes: true,
        canEditNotes: true,
      });
      share.accept();
      await this.shareRepo.save(share);
    }
  }
}
```

- [ ] **Step 4: Create DeclineOwnershipTransferUseCase.ts**

```typescript
// src/application/transfer/DeclineOwnershipTransferUseCase.ts
import { Inject, Service } from 'typedi';
import { PetOwnershipTransferRepository, PET_OWNERSHIP_TRANSFER_REPOSITORY } from '../../domain/transfer/PetOwnershipTransferRepository';
import { ForbiddenError, NotFoundError } from '../../shared/errors/AppError';

@Service()
export class DeclineOwnershipTransferUseCase {
  constructor(
    @Inject(PET_OWNERSHIP_TRANSFER_REPOSITORY) private readonly transferRepo: PetOwnershipTransferRepository,
  ) {}

  async execute(transferId: string, requestingUserId: string): Promise<void> {
    const transfer = await this.transferRepo.findById(transferId);
    if (!transfer) throw new NotFoundError('Transfer');
    if (transfer.toUserId !== requestingUserId) throw new ForbiddenError();
    transfer.decline();
    await this.transferRepo.save(transfer);
  }
}
```

- [ ] **Step 5: Run tests and build**

```bash
pnpm test tests/application/transfer/AcceptOwnershipTransferUseCase.test.ts
pnpm build
```
Expected: tests PASS, build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/application/transfer/AcceptOwnershipTransferUseCase.ts src/application/transfer/DeclineOwnershipTransferUseCase.ts tests/application/transfer/AcceptOwnershipTransferUseCase.test.ts
git commit -m "feat: add recipient-side transfer use cases"
```

---

## Task 16: TransferExpiryQueue + TransferExpiryWorker + main.ts

**Files:**
- Create: `src/infrastructure/queue/TransferExpiryQueue.ts`
- Create: `src/infrastructure/queue/TransferExpiryWorker.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Create TransferExpiryQueue.ts**

```typescript
// src/infrastructure/queue/TransferExpiryQueue.ts
import { Queue } from 'bullmq';
import { redis } from './redis';

export interface TransferExpiryJobData {
  transferId: string;
}

export const TRANSFER_EXPIRY_QUEUE_NAME = 'transfer-expiry';

export const transferExpiryQueue = new Queue<TransferExpiryJobData>(TRANSFER_EXPIRY_QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: { removeOnComplete: true, removeOnFail: 50 },
});

export async function scheduleTransferExpiry(transferId: string, expiresAt: Date): Promise<void> {
  const delay = Math.max(0, expiresAt.getTime() - Date.now());
  await transferExpiryQueue.add(
    'expire-transfer',
    { transferId },
    { delay, jobId: `transfer--${transferId}` },
  );
}
```

- [ ] **Step 2: Create TransferExpiryWorker.ts**

```typescript
// src/infrastructure/queue/TransferExpiryWorker.ts
import { Worker } from 'bullmq';
import { Container } from 'typedi';
import { redis } from './redis';
import { TRANSFER_EXPIRY_QUEUE_NAME, TransferExpiryJobData } from './TransferExpiryQueue';
import { ExpireOwnershipTransferUseCase } from '../../application/transfer/ExpireOwnershipTransferUseCase';

export function createTransferExpiryWorker(): Worker<TransferExpiryJobData> {
  return new Worker<TransferExpiryJobData>(
    TRANSFER_EXPIRY_QUEUE_NAME,
    async (job) => {
      const useCase = Container.get(ExpireOwnershipTransferUseCase);
      await useCase.execute(job.data.transferId);
    },
    { connection: redis },
  );
}
```

- [ ] **Step 3: Start the worker in main.ts**

Read `src/main.ts`, then add these two lines in the same place the reminder worker is started:
```typescript
import { createTransferExpiryWorker } from './infrastructure/queue/TransferExpiryWorker';

// in the startup block where reminder worker starts:
createTransferExpiryWorker();
```

- [ ] **Step 4: Build and commit**

```bash
pnpm build
git add src/infrastructure/queue/TransferExpiryQueue.ts src/infrastructure/queue/TransferExpiryWorker.ts src/main.ts
git commit -m "feat: add TransferExpiryQueue and worker for 7-day transfer expiry"
```

---

## Task 17: Email templates

**Files:**
- Create: `src/infrastructure/email/templates/petShareInvite.ts`
- Create: `src/infrastructure/email/templates/petShareNotification.ts`
- Create: `src/infrastructure/email/templates/petTransferInvite.ts`
- Create: `src/infrastructure/email/templates/petTransferNotification.ts`

- [ ] **Step 1: Create petShareInvite.ts**

```typescript
// src/infrastructure/email/templates/petShareInvite.ts
export interface PetShareInviteContext {
  petName: string;
}

export function petShareInviteHtml(ctx: PetShareInviteContext): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>You've been invited to care for ${ctx.petName}</h2>
      <p>Someone has shared their pet with you on Pet Health Tracker.</p>
      <p>Create an account to accept the invitation and view ${ctx.petName}'s health records.</p>
      <a href="${process.env.CLIENT_ORIGIN ?? 'http://localhost:5173'}/register"
         style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;border-radius:6px;text-decoration:none;">
        Create Account
      </a>
    </div>
  `;
}
```

- [ ] **Step 2: Create petShareNotification.ts**

```typescript
// src/infrastructure/email/templates/petShareNotification.ts
export interface PetShareNotificationContext {
  petName: string;
}

export function petShareNotificationHtml(ctx: PetShareNotificationContext): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>${ctx.petName} has been shared with you</h2>
      <p>Log in to accept the share invitation and view ${ctx.petName}'s health records.</p>
      <a href="${process.env.CLIENT_ORIGIN ?? 'http://localhost:5173'}/login"
         style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;border-radius:6px;text-decoration:none;">
        Log In
      </a>
    </div>
  `;
}
```

- [ ] **Step 3: Create petTransferInvite.ts**

```typescript
// src/infrastructure/email/templates/petTransferInvite.ts
export interface PetTransferInviteContext {
  petName: string;
}

export function petTransferInviteHtml(ctx: PetTransferInviteContext): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>You've been offered ownership of ${ctx.petName}</h2>
      <p>Someone wants to transfer ownership of their pet to you on Pet Health Tracker.</p>
      <p>Create an account to accept or decline the transfer. This offer expires in 7 days.</p>
      <a href="${process.env.CLIENT_ORIGIN ?? 'http://localhost:5173'}/register"
         style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;border-radius:6px;text-decoration:none;">
        Create Account
      </a>
    </div>
  `;
}
```

- [ ] **Step 4: Create petTransferNotification.ts**

```typescript
// src/infrastructure/email/templates/petTransferNotification.ts
export interface PetTransferNotificationContext {
  petName: string;
}

export function petTransferNotificationHtml(ctx: PetTransferNotificationContext): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Ownership transfer request for ${ctx.petName}</h2>
      <p>You have a pending ownership transfer request. This offer expires in 7 days.</p>
      <a href="${process.env.CLIENT_ORIGIN ?? 'http://localhost:5173'}/pet-ownership-transfers"
         style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;border-radius:6px;text-decoration:none;">
        Review Transfer
      </a>
    </div>
  `;
}
```

- [ ] **Step 5: Build and commit**

```bash
pnpm build
git add src/infrastructure/email/templates/petShareInvite.ts src/infrastructure/email/templates/petShareNotification.ts src/infrastructure/email/templates/petTransferInvite.ts src/infrastructure/email/templates/petTransferNotification.ts
git commit -m "feat: add share and transfer email templates"
```

---

## Task 18: ShareController + share routes

**Files:**
- Create: `src/infrastructure/http/controllers/ShareController.ts`
- Create: `src/infrastructure/http/routes/shareRoutes.ts`
- Create: `src/infrastructure/http/routes/petShareInboxRoutes.ts`

- [ ] **Step 1: Create ShareController.ts**

```typescript
// src/infrastructure/http/controllers/ShareController.ts
import { Request, Response, NextFunction } from 'express';
import { Service } from 'typedi';
import { SharePetUseCase } from '../../../application/share/SharePetUseCase';
import { UpdateSharePermissionsUseCase } from '../../../application/share/UpdateSharePermissionsUseCase';
import { RevokeShareUseCase } from '../../../application/share/RevokeShareUseCase';
import { ListPetSharesUseCase } from '../../../application/share/ListPetSharesUseCase';
import { ListPendingSharesUseCase } from '../../../application/share/ListPendingSharesUseCase';
import { AcceptShareUseCase } from '../../../application/share/AcceptShareUseCase';
import { DeclineShareUseCase } from '../../../application/share/DeclineShareUseCase';
import { ListSharedPetsUseCase } from '../../../application/share/ListSharedPetsUseCase';
import { PetShareMapper } from '../../mappers/PetShareMapper';
import { PetMapper } from '../../mappers/PetMapper';

@Service()
export class ShareController {
  constructor(
    private readonly sharePet: SharePetUseCase,
    private readonly updateSharePermissions: UpdateSharePermissionsUseCase,
    private readonly revokeShare: RevokeShareUseCase,
    private readonly listPetShares: ListPetSharesUseCase,
    private readonly listPendingShares: ListPendingSharesUseCase,
    private readonly acceptShare: AcceptShareUseCase,
    private readonly declineShare: DeclineShareUseCase,
    private readonly listSharedPets: ListSharedPetsUseCase,
    private readonly shareMapper: PetShareMapper,
    private readonly petMapper: PetMapper,
  ) {}

  listForPet = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shares = await this.listPetShares.execute(req.params.petId, req.auth.userId);
      res.json(shares.map((s) => this.shareMapper.toResponse(s)));
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const share = await this.sharePet.execute({
        petId: req.params.petId,
        requestingUserId: req.auth.userId,
        email: req.body.email,
        permissions: req.body.permissions,
      });
      res.status(201).json(this.shareMapper.toResponse(share));
    } catch (err) { next(err); }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const share = await this.updateSharePermissions.execute({
        petId: req.params.petId,
        shareId: req.params.shareId,
        requestingUserId: req.auth.userId,
        ...req.body,
      });
      res.json(this.shareMapper.toResponse(share));
    } catch (err) { next(err); }
  };

  revoke = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.revokeShare.execute(req.params.petId, req.params.shareId, req.auth.userId);
      res.status(204).send();
    } catch (err) { next(err); }
  };

  listPending = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shares = await this.listPendingShares.execute(req.auth.userId);
      res.json(shares.map((s) => this.shareMapper.toResponse(s)));
    } catch (err) { next(err); }
  };

  accept = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.acceptShare.execute(req.params.shareId, req.auth.userId);
      res.status(204).send();
    } catch (err) { next(err); }
  };

  decline = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.declineShare.execute(req.params.shareId, req.auth.userId);
      res.status(204).send();
    } catch (err) { next(err); }
  };

  listSharedWithMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const results = await this.listSharedPets.execute(req.auth.userId);
      res.json(results.map(({ pet, share }) => ({
        ...this.petMapper.toResponse(pet),
        permissions: this.shareMapper.toResponse(share).permissions,
        shareId: share.id.toValue(),
      })));
    } catch (err) { next(err); }
  };
}
```

- [ ] **Step 2: Create shareRoutes.ts** (mounted at `/pets`)

```typescript
// src/infrastructure/http/routes/shareRoutes.ts
import { Router } from 'express';
import { Container } from 'typedi';
import { ShareController } from '../controllers/ShareController';
import { authMiddleware } from '../middleware/authMiddleware';

export function shareRoutes(): Router {
  const router = Router();
  const controller = Container.get(ShareController);

  router.get('/shared-with-me', authMiddleware, controller.listSharedWithMe);
  router.get('/:petId/shares', authMiddleware, controller.listForPet);
  router.post('/:petId/shares', authMiddleware, controller.create);
  router.put('/:petId/shares/:shareId', authMiddleware, controller.update);
  router.delete('/:petId/shares/:shareId', authMiddleware, controller.revoke);

  return router;
}
```

- [ ] **Step 3: Create petShareInboxRoutes.ts** (mounted at `/pet-shares`)

```typescript
// src/infrastructure/http/routes/petShareInboxRoutes.ts
import { Router } from 'express';
import { Container } from 'typedi';
import { ShareController } from '../controllers/ShareController';
import { authMiddleware } from '../middleware/authMiddleware';

export function petShareInboxRoutes(): Router {
  const router = Router();
  const controller = Container.get(ShareController);

  router.get('/pending', authMiddleware, controller.listPending);
  router.patch('/:shareId/accept', authMiddleware, controller.accept);
  router.patch('/:shareId/decline', authMiddleware, controller.decline);

  return router;
}
```

- [ ] **Step 4: Build and commit**

```bash
pnpm build
git add src/infrastructure/http/controllers/ShareController.ts src/infrastructure/http/routes/shareRoutes.ts src/infrastructure/http/routes/petShareInboxRoutes.ts
git commit -m "feat: add ShareController and share routes"
```

---

## Task 19: TransferController + routes + index.ts wiring

**Files:**
- Create: `src/infrastructure/http/controllers/TransferController.ts`
- Create: `src/infrastructure/http/routes/transferRoutes.ts`
- Create: `src/infrastructure/http/routes/petTransferInboxRoutes.ts`
- Modify: `src/infrastructure/http/routes/index.ts`

- [ ] **Step 1: Create TransferController.ts**

```typescript
// src/infrastructure/http/controllers/TransferController.ts
import { Request, Response, NextFunction } from 'express';
import { Service } from 'typedi';
import { InitiateOwnershipTransferUseCase } from '../../../application/transfer/InitiateOwnershipTransferUseCase';
import { CancelOwnershipTransferUseCase } from '../../../application/transfer/CancelOwnershipTransferUseCase';
import { ListPendingTransfersUseCase } from '../../../application/transfer/ListPendingTransfersUseCase';
import { AcceptOwnershipTransferUseCase } from '../../../application/transfer/AcceptOwnershipTransferUseCase';
import { DeclineOwnershipTransferUseCase } from '../../../application/transfer/DeclineOwnershipTransferUseCase';
import { PetOwnershipTransferMapper } from '../../mappers/PetOwnershipTransferMapper';

@Service()
export class TransferController {
  constructor(
    private readonly initiateTransfer: InitiateOwnershipTransferUseCase,
    private readonly cancelTransfer: CancelOwnershipTransferUseCase,
    private readonly listPendingTransfers: ListPendingTransfersUseCase,
    private readonly acceptTransfer: AcceptOwnershipTransferUseCase,
    private readonly declineTransfer: DeclineOwnershipTransferUseCase,
    private readonly mapper: PetOwnershipTransferMapper,
  ) {}

  initiate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const transfer = await this.initiateTransfer.execute(req.params.petId, req.auth.userId, req.body.email);
      res.status(201).json(this.mapper.toResponse(transfer));
    } catch (err) { next(err); }
  };

  cancel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.cancelTransfer.execute(req.params.petId, req.auth.userId);
      res.status(204).send();
    } catch (err) { next(err); }
  };

  listPending = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const transfers = await this.listPendingTransfers.execute(req.auth.userId);
      res.json(transfers.map((t) => this.mapper.toResponse(t)));
    } catch (err) { next(err); }
  };

  accept = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.acceptTransfer.execute(
        req.params.transferId,
        req.auth.userId,
        Boolean(req.body.retainAccessForOriginalOwner),
      );
      res.status(204).send();
    } catch (err) { next(err); }
  };

  decline = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.declineTransfer.execute(req.params.transferId, req.auth.userId);
      res.status(204).send();
    } catch (err) { next(err); }
  };
}
```

- [ ] **Step 2: Create transferRoutes.ts** (mounted at `/pets`)

```typescript
// src/infrastructure/http/routes/transferRoutes.ts
import { Router } from 'express';
import { Container } from 'typedi';
import { TransferController } from '../controllers/TransferController';
import { authMiddleware } from '../middleware/authMiddleware';

export function transferRoutes(): Router {
  const router = Router();
  const controller = Container.get(TransferController);

  router.post('/:petId/transfer', authMiddleware, controller.initiate);
  router.delete('/:petId/transfer', authMiddleware, controller.cancel);

  return router;
}
```

- [ ] **Step 3: Create petTransferInboxRoutes.ts** (mounted at `/pet-ownership-transfers`)

```typescript
// src/infrastructure/http/routes/petTransferInboxRoutes.ts
import { Router } from 'express';
import { Container } from 'typedi';
import { TransferController } from '../controllers/TransferController';
import { authMiddleware } from '../middleware/authMiddleware';

export function petTransferInboxRoutes(): Router {
  const router = Router();
  const controller = Container.get(TransferController);

  router.get('/pending', authMiddleware, controller.listPending);
  router.patch('/:transferId/accept', authMiddleware, controller.accept);
  router.patch('/:transferId/decline', authMiddleware, controller.decline);

  return router;
}
```

- [ ] **Step 4: Update routes/index.ts**

Add imports at the top:
```typescript
import { shareRoutes } from './shareRoutes';
import { petShareInboxRoutes } from './petShareInboxRoutes';
import { transferRoutes } from './transferRoutes';
import { petTransferInboxRoutes } from './petTransferInboxRoutes';
```

Register new routes **before** the existing `router.use('/pets', petRoutes())` line so `/pets/shared-with-me` matches before `/:petId`:
```typescript
router.use('/pets', shareRoutes());       // handles /pets/shared-with-me and /pets/:petId/shares
router.use('/pets', transferRoutes());    // handles /pets/:petId/transfer
router.use('/pets', petRoutes());         // handles /pets/:petId — must come after fixed routes
router.use('/pet-shares', petShareInboxRoutes());
router.use('/pet-ownership-transfers', petTransferInboxRoutes());
```

- [ ] **Step 5: Final build**

```bash
pnpm build
```
Expected: no TypeScript errors.

- [ ] **Step 6: Run all tests**

```bash
pnpm test
```
Expected: all tests passing.

- [ ] **Step 7: Commit**

```bash
git add src/infrastructure/http/controllers/TransferController.ts src/infrastructure/http/routes/transferRoutes.ts src/infrastructure/http/routes/petTransferInboxRoutes.ts src/infrastructure/http/routes/index.ts
git commit -m "feat: add TransferController, transfer routes, and wire all new routes"
```

---

## Self-Review Checklist

After all tasks are complete, verify:

- [ ] `pnpm build` passes with no TypeScript errors
- [ ] `pnpm test` passes — all test files green
- [ ] `GET /api/v1/pets/shared-with-me` returns `[]` for a user with no shares (no 500)
- [ ] `POST /api/v1/pets/:petId/shares` as a non-owner returns 403
- [ ] `POST /api/v1/pets/:petId/transfer` with an existing pending transfer returns 409
- [ ] `PATCH /api/v1/pet-ownership-transfers/:id/accept` with wrong user returns 403
- [ ] Registration with an invited email links pending shares and transfers
