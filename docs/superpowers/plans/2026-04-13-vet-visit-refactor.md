# Vet Visit Refactor & Medication Reminder UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor vet visits to support logged/scheduled types, add standalone scheduled visit creation, and add medication reminder configuration UI.

**Architecture:** Add `type: 'logged' | 'scheduled'` discriminator to `VetVisit` via a single DB column; scheduled visits auto-get a lead-time BullMQ job and optionally a cron-based `Reminder`; client filters by type for the upcoming banner vs history list; medication reminder config lives in a new tabbed `MedicationDetailDialog`.

**Tech Stack:** API — Node.js, Express, Sequelize-TypeScript (Postgres), BullMQ, TypeDI; Client — React, MUI v9, TanStack Query v4

---

## File Map

### API (`/Users/latzko/projects/pet-health-tracker-api`)

| Action | File |
|---|---|
| Modify | `src/domain/health/VetVisit.ts` |
| Modify | `src/infrastructure/db/models/VetVisitModel.ts` |
| Modify | `src/infrastructure/mappers/VetVisitMapper.ts` |
| Modify | `src/infrastructure/db/repositories/SequelizeHealthRecordRepository.ts` |
| Modify | `src/infrastructure/queue/NotificationQueue.ts` |
| Modify | `src/infrastructure/queue/NotificationWorker.ts` |
| Modify | `src/infrastructure/queue/ReminderSchedulerService.ts` |
| Modify | `src/application/health/AddVetVisitUseCase.ts` |
| Modify | `src/application/health/UpdateVetVisitUseCase.ts` |
| Modify | `src/infrastructure/http/controllers/HealthController.ts` |
| Modify | `src/infrastructure/http/controllers/ReminderController.ts` |
| Modify | `src/infrastructure/http/routes/healthRoutes.ts` |
| Modify | `src/infrastructure/http/routes/reminderRoutes.ts` |
| Create | `src/application/health/CompleteVetVisitUseCase.ts` |
| Create | `src/application/reminder/ConfigureVetVisitReminderUseCase.ts` |

### Client (`/Users/latzko/projects/pet-health-tracker-client`)

| Action | File |
|---|---|
| Modify | `src/types/index.ts` |
| Modify | `src/api/health.ts` |
| Modify | `src/pages/health/PetDetailPage.tsx` |
| Create | `src/api/reminders.ts` |
| Create | `src/components/ReminderScheduleEditor.tsx` |
| Create | `src/components/ScheduledVisitDetailDialog.tsx` |
| Create | `src/components/MedicationDetailDialog.tsx` |

---

## Task 1: DB migration — add `type` column, drop `next_visit_date`

**Files:**
- Modify: `src/infrastructure/db/models/VetVisitModel.ts`

> ⚠️ **Data note:** Existing `next_visit_date` values will be lost. Re-enter any upcoming visits after the migration.

- [ ] **Step 1: Run migration SQL on the database**

```bash
psql -U postgres -d pet_health_tracker -c "
  ALTER TABLE vet_visits ADD COLUMN IF NOT EXISTS type VARCHAR(10) NOT NULL DEFAULT 'logged';
  ALTER TABLE vet_visits DROP COLUMN IF EXISTS next_visit_date;
"
```

Expected: `ALTER TABLE` × 2, no errors.

- [ ] **Step 2: Update `VetVisitModel`**

Replace the full file content:

```typescript
import { BelongsTo, Column, DataType, ForeignKey, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { PetModel } from './PetModel';
import { VetModel } from './VetModel';

@Table({ tableName: 'vet_visits', timestamps: false })
export class VetVisitModel extends Model {
  @PrimaryKey
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => PetModel)
  @Column({ type: DataType.UUID, allowNull: false, field: 'pet_id' })
  declare petId: string;

  @Column({ type: DataType.STRING, allowNull: false, defaultValue: 'logged' })
  declare type: string;

  @ForeignKey(() => VetModel)
  @Column({ type: DataType.UUID, allowNull: true, field: 'vet_id' })
  declare vetId: string | null;

  @Column({ type: DataType.DATE, allowNull: false, field: 'visit_date' })
  declare visitDate: Date;

  @Column({ type: DataType.STRING, allowNull: true })
  declare clinic: string | null;

  @Column({ type: DataType.STRING, allowNull: true, field: 'vet_name' })
  declare vetName: string | null;

  @Column({ type: DataType.STRING, allowNull: false })
  declare reason: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare notes: string | null;

  @Column({ type: DataType.JSONB, allowNull: false, defaultValue: [], field: 'image_urls' })
  declare imageUrls: string[];

  @Column({ type: DataType.UUID, allowNull: false, field: 'created_by' })
  declare createdBy: string;

  @Column({ type: DataType.DATE, allowNull: false, field: 'created_at' })
  declare createdAt: Date;

  @BelongsTo(() => PetModel)
  declare pet: PetModel;

  @BelongsTo(() => VetModel)
  declare vet: VetModel;
}
```

- [ ] **Step 3: Verify build compiles**

```bash
cd /Users/latzko/projects/pet-health-tracker-api && npx tsc --noEmit
```

Expected: no errors related to `VetVisitModel`.

- [ ] **Step 4: Commit**

```bash
git add src/infrastructure/db/models/VetVisitModel.ts
git commit -m "feat: add type column to vet_visits, drop next_visit_date"
```

---

## Task 2: `VetVisit` domain entity

**Files:**
- Modify: `src/domain/health/VetVisit.ts`

- [ ] **Step 1: Replace full file**

```typescript
import { Entity } from '../shared/Entity';
import { UniqueEntityId } from '../shared/UniqueEntityId';

export type VetVisitType = 'logged' | 'scheduled';

interface VetVisitProps {
  petId: string;
  type: VetVisitType;
  vetId?: string;
  visitDate: Date;
  clinic?: string;
  vetName?: string;
  reason: string;
  notes?: string;
  imageUrls: string[];
  createdBy: string;
  createdAt: Date;
}

export class VetVisit extends Entity<VetVisitProps> {
  get type(): VetVisitType { return this.props.type; }
  get petId(): string { return this.props.petId; }
  get vetId(): string | undefined { return this.props.vetId; }
  get visitDate(): Date { return this.props.visitDate; }
  get clinic(): string | undefined { return this.props.clinic; }
  get vetName(): string | undefined { return this.props.vetName; }
  get reason(): string { return this.props.reason; }
  get notes(): string | undefined { return this.props.notes; }
  get imageUrls(): string[] { return this.props.imageUrls; }
  get createdBy(): string { return this.props.createdBy; }
  get createdAt(): Date { return this.props.createdAt; }

  static create(props: Omit<VetVisitProps, 'createdAt' | 'imageUrls'>, id?: UniqueEntityId): VetVisit {
    return new VetVisit({ ...props, imageUrls: [], createdAt: new Date() }, id);
  }

  static reconstitute(props: VetVisitProps, id: UniqueEntityId): VetVisit {
    return new VetVisit(props, id);
  }

  static addImage(existing: VetVisit, imageUrl: string): VetVisit {
    return VetVisit.reconstitute(
      { ...existing.props, imageUrls: [...existing.imageUrls, imageUrl] },
      existing.id,
    );
  }
}
```

- [ ] **Step 2: Build check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: errors only in files that reference `nextVisitDate` (mapper, use cases) — those get fixed in later tasks.

- [ ] **Step 3: Commit**

```bash
git add src/domain/health/VetVisit.ts
git commit -m "feat: add type discriminator to VetVisit, remove nextVisitDate"
```

---

## Task 3: `VetVisitMapper` — map `type`, remove `nextVisitDate`

**Files:**
- Modify: `src/infrastructure/mappers/VetVisitMapper.ts`

- [ ] **Step 1: Replace full file**

```typescript
import { Service } from 'typedi';
import { VetVisitModel } from '../db/models/VetVisitModel';
import { VetVisit, VetVisitType } from '../../domain/health/VetVisit';
import { UniqueEntityId } from '../../domain/shared/UniqueEntityId';

export interface VetVisitResponseDto {
  id: string;
  petId: string;
  type: VetVisitType;
  vetId?: string;
  visitDate: string;
  clinic?: string;
  vetName?: string;
  reason: string;
  notes?: string;
  imageUrls: string[];
  createdBy: string;
  createdAt: string;
}

@Service()
export class VetVisitMapper {
  toDomain(model: VetVisitModel): VetVisit {
    return VetVisit.reconstitute(
      {
        petId: model.petId,
        type: (model.type as VetVisitType) ?? 'logged',
        vetId: model.vetId ?? undefined,
        visitDate: model.visitDate,
        clinic: model.clinic ?? undefined,
        vetName: model.vetName ?? undefined,
        reason: model.reason,
        notes: model.notes ?? undefined,
        imageUrls: model.imageUrls ?? [],
        createdBy: model.createdBy,
        createdAt: model.createdAt,
      },
      new UniqueEntityId(model.id),
    );
  }

  toPersistence(visit: VetVisit): object {
    return {
      id: visit.id.toValue(),
      petId: visit.petId,
      type: visit.type,
      vetId: visit.vetId ?? null,
      visitDate: visit.visitDate,
      clinic: visit.clinic ?? null,
      vetName: visit.vetName ?? null,
      reason: visit.reason,
      notes: visit.notes ?? null,
      imageUrls: visit.imageUrls,
      createdBy: visit.createdBy,
      createdAt: visit.createdAt,
    };
  }

  toResponse(visit: VetVisit): VetVisitResponseDto {
    return {
      id: visit.id.toValue(),
      petId: visit.petId,
      type: visit.type,
      vetId: visit.vetId,
      visitDate: visit.visitDate.toISOString(),
      clinic: visit.clinic,
      vetName: visit.vetName,
      reason: visit.reason,
      notes: visit.notes,
      imageUrls: visit.imageUrls,
      createdBy: visit.createdBy,
      createdAt: visit.createdAt.toISOString(),
    };
  }
}
```

