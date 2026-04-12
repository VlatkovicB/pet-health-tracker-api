# Notification Scheduling Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the coarse `FrequencySchedule` (type + interval) on reminders with a discriminated-union `ReminderSchedule` that captures exact times, days-of-week, or days-of-month so BullMQ jobs fire at precise, predictable moments.

**Architecture:** `ReminderSchedule` is a value object with three variants (`daily`, `weekly`, `monthly`), each carrying exact `times[]` plus variant-specific day selectors. It generates one cron expression per time slot via `toCronExpressions()`. The `ReminderSchedulerService` registers one BullMQ `upsertJobScheduler` entry per cron expression, keyed `reminder--{entityId}--{index}`. The `reminders` DB table replaces two flat columns (`schedule_type`, `schedule_interval`) with a single `schedule` JSONB column.

**Tech Stack:** TypeScript, BullMQ v5 (`upsertJobScheduler`, `getJobSchedulers`, `removeJobScheduler`), Sequelize JSONB column, PostgreSQL.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Rewrite | `src/domain/health/value-objects/ReminderSchedule.ts` | Discriminated union VO; cron generation; validation |
| Modify | `src/domain/reminder/Reminder.ts` | Swap to `ReminderSchedule`; add `updateSchedule()` |
| Modify | `src/infrastructure/db/models/ReminderModel.ts` | Replace `scheduleType`/`scheduleInterval` with `schedule` JSONB |
| Modify | `src/infrastructure/mappers/ReminderMapper.ts` | Update all three mapper methods + response DTO |
| Modify | `src/application/reminder/ConfigureMedicationReminderUseCase.ts` | New `schedule` input field |
| Modify | `src/infrastructure/queue/ReminderSchedulerService.ts` | Switch to `upsertJobScheduler` + cron |
| Modify | `scripts/seed.ts` | `sync({ force: true })` for clean DB resets |
| Modify | `src/main.ts` | Note: keep `alter: true` |
| Modify | `README.md` | Update medications feature bullet |
| Modify | `skills/ARCHITECTURE.md` | Update VO entry, model table, scheduler description |

---

## Task 1: Rewrite `ReminderSchedule` value object

**Files:**
- Rewrite: `src/domain/health/value-objects/ReminderSchedule.ts`

- [ ] **Step 1: Replace the file contents**

```typescript
import { ValueObject } from '../../shared/ValueObject';

export type DayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

const DAY_CRON: Record<DayOfWeek, number> = {
  SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6,
};

export type DailySchedule   = { type: 'daily';   times: string[] };
export type WeeklySchedule  = { type: 'weekly';  days: DayOfWeek[];     times: string[] };
export type MonthlySchedule = { type: 'monthly'; daysOfMonth: number[]; times: string[] };

export type ReminderScheduleProps = DailySchedule | WeeklySchedule | MonthlySchedule;

function validateTimes(times: string[]): void {
  if (!times.length) throw new Error('times must not be empty');
  for (const t of times) {
    if (!/^\d{2}:\d{2}$/.test(t)) throw new Error(`Invalid time format: ${t}`);
    const [h, m] = t.split(':').map(Number);
    if (h < 0 || h > 23) throw new Error(`Invalid hour: ${h}`);
    if (m < 0 || m > 59) throw new Error(`Invalid minute: ${m}`);
  }
}

export class ReminderSchedule extends ValueObject<ReminderScheduleProps> {
  get type(): 'daily' | 'weekly' | 'monthly' { return this.props.type; }
  get times(): string[] { return this.props.times; }

  get days(): DayOfWeek[] | undefined {
    return this.props.type === 'weekly' ? this.props.days : undefined;
  }

  get daysOfMonth(): number[] | undefined {
    return this.props.type === 'monthly' ? this.props.daysOfMonth : undefined;
  }

  toJSON(): ReminderScheduleProps {
    return { ...this.props } as ReminderScheduleProps;
  }

  toCronExpressions(): string[] {
    const p = this.props;
    switch (p.type) {
      case 'daily':
        return p.times.map((t) => {
          const [h, m] = t.split(':');
          return `${Number(m)} ${Number(h)} * * *`;
        });
      case 'weekly': {
        const dayPart = p.days.map((d) => DAY_CRON[d]).join(',');
        return p.times.map((t) => {
          const [h, m] = t.split(':');
          return `${Number(m)} ${Number(h)} * * ${dayPart}`;
        });
      }
      case 'monthly': {
        const domPart = p.daysOfMonth.join(',');
        return p.times.map((t) => {
          const [h, m] = t.split(':');
          return `${Number(m)} ${Number(h)} ${domPart} * *`;
        });
      }
    }
  }

  static create(props: ReminderScheduleProps): ReminderSchedule {
    validateTimes(props.times);
    if (props.type === 'weekly') {
      if (!props.days.length) throw new Error('weekly schedule requires at least one day');
    }
    if (props.type === 'monthly') {
      if (!props.daysOfMonth.length) throw new Error('monthly schedule requires at least one day of month');
      for (const d of props.daysOfMonth) {
        if (d < 1 || d > 31) throw new Error(`Invalid day of month: ${d}`);
      }
    }
    return new ReminderSchedule(props);
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/latzko/projects/pet-health-tracker-api
pnpm exec tsc --noEmit 2>&1 | head -30
```

Expected: errors only in files that still import the old VO shape (those are fixed in later tasks).

- [ ] **Step 3: Commit**

```bash
git add src/domain/health/value-objects/ReminderSchedule.ts
git commit -m "feat: rewrite ReminderSchedule as discriminated union VO"
```

---

## Task 2: Update `Reminder` entity

**Files:**
- Modify: `src/domain/reminder/Reminder.ts`

- [ ] **Step 1: Replace the file contents**

```typescript
import { Entity } from '../shared/Entity';
import { UniqueEntityId } from '../shared/UniqueEntityId';
import { ReminderSchedule } from '../health/value-objects/ReminderSchedule';

export type ReminderEntityType = 'medication' | 'vet_visit';

interface ReminderProps {
  entityType: ReminderEntityType;
  entityId: string;
  schedule: ReminderSchedule;
  enabled: boolean;
  notifyUserIds: string[];
  createdBy: string;
  createdAt: Date;
}

export class Reminder extends Entity<ReminderProps> {
  get entityType(): ReminderEntityType { return this.props.entityType; }
  get entityId(): string { return this.props.entityId; }
  get schedule(): ReminderSchedule { return this.props.schedule; }
  get enabled(): boolean { return this.props.enabled; }
  get notifyUserIds(): string[] { return this.props.notifyUserIds; }
  get createdBy(): string { return this.props.createdBy; }
  get createdAt(): Date { return this.props.createdAt; }

  toggle(enabled: boolean): void {
    this.props.enabled = enabled;
  }

  updateSchedule(schedule: ReminderSchedule): void {
    this.props.schedule = schedule;
  }

  static create(
    props: Omit<ReminderProps, 'createdAt'>,
    id?: UniqueEntityId,
  ): Reminder {
    return new Reminder({ ...props, createdAt: new Date() }, id);
  }

  static reconstitute(props: ReminderProps, id: UniqueEntityId): Reminder {
    return new Reminder(props, id);
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm exec tsc --noEmit 2>&1 | head -30
```

Expected: errors only in mapper/use case files that still reference the old `FrequencySchedule` shape.

- [ ] **Step 3: Commit**

```bash
git add src/domain/reminder/Reminder.ts
git commit -m "feat: update Reminder entity to use ReminderSchedule"
```

---

## Task 3: Update `ReminderModel`

**Files:**
- Modify: `src/infrastructure/db/models/ReminderModel.ts`

- [ ] **Step 1: Replace the file contents**