- [ ] **Step 2: Build check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/mappers/VetVisitMapper.ts
git commit -m "feat: update VetVisitMapper for type field, remove nextVisitDate"
```

---

## Task 4: `SequelizeHealthRecordRepository` — fix upcoming query

**Files:**
- Modify: `src/infrastructure/db/repositories/SequelizeHealthRecordRepository.ts`

- [ ] **Step 1: Update `findUpcomingVetVisitsByUserId`**

Replace the `findUpcomingVetVisitsByUserId` method (lines 46–55):

```typescript
async findUpcomingVetVisitsByUserId(userId: string): Promise<VetVisit[]> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const rows = await VetVisitModel.findAll({
    where: {
      type: 'scheduled',
      visitDate: { [Op.gte]: startOfToday },
    },
    include: [{ model: PetModel, where: { userId }, required: true }],
    order: [['visit_date', 'ASC']],
  });
  return rows.map((m) => this.vetVisitMapper.toDomain(m));
}
```

- [ ] **Step 2: Build check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/db/repositories/SequelizeHealthRecordRepository.ts
git commit -m "feat: update upcoming vet visits query to use type=scheduled"
```

---

## Task 5: `NotificationQueue` + `ReminderSchedulerService` — add repeating vet visit reminder

**Files:**
- Modify: `src/infrastructure/queue/NotificationQueue.ts`
- Modify: `src/infrastructure/queue/ReminderSchedulerService.ts`

- [ ] **Step 1: Add `VetVisitRepeatingReminderJobData` to `NotificationQueue.ts`**

Replace the full file:

```typescript
import { Queue } from 'bullmq';
import { redis } from './redis';

export type NotificationType = 'medication_reminder' | 'vet_visit_reminder' | 'vet_visit_repeating_reminder';

export interface MedicationReminderJobData {
  type: 'medication_reminder';
  reminderId: string;
  petName: string;
  medicationName: string;
  dosage: string;
  notifyUserIds: string[];
}

export interface VetVisitReminderJobData {
  type: 'vet_visit_reminder';
  visitId: string;
  petName: string;
  reason: string;
  nextVisitDate: string;
  vetName?: string;
  clinic?: string;
  notifyUserIds: string[];
}

export interface VetVisitRepeatingReminderJobData {
  type: 'vet_visit_repeating_reminder';
  reminderId: string;
  petName: string;
  reason: string;
  visitDate: string; // ISO — the scheduled appointment date
  vetName?: string;
  clinic?: string;
  notifyUserIds: string[];
}

export type NotificationJobData =
  | MedicationReminderJobData
  | VetVisitReminderJobData
  | VetVisitRepeatingReminderJobData;

export const NOTIFICATION_QUEUE_NAME = 'notifications';

export const notificationQueue = new Queue<NotificationJobData>(NOTIFICATION_QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});
```

- [ ] **Step 2: Add `scheduleVetVisitRepeatingReminder` to `ReminderSchedulerService.ts`**

Add the following method after `cancelReminders` (before `scheduleVetVisitReminder`):

```typescript
async scheduleVetVisitRepeatingReminder(
  reminder: Reminder,
  context: {
    petId: string;
    petName: string;
    reason: string;
    visitDate: Date;
    vetName?: string;
    clinic?: string;
  },
): Promise<void> {
  if (!reminder.enabled) return;

  await this.cancelReminders(reminder.entityId);

  const jobData: VetVisitRepeatingReminderJobData = {
    type: 'vet_visit_repeating_reminder',
    reminderId: reminder.id.toValue(),
    petName: context.petName,
    reason: context.reason,
    visitDate: context.visitDate.toISOString(),
    vetName: context.vetName,
    clinic: context.clinic,
    notifyUserIds: reminder.notifyUserIds,
  };

  const cronExpressions = reminder.schedule.toCronExpressions();
  await Promise.all(
    cronExpressions.map((pattern, index) =>
      notificationQueue.upsertJobScheduler(
        `reminder--${reminder.entityId}--${index}`,
        { pattern, tz: 'UTC' },
        { name: `reminder--${reminder.entityId}`, data: jobData },
      ),
    ),
  );
}
```

Also add the import for `VetVisitRepeatingReminderJobData` at the top of `ReminderSchedulerService.ts`:

```typescript
import { notificationQueue, MedicationReminderJobData, VetVisitReminderJobData, VetVisitRepeatingReminderJobData } from './NotificationQueue';
```

- [ ] **Step 3: Build check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
git add src/infrastructure/queue/NotificationQueue.ts src/infrastructure/queue/ReminderSchedulerService.ts
git commit -m "feat: add VetVisitRepeatingReminder job type and scheduler method"
```

---

## Task 6: `NotificationWorker` — handle new job type

**Files:**
- Modify: `src/infrastructure/queue/NotificationWorker.ts`

- [ ] **Step 1: Replace full file**

```typescript
import { Worker, Job } from 'bullmq';
import { redis } from './redis';
import {
  NOTIFICATION_QUEUE_NAME,
  NotificationJobData,
  MedicationReminderJobData,
  VetVisitReminderJobData,
  VetVisitRepeatingReminderJobData,
} from './NotificationQueue';
import { EmailService } from '../email/EmailService';
import { UserRepository } from '../../domain/user/UserRepository';
import { User } from '../../domain/user/User';

export class NotificationWorker {
  private readonly worker: Worker<NotificationJobData>;

  constructor(
    private readonly emailService: EmailService,
    private readonly userRepository: UserRepository,
  ) {
    this.worker = new Worker<NotificationJobData>(
      NOTIFICATION_QUEUE_NAME,
      (job) => this.process(job),
      { connection: redis },
    );

    this.worker.on('failed', (job, err) => {
      console.error(`Notification job ${job?.id} (${job?.data.type}) failed:`, err.message);
    });
  }

  private async process(job: Job<NotificationJobData>): Promise<void> {
    const users = await this.userRepository.findByIds(job.data.notifyUserIds);

    switch (job.data.type) {
      case 'medication_reminder':
        await this.processMedicationReminder(job.data, users);
        break;
      case 'vet_visit_reminder':
        await this.processVetVisitReminder(job.data, users);
        break;
      case 'vet_visit_repeating_reminder':
        await this.processVetVisitRepeatingReminder(job.data, users);
        break;
    }
  }

  private async processMedicationReminder(data: MedicationReminderJobData, users: User[]): Promise<void> {
    await Promise.all(
      users.map((user) =>
        this.emailService.sendMedicationReminder(user.email, {
          recipientName: user.name,
          petName: data.petName,
          medicationName: data.medicationName,
          dosage: data.dosage,
        }),
      ),
    );
  }

  private async processVetVisitReminder(data: VetVisitReminderJobData, users: User[]): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [year, month, day] = data.nextVisitDate.split('T')[0].split('-').map(Number);
    const visitDay = new Date(year, month - 1, day);
    const daysUntil = Math.round((visitDay.getTime() - today.getTime()) / 86_400_000);

    await Promise.all(
      users.map((user) =>
        this.emailService.sendVetVisitReminder(user.email, {
          recipientName: user.name,
          petName: data.petName,
          reason: data.reason,
          nextVisitDate: data.nextVisitDate,
          vetName: data.vetName,
          clinic: data.clinic,
          daysUntil,
        }),
      ),
    );
  }

  private async processVetVisitRepeatingReminder(data: VetVisitRepeatingReminderJobData, users: User[]): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [year, month, day] = data.visitDate.split('T')[0].split('-').map(Number);
    const visitDay = new Date(year, month - 1, day);
    const daysUntil = Math.round((visitDay.getTime() - today.getTime()) / 86_400_000);

    await Promise.all(
      users.map((user) =>
        this.emailService.sendVetVisitReminder(user.email, {
          recipientName: user.name,
          petName: data.petName,
          reason: data.reason,
          nextVisitDate: data.visitDate,
          vetName: data.vetName,
          clinic: data.clinic,
          daysUntil,
        }),
      ),
    );
  }

  async close(): Promise<void> {
    await this.worker.close();
  }
}
```

- [ ] **Step 2: Build check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/queue/NotificationWorker.ts
git commit -m "feat: handle vet_visit_repeating_reminder in NotificationWorker"
```

---

## Task 7: `AddVetVisitUseCase` — derive type, handle `scheduleNextVisit`

**Files:**
- Modify: `src/application/health/AddVetVisitUseCase.ts`

- [ ] **Step 1: Replace full file**