```typescript
import { Column, DataType, HasMany, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { ReminderNotifyUserModel } from './ReminderNotifyUserModel';
import { ReminderScheduleProps } from '../../../domain/health/value-objects/ReminderSchedule';

@Table({ tableName: 'reminders', timestamps: false })
export class ReminderModel extends Model {
  @PrimaryKey
  @Column(DataType.UUID)
  declare id: string;

  @Column({ type: DataType.STRING, allowNull: false, field: 'entity_type' })
  declare entityType: string;

  @Column({ type: DataType.UUID, allowNull: false, field: 'entity_id' })
  declare entityId: string;

  @Column({ type: DataType.JSONB, allowNull: false })
  declare schedule: ReminderScheduleProps;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  declare enabled: boolean;

  @Column({ type: DataType.UUID, allowNull: false, field: 'created_by' })
  declare createdBy: string;

  @Column({ type: DataType.DATE, allowNull: false, field: 'created_at' })
  declare createdAt: Date;

  @HasMany(() => ReminderNotifyUserModel)
  declare notifyUsers: ReminderNotifyUserModel[];
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm exec tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/db/models/ReminderModel.ts
git commit -m "feat: replace schedule_type/schedule_interval columns with schedule JSONB"
```

---

## Task 4: Update `ReminderMapper`

**Files:**
- Modify: `src/infrastructure/mappers/ReminderMapper.ts`

- [ ] **Step 1: Replace the file contents**

```typescript
import { Service } from 'typedi';
import { ReminderModel } from '../db/models/ReminderModel';
import { Reminder, ReminderEntityType } from '../../domain/reminder/Reminder';
import { ReminderSchedule, ReminderScheduleProps } from '../../domain/health/value-objects/ReminderSchedule';
import { UniqueEntityId } from '../../domain/shared/UniqueEntityId';

export interface ReminderResponseDto {
  id: string;
  entityType: ReminderEntityType;
  entityId: string;
  schedule: ReminderScheduleProps;
  enabled: boolean;
  notifyUserIds: string[];
  createdAt: string;
}

@Service()
export class ReminderMapper {
  toDomain(model: ReminderModel): Reminder {
    return Reminder.reconstitute(
      {
        entityType: model.entityType as ReminderEntityType,
        entityId: model.entityId,
        schedule: ReminderSchedule.create(model.schedule),
        enabled: model.enabled,
        notifyUserIds: (model.notifyUsers ?? []).map((r) => r.userId),
        createdBy: model.createdBy,
        createdAt: model.createdAt,
      },
      new UniqueEntityId(model.id),
    );
  }

  toPersistence(reminder: Reminder): object {
    return {
      id: reminder.id.toValue(),
      entityType: reminder.entityType,
      entityId: reminder.entityId,
      schedule: reminder.schedule.toJSON(),
      enabled: reminder.enabled,
      createdBy: reminder.createdBy,
      createdAt: reminder.createdAt,
    };
  }

  toResponse(reminder: Reminder): ReminderResponseDto {
    return {
      id: reminder.id.toValue(),
      entityType: reminder.entityType,
      entityId: reminder.entityId,
      schedule: reminder.schedule.toJSON(),
      enabled: reminder.enabled,
      notifyUserIds: reminder.notifyUserIds,
      createdAt: reminder.createdAt.toISOString(),
    };
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm exec tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/mappers/ReminderMapper.ts
git commit -m "feat: update ReminderMapper for new schedule shape"
```

---

## Task 5: Update `ConfigureMedicationReminderUseCase`

**Files:**
- Modify: `src/application/reminder/ConfigureMedicationReminderUseCase.ts`

- [ ] **Step 1: Replace the file contents**

```typescript
import { Inject, Service } from 'typedi';
import { HealthRecordRepository, HEALTH_RECORD_REPOSITORY } from '../../domain/health/HealthRecordRepository';
import { PetRepository, PET_REPOSITORY } from '../../domain/pet/PetRepository';
import { ReminderRepository, REMINDER_REPOSITORY } from '../../domain/reminder/ReminderRepository';
import { Reminder } from '../../domain/reminder/Reminder';
import { ReminderSchedule, ReminderScheduleProps } from '../../domain/health/value-objects/ReminderSchedule';
import { ForbiddenError, NotFoundError } from '../../shared/errors/AppError';
import { ReminderSchedulerService } from '../../infrastructure/queue/ReminderSchedulerService';

interface ConfigureReminderInput {
  medicationId: string;
  schedule: ReminderScheduleProps;
  enabled: boolean;
  requestingUserId: string;
}

@Service()
export class ConfigureMedicationReminderUseCase {
  constructor(
    @Inject(HEALTH_RECORD_REPOSITORY) private readonly healthRepo: HealthRecordRepository,
    @Inject(PET_REPOSITORY) private readonly petRepository: PetRepository,
    @Inject(REMINDER_REPOSITORY) private readonly reminderRepo: ReminderRepository,
    private readonly reminderScheduler: ReminderSchedulerService,
  ) {}

  async execute(input: ConfigureReminderInput): Promise<void> {
    const medication = await this.healthRepo.findMedicationById(input.medicationId);
    if (!medication) throw new NotFoundError('Medication');

    const pet = await this.petRepository.findById(medication.petId);
    if (!pet) throw new NotFoundError('Pet');
    if (pet.userId !== input.requestingUserId) throw new ForbiddenError('Not your pet');

    const schedule = ReminderSchedule.create(input.schedule);

    const existing = await this.reminderRepo.findByEntityId(input.medicationId);

    let reminder: Reminder;
    if (existing) {
      existing.updateSchedule(schedule);
      existing.toggle(input.enabled);
      reminder = existing;
    } else {
      reminder = Reminder.create({
        entityType: 'medication',
        entityId: input.medicationId,
        schedule,
        enabled: input.enabled,
        notifyUserIds: [input.requestingUserId],
        createdBy: input.requestingUserId,
      });
    }

    await this.reminderRepo.save(reminder);

    if (input.enabled) {
      await this.reminderScheduler.scheduleReminder(reminder, {
        petId: pet.id.toValue(),
        petName: pet.name,
        medicationName: medication.name,
        dosage: medication.dosage.toString(),
      });
    } else {
      await this.reminderScheduler.cancelReminders(input.medicationId);
    }
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm exec tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add src/application/reminder/ConfigureMedicationReminderUseCase.ts
git commit -m "feat: update ConfigureMedicationReminderUseCase to accept schedule input"
```

---

## Task 6: Update `ReminderSchedulerService`

**Files:**
- Modify: `src/infrastructure/queue/ReminderSchedulerService.ts`

BullMQ v5 API used here:
- `queue.upsertJobScheduler(schedulerId, repeatOptions, jobTemplate)` — creates or updates a repeating scheduler
- `queue.getJobSchedulers()` — returns all scheduler entries
- `queue.removeJobScheduler(schedulerId)` — removes a single scheduler entry

- [ ] **Step 1: Replace the file contents**