```typescript
import { Inject, Service } from 'typedi';
import { HealthRecordRepository, HEALTH_RECORD_REPOSITORY } from '../../domain/health/HealthRecordRepository';
import { PetRepository, PET_REPOSITORY } from '../../domain/pet/PetRepository';
import { VetVisit } from '../../domain/health/VetVisit';
import { ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors/AppError';
import { ReminderSchedulerService } from '../../infrastructure/queue/ReminderSchedulerService';

interface ScheduleNextVisitInput {
  visitDate: Date;
  vetId?: string;
  reason?: string;
}

interface AddVetVisitInput {
  petId: string;
  vetId?: string;
  visitDate: Date;
  clinic?: string;
  vetName?: string;
  reason: string;
  notes?: string;
  scheduleNextVisit?: ScheduleNextVisitInput;
  requestingUserId: string;
}

export interface AddVetVisitResult {
  visit: VetVisit;
  nextVisit?: VetVisit;
}

@Service()
export class AddVetVisitUseCase {
  constructor(
    @Inject(HEALTH_RECORD_REPOSITORY) private readonly healthRepo: HealthRecordRepository,
    @Inject(PET_REPOSITORY) private readonly petRepository: PetRepository,
    private readonly reminderScheduler: ReminderSchedulerService,
  ) {}

  async execute(input: AddVetVisitInput): Promise<AddVetVisitResult> {
    if (!input.reason?.trim()) throw new ValidationError('Reason is required');
    if (!input.visitDate) throw new ValidationError('Visit date is required');

    const pet = await this.petRepository.findById(input.petId);
    if (!pet) throw new NotFoundError('Pet');
    if (pet.userId !== input.requestingUserId) throw new ForbiddenError('Not your pet');

    const now = new Date();
    const type = input.visitDate > now ? 'scheduled' : 'logged';

    const visit = VetVisit.create({
      petId: input.petId,
      type,
      vetId: input.vetId,
      visitDate: input.visitDate,
      clinic: input.clinic,
      vetName: input.vetName,
      reason: input.reason,
      notes: input.notes,
      createdBy: input.requestingUserId,
    });

    await this.healthRepo.saveVetVisit(visit);

    if (type === 'scheduled') {
      await this.reminderScheduler.scheduleVetVisitReminder({
        visitId: visit.id.toValue(),
        petName: pet.name,
        reason: input.reason,
        nextVisitDate: input.visitDate,
        vetName: input.vetName,
        clinic: input.clinic,
        notifyUserIds: [input.requestingUserId],
      });
    }

    let nextVisit: VetVisit | undefined;
    if (input.scheduleNextVisit) {
      nextVisit = VetVisit.create({
        petId: input.petId,
        type: 'scheduled',
        vetId: input.scheduleNextVisit.vetId ?? input.vetId,
        visitDate: input.scheduleNextVisit.visitDate,
        reason: input.scheduleNextVisit.reason ?? input.reason,
        createdBy: input.requestingUserId,
      });
      await this.healthRepo.saveVetVisit(nextVisit);
      await this.reminderScheduler.scheduleVetVisitReminder({
        visitId: nextVisit.id.toValue(),
        petName: pet.name,
        reason: nextVisit.reason,
        nextVisitDate: nextVisit.visitDate,
        vetName: nextVisit.vetName,
        clinic: nextVisit.clinic,
        notifyUserIds: [input.requestingUserId],
      });
    }

    return { visit, nextVisit };
  }
}
```

- [ ] **Step 2: Build check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add src/application/health/AddVetVisitUseCase.ts
git commit -m "feat: AddVetVisitUseCase derives type from date, supports scheduleNextVisit"
```

---

## Task 8: `UpdateVetVisitUseCase` — remove `nextVisitDate`, preserve `type`

**Files:**
- Modify: `src/application/health/UpdateVetVisitUseCase.ts`

- [ ] **Step 1: Replace full file**

```typescript
import { Inject, Service } from 'typedi';
import { HealthRecordRepository, HEALTH_RECORD_REPOSITORY } from '../../domain/health/HealthRecordRepository';
import { PetRepository, PET_REPOSITORY } from '../../domain/pet/PetRepository';
import { VetVisit } from '../../domain/health/VetVisit';
import { ForbiddenError, NotFoundError } from '../../shared/errors/AppError';
import { ReminderSchedulerService } from '../../infrastructure/queue/ReminderSchedulerService';

export interface UpdateVetVisitInput {
  visitId: string;
  vetId?: string;
  reason?: string;
  notes?: string;
  visitDate?: Date;
  requestingUserId: string;
}

@Service()
export class UpdateVetVisitUseCase {
  constructor(
    @Inject(HEALTH_RECORD_REPOSITORY) private readonly healthRepo: HealthRecordRepository,
    @Inject(PET_REPOSITORY) private readonly petRepository: PetRepository,
    private readonly reminderScheduler: ReminderSchedulerService,
  ) {}

  async execute(input: UpdateVetVisitInput): Promise<VetVisit> {
    const existing = await this.healthRepo.findVetVisitById(input.visitId);
    if (!existing) throw new NotFoundError('VetVisit');

    const pet = await this.petRepository.findById(existing.petId);
    if (!pet || pet.userId !== input.requestingUserId) throw new ForbiddenError('Not your pet');

    const updated = VetVisit.reconstitute(
      {
        petId: existing.petId,
        type: existing.type,
        createdBy: existing.createdBy,
        createdAt: existing.createdAt,
        imageUrls: existing.imageUrls,
        clinic: existing.clinic,
        vetName: existing.vetName,
        vetId: input.vetId !== undefined ? (input.vetId || undefined) : existing.vetId,
        reason: input.reason ?? existing.reason,
        notes: input.notes !== undefined ? (input.notes || undefined) : existing.notes,
        visitDate: input.visitDate ?? existing.visitDate,
      },
      existing.id,
    );

    await this.healthRepo.saveVetVisit(updated);

    // Reschedule lead-time job if visitDate changed on a scheduled visit
    if (updated.type === 'scheduled' && input.visitDate) {
      await this.reminderScheduler.scheduleVetVisitReminder({
        visitId: updated.id.toValue(),
        petName: pet.name,
        reason: updated.reason,
        nextVisitDate: updated.visitDate,
        vetName: updated.vetName,
        clinic: updated.clinic,
        notifyUserIds: [input.requestingUserId],
      });
    }

    return updated;
  }
}
```

- [ ] **Step 2: Build check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add src/application/health/UpdateVetVisitUseCase.ts
git commit -m "feat: UpdateVetVisitUseCase preserves type, removes nextVisitDate"
```

---

## Task 9: `CompleteVetVisitUseCase` — new

**Files:**
- Create: `src/application/health/CompleteVetVisitUseCase.ts`

- [ ] **Step 1: Create the file**

```typescript
import { Inject, Service } from 'typedi';
import { HealthRecordRepository, HEALTH_RECORD_REPOSITORY } from '../../domain/health/HealthRecordRepository';
import { PetRepository, PET_REPOSITORY } from '../../domain/pet/PetRepository';
import { VetVisit } from '../../domain/health/VetVisit';
import { ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors/AppError';
import { ReminderSchedulerService } from '../../infrastructure/queue/ReminderSchedulerService';

interface CompleteVetVisitInput {
  visitId: string;
  notes?: string;
  requestingUserId: string;
}

@Service()
export class CompleteVetVisitUseCase {
  constructor(
    @Inject(HEALTH_RECORD_REPOSITORY) private readonly healthRepo: HealthRecordRepository,
    @Inject(PET_REPOSITORY) private readonly petRepository: PetRepository,
    private readonly reminderScheduler: ReminderSchedulerService,
  ) {}

  async execute(input: CompleteVetVisitInput): Promise<VetVisit> {
    const existing = await this.healthRepo.findVetVisitById(input.visitId);
    if (!existing) throw new NotFoundError('VetVisit');
    if (existing.type !== 'scheduled') {
      throw new ValidationError('Only scheduled visits can be marked as done');
    }

    const pet = await this.petRepository.findById(existing.petId);
    if (!pet || pet.userId !== input.requestingUserId) throw new ForbiddenError('Not your pet');

    const completed = VetVisit.reconstitute(
      {
        petId: existing.petId,
        type: 'logged',
        vetId: existing.vetId,
        visitDate: existing.visitDate,
        clinic: existing.clinic,
        vetName: existing.vetName,
        reason: existing.reason,
        notes: input.notes ?? existing.notes,
        imageUrls: existing.imageUrls,
        createdBy: existing.createdBy,
        createdAt: existing.createdAt,
      },
      existing.id,
    );

    await this.healthRepo.saveVetVisit(completed);
    await this.reminderScheduler.cancelVetVisitReminder(input.visitId);
    await this.reminderScheduler.cancelReminders(input.visitId);

    return completed;
  }
}
```

- [ ] **Step 2: Build check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add src/application/health/CompleteVetVisitUseCase.ts
git commit -m "feat: add CompleteVetVisitUseCase"
```

---

## Task 10: `ConfigureVetVisitReminderUseCase` — new

**Files:**
- Create: `src/application/reminder/ConfigureVetVisitReminderUseCase.ts`

- [ ] **Step 1: Create the file**

```typescript
import { Inject, Service } from 'typedi';
import { HealthRecordRepository, HEALTH_RECORD_REPOSITORY } from '../../domain/health/HealthRecordRepository';
import { PetRepository, PET_REPOSITORY } from '../../domain/pet/PetRepository';
import { ReminderRepository, REMINDER_REPOSITORY } from '../../domain/reminder/ReminderRepository';
import { Reminder } from '../../domain/reminder/Reminder';
import { ReminderSchedule, ReminderScheduleProps } from '../../domain/health/value-objects/ReminderSchedule';
import { ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors/AppError';
import { ReminderSchedulerService } from '../../infrastructure/queue/ReminderSchedulerService';

interface ConfigureVetVisitReminderInput {
  visitId: string;
  schedule: ReminderScheduleProps;
  enabled: boolean;
  requestingUserId: string;
}

@Service()
export class ConfigureVetVisitReminderUseCase {
  constructor(
    @Inject(HEALTH_RECORD_REPOSITORY) private readonly healthRepo: HealthRecordRepository,
    @Inject(PET_REPOSITORY) private readonly petRepository: PetRepository,
    @Inject(REMINDER_REPOSITORY) private readonly reminderRepo: ReminderRepository,
    private readonly reminderScheduler: ReminderSchedulerService,
  ) {}

  async execute(input: ConfigureVetVisitReminderInput): Promise<void> {
    const visit = await this.healthRepo.findVetVisitById(input.visitId);
    if (!visit) throw new NotFoundError('VetVisit');
    if (visit.type !== 'scheduled') {
      throw new ValidationError('Only scheduled visits can have repeating reminders');
    }

    const pet = await this.petRepository.findById(visit.petId);
    if (!pet) throw new NotFoundError('Pet');
    if (pet.userId !== input.requestingUserId) throw new ForbiddenError('Not your pet');

    const schedule = ReminderSchedule.create(input.schedule);
    const existing = await this.reminderRepo.findByEntityId(input.visitId);

    let reminder: Reminder;
    if (existing) {
      existing.updateSchedule(schedule);
      existing.toggle(input.enabled);
      reminder = existing;
    } else {
      reminder = Reminder.create({
        entityType: 'vet_visit',
        entityId: input.visitId,
        schedule,
        enabled: input.enabled,
        notifyUserIds: [input.requestingUserId],
        createdBy: input.requestingUserId,
      });
    }

    await this.reminderRepo.save(reminder);

    if (input.enabled) {
      await this.reminderScheduler.scheduleVetVisitRepeatingReminder(reminder, {
        petId: pet.id.toValue(),
        petName: pet.name,
        reason: visit.reason,
        visitDate: visit.visitDate,
        vetName: visit.vetName,
        clinic: visit.clinic,
      });
    } else {
      await this.reminderScheduler.cancelReminders(input.visitId);
    }
  }
}
```

- [ ] **Step 2: Build check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add src/application/reminder/ConfigureVetVisitReminderUseCase.ts
git commit -m "feat: add ConfigureVetVisitReminderUseCase"
```

---

## Task 11: `HealthController` + `healthRoutes` — wire new endpoints

**Files:**
- Modify: `src/infrastructure/http/controllers/HealthController.ts`
- Modify: `src/infrastructure/http/routes/healthRoutes.ts`

- [ ] **Step 1: Update `HealthController.ts`**

Replace the full file:

```typescript
import { Request, Response, NextFunction } from 'express';
import { Inject, Service } from 'typedi';
import { AddVetVisitUseCase } from '../../../application/health/AddVetVisitUseCase';
import { AddVetVisitImageUseCase } from '../../../application/health/AddVetVisitImageUseCase';
import { UpdateVetVisitUseCase } from '../../../application/health/UpdateVetVisitUseCase';
import { CompleteVetVisitUseCase } from '../../../application/health/CompleteVetVisitUseCase';
import { ListVetVisitsUseCase } from '../../../application/health/ListVetVisitsUseCase';
import { LogMedicationUseCase } from '../../../application/health/LogMedicationUseCase';
import { UpdateMedicationUseCase } from '../../../application/health/UpdateMedicationUseCase';
import { ListMedicationsUseCase } from '../../../application/health/ListMedicationsUseCase';
import { ConfigureVetVisitReminderUseCase } from '../../../application/reminder/ConfigureVetVisitReminderUseCase';
import { VetVisitMapper } from '../../mappers/VetVisitMapper';
import { MedicationMapper } from '../../mappers/MedicationMapper';
import { ReminderMapper } from '../../mappers/ReminderMapper';
import { HealthRecordRepository, HEALTH_RECORD_REPOSITORY } from '../../../domain/health/HealthRecordRepository';
import { ReminderRepository, REMINDER_REPOSITORY } from '../../../domain/reminder/ReminderRepository';

@Service()
export class HealthController {
  constructor(
    private readonly addVetVisit: AddVetVisitUseCase,
    private readonly addVetVisitImage: AddVetVisitImageUseCase,
    private readonly updateVetVisit: UpdateVetVisitUseCase,
    private readonly completeVetVisitUseCase: CompleteVetVisitUseCase,
    private readonly listVetVisits: ListVetVisitsUseCase,
    private readonly logMedication: LogMedicationUseCase,
    private readonly updateMedication: UpdateMedicationUseCase,
    private readonly listMedications: ListMedicationsUseCase,
    private readonly configureVetVisitReminder: ConfigureVetVisitReminderUseCase,
    private readonly vetVisitMapper: VetVisitMapper,
    private readonly medicationMapper: MedicationMapper,
    private readonly reminderMapper: ReminderMapper,
    @Inject(HEALTH_RECORD_REPOSITORY) private readonly healthRepo: HealthRecordRepository,
    @Inject(REMINDER_REPOSITORY) private readonly reminderRepo: ReminderRepository,
  ) {}

  getVetVisits = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const result = await this.listVetVisits.execute(req.params.petId, req.auth.userId, { page, limit });
      res.json({ ...result, items: result.items.map((v) => this.vetVisitMapper.toResponse(v)) });
    } catch (err) {
      next(err);
    }
  };

  createVetVisit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scheduleNextVisit = req.body.scheduleNextVisit
        ? { ...req.body.scheduleNextVisit, visitDate: new Date(req.body.scheduleNextVisit.visitDate) }
        : undefined;

      const result = await this.addVetVisit.execute({
        ...req.body,
        petId: req.params.petId,
        visitDate: new Date(req.body.visitDate),
        scheduleNextVisit,
        requestingUserId: req.auth.userId,
      });

      res.status(201).json({
        visit: this.vetVisitMapper.toResponse(result.visit),
        nextVisit: result.nextVisit ? this.vetVisitMapper.toResponse(result.nextVisit) : undefined,
      });
    } catch (err) {
      next(err);
    }
  };

  uploadVetVisitImage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.file) { res.status(400).json({ message: 'No file uploaded' }); return; }
      const imageUrl = `/uploads/vet-visits/${req.file.filename}`;
      const visit = await this.addVetVisitImage.execute(req.params.visitId, imageUrl, req.auth.userId);
      res.json(this.vetVisitMapper.toResponse(visit));
    } catch (err) {
      next(err);
    }
  };

  updateVetVisitHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const visit = await this.updateVetVisit.execute({
        visitId: req.params.visitId,
        vetId: req.body.vetId,
        reason: req.body.reason,
        notes: req.body.notes,
        visitDate: req.body.visitDate ? new Date(req.body.visitDate) : undefined,
        requestingUserId: req.auth.userId,
      });
      res.json(this.vetVisitMapper.toResponse(visit));
    } catch (err) {
      next(err);
    }
  };

  completeVetVisit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const visit = await this.completeVetVisitUseCase.execute({
        visitId: req.params.visitId,
        notes: req.body.notes,
        requestingUserId: req.auth.userId,
      });
      res.json(this.vetVisitMapper.toResponse(visit));
    } catch (err) {
      next(err);
    }
  };

  getVetVisitReminder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const reminder = await this.reminderRepo.findByEntityId(req.params.visitId);
      if (!reminder) { res.status(404).json({ message: 'No reminder configured' }); return; }
      res.json(this.reminderMapper.toResponse(reminder));
    } catch (err) {
      next(err);
    }
  };

  configureVetVisitReminderHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.configureVetVisitReminder.execute({
        visitId: req.params.visitId,
        schedule: req.body.schedule,
        enabled: req.body.enabled,
        requestingUserId: req.auth.userId,
      });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  getUpcomingVetVisits = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const visits = await this.healthRepo.findUpcomingVetVisitsByUserId(req.auth.userId);
      res.json(visits.map((v) => this.vetVisitMapper.toResponse(v)));
    } catch (err) {
      next(err);
    }
  };

  getMedications = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const medications = await this.listMedications.execute(req.params.petId, req.auth.userId);
      res.json(medications.map((m) => this.medicationMapper.toResponse(m)));
    } catch (err) {
      next(err);
    }
  };

  createMedication = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const medication = await this.logMedication.execute({
        petId: req.params.petId,
        name: req.body.name,
        dosageAmount: req.body.dosageAmount,
        dosageUnit: req.body.dosageUnit,
        frequency: req.body.frequency,
        startDate: new Date(req.body.startDate),
        endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
        notes: req.body.notes,
        requestingUserId: req.auth.userId,
      });
      res.status(201).json(this.medicationMapper.toResponse(medication));
    } catch (err) {
      next(err);
    }
  };

  updateMedicationHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const medication = await this.updateMedication.execute({
        medicationId: req.params.medicationId,
        name: req.body.name,
        dosageAmount: req.body.dosageAmount,
        dosageUnit: req.body.dosageUnit,
        frequency: req.body.frequency,
        startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
        endDate: req.body.endDate === null ? null : req.body.endDate ? new Date(req.body.endDate) : undefined,
        notes: req.body.notes !== undefined ? (req.body.notes || null) : undefined,
        active: req.body.active,
        requestingUserId: req.auth.userId,
      });
      res.json(this.medicationMapper.toResponse(medication));
    } catch (err) {
      next(err);
    }
  };
}
```

- [ ] **Step 2: Update `healthRoutes.ts`**

Replace the full file:

```typescript
import { Router } from 'express';
import { Container } from 'typedi';
import { HealthController } from '../controllers/HealthController';
import { authMiddleware } from '../middleware/authMiddleware';
import { uploadImage } from '../middleware/upload';

export function healthRoutes(): Router {
  const router = Router();
  const controller = Container.get(HealthController);

  router.get('/:petId/vet-visits', authMiddleware, controller.getVetVisits);
  router.post('/:petId/vet-visits', authMiddleware, controller.createVetVisit);
  router.put('/:petId/vet-visits/:visitId', authMiddleware, controller.updateVetVisitHandler);
  router.patch('/:petId/vet-visits/:visitId/complete', authMiddleware, controller.completeVetVisit);
  router.get('/:petId/vet-visits/:visitId/reminder', authMiddleware, controller.getVetVisitReminder);
  router.put('/:petId/vet-visits/:visitId/reminder', authMiddleware, controller.configureVetVisitReminderHandler);
  router.post('/:petId/vet-visits/:visitId/images', authMiddleware, uploadImage.single('image'), controller.uploadVetVisitImage);
  router.get('/:petId/medications', authMiddleware, controller.getMedications);
  router.post('/:petId/medications', authMiddleware, controller.createMedication);
  router.put('/:petId/medications/:medicationId', authMiddleware, controller.updateMedicationHandler);

  return router;
}
```

- [ ] **Step 3: Build check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/infrastructure/http/controllers/HealthController.ts src/infrastructure/http/routes/healthRoutes.ts
git commit -m "feat: wire complete + vet visit reminder endpoints in HealthController"
```

---

## Task 12: `ReminderController` + `reminderRoutes` — add GET medication reminder

**Files:**
- Modify: `src/infrastructure/http/controllers/ReminderController.ts`
- Modify: `src/infrastructure/http/routes/reminderRoutes.ts`

- [ ] **Step 1: Replace `ReminderController.ts`**

```typescript
import { Request, Response, NextFunction } from 'express';
import { Inject, Service } from 'typedi';
import { ConfigureMedicationReminderUseCase } from '../../../application/reminder/ConfigureMedicationReminderUseCase';
import { ToggleMedicationReminderUseCase } from '../../../application/reminder/ToggleMedicationReminderUseCase';
import { ReminderRepository, REMINDER_REPOSITORY } from '../../../domain/reminder/ReminderRepository';
import { ReminderMapper } from '../../mappers/ReminderMapper';

@Service()
export class ReminderController {
  constructor(
    private readonly configureReminder: ConfigureMedicationReminderUseCase,
    private readonly toggleReminder: ToggleMedicationReminderUseCase,
    @Inject(REMINDER_REPOSITORY) private readonly reminderRepo: ReminderRepository,
    private readonly reminderMapper: ReminderMapper,
  ) {}

  getReminder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const reminder = await this.reminderRepo.findByEntityId(req.params.medicationId);
      if (!reminder) { res.status(404).json({ message: 'No reminder configured' }); return; }
      res.json(this.reminderMapper.toResponse(reminder));
    } catch (err) {
      next(err);
    }
  };

  configure = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.configureReminder.execute({
        medicationId: req.params.medicationId,
        ...req.body,
        requestingUserId: req.auth.userId,
      });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  toggle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.toggleReminder.execute(
        req.params.medicationId,
        req.body.enabled,
        req.auth.userId,
      );
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}
```

- [ ] **Step 2: Replace `reminderRoutes.ts`**

```typescript
import { Router } from 'express';
import { Container } from 'typedi';
import { ReminderController } from '../controllers/ReminderController';
import { authMiddleware } from '../middleware/authMiddleware';