```typescript
import { Service } from 'typedi';
import { notificationQueue, MedicationReminderJobData, VetVisitReminderJobData } from './NotificationQueue';
import { Reminder } from '../../domain/reminder/Reminder';

const VET_VISIT_JOB_PREFIX = 'vet-visit-reminder--';
const DEFAULT_LEAD_TIME_MS = 24 * 60 * 60 * 1000;

export interface VetVisitReminderContext {
  visitId: string;
  petName: string;
  reason: string;
  nextVisitDate: Date;
  vetName?: string;
  clinic?: string;
  notifyUserIds: string[];
  leadTimeMs?: number;
}

@Service()
export class ReminderSchedulerService {
  // ── Medication reminders (cron-based repeating) ────────────────────────────

  async scheduleReminder(
    reminder: Reminder,
    context: { petId: string; petName: string; medicationName: string; dosage: string },
  ): Promise<void> {
    if (!reminder.enabled) return;

    await this.cancelReminders(reminder.entityId);

    const jobData: MedicationReminderJobData = {
      type: 'medication_reminder',
      reminderId: reminder.id.toValue(),
      petName: context.petName,
      medicationName: context.medicationName,
      dosage: context.dosage,
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

  async cancelReminders(entityId: string): Promise<void> {
    const prefix = `reminder--${entityId}--`;
    const schedulers = await notificationQueue.getJobSchedulers();
    await Promise.all(
      schedulers
        .filter((s) => s.id?.startsWith(prefix))
        .map((s) => notificationQueue.removeJobScheduler(s.id!)),
    );
  }

  // ── Vet visit reminders (one-time delayed) ─────────────────────────────────

  async scheduleVetVisitReminder(ctx: VetVisitReminderContext): Promise<void> {
    await this.cancelVetVisitReminder(ctx.visitId);

    const leadTime = ctx.leadTimeMs ?? DEFAULT_LEAD_TIME_MS;
    const fireAt = ctx.nextVisitDate.getTime() - leadTime;
    const delay = Math.max(0, fireAt - Date.now());

    const jobData: VetVisitReminderJobData = {
      type: 'vet_visit_reminder',
      visitId: ctx.visitId,
      petName: ctx.petName,
      reason: ctx.reason,
      nextVisitDate: ctx.nextVisitDate.toISOString(),
      vetName: ctx.vetName,
      clinic: ctx.clinic,
      notifyUserIds: ctx.notifyUserIds,
    };

    const jobId = `${VET_VISIT_JOB_PREFIX}${ctx.visitId}`;
    await notificationQueue.add(jobId, jobData, { delay, jobId });
  }

  async cancelVetVisitReminder(visitId: string): Promise<void> {
    const jobId = `${VET_VISIT_JOB_PREFIX}${visitId}`;
    const job = await notificationQueue.getJob(jobId);
    if (job) await job.remove();
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm exec tsc --noEmit 2>&1 | head -30
```

Expected: clean compile (or only unrelated errors).

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/queue/ReminderSchedulerService.ts
git commit -m "feat: switch ReminderSchedulerService to upsertJobScheduler with cron"
```

---

## Task 7: Update seed for clean DB resets

**Files:**
- Modify: `scripts/seed.ts` (line 232)

- [ ] **Step 1: Change `force: false` to `force: true`**

In `scripts/seed.ts`, find the line:
```typescript
await sequelize.sync({ force: false });
```
Replace with:
```typescript
await sequelize.sync({ force: true });
```

- [ ] **Step 2: Drop the existing DB and reseed**

```bash
pnpm seed
```

Expected output ends with:
```
Schema synced.
Truncating all tables…
User: Alex Johnson (alex@example.com) — password: password123
Created 10 vets.
...
Seed complete.
```

- [ ] **Step 3: Start the server and verify it connects**

```bash
pnpm dev
```

Expected: `Database connected` and `Server running on port 3000` with no errors.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed.ts
git commit -m "chore: seed uses force: true for clean DB resets"
```

---

## Task 8: Update docs

**Files:**
- Modify: `README.md`
- Modify: `skills/ARCHITECTURE.md`

- [ ] **Step 1: Update README.md medications bullet**

Find:
```markdown
- **Medications** — log medications with dosage; configurable reminders via BullMQ
```
Replace with:
```markdown
- **Medications** — log medications with dosage; configurable reminders via BullMQ with precise daily/weekly/monthly schedules (exact times and days)
```

- [ ] **Step 2: Update ARCHITECTURE.md — Value Objects section**

Find:
```markdown
- `ReminderSchedule` — times[], intervalHours?, days?, timezone; `toCronExpressions()` for BullMQ
```
Replace with:
```markdown
- `ReminderSchedule` — discriminated union: `daily` (times[]), `weekly` (days[], times[]), `monthly` (daysOfMonth[], times[]); UTC; `toCronExpressions()` returns one cron string per time slot
```

- [ ] **Step 3: Update ARCHITECTURE.md — Database Models table**