export function reminderRoutes(): Router {
  const router = Router();
  const controller = Container.get(ReminderController);

  router.get('/:medicationId/reminder', authMiddleware, controller.getReminder);
  router.put('/:medicationId/reminder', authMiddleware, controller.configure);
  router.patch('/:medicationId/reminder/toggle', authMiddleware, controller.toggle);

  return router;
}
```

- [ ] **Step 3: Final API build check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4: Manual smoke test — start the server**

```bash
npm run dev
```

In another terminal, get a JWT token via login, then test:

```bash
# List vet visits — should include `type` in response
curl -H "Authorization: Bearer <token>" http://localhost:3000/pets/<petId>/vet-visits

# Create a future-dated visit (should be type=scheduled)
curl -X POST -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"visitDate":"2026-07-01T10:00:00.000Z","reason":"Annual checkup"}' \
  http://localhost:3000/pets/<petId>/vet-visits

# Mark it done
curl -X PATCH -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"notes":"All good"}' \
  http://localhost:3000/pets/<petId>/vet-visits/<visitId>/complete
```

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/http/controllers/ReminderController.ts src/infrastructure/http/routes/reminderRoutes.ts
git commit -m "feat: add GET reminder endpoint to ReminderController"
```

---

## Task 13: Client types + API layer

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/api/health.ts`
- Create: `src/api/reminders.ts`

- [ ] **Step 1: Update `src/types/index.ts`**

Replace the `VetVisit` interface and add `ReminderScheduleProps` + `Reminder`:

```typescript
export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface Pet {
  id: string;
  name: string;
  species: string;
  breed?: string;
  birthDate?: string;
  photoUrl?: string;
  userId: string;
  createdAt: string;
}

export interface VetVisit {
  id: string;
  petId: string;
  type: 'logged' | 'scheduled';
  vetId?: string;
  clinic?: string;
  vetName?: string;
  reason: string;
  notes?: string;
  visitDate: string;
  imageUrls: string[];
  createdAt: string;
}

export type DayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

export type ReminderScheduleProps =
  | { type: 'daily'; times: string[] }
  | { type: 'weekly'; days: DayOfWeek[]; times: string[] }
  | { type: 'monthly'; daysOfMonth: number[]; times: string[] };

export interface Reminder {
  id: string;
  entityType: 'medication' | 'vet_visit';
  entityId: string;
  schedule: ReminderScheduleProps;
  enabled: boolean;
  notifyUserIds: string[];
  createdAt: string;
}

export interface Medication {
  id: string;
  petId: string;
  name: string;
  dosage: { amount: number; unit: string };
  frequency: { type: string; interval: number; label: string };
  startDate: string;
  endDate?: string;
  notes?: string;
  active: boolean;
  createdAt: string;
}

export interface Vet {
  id: string;
  userId: string;
  name: string;
  address?: string;
  phone?: string;
  workHours?: string;
  googleMapsUrl?: string;
  notes?: string;
  createdAt: string;
}

export interface AuthTokens {
  token: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  nextPage: number | null;
}
```

- [ ] **Step 2: Update `src/api/health.ts`**

```typescript
import { apiClient } from './client';
import type { VetVisit, Medication, PaginatedResult } from '../types';