Find the `ReminderModel` row:
```markdown
| `MedicationModel` | `medications` | name, dosage (JSONB), reminder (JSONB), active |
```
This row is about `MedicationModel` — find the reminders row. The table doesn't have one explicitly — add it. Find:
```markdown
| `VetVisitModel` | `vet_visits` | pet_id, vet_id, visit_date, next_visit_date, image_urls (JSONB) |
```
Add after:
```markdown
| `ReminderModel` | `reminders` | entity_type, entity_id, schedule (JSONB), enabled, created_by |
```

- [ ] **Step 4: Update ARCHITECTURE.md — Queue section**

Find:
```markdown
- `ReminderSchedulerService` — creates/removes repeatable BullMQ jobs keyed as `reminder:{medicationId}:{cron}` from `ReminderSchedule.toCronExpressions()`
```
Replace with:
```markdown
- `ReminderSchedulerService` — registers one `upsertJobScheduler` entry per cron expression from `ReminderSchedule.toCronExpressions()`; scheduler IDs are `reminder--{entityId}--{index}`; cancellation removes all entries matching the entity prefix
```

- [ ] **Step 5: Update ARCHITECTURE.md — Key Design Decisions sync note**

Find:
```markdown
- **`sync({ alter: true })`** — DB schema is kept in sync by Sequelize on startup; no migration files. Suitable for early-stage development.
```
Replace with:
```markdown
- **`sync({ alter: true })`** — DB schema is kept in sync by Sequelize on startup; no migration files. Run `pnpm seed` (uses `force: true`) to drop and recreate all tables with fresh data during development.
```

- [ ] **Step 6: Verify TypeScript still compiles cleanly**

```bash
pnpm exec tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add README.md skills/ARCHITECTURE.md
git commit -m "docs: update README and ARCHITECTURE for new reminder scheduling"
```

---

## Task 9: Manual end-to-end verification

- [ ] **Step 1: Confirm server starts clean**

```bash
pnpm dev
```

Expected: `Database connected`, `Notification worker started`, `Server running on port 3000`.

- [ ] **Step 2: Register and login**

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alex@example.com","password":"password123"}' | jq .token
```

Expected: a JWT string. Save it as `TOKEN`.

- [ ] **Step 3: Get a medication ID**

```bash
curl -s http://localhost:3000/api/v1/pets/<any-pet-id>/medications \
  -H "Authorization: Bearer $TOKEN" | jq '.[0].id'
```

Use one of the pet IDs from seed output (format: `00000000-0000-0000-0002-000000000001`).

- [ ] **Step 4: Configure a daily reminder**

```bash
curl -s -X PUT http://localhost:3000/api/v1/medications/<medication-id>/reminder \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "schedule": { "type": "daily", "times": ["08:00", "20:00"] },
    "enabled": true
  }'
```

Expected: `204 No Content`.

- [ ] **Step 5: Configure a weekly reminder**

```bash
curl -s -X PUT http://localhost:3000/api/v1/medications/<medication-id>/reminder \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "schedule": { "type": "weekly", "days": ["MON", "WED", "FRI"], "times": ["09:00"] },
    "enabled": true
  }'
```

Expected: `204 No Content`.

- [ ] **Step 6: Configure a monthly reminder**

```bash
curl -s -X PUT http://localhost:3000/api/v1/medications/<medication-id>/reminder \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "schedule": { "type": "monthly", "daysOfMonth": [1, 15], "times": ["09:00"] },
    "enabled": true
  }'
```

Expected: `204 No Content`.

- [ ] **Step 7: Verify BullMQ schedulers were created**

Add a temporary log to `ReminderSchedulerService.scheduleReminder` or use the BullMQ board if available. Alternatively, check that the server logs no errors after each PUT request.

- [ ] **Step 8: Verify invalid input is rejected**

```bash
curl -s -X PUT http://localhost:3000/api/v1/medications/<medication-id>/reminder \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "schedule": { "type": "daily", "times": [] },
    "enabled": true
  }'
```

Expected: `400` or `500` with an error message about empty times.