export const healthApi = {
  // Vet Visits
  listVetVisits: (petId: string, { pageParam = 1 }: { pageParam?: number } = {}) =>
    apiClient
      .get<PaginatedResult<VetVisit>>(`/pets/${petId}/vet-visits`, { params: { page: pageParam, limit: 20 } })
      .then((r) => r.data),

  createVetVisit: (
    petId: string,
    data: {
      visitDate: string;
      vetId?: string;
      reason: string;
      notes?: string;
      scheduleNextVisit?: { visitDate: string; vetId?: string; reason?: string };
    },
  ) =>
    apiClient
      .post<{ visit: VetVisit; nextVisit?: VetVisit }>(`/pets/${petId}/vet-visits`, data)
      .then((r) => r.data),

  updateVetVisit: (
    petId: string,
    visitId: string,
    data: { vetId?: string; reason?: string; notes?: string; visitDate?: string },
  ) =>
    apiClient.put<VetVisit>(`/pets/${petId}/vet-visits/${visitId}`, data).then((r) => r.data),

  completeVetVisit: (petId: string, visitId: string, notes?: string) =>
    apiClient
      .patch<VetVisit>(`/pets/${petId}/vet-visits/${visitId}/complete`, { notes })
      .then((r) => r.data),

  uploadVetVisitImage: (petId: string, visitId: string, file: File) => {
    const form = new FormData();
    form.append('image', file);
    return apiClient
      .post<VetVisit>(`/pets/${petId}/vet-visits/${visitId}/images`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },

  listUpcomingVetVisits: () =>
    apiClient.get<VetVisit[]>('/vet-visits/upcoming').then((r) => r.data),

  // Medications
  createMedication: (petId: string, data: Omit<Medication, 'id' | 'petId' | 'createdAt'>) =>
    apiClient.post<Medication>(`/pets/${petId}/medications`, data).then((r) => r.data),
};
```

- [ ] **Step 3: Create `src/api/reminders.ts`**

```typescript
import { apiClient } from './client';
import type { Reminder, ReminderScheduleProps } from '../types';

export const remindersApi = {
  getMedicationReminder: (medicationId: string): Promise<Reminder | null> =>
    apiClient
      .get<Reminder>(`/medications/${medicationId}/reminder`)
      .then((r) => r.data)
      .catch((err) => {
        if (err.response?.status === 404) return null;
        throw err;
      }),

  configureMedicationReminder: (
    medicationId: string,
    data: { schedule: ReminderScheduleProps; enabled: boolean },
  ) => apiClient.put(`/medications/${medicationId}/reminder`, data),

  getVetVisitReminder: (petId: string, visitId: string): Promise<Reminder | null> =>
    apiClient
      .get<Reminder>(`/pets/${petId}/vet-visits/${visitId}/reminder`)
      .then((r) => r.data)
      .catch((err) => {
        if (err.response?.status === 404) return null;
        throw err;
      }),

  configureVetVisitReminder: (
    petId: string,
    visitId: string,
    data: { schedule: ReminderScheduleProps; enabled: boolean },
  ) => apiClient.put(`/pets/${petId}/vet-visits/${visitId}/reminder`, data),
};
```

- [ ] **Step 4: Commit**

```bash
cd /Users/latzko/projects/pet-health-tracker-client
git add src/types/index.ts src/api/health.ts src/api/reminders.ts
git commit -m "feat: update types and API layer for vet visit refactor"
```

---

## Task 14: `ReminderScheduleEditor` component

**Files:**
- Create: `src/components/ReminderScheduleEditor.tsx`

- [ ] **Step 1: Create the file**

```typescript
import { Box, Button, Chip, FormControlLabel, MenuItem, Switch, TextField, Typography } from '@mui/material';
import type { DayOfWeek, ReminderScheduleProps } from '../types';

const DAYS: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const DEFAULT_SCHEDULE: ReminderScheduleProps = { type: 'daily', times: ['08:00'] };

interface ReminderScheduleEditorProps {
  enabled: boolean;
  onToggleEnabled: (v: boolean) => void;
  schedule: ReminderScheduleProps | null;
  onChange: (s: ReminderScheduleProps) => void;
  saving?: boolean;
}

export function ReminderScheduleEditor({
  enabled,
  onToggleEnabled,
  schedule,
  onChange,
  saving,
}: ReminderScheduleEditorProps) {
  const current = schedule ?? DEFAULT_SCHEDULE;

  const handleTypeChange = (type: 'daily' | 'weekly' | 'monthly') => {
    if (type === 'daily') onChange({ type: 'daily', times: current.times });
    else if (type === 'weekly') onChange({ type: 'weekly', days: ['MON'], times: current.times });
    else onChange({ type: 'monthly', daysOfMonth: [1], times: current.times });
  };

  const handleTimeChange = (index: number, value: string) => {
    const times = [...current.times];
    times[index] = value;
    onChange({ ...current, times } as ReminderScheduleProps);
  };

  const addTime = () => {
    if (current.times.length >= 4) return;
    onChange({ ...current, times: [...current.times, '08:00'] } as ReminderScheduleProps);
  };

  const removeTime = (index: number) => {
    const times = current.times.filter((_, i) => i !== index);
    if (times.length === 0) return;
    onChange({ ...current, times } as ReminderScheduleProps);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <FormControlLabel
        control={
          <Switch checked={enabled} onChange={(e) => onToggleEnabled(e.target.checked)} disabled={saving} />
        }
        label="Enable reminders"
      />

      {enabled && (
        <>
          <TextField
            select
            label="Schedule type"
            value={current.type}
            onChange={(e) => handleTypeChange(e.target.value as 'daily' | 'weekly' | 'monthly')}
            fullWidth
            disabled={saving}
          >
            <MenuItem value="daily">Daily</MenuItem>
            <MenuItem value="weekly">Weekly</MenuItem>
            <MenuItem value="monthly">Monthly</MenuItem>
          </TextField>

          {current.type === 'weekly' && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {DAYS.map((d) => {
                const selected = (current as { days: DayOfWeek[] }).days.includes(d);
                return (
                  <Chip
                    key={d}
                    label={d}
                    size="small"
                    color={selected ? 'primary' : 'default'}
                    variant={selected ? 'filled' : 'outlined'}
                    onClick={() => {
                      const days = selected
                        ? (current as { days: DayOfWeek[] }).days.filter((x) => x !== d)
                        : [...(current as { days: DayOfWeek[] }).days, d];
                      if (days.length > 0)
                        onChange({ ...current, days } as ReminderScheduleProps);
                    }}
                    disabled={saving}
                    sx={{ cursor: 'pointer' }}
                  />
                );
              })}
            </Box>
          )}

          {current.type === 'monthly' && (
            <TextField
              label="Day(s) of month (comma-separated)"
              fullWidth
              disabled={saving}
              value={(current as { daysOfMonth: number[] }).daysOfMonth.join(', ')}
              onChange={(e) => {
                const daysOfMonth = e.target.value
                  .split(',')
                  .map((s) => parseInt(s.trim()))
                  .filter((n) => n >= 1 && n <= 31);
                if (daysOfMonth.length > 0)
                  onChange({ ...current, daysOfMonth } as ReminderScheduleProps);
              }}
            />
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Reminder time(s)
            </Typography>
            {current.times.map((t, i) => (
              <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <TextField
                  label={`Time ${i + 1}`}
                  type="time"
                  value={t}
                  onChange={(e) => handleTimeChange(i, e.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                  disabled={saving}
                  sx={{ flex: 1 }}
                />
                {current.times.length > 1 && (
                  <Button
                    size="small"
                    color="inherit"
                    onClick={() => removeTime(i)}
                    disabled={saving}
                    sx={{ minWidth: 32 }}
                  >
                    ✕
                  </Button>
                )}
              </Box>
            ))}
            <Button
              size="small"
              variant="outlined"
              onClick={addTime}
              disabled={saving || current.times.length >= 4}
            >
              + Add time
            </Button>
          </Box>
        </>
      )}
    </Box>
  );
}
```

- [ ] **Step 2: Build check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ReminderScheduleEditor.tsx
git commit -m "feat: add ReminderScheduleEditor shared component"
```

---

## Task 15: `ScheduledVisitDetailDialog` component

**Files:**
- Create: `src/components/ScheduledVisitDetailDialog.tsx`

- [ ] **Step 1: Create the file**

```typescript
import { useEffect, useState } from 'react';
import {
  Box, Button, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, TextField, Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Reminder, ReminderScheduleProps, Vet, VetVisit } from '../types';
import { healthApi } from '../api/health';
import { remindersApi } from '../api/reminders';
import { ReminderScheduleEditor } from './ReminderScheduleEditor';
import { getApiError } from '../api/client';
import { useNotification } from '../context/NotificationContext';

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

function daysUntilLabel(iso: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [year, month, day] = iso.split('T')[0].split('-').map(Number);
  const d = Math.round((new Date(year, month - 1, day).getTime() - today.getTime()) / 86_400_000);
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  if (d > 0) return `In ${d} days`;
  return `${Math.abs(d)} days ago`;
}

interface Props {
  visit: VetVisit;
  petId: string;
  vets: Vet[];
  onClose: () => void;
}

export function ScheduledVisitDetailDialog({ visit, petId, vets, onClose }: Props) {
  const queryClient = useQueryClient();
  const { showError } = useNotification();

  const vetName = vets.find((v) => v.id === visit.vetId)?.name ?? visit.clinic ?? '—';
  const [markingDone, setMarkingDone] = useState(false);
  const [doneNotes, setDoneNotes] = useState('');
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderSchedule, setReminderSchedule] = useState<ReminderScheduleProps | null>(null);

  const reminderQuery = useQuery<Reminder | null>({
    queryKey: ['vet-visit-reminder', visit.id],
    queryFn: () => remindersApi.getVetVisitReminder(petId, visit.id),
    retry: false,
  });

  useEffect(() => {
    if (reminderQuery.data) {
      setReminderEnabled(reminderQuery.data.enabled);
      setReminderSchedule(reminderQuery.data.schedule);
    }
  }, [reminderQuery.data]);

  const reminderMutation = useMutation({
    mutationFn: (data: { schedule: ReminderScheduleProps; enabled: boolean }) =>
      remindersApi.configureVetVisitReminder(petId, visit.id, data),
    onError: (err) => showError(getApiError(err)),
  });

  const completeMutation = useMutation({
    mutationFn: () => healthApi.completeVetVisit(petId, visit.id, doneNotes || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vet-visits', petId] });
      onClose();
    },
    onError: (err) => showError(getApiError(err)),
  });

  const handleReminderChange = (s: ReminderScheduleProps) => {
    setReminderSchedule(s);
    if (reminderEnabled) reminderMutation.mutate({ schedule: s, enabled: true });
  };

  const handleReminderToggle = (enabled: boolean) => {
    setReminderEnabled(enabled);
    reminderMutation.mutate({
      schedule: reminderSchedule ?? { type: 'daily', times: ['08:00'] },
      enabled,
    });
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pb: 0.5 }}>
        <Typography variant="h6">{visit.reason}</Typography>
        <Typography variant="body2" color="text.secondary">
          {vetName} · {fmtDate(visit.visitDate)}
        </Typography>
        <Typography variant="body2" color="primary">
          {daysUntilLabel(visit.visitDate)}
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1.5 }}>
        <Divider />

        <Typography variant="subtitle2" color="text.secondary">
          Repeating reminder
        </Typography>

        {reminderQuery.isLoading ? (
          <CircularProgress size={20} />
        ) : (
          <ReminderScheduleEditor
            enabled={reminderEnabled}
            onToggleEnabled={handleReminderToggle}
            schedule={reminderSchedule}
            onChange={handleReminderChange}
            saving={reminderMutation.isPending}
          />
        )}

        <Divider />

        {markingDone ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography variant="subtitle2">Add visit notes (optional)</Typography>
            <TextField
              label="Notes"
              multiline
              rows={3}
              fullWidth
              value={doneNotes}
              onChange={(e) => setDoneNotes(e.target.value)}
              autoFocus
            />
          </Box>
        ) : (
          <Button variant="outlined" color="success" onClick={() => setMarkingDone(true)}>
            Mark as done
          </Button>
        )}
      </DialogContent>

      <DialogActions>
        {markingDone ? (
          <>
            <Button onClick={() => setMarkingDone(false)} color="inherit">
              Back
            </Button>
            <Button
              variant="contained"
              color="success"
              onClick={() => completeMutation.mutate()}
              disabled={completeMutation.isPending}
            >
              {completeMutation.isPending ? 'Saving…' : 'Confirm done'}
            </Button>
          </>
        ) : (
          <Button onClick={onClose}>Close</Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
```

- [ ] **Step 2: Build check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ScheduledVisitDetailDialog.tsx
git commit -m "feat: add ScheduledVisitDetailDialog"
```

---

## Task 16: `MedicationDetailDialog` component

**Files:**
- Create: `src/components/MedicationDetailDialog.tsx`

- [ ] **Step 1: Create the file**

```typescript
import { useEffect, useState } from 'react';
import {
  Box, Button, Checkbox, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControlLabel, MenuItem, Switch, Tab, Tabs, TextField,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Medication, ReminderScheduleProps } from '../types';
import type { UpdateMedicationInput } from '../api/medications';
import { medicationsApi } from '../api/medications';
import { remindersApi } from '../api/reminders';
import { ReminderScheduleEditor } from './ReminderScheduleEditor';
import { getApiError } from '../api/client';
import { useNotification } from '../context/NotificationContext';

const DOSAGE_UNITS = ['mg', 'ml', 'g', 'mcg', 'tab', 'pip', 'injection', 'collar', 'drop'];
type FreqType = 'hourly' | 'daily' | 'weekly' | 'monthly';

const today = () => new Date().toISOString().slice(0, 10);

interface Props {
  med: Medication;
  petId: string;
  onClose: () => void;
}

export function MedicationDetailDialog({ med, petId, onClose }: Props) {
  const queryClient = useQueryClient();
  const { showError } = useNotification();
  const [tab, setTab] = useState<'details' | 'reminder'>('details');

  // Details form state
  const [form, setForm] = useState({
    name: med.name,
    dosageAmount: String(med.dosage.amount),
    dosageUnit: med.dosage.unit,
    startDate: med.startDate.slice(0, 10),
    endDate: med.endDate ? med.endDate.slice(0, 10) : '',
    notes: med.notes ?? '',
  });
  const [frequency, setFrequency] = useState<{ type: FreqType; interval: number }>({
    type: med.frequency.type as FreqType,
    interval: med.frequency.interval,
  });
  const [hasEndDate, setHasEndDate] = useState(!!med.endDate);
  const [active, setActive] = useState(med.active);

  const set = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));
  const canSave = !!(form.name && form.dosageAmount && form.dosageUnit && form.startDate);

  // Reminder state
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderSchedule, setReminderSchedule] = useState<ReminderScheduleProps | null>(null);

  const reminderQuery = useQuery({
    queryKey: ['medication-reminder', med.id],
    queryFn: () => remindersApi.getMedicationReminder(med.id),
    retry: false,
    enabled: tab === 'reminder',
  });

  useEffect(() => {
    if (reminderQuery.data) {
      setReminderEnabled(reminderQuery.data.enabled);
      setReminderSchedule(reminderQuery.data.schedule);
    }
  }, [reminderQuery.data]);

  const updateMutation = useMutation({
    mutationFn: (data: UpdateMedicationInput) => medicationsApi.update(petId, med.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medications', petId] });
      onClose();
    },
    onError: (err) => showError(getApiError(err)),
  });

  const reminderMutation = useMutation({
    mutationFn: (data: { schedule: ReminderScheduleProps; enabled: boolean }) =>
      remindersApi.configureMedicationReminder(med.id, data),
    onError: (err) => showError(getApiError(err)),
  });

  const handleSave = () => {
    updateMutation.mutate({
      name: form.name,
      dosageAmount: parseFloat(form.dosageAmount),
      dosageUnit: form.dosageUnit,
      frequency,
      startDate: new Date(form.startDate).toISOString(),
      endDate: hasEndDate && form.endDate ? new Date(form.endDate).toISOString() : null,
      notes: form.notes || null,
      active,
    });
  };

  const handleReminderChange = (s: ReminderScheduleProps) => {
    setReminderSchedule(s);
    if (reminderEnabled) reminderMutation.mutate({ schedule: s, enabled: true });
  };

  const handleReminderToggle = (enabled: boolean) => {
    setReminderEnabled(enabled);
    reminderMutation.mutate({
      schedule: reminderSchedule ?? { type: 'daily', times: ['08:00'] },
      enabled,
    });
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pb: 0 }}>{med.name}</DialogTitle>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 3 }}>
        <Tab value="details" label="Details" />
        <Tab value="reminder" label="🔔 Reminder" />
      </Tabs>

      <DialogContent sx={{ pt: 2 }}>
        {tab === 'details' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Medication name"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              fullWidth
              required
            />
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                label="Dose"
                type="number"
                value={form.dosageAmount}
                onChange={(e) => set('dosageAmount', e.target.value)}
                sx={{ flex: 1 }}
                required
                slotProps={{ htmlInput: { min: 0, step: 'any' } }}
              />
              <TextField
                select
                label="Unit"
                value={form.dosageUnit}
                onChange={(e) => set('dosageUnit', e.target.value)}
                sx={{ width: 130 }}
              >
                {DOSAGE_UNITS.map((u) => (
                  <MenuItem key={u} value={u}>
                    {u}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                select
                label="Frequency"
                value={frequency.type}
                onChange={(e) => setFrequency({ ...frequency, type: e.target.value as FreqType })}
                sx={{ flex: 1 }}
              >
                <MenuItem value="hourly">Hourly</MenuItem>
                <MenuItem value="daily">Daily</MenuItem>
                <MenuItem value="weekly">Weekly</MenuItem>
                <MenuItem value="monthly">Monthly</MenuItem>
              </TextField>
              <TextField
                label="Every"
                type="number"
                value={frequency.interval}
                onChange={(e) => setFrequency({ ...frequency, interval: Math.max(1, parseInt(e.target.value) || 1) })}
                sx={{ width: 100 }}
                slotProps={{ htmlInput: { min: 1 } }}
              />
            </Box>
            <TextField
              label="Start date"
              type="date"
              value={form.startDate}
              onChange={(e) => set('startDate', e.target.value)}
              fullWidth
              required
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <FormControlLabel
              control={<Checkbox checked={hasEndDate} onChange={(e) => setHasEndDate(e.target.checked)} />}
              label="Set end date"
            />
            {hasEndDate && (
              <TextField
                label="End date"
                type="date"
                value={form.endDate}
                onChange={(e) => set('endDate', e.target.value)}
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
              />
            )}
            <TextField
              label="Notes"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              fullWidth
              multiline
              rows={2}
            />
            <FormControlLabel
              control={<Switch checked={active} onChange={(e) => setActive(e.target.checked)} />}
              label="Active"
            />
          </Box>
        )}

        {tab === 'reminder' && (
          <>
            {reminderQuery.isLoading ? (
              <CircularProgress size={20} />
            ) : (
              <ReminderScheduleEditor
                enabled={reminderEnabled}
                onToggleEnabled={handleReminderToggle}
                schedule={reminderSchedule}
                onChange={handleReminderChange}
                saving={reminderMutation.isPending}
              />
            )}
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        {tab === 'details' && (
          <Button
            variant="contained"
            disabled={!canSave || updateMutation.isPending}
            onClick={handleSave}
          >
            {updateMutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
```

- [ ] **Step 2: Build check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/components/MedicationDetailDialog.tsx
git commit -m "feat: add MedicationDetailDialog with Details + Reminder tabs"
```

---

## Task 17: `PetDetailPage` — refactor for new UI

**Files:**
- Modify: `src/pages/health/PetDetailPage.tsx`

This is the largest change. Work through it section by section.

- [ ] **Step 1: Update imports at the top of `PetDetailPage.tsx`**

Add these imports (merge with existing):

```typescript
import { ScheduledVisitDetailDialog } from '../../components/ScheduledVisitDetailDialog';
import { MedicationDetailDialog } from '../../components/MedicationDetailDialog';
```

Remove the import of `MedicalServices` from `@mui/icons-material` if it was unused, and add `CalendarToday`:

```typescript
import { Add, AddAPhoto, Edit, Pets, Close, Medication as MedicationIcon, CalendarToday } from '@mui/icons-material';
```

- [ ] **Step 2: Add state for scheduled visit dialog and medication detail dialog**

After the existing `const [detailVisit, setDetailVisit] = useState<VetVisit | null>(null);` line, add:

```typescript
const [scheduledVisit, setScheduledVisit] = useState<VetVisit | null>(null);
const [detailMed, setDetailMed] = useState<Medication | null>(null);
```

- [ ] **Step 3: Update `AddVetVisitDialog` form state and mutation**

Replace the `hasNextVisit` state and `vetForm` state with:

```typescript
const [hasNextVisit, setHasNextVisit] = useState(false);
const [vetForm, setVetForm] = useState({
  vetId: '',
  reason: '',
  notes: '',
  visitDate: todayNoon(),
  nextVisitDate: weekFromNow(),
  nextReason: '',
});
```

Replace the `vetMutation` with:

```typescript
const isScheduling = vetForm.visitDate ? new Date(vetForm.visitDate + ':00') > new Date() : false;

const vetMutation = useMutation({
  mutationFn: () =>
    healthApi.createVetVisit(petId!, {
      vetId: vetForm.vetId || undefined,
      reason: vetForm.reason,
      notes: !isScheduling && vetForm.notes ? vetForm.notes : undefined,
      visitDate: toIso(vetForm.visitDate),
      scheduleNextVisit:
        !isScheduling && hasNextVisit && vetForm.nextVisitDate
          ? {
              visitDate: toIso(vetForm.nextVisitDate),
              reason: vetForm.nextReason || vetForm.reason,
              vetId: vetForm.vetId || undefined,
            }
          : undefined,
    }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['vet-visits', petId] });
    setAddOpen(false);
    setVetForm({ vetId: '', reason: '', notes: '', visitDate: todayNoon(), nextVisitDate: weekFromNow(), nextReason: '' });
    setHasNextVisit(false);
  },
  onError: (err) => showError(getApiError(err)),
});
```

- [ ] **Step 4: Split vetVisits into scheduled and logged arrays**

After the `const vetVisits = ...` line, add:

```typescript
const scheduledVisits = vetVisits
  .filter((v) => v.type === 'scheduled')
  .sort((a, b) => new Date(a.visitDate).getTime() - new Date(b.visitDate).getTime());
const loggedVisits = vetVisits.filter((v) => v.type === 'logged');
```

- [ ] **Step 5: Replace the vet visits tab rendering**

Replace the entire `{tab === 'vet-visits' && (...)}` block with:

```tsx
{tab === 'vet-visits' && (
  <>
    {vetVisitsQuery.isLoading ? (
      <LoadingState />
    ) : vetVisitsQuery.isError ? (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">{getApiError(vetVisitsQuery.error)}</Alert>
      </Box>
    ) : (
      <>
        {/* Upcoming banner */}
        {scheduledVisits.length > 0 && (
          <Box
            sx={{
              p: 1.5,
              borderBottom: '1px solid rgba(255,255,255,0.07)',
              background: 'rgba(42,157,143,0.06)',
            }}
          >
            <Typography
              variant="caption"
              sx={{ fontWeight: 600, color: 'primary.main', px: 0.5, display: 'block', mb: 1 }}
            >
              UPCOMING
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 0.5 }}>
              {scheduledVisits.map((v) => {
                const days = daysUntilNum(v.visitDate);
                return (
                  <Box
                    key={v.id}
                    onClick={() => setScheduledVisit(v)}
                    sx={{
                      flexShrink: 0,
                      background: 'rgba(42,157,143,0.15)',
                      border: '1px solid rgba(42,157,143,0.3)',
                      borderRadius: 2,
                      px: 1.5,
                      py: 1,
                      cursor: 'pointer',
                      '&:hover': { background: 'rgba(42,157,143,0.25)' },
                    }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {v.reason}
                    </Typography>
                    <Typography variant="caption" color="primary">
                      {days === 0
                        ? 'Today'
                        : days === 1
                        ? 'Tomorrow'
                        : `In ${days} days`}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}

        {/* History list */}
        {loggedVisits.length === 0 && scheduledVisits.length === 0 ? (
          <EmptyState />
        ) : loggedVisits.length === 0 ? (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No visit history yet
            </Typography>
          </Box>
        ) : (
          <List disablePadding>
            {loggedVisits.map((v, i) => {
              const vet = vets.find((vt) => vt.id === v.vetId);
              const vetName = vet ? vet.name : (v.clinic ?? null);
              return (
                <Box key={v.id}>
                  {i > 0 && <Divider />}
                  <ListItemButton onClick={() => setDetailVisit(v)} sx={{ py: 1, px: 2 }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
                        {v.reason}
                      </Typography>
                      {vetName && (
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {vetName}
                        </Typography>
                      )}
                    </Box>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ whiteSpace: 'nowrap', ml: 2, flexShrink: 0 }}
                    >
                      {fmtDate(v.visitDate)}
                    </Typography>
                  </ListItemButton>
                </Box>
              );
            })}
          </List>
        )}
        <div ref={vetVisitsSentinel} />
        {vetVisitsQuery.isFetchingNextPage && <ListSkeleton />}
      </>
    )}
  </>
)}
```

- [ ] **Step 6: Update the medications tab to use `MedicationDetailDialog`**

Replace `onEdit={() => setEditMed(m)}` in the MedicationRow calls:

```tsx
{medications.map((m, i) => (
  <Box key={m.id}>
    {i > 0 && <Divider />}
    <MedicationRow
      med={m}
      onEdit={() => setDetailMed(m)}
      onToggleActive={(active) => editMedMutation.mutate({ id: m.id, data: { active } })}
    />
  </Box>
))}
```

- [ ] **Step 7: Update the Add Vet Visit dialog form**

Replace the contents of the `<Dialog open={addOpen} ...>` dialog:

```tsx
<Dialog open={addOpen} onClose={() => setAddOpen(false)} fullWidth maxWidth="sm">
  <DialogTitle>
    {isScheduling ? 'Schedule Vet Visit' : 'Log Vet Visit'}
  </DialogTitle>
  <DialogContent>
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
      <TextField
        select
        label="Vet / Clinic"
        value={vetForm.vetId}
        onChange={(e) => setVetForm({ ...vetForm, vetId: e.target.value })}
        fullWidth
      >
        <MenuItem value="">— None —</MenuItem>
        {vets.map((v) => (
          <MenuItem key={v.id} value={v.id}>
            {v.name}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        label="Reason"
        value={vetForm.reason}
        onChange={(e) => setVetForm({ ...vetForm, reason: e.target.value })}
        fullWidth
        required
      />
      <TextField
        label="Visit Date"
        type="datetime-local"
        value={vetForm.visitDate}
        onChange={(e) => setVetForm({ ...vetForm, visitDate: e.target.value })}
        fullWidth
        slotProps={{ inputLabel: { shrink: true } }}
        required
        helperText={isScheduling ? 'Future date — will be saved as a scheduled visit' : 'Past or today — will be logged as history'}
      />
      {!isScheduling && (
        <TextField
          label="Notes"
          value={vetForm.notes}
          onChange={(e) => setVetForm({ ...vetForm, notes: e.target.value })}
          fullWidth
          multiline
          rows={3}
        />
      )}
      {!isScheduling && (
        <>
          <FormControlLabel
            control={
              <Checkbox
                checked={hasNextVisit}
                onChange={(e) => setHasNextVisit(e.target.checked)}
              />
            }
            label="Also schedule next visit"
          />
          {hasNextVisit && (
            <>
              <TextField
                label="Next Visit Date"
                type="datetime-local"
                value={vetForm.nextVisitDate}
                onChange={(e) => setVetForm({ ...vetForm, nextVisitDate: e.target.value })}
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                label="Reason for next visit"
                placeholder={vetForm.reason || 'Same as current'}
                value={vetForm.nextReason}
                onChange={(e) => setVetForm({ ...vetForm, nextReason: e.target.value })}
                fullWidth
              />
            </>
          )}
        </>
      )}
    </Box>
  </DialogContent>
  <DialogActions>
    <Button onClick={() => setAddOpen(false)}>Cancel</Button>
    <Button
      variant="contained"
      onClick={() => vetMutation.mutate()}
      disabled={!vetForm.reason || !vetForm.visitDate || vetMutation.isPending}
    >
      {vetMutation.isPending ? 'Saving…' : 'Save'}
    </Button>
  </DialogActions>
</Dialog>
```

- [ ] **Step 8: Add `ScheduledVisitDetailDialog` and `MedicationDetailDialog` to the render**

After the `{/* Vet visit detail dialog */}` block, add:

```tsx
{/* Scheduled visit detail dialog */}
{scheduledVisit && (
  <ScheduledVisitDetailDialog
    key={scheduledVisit.id}
    visit={scheduledVisit}
    petId={petId!}
    vets={vets}
    onClose={() => setScheduledVisit(null)}
  />
)}

{/* Medication detail dialog */}
{detailMed && (
  <MedicationDetailDialog
    key={detailMed.id}
    med={detailMed}
    petId={petId!}
    onClose={() => setDetailMed(null)}
  />
)}
```

- [ ] **Step 9: Remove now-unused state and dialogs**

Remove:
- `const [editMed, setEditMed] = useState<Medication | null>(null);` — replaced by `detailMed`
- The `{editMed && <EditMedicationDialog ... />}` block — replaced by `MedicationDetailDialog`
- The `EditMedicationDialog` function definition at the bottom of the file (it was inline, now extracted)

Also remove `AddMedicationDialog` if it's still inline — keep it or leave it as-is (it's still needed for adding new medications; only the *edit* flow changed).

- [ ] **Step 10: Build check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Fix any remaining type errors (typically around the removed `nextVisitDate` references in `VetVisitEditForm` or `visitToForm`).

In `visitToForm` (the function for the existing `VetVisitDetailDialog` edit form), remove the `nextVisitDate` and `hasNextVisit` fields:

```typescript
type VetVisitEditForm = {
  vetId: string;
  reason: string;
  notes: string;
  visitDate: string;
};

function visitToForm(visit: VetVisit): VetVisitEditForm {
  return {
    vetId: visit.vetId ?? '',
    reason: visit.reason,
    notes: visit.notes ?? '',
    visitDate: visit.visitDate ? new Date(visit.visitDate).toISOString().slice(0, 16) : '',
  };
}
```

In `VetVisitDetailDialog.handleConfirm`, remove the `nextVisitDate` field from the `onSave` call:

```typescript
const handleConfirm = () => {
  setConfirmOpen(false);
  onSave({
    vetId: form.vetId || undefined,
    reason: form.reason,
    notes: form.notes || undefined,
    visitDate: form.visitDate ? new Date(form.visitDate + ':00').toISOString() : undefined,
  });
  setEditing(false);
};
```

In `VetVisitDetailDialog`'s edit form, remove the `FormControlLabel` for "Schedule next visit" and the `nextVisitDate` field.

- [ ] **Step 11: Start dev server and verify manually**

```bash
npm run dev
```

Verify:
1. Navigate to a pet's detail page → vet visits tab
2. Click "Add" → pick a future date → title shows "Schedule Vet Visit", no notes field
3. Click "Add" → pick today's date → title shows "Log Vet Visit", notes field present, "Also schedule next visit" checkbox present
4. After saving a future-dated visit, it appears in the upcoming banner as a chip
5. Click the chip → `ScheduledVisitDetailDialog` opens with reminder config and "Mark as done"
6. Mark as done → visit moves from banner to history list
7. Medications tab → click a medication → `MedicationDetailDialog` opens with Details and Reminder tabs
8. Reminder tab → enable, pick schedule → saves without page reload

- [ ] **Step 12: Commit**

```bash
cd /Users/latzko/projects/pet-health-tracker-client
git add src/pages/health/PetDetailPage.tsx
git commit -m "feat: refactor PetDetailPage for scheduled/logged visits and medication reminder UI"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task(s) |
|---|---|
| `type: logged/scheduled` discriminator | Tasks 1, 2, 3 |
| `nextVisitDate` removed | Tasks 1, 2, 3, 8 |
| Auto-detect type from visitDate | Task 7 |
| Lead-time job on scheduled creation | Task 7 |
| `scheduleNextVisit` shortcut | Tasks 7, 17 |
| `CompleteVetVisitUseCase` (PATCH .../complete) | Tasks 9, 11 |
| `ConfigureVetVisitReminderUseCase` (repeating) | Tasks 10, 11 |
| GET reminder endpoints | Tasks 11, 12 |
| Upcoming banner (pinned chips) | Task 17 |
| `ScheduledVisitDetailDialog` with reminder config | Tasks 15, 17 |
| `MedicationDetailDialog` with Details+Reminder tabs | Tasks 16, 17 |
| `ReminderScheduleEditor` shared component | Task 14 |
| Client types updated | Task 13 |
| `findUpcomingVetVisitsByUserId` fixed | Task 4 |

**Type consistency:** `VetVisitType` defined in Task 2, imported in Tasks 3 and onward. `AddVetVisitResult` defined in Task 7, consumed in Task 11. `ReminderScheduleProps` + `Reminder` defined in Task 13, used in Tasks 14–17. All consistent.

**Placeholders:** None found.
