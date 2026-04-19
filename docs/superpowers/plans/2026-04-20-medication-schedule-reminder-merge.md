# Medication Schedule + Reminder Merge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `FrequencySchedule` on `Medication` with `ReminderSchedule`, add inline reminder toggle + advance-notice selector to medication forms, and eliminate N+1 reminder queries on the calendar.

**Architecture:** The `Medication` entity's `schedule` field uses the same `ReminderSchedule` shape already used by the `Reminder` entity. When saving a medication, the `LogMedication` and `UpdateMedication` use cases atomically upsert the linked `Reminder`. The `Reminder` entity gains an `advanceNotice` field that `ReminderSchedulerService` applies as a time offset when scheduling BullMQ jobs.

**Tech Stack:** TypeScript, Express, Sequelize (sync alter:true — no migration runner), BullMQ, React, MUI v9, TanStack Query, pnpm

---

## File Map

**API — Delete:**
- `src/domain/health/value-objects/FrequencySchedule.ts`

**API — Modify:**
- `src/domain/health/Medication.ts` — `frequency: FrequencySchedule` → `schedule: ReminderSchedule`
- `src/domain/reminder/Reminder.ts` — add `advanceNotice` field + getter + `updateAdvanceNotice()`
- `src/domain/health/value-objects/ReminderSchedule.ts` — add `advanceNotice` param to `toCronExpressions()`
- `src/domain/health/HealthRecordRepository.ts` — add `MedicationSummary` type, update `findMedicationsByPetId` signature
- `src/infrastructure/db/models/MedicationModel.ts` — replace `frequencyType`/`frequencyInterval` with `schedule: JSONB`
- `src/infrastructure/db/models/ReminderModel.ts` — add `advanceNotice: JSONB | null`
- `src/infrastructure/mappers/MedicationMapper.ts` — map `schedule`, add `reminderEnabled`/`advanceNotice` to response DTO
- `src/infrastructure/mappers/ReminderMapper.ts` — map `advanceNotice` in `toDomain` and `toPersistence`
- `src/infrastructure/db/repositories/SequelizeHealthRecordRepository.ts` — update `findMedicationsByPetId` to batch-load reminders
- `src/infrastructure/queue/ReminderSchedulerService.ts` — apply `advanceNotice` offset
- `src/application/health/LogMedicationUseCase.ts` — accept `schedule` + optional `reminder`; save both atomically
- `src/application/health/UpdateMedicationUseCase.ts` — accept `schedule` + optional `reminder`; sync reminder
- `src/application/health/ListMedicationsUseCase.ts` — return `MedicationSummary[]`
- `src/application/reminder/ConfigureMedicationReminderUseCase.ts` — remove `schedule` from input
- `src/infrastructure/http/controllers/HealthController.ts` — pass new fields; map summaries to response
- `scripts/seed.ts` — update medication creation to use `schedule` JSONB

**API — Create:**
- `scripts/migrate-medication-schedule.ts` — one-time backfill of `schedule` from old `frequency_type`/`frequency_interval` columns

**Client — Create:**
- `src/components/MedicationScheduleSection.tsx` — schedule picker + reminder toggle + advance notice

**Client — Modify:**
- `src/types/index.ts` — update `Medication` type, add `AdvanceNotice`
- `src/api/medications.ts` — update `CreateMedicationInput`/`UpdateMedicationInput`
- `src/api/reminders.ts` — update `configureMedicationReminder` (drop `schedule` from body)
- `src/pages/health/PetDetailPage.tsx` — replace `FrequencyPicker` + `AddMedicationDialog` with schedule section
- `src/components/MedicationDetailDialog.tsx` — remove tabs, use `MedicationScheduleSection`
- `src/pages/calendar/CalendarPage.tsx` — remove `reminderQueries`/`remindersMap`

---

## Task 1: Update `Medication` entity — `frequency` → `schedule`

**Files:**
- Modify: `src/domain/health/Medication.ts`

- [ ] **Step 1: Update the entity**

Replace the entire file with:

```ts
import { Entity } from '../shared/Entity';
import { UniqueEntityId } from '../shared/UniqueEntityId';
import { Dosage } from './value-objects/Dosage';
import { ReminderSchedule } from './value-objects/ReminderSchedule';

interface MedicationProps {
  petId: string;
  name: string;
  dosage: Dosage;
  schedule: ReminderSchedule;
  startDate: Date;
  endDate?: Date;
  notes?: string;
  active: boolean;
  createdBy: string;
  createdAt: Date;
}

export class Medication extends Entity<MedicationProps> {
  get petId(): string { return this.props.petId; }
  get name(): string { return this.props.name; }
  get dosage(): Dosage { return this.props.dosage; }
  get schedule(): ReminderSchedule { return this.props.schedule; }
  get startDate(): Date { return this.props.startDate; }
  get endDate(): Date | undefined { return this.props.endDate; }
  get notes(): string | undefined { return this.props.notes; }
  get active(): boolean { return this.props.active; }
  get createdBy(): string { return this.props.createdBy; }
  get createdAt(): Date { return this.props.createdAt; }

  static create(props: Omit<MedicationProps, 'createdAt'>, id?: UniqueEntityId): Medication {
    return new Medication({ ...props, createdAt: new Date() }, id);
  }

  static reconstitute(props: MedicationProps, id: UniqueEntityId): Medication {
    return new Medication(props, id);
  }
}
```

- [ ] **Step 2: Verify it compiles (expect errors in files that still reference `medication.frequency`)**

```bash
cd ~/projects/pet-health-tracker-api && pnpm build 2>&1 | grep -E "error TS" | head -20
```

Expected: errors mentioning `frequency` in mapper/use cases. That's fine — we'll fix them task by task.

---

## Task 2: Update `Reminder` entity — add `advanceNotice`

**Files:**
- Modify: `src/domain/reminder/Reminder.ts`

- [ ] **Step 1: Update the entity**

Note: `AdvanceNotice` is defined in `ReminderSchedule.ts` (Task 3) and imported here — not the other way around. This avoids a circular dependency.

```ts
import { Entity } from '../shared/Entity';
import { UniqueEntityId } from '../shared/UniqueEntityId';
import { ReminderSchedule, AdvanceNotice } from '../health/value-objects/ReminderSchedule';

export type ReminderEntityType = 'medication' | 'vet_visit';

export { AdvanceNotice };

interface ReminderProps {
  entityType: ReminderEntityType;
  entityId: string;
  schedule: ReminderSchedule;
  enabled: boolean;
  advanceNotice?: AdvanceNotice;
  notifyUserIds: string[];
  createdBy: string;
  createdAt: Date;
}

export class Reminder extends Entity<ReminderProps> {
  get entityType(): ReminderEntityType { return this.props.entityType; }
  get entityId(): string { return this.props.entityId; }
  get schedule(): ReminderSchedule { return this.props.schedule; }
  get enabled(): boolean { return this.props.enabled; }
  get advanceNotice(): AdvanceNotice | undefined { return this.props.advanceNotice; }
  get notifyUserIds(): string[] { return this.props.notifyUserIds; }
  get createdBy(): string { return this.props.createdBy; }
  get createdAt(): Date { return this.props.createdAt; }

  toggle(enabled: boolean): void {
    this.props.enabled = enabled;
  }

  updateSchedule(schedule: ReminderSchedule): void {
    this.props.schedule = schedule;
  }

  updateAdvanceNotice(advanceNotice: AdvanceNotice | undefined): void {
    this.props.advanceNotice = advanceNotice;
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

- [ ] **Step 2: Commit domain entity changes**

```bash
cd ~/projects/pet-health-tracker-api
git add src/domain/health/Medication.ts src/domain/reminder/Reminder.ts
git commit -m "feat: update Medication and Reminder domain entities for schedule merge"
```

---

## Task 3: Update `ReminderSchedule` VO — add advance notice offset to cron generation

**Files:**
- Modify: `src/domain/health/value-objects/ReminderSchedule.ts`

- [ ] **Step 1: Add offset helper + update `toCronExpressions`**

Add this helper function above the class, then update `toCronExpressions` to accept an optional `AdvanceNotice` import:

```ts
import { ValueObject } from '../../shared/ValueObject';
import { ValidationError } from '../../../shared/errors/AppError';

export interface AdvanceNotice {
  amount: number;
  unit: 'minutes' | 'hours' | 'days';
}

export type DayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

const DAY_CRON: Record<DayOfWeek, number> = {
  SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6,
};

export type DailySchedule   = { type: 'daily';   times: string[] };
export type WeeklySchedule  = { type: 'weekly';  days: DayOfWeek[];     times: string[] };
export type MonthlySchedule = { type: 'monthly'; daysOfMonth: number[]; times: string[] };

export type ReminderScheduleProps = DailySchedule | WeeklySchedule | MonthlySchedule;

function validateTimes(times: string[]): void {
  const uniqueTimes = Array.from(new Set(times));
  if (!uniqueTimes.length) throw new ValidationError('times must not be empty');
  for (const t of uniqueTimes) {
    if (!/^\d{2}:\d{2}$/.test(t)) throw new ValidationError(`Invalid time format: ${t}`);
    const [h, m] = t.split(':').map(Number);
    if (h < 0 || h > 23) throw new ValidationError(`Invalid hour: ${h}`);
    if (m < 0 || m > 59) throw new ValidationError(`Invalid minute: ${m}`);
  }
}

/** Subtract advanceNotice from a HH:MM time string. Returns { time: 'HH:MM', dayOffset: -1 | 0 }. */
function applyOffset(time: string, notice: AdvanceNotice): { time: string; dayOffset: number } {
  const [h, m] = time.split(':').map(Number);
  let totalMinutes = h * 60 + m;

  switch (notice.unit) {
    case 'minutes': totalMinutes -= notice.amount; break;
    case 'hours':   totalMinutes -= notice.amount * 60; break;
    case 'days':    totalMinutes -= notice.amount * 24 * 60; break;
  }

  let dayOffset = 0;
  if (totalMinutes < 0) {
    dayOffset = -1;
    totalMinutes += 24 * 60;
  }

  const hh = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const mm = String(totalMinutes % 60).padStart(2, '0');
  return { time: `${hh}:${mm}`, dayOffset };
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

  toCronExpressions(advanceNotice?: AdvanceNotice): string[] {
    const p = this.props;

    if (!advanceNotice) {
      // Original logic, no offset
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
        default:
          throw new ValidationError(`Unknown schedule type: ${(p as any).type}`);
      }
    }

    // With offset — build cron at (time - advanceNotice)
    switch (p.type) {
      case 'daily':
        return p.times.map((t) => {
          const { time } = applyOffset(t, advanceNotice);
          const [h, m] = time.split(':');
          return `${Number(m)} ${Number(h)} * * *`;
        });
      case 'weekly': {
        const days = p.days.map((d) => DAY_CRON[d]);
        return p.times.map((t) => {
          const { time, dayOffset } = applyOffset(t, advanceNotice);
          const [h, m] = time.split(':');
          const adjustedDays = dayOffset === 0
            ? days
            : days.map((d) => ((d + 7 + dayOffset) % 7));
          return `${Number(m)} ${Number(h)} * * ${adjustedDays.join(',')}`;
        });
      }
      case 'monthly': {
        return p.times.map((t) => {
          const { time, dayOffset } = applyOffset(t, advanceNotice);
          const [h, m] = time.split(':');
          // TODO: day-of-month offset across month boundaries is rare; use same dom for now
          const domPart = dayOffset === 0
            ? p.daysOfMonth.join(',')
            : p.daysOfMonth.map((d) => Math.max(1, d + dayOffset)).join(',');
          return `${Number(m)} ${Number(h)} ${domPart} * *`;
        });
      }
      default:
        throw new ValidationError(`Unknown schedule type: ${(p as any).type}`);
    }
  }

  static create(props: ReminderScheduleProps): ReminderSchedule {
    validateTimes(props.times);
    if (props.type === 'weekly') {
      if (!props.days.length) throw new ValidationError('weekly schedule requires at least one day');
    }
    if (props.type === 'monthly') {
      if (!props.daysOfMonth.length) throw new ValidationError('monthly schedule requires at least one day of month');
      for (const d of props.daysOfMonth) {
        if (d < 1 || d > 31) throw new ValidationError(`Invalid day of month: ${d}`);
      }
    }
    return new ReminderSchedule(props);
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd ~/projects/pet-health-tracker-api
git add src/domain/health/value-objects/ReminderSchedule.ts
git commit -m "feat: add advanceNotice offset support to ReminderSchedule.toCronExpressions()"
```

---

## Task 4: Delete `FrequencySchedule`, update `HealthRecordRepository` interface

**Files:**
- Delete: `src/domain/health/value-objects/FrequencySchedule.ts`
- Modify: `src/domain/health/HealthRecordRepository.ts`

- [ ] **Step 1: Delete FrequencySchedule**

```bash
rm ~/projects/pet-health-tracker-api/src/domain/health/value-objects/FrequencySchedule.ts
```

- [ ] **Step 2: Update `HealthRecordRepository.ts`**

```ts
import { VetVisit } from './VetVisit';
import { Medication } from './Medication';
import { PaginationParams, PaginatedResult } from '../../shared/types/Pagination';
import type { AdvanceNotice } from '../reminder/Reminder';

export interface MedicationSummary {
  medication: Medication;
  reminderEnabled: boolean;
  advanceNotice?: AdvanceNotice;
}

export interface HealthRecordRepository {
  // Vet visits
  findVetVisitById(id: string): Promise<VetVisit | null>;
  findVetVisitsByPetId(petId: string, pagination: PaginationParams): Promise<PaginatedResult<VetVisit>>;
  findUpcomingVetVisitsByUserId(userId: string): Promise<VetVisit[]>;
  findVetVisitsByDateRange(userId: string, from: Date, to: Date): Promise<VetVisit[]>;
  saveVetVisit(visit: VetVisit): Promise<void>;

  // Medications
  findMedicationById(id: string): Promise<Medication | null>;
  findMedicationsByPetId(petId: string): Promise<MedicationSummary[]>;
  findActiveMedications(): Promise<Medication[]>;
  saveMedication(medication: Medication): Promise<void>;
}

export const HEALTH_RECORD_REPOSITORY = 'HealthRecordRepository';
```

- [ ] **Step 3: Commit**

```bash
cd ~/projects/pet-health-tracker-api
git add src/domain/health/HealthRecordRepository.ts
git rm src/domain/health/value-objects/FrequencySchedule.ts
git commit -m "feat: delete FrequencySchedule VO, add MedicationSummary to repository interface"
```

---

## Task 5: Update DB models — `MedicationModel` and `ReminderModel`

**Files:**
- Modify: `src/infrastructure/db/models/MedicationModel.ts`
- Modify: `src/infrastructure/db/models/ReminderModel.ts`

- [ ] **Step 1: Update `MedicationModel.ts`**

Replace `frequencyType` and `frequencyInterval` columns with a `schedule` JSONB column:

```ts
import { BelongsTo, Column, DataType, ForeignKey, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { PetModel } from './PetModel';
import type { ReminderScheduleProps } from '../../../domain/health/value-objects/ReminderSchedule';

@Table({ tableName: 'medications', timestamps: false })
export class MedicationModel extends Model {
  @PrimaryKey
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => PetModel)
  @Column({ type: DataType.UUID, allowNull: false, field: 'pet_id' })
  declare petId: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare name: string;

  @Column({ type: DataType.FLOAT, allowNull: false, field: 'dosage_amount' })
  declare dosageAmount: number;

  @Column({ type: DataType.STRING, allowNull: false, field: 'dosage_unit' })
  declare dosageUnit: string;

  @Column({ type: DataType.JSONB, allowNull: false })
  declare schedule: ReminderScheduleProps;

  @Column({ type: DataType.DATE, allowNull: false, field: 'start_date' })
  declare startDate: Date;

  @Column({ type: DataType.DATE, allowNull: true, field: 'end_date' })
  declare endDate: Date | null;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare notes: string | null;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  declare active: boolean;

  @Column({ type: DataType.UUID, allowNull: false, field: 'created_by' })
  declare createdBy: string;

  @Column({ type: DataType.DATE, allowNull: false, field: 'created_at' })
  declare createdAt: Date;

  @BelongsTo(() => PetModel)
  declare pet: PetModel;
}
```

- [ ] **Step 2: Update `ReminderModel.ts`**

Add `advanceNotice` column:

```ts
import { Column, DataType, HasMany, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { ReminderNotifyUserModel } from './ReminderNotifyUserModel';
import { ReminderScheduleProps } from '../../../domain/health/value-objects/ReminderSchedule';
import type { AdvanceNotice } from '../../../domain/reminder/Reminder';

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

  @Column({ type: DataType.JSONB, allowNull: true, field: 'advance_notice' })
  declare advanceNotice: AdvanceNotice | null;

  @Column({ type: DataType.UUID, allowNull: false, field: 'created_by' })
  declare createdBy: string;

  @Column({ type: DataType.DATE, allowNull: false, field: 'created_at' })
  declare createdAt: Date;

  @HasMany(() => ReminderNotifyUserModel)
  declare notifyUsers: ReminderNotifyUserModel[];
}
```

- [ ] **Step 3: Commit**

```bash
cd ~/projects/pet-health-tracker-api
git add src/infrastructure/db/models/MedicationModel.ts src/infrastructure/db/models/ReminderModel.ts
git commit -m "feat: replace frequencyType/frequencyInterval with schedule JSONB; add advanceNotice to ReminderModel"
```

---

## Task 6: Data migration — backfill `schedule` from old columns

**Files:**
- Create: `scripts/migrate-medication-schedule.ts`

- [ ] **Step 1: Create the migration script**

```ts
/**
 * One-time migration: backfill medications.schedule JSONB from legacy
 * frequency_type / frequency_interval columns.
 *
 * Run ONCE before starting the app after the model change:
 *   pnpm ts-node -r dotenv/config --project tsconfig.json scripts/migrate-medication-schedule.ts
 */
import 'reflect-metadata';
import { Sequelize, QueryTypes } from 'sequelize';

const sequelize = new Sequelize({
  dialect: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME ?? 'pet_health_tracker',
  username: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  logging: false,
});

async function migrate(): Promise<void> {
  await sequelize.authenticate();

  const rows = await sequelize.query<{ id: string; frequency_type: string }>(
    `SELECT id, frequency_type FROM medications WHERE schedule IS NULL`,
    { type: QueryTypes.SELECT },
  );

  console.log(`Backfilling schedule for ${rows.length} medications...`);

  for (const row of rows) {
    let schedule: object;
    switch (row.frequency_type) {
      case 'weekly':
        schedule = { type: 'weekly', days: ['MON'], times: ['08:00'] };
        break;
      case 'monthly':
        schedule = { type: 'monthly', daysOfMonth: [1], times: ['08:00'] };
        break;
      default: // daily, hourly → daily
        schedule = { type: 'daily', times: ['08:00'] };
    }

    await sequelize.query(
      `UPDATE medications SET schedule = :schedule WHERE id = :id`,
      { replacements: { schedule: JSON.stringify(schedule), id: row.id }, type: QueryTypes.UPDATE },
    );
  }

  console.log('Done. Old frequency_type / frequency_interval columns remain in DB and can be dropped manually.');
  await sequelize.close();
}

migrate().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Run the migration (if existing data in DB)**

```bash
cd ~/projects/pet-health-tracker-api
pnpm ts-node -r dotenv/config --project tsconfig.json scripts/migrate-medication-schedule.ts
```

Expected output: `Backfilling schedule for N medications... Done.`

- [ ] **Step 3: Commit**

```bash
git add scripts/migrate-medication-schedule.ts
git commit -m "feat: add one-time medication schedule backfill migration script"
```

---

## Task 7: Update `MedicationMapper` and `ReminderMapper`

**Files:**
- Modify: `src/infrastructure/mappers/MedicationMapper.ts`
- Modify: `src/infrastructure/mappers/ReminderMapper.ts`

- [ ] **Step 1: Replace `MedicationMapper.ts`**

```ts
import { Service } from 'typedi';
import { MedicationModel } from '../db/models/MedicationModel';
import { Medication } from '../../domain/health/Medication';
import { Dosage } from '../../domain/health/value-objects/Dosage';
import { ReminderSchedule, ReminderScheduleProps } from '../../domain/health/value-objects/ReminderSchedule';
import { UniqueEntityId } from '../../domain/shared/UniqueEntityId';
import type { AdvanceNotice } from '../../domain/reminder/Reminder';

export interface MedicationResponseDto {
  id: string;
  petId: string;
  name: string;
  dosage: { amount: number; unit: string };
  schedule: ReminderScheduleProps;
  startDate: string;
  endDate?: string;
  notes?: string;
  active: boolean;
  reminderEnabled: boolean;
  advanceNotice?: AdvanceNotice;
  createdBy: string;
  createdAt: string;
}

@Service()
export class MedicationMapper {
  toDomain(model: MedicationModel): Medication {
    return Medication.reconstitute(
      {
        petId: model.petId,
        name: model.name,
        dosage: Dosage.create(model.dosageAmount, model.dosageUnit as any),
        schedule: ReminderSchedule.create(model.schedule),
        startDate: model.startDate,
        endDate: model.endDate ?? undefined,
        notes: model.notes ?? undefined,
        active: model.active,
        createdBy: model.createdBy,
        createdAt: model.createdAt,
      },
      new UniqueEntityId(model.id),
    );
  }

  toPersistence(medication: Medication): object {
    return {
      id: medication.id.toValue(),
      petId: medication.petId,
      name: medication.name,
      dosageAmount: medication.dosage.amount,
      dosageUnit: medication.dosage.unit,
      schedule: medication.schedule.toJSON(),
      startDate: medication.startDate,
      endDate: medication.endDate ?? null,
      notes: medication.notes ?? null,
      active: medication.active,
      createdBy: medication.createdBy,
      createdAt: medication.createdAt,
    };
  }

  toResponse(
    medication: Medication,
    reminderEnabled = false,
    advanceNotice?: AdvanceNotice,
  ): MedicationResponseDto {
    return {
      id: medication.id.toValue(),
      petId: medication.petId,
      name: medication.name,
      dosage: {
        amount: medication.dosage.amount,
        unit: medication.dosage.unit,
      },
      schedule: medication.schedule.toJSON(),
      startDate: medication.startDate.toISOString(),
      endDate: medication.endDate?.toISOString(),
      notes: medication.notes,
      active: medication.active,
      reminderEnabled,
      advanceNotice,
      createdBy: medication.createdBy,
      createdAt: medication.createdAt.toISOString(),
    };
  }
}
```

- [ ] **Step 2: Update `ReminderMapper.ts` — add `advanceNotice` to toDomain/toPersistence**

```ts
import { Service } from 'typedi';
import { ReminderModel } from '../db/models/ReminderModel';
import { Reminder, ReminderEntityType, AdvanceNotice } from '../../domain/reminder/Reminder';
import { ReminderSchedule, ReminderScheduleProps } from '../../domain/health/value-objects/ReminderSchedule';
import { UniqueEntityId } from '../../domain/shared/UniqueEntityId';

export interface ReminderResponseDto {
  id: string;
  entityType: ReminderEntityType;
  entityId: string;
  schedule: ReminderScheduleProps;
  enabled: boolean;
  advanceNotice?: AdvanceNotice;
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
        advanceNotice: model.advanceNotice ?? undefined,
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
      advanceNotice: reminder.advanceNotice ?? null,
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
      advanceNotice: reminder.advanceNotice,
      notifyUserIds: reminder.notifyUserIds,
      createdAt: reminder.createdAt.toISOString(),
    };
  }
}
```

- [ ] **Step 3: Commit**

```bash
cd ~/projects/pet-health-tracker-api
git add src/infrastructure/mappers/MedicationMapper.ts src/infrastructure/mappers/ReminderMapper.ts
git commit -m "feat: update MedicationMapper (schedule/reminderEnabled) and ReminderMapper (advanceNotice)"
```

---

## Task 8: Update `SequelizeHealthRecordRepository` — `findMedicationsByPetId` with reminder batch-load

**Files:**
- Modify: `src/infrastructure/db/repositories/SequelizeHealthRecordRepository.ts`

- [ ] **Step 1: Add import and update `findMedicationsByPetId`**

Add to imports at top of file:
```ts
import { ReminderModel } from '../models/ReminderModel';
import { MedicationSummary } from '../../../domain/health/HealthRecordRepository';
```

Replace the `findMedicationsByPetId` method:
```ts
async findMedicationsByPetId(petId: string): Promise<MedicationSummary[]> {
  const models = await MedicationModel.findAll({ where: { petId } });
  if (models.length === 0) return [];

  const ids = models.map((m) => m.id);
  const reminderModels = await ReminderModel.findAll({
    where: { entityType: 'medication', entityId: ids },
  });
  const reminderMap = new Map(reminderModels.map((r) => [r.entityId, r]));

  return models.map((m) => {
    const reminder = reminderMap.get(m.id);
    return {
      medication: this.medicationMapper.toDomain(m),
      reminderEnabled: reminder?.enabled ?? false,
      advanceNotice: reminder?.advanceNotice ?? undefined,
    };
  });
}
```

- [ ] **Step 2: Commit**

```bash
cd ~/projects/pet-health-tracker-api
git add src/infrastructure/db/repositories/SequelizeHealthRecordRepository.ts
git commit -m "feat: findMedicationsByPetId batch-loads reminders (eliminates N+1)"
```

---

## Task 9: Update `LogMedicationUseCase` — accept `schedule` + optional `reminder`

**Files:**
- Modify: `src/application/health/LogMedicationUseCase.ts`

- [ ] **Step 1: Replace file**

```ts
import { Inject, Service } from 'typedi';
import { HealthRecordRepository, HEALTH_RECORD_REPOSITORY } from '../../domain/health/HealthRecordRepository';
import { PetRepository, PET_REPOSITORY } from '../../domain/pet/PetRepository';
import { ReminderRepository, REMINDER_REPOSITORY } from '../../domain/reminder/ReminderRepository';
import { Medication } from '../../domain/health/Medication';
import { Dosage } from '../../domain/health/value-objects/Dosage';
import { ReminderSchedule, ReminderScheduleProps } from '../../domain/health/value-objects/ReminderSchedule';
import { Reminder, AdvanceNotice } from '../../domain/reminder/Reminder';
import { ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors/AppError';
import { ReminderSchedulerService } from '../../infrastructure/queue/ReminderSchedulerService';

interface LogMedicationInput {
  petId: string;
  name: string;
  dosageAmount: number;
  dosageUnit: string;
  schedule: ReminderScheduleProps;
  startDate: Date;
  endDate?: Date;
  notes?: string;
  reminder?: { enabled: boolean; advanceNotice?: AdvanceNotice };
  requestingUserId: string;
}

@Service()
export class LogMedicationUseCase {
  constructor(
    @Inject(HEALTH_RECORD_REPOSITORY) private readonly healthRepo: HealthRecordRepository,
    @Inject(PET_REPOSITORY) private readonly petRepository: PetRepository,
    @Inject(REMINDER_REPOSITORY) private readonly reminderRepo: ReminderRepository,
    private readonly reminderScheduler: ReminderSchedulerService,
  ) {}

  async execute(input: LogMedicationInput): Promise<Medication> {
    if (!input.name?.trim()) throw new ValidationError('Medication name is required');
    if (input.dosageAmount == null || isNaN(input.dosageAmount)) throw new ValidationError('Dosage amount is required');
    if (!input.dosageUnit?.trim()) throw new ValidationError('Dosage unit is required');
    if (!input.schedule) throw new ValidationError('Schedule is required');
    if (!input.startDate) throw new ValidationError('Start date is required');

    const pet = await this.petRepository.findById(input.petId);
    if (!pet) throw new NotFoundError('Pet');
    if (pet.userId !== input.requestingUserId) throw new ForbiddenError('Not your pet');

    const schedule = ReminderSchedule.create(input.schedule);

    const medication = Medication.create({
      petId: input.petId,
      name: input.name,
      dosage: Dosage.create(input.dosageAmount, input.dosageUnit as any),
      schedule,
      startDate: input.startDate,
      endDate: input.endDate,
      notes: input.notes,
      active: true,
      createdBy: input.requestingUserId,
    });

    await this.healthRepo.saveMedication(medication);

    if (input.reminder) {
      const reminder = Reminder.create({
        entityType: 'medication',
        entityId: medication.id.toValue(),
        schedule,
        enabled: input.reminder.enabled,
        advanceNotice: input.reminder.advanceNotice,
        notifyUserIds: [input.requestingUserId],
        createdBy: input.requestingUserId,
      });
      await this.reminderRepo.save(reminder);

      if (input.reminder.enabled) {
        await this.reminderScheduler.scheduleReminder(
          reminder,
          { petId: pet.id.toValue(), petName: pet.name, medicationName: medication.name, dosage: medication.dosage.toString() },
        );
      }
    }

    return medication;
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd ~/projects/pet-health-tracker-api
git add src/application/health/LogMedicationUseCase.ts
git commit -m "feat: LogMedicationUseCase accepts schedule + optional reminder config"
```

---

## Task 10: Update `UpdateMedicationUseCase` — accept `schedule` + optional `reminder`

**Files:**
- Modify: `src/application/health/UpdateMedicationUseCase.ts`

- [ ] **Step 1: Replace file**

```ts
import { Inject, Service } from 'typedi';
import { HealthRecordRepository, HEALTH_RECORD_REPOSITORY } from '../../domain/health/HealthRecordRepository';
import { PetRepository, PET_REPOSITORY } from '../../domain/pet/PetRepository';
import { ReminderRepository, REMINDER_REPOSITORY } from '../../domain/reminder/ReminderRepository';
import { Medication } from '../../domain/health/Medication';
import { Dosage } from '../../domain/health/value-objects/Dosage';
import { ReminderSchedule, ReminderScheduleProps } from '../../domain/health/value-objects/ReminderSchedule';
import { Reminder, AdvanceNotice } from '../../domain/reminder/Reminder';
import { ForbiddenError, NotFoundError } from '../../shared/errors/AppError';
import { ReminderSchedulerService } from '../../infrastructure/queue/ReminderSchedulerService';

export interface UpdateMedicationInput {
  medicationId: string;
  name?: string;
  dosageAmount?: number;
  dosageUnit?: string;
  schedule?: ReminderScheduleProps;
  startDate?: Date;
  endDate?: Date | null;
  notes?: string | null;
  active?: boolean;
  reminder?: { enabled: boolean; advanceNotice?: AdvanceNotice };
  requestingUserId: string;
}

@Service()
export class UpdateMedicationUseCase {
  constructor(
    @Inject(HEALTH_RECORD_REPOSITORY) private readonly healthRepo: HealthRecordRepository,
    @Inject(PET_REPOSITORY) private readonly petRepository: PetRepository,
    @Inject(REMINDER_REPOSITORY) private readonly reminderRepo: ReminderRepository,
    private readonly reminderScheduler: ReminderSchedulerService,
  ) {}

  async execute(input: UpdateMedicationInput): Promise<Medication> {
    const existing = await this.healthRepo.findMedicationById(input.medicationId);
    if (!existing) throw new NotFoundError('Medication');

    const pet = await this.petRepository.findById(existing.petId);
    if (!pet || pet.userId !== input.requestingUserId) throw new ForbiddenError('Not your pet');

    const newSchedule = input.schedule
      ? ReminderSchedule.create(input.schedule)
      : existing.schedule;

    const updated = Medication.reconstitute(
      {
        petId: existing.petId,
        createdBy: existing.createdBy,
        createdAt: existing.createdAt,
        name: input.name ?? existing.name,
        dosage: Dosage.create(
          input.dosageAmount ?? existing.dosage.amount,
          (input.dosageUnit ?? existing.dosage.unit) as any,
        ),
        schedule: newSchedule,
        startDate: input.startDate ?? existing.startDate,
        endDate: input.endDate === null ? undefined : (input.endDate ?? existing.endDate),
        notes: input.notes === null ? undefined : (input.notes ?? existing.notes),
        active: input.active ?? existing.active,
      },
      existing.id,
    );

    await this.healthRepo.saveMedication(updated);

    if (input.reminder !== undefined) {
      const existingReminder = await this.reminderRepo.findByEntityId(input.medicationId);
      let reminder: Reminder;
      if (existingReminder) {
        existingReminder.updateSchedule(newSchedule);
        existingReminder.toggle(input.reminder.enabled);
        existingReminder.updateAdvanceNotice(input.reminder.advanceNotice);
        reminder = existingReminder;
      } else {
        reminder = Reminder.create({
          entityType: 'medication',
          entityId: input.medicationId,
          schedule: newSchedule,
          enabled: input.reminder.enabled,
          advanceNotice: input.reminder.advanceNotice,
          notifyUserIds: [input.requestingUserId],
          createdBy: input.requestingUserId,
        });
      }
      await this.reminderRepo.save(reminder);

      if (input.reminder.enabled) {
        await this.reminderScheduler.scheduleReminder(
          reminder,
          { petId: pet.id.toValue(), petName: pet.name, medicationName: updated.name, dosage: updated.dosage.toString() },
        );
      } else {
        await this.reminderScheduler.cancelReminders(input.medicationId);
      }
    } else if (input.schedule) {
      // Schedule changed but no reminder config given — sync reminder schedule if one exists
      const existingReminder = await this.reminderRepo.findByEntityId(input.medicationId);
      if (existingReminder) {
        existingReminder.updateSchedule(newSchedule);
        await this.reminderRepo.save(existingReminder);
        if (existingReminder.enabled) {
          await this.reminderScheduler.scheduleReminder(
            existingReminder,
            { petId: pet.id.toValue(), petName: pet.name, medicationName: updated.name, dosage: updated.dosage.toString() },
          );
        }
      }
    }

    return updated;
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd ~/projects/pet-health-tracker-api
git add src/application/health/UpdateMedicationUseCase.ts
git commit -m "feat: UpdateMedicationUseCase accepts schedule + reminder; syncs reminder on schedule change"
```

---

## Task 11: Update `ListMedicationsUseCase` — return `MedicationSummary[]`

**Files:**
- Modify: `src/application/health/ListMedicationsUseCase.ts`

- [ ] **Step 1: Replace file**

```ts
import { Inject, Service } from 'typedi';
import { HealthRecordRepository, HEALTH_RECORD_REPOSITORY, MedicationSummary } from '../../domain/health/HealthRecordRepository';
import { PetRepository, PET_REPOSITORY } from '../../domain/pet/PetRepository';
import { ForbiddenError, NotFoundError } from '../../shared/errors/AppError';

@Service()
export class ListMedicationsUseCase {
  constructor(
    @Inject(HEALTH_RECORD_REPOSITORY) private readonly healthRepo: HealthRecordRepository,
    @Inject(PET_REPOSITORY) private readonly petRepository: PetRepository,
  ) {}

  async execute(petId: string, requestingUserId: string): Promise<MedicationSummary[]> {
    const pet = await this.petRepository.findById(petId);
    if (!pet) throw new NotFoundError('Pet');
    if (pet.userId !== requestingUserId) throw new ForbiddenError('Not your pet');
    return this.healthRepo.findMedicationsByPetId(petId);
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd ~/projects/pet-health-tracker-api
git add src/application/health/ListMedicationsUseCase.ts
git commit -m "feat: ListMedicationsUseCase returns MedicationSummary[] with reminderEnabled"
```

---

## Task 12: Simplify `ConfigureMedicationReminderUseCase` — remove `schedule` from input

**Files:**
- Modify: `src/application/reminder/ConfigureMedicationReminderUseCase.ts`

- [ ] **Step 1: Replace file**

```ts
import { Inject, Service } from 'typedi';
import { HealthRecordRepository, HEALTH_RECORD_REPOSITORY } from '../../domain/health/HealthRecordRepository';
import { PetRepository, PET_REPOSITORY } from '../../domain/pet/PetRepository';
import { ReminderRepository, REMINDER_REPOSITORY } from '../../domain/reminder/ReminderRepository';
import { Reminder, AdvanceNotice } from '../../domain/reminder/Reminder';
import { ForbiddenError, NotFoundError } from '../../shared/errors/AppError';
import { ReminderSchedulerService } from '../../infrastructure/queue/ReminderSchedulerService';

interface ConfigureReminderInput {
  medicationId: string;
  enabled: boolean;
  advanceNotice?: AdvanceNotice;
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

    const existing = await this.reminderRepo.findByEntityId(input.medicationId);

    let reminder: Reminder;
    if (existing) {
      existing.toggle(input.enabled);
      existing.updateAdvanceNotice(input.advanceNotice);
      reminder = existing;
    } else {
      reminder = Reminder.create({
        entityType: 'medication',
        entityId: input.medicationId,
        schedule: medication.schedule,
        enabled: input.enabled,
        advanceNotice: input.advanceNotice,
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

- [ ] **Step 2: Commit**

```bash
cd ~/projects/pet-health-tracker-api
git add src/application/reminder/ConfigureMedicationReminderUseCase.ts
git commit -m "feat: simplify ConfigureMedicationReminderUseCase — schedule sourced from medication"
```

---

## Task 13: Update `ReminderSchedulerService` — apply advance notice offset

**Files:**
- Modify: `src/infrastructure/queue/ReminderSchedulerService.ts`

- [ ] **Step 1: Update `scheduleReminder` to pass advanceNotice to cron**

In `scheduleReminder`, change the line that calls `toCronExpressions()`:

```ts
// Find this line:
const cronExpressions = reminder.schedule.toCronExpressions();

// Replace with:
const cronExpressions = reminder.schedule.toCronExpressions(reminder.advanceNotice);
```

- [ ] **Step 2: Verify compile**

```bash
cd ~/projects/pet-health-tracker-api && pnpm build 2>&1 | grep "error TS"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/queue/ReminderSchedulerService.ts
git commit -m "feat: ReminderSchedulerService applies advanceNotice offset to cron scheduling"
```

---

## Task 14: Update `HealthController` — new medication input/output shape

**Files:**
- Modify: `src/infrastructure/http/controllers/HealthController.ts`

- [ ] **Step 1: Update `getMedications`**

Replace the `getMedications` handler:
```ts
getMedications = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const summaries = await this.listMedications.execute(req.params.petId, req.auth.userId);
    res.json(summaries.map((s) =>
      this.medicationMapper.toResponse(s.medication, s.reminderEnabled, s.advanceNotice)
    ));
  } catch (err) {
    next(err);
  }
};
```

- [ ] **Step 2: Update `createMedication`**

Replace the `createMedication` handler:
```ts
createMedication = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const medication = await this.logMedication.execute({
      petId: req.params.petId,
      name: req.body.name,
      dosageAmount: req.body.dosageAmount,
      dosageUnit: req.body.dosageUnit,
      schedule: req.body.schedule,
      startDate: new Date(req.body.startDate),
      endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
      notes: req.body.notes,
      reminder: req.body.reminder,
      requestingUserId: req.auth.userId,
    });
    res.status(201).json(this.medicationMapper.toResponse(medication, req.body.reminder?.enabled ?? false, req.body.reminder?.advanceNotice));
  } catch (err) {
    next(err);
  }
};
```

- [ ] **Step 3: Update `updateMedicationHandler`**

Replace the handler:
```ts
updateMedicationHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const medication = await this.updateMedication.execute({
      medicationId: req.params.medicationId,
      name: req.body.name,
      dosageAmount: req.body.dosageAmount,
      dosageUnit: req.body.dosageUnit,
      schedule: req.body.schedule,
      startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
      endDate: req.body.endDate === null ? null : req.body.endDate ? new Date(req.body.endDate) : undefined,
      notes: req.body.notes !== undefined ? (req.body.notes || null) : undefined,
      active: req.body.active,
      reminder: req.body.reminder,
      requestingUserId: req.auth.userId,
    });
    res.json(this.medicationMapper.toResponse(medication, req.body.reminder?.enabled ?? false, req.body.reminder?.advanceNotice));
  } catch (err) {
    next(err);
  }
};
```

- [ ] **Step 4: Build and verify**

```bash
cd ~/projects/pet-health-tracker-api && pnpm build 2>&1 | grep "error TS"
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/http/controllers/HealthController.ts
git commit -m "feat: HealthController uses schedule/reminder fields for medication endpoints"
```

---

## Task 15: Update seed script

**Files:**
- Modify: `scripts/seed.ts`

- [ ] **Step 1: Find and update medication creation in seed**

Find the section where `MedicationModel.bulkCreate` or individual medication records are created. Replace any `frequencyType`/`frequencyInterval` fields with a `schedule` JSONB field.

Search for:
```bash
grep -n "frequencyType\|frequencyInterval\|frequency_type\|frequency_interval" ~/projects/pet-health-tracker-api/scripts/seed.ts
```

For each medication record in the seed, replace:
```ts
// Before
{ ..., frequencyType: 'daily', frequencyInterval: 1, ... }

// After
{ ..., schedule: { type: 'daily', times: ['08:00'] }, ... }
```

Common replacements for the seed's medication data:
- `frequencyType: 'daily', frequencyInterval: 1` → `schedule: { type: 'daily', times: ['08:00'] }`
- `frequencyType: 'weekly', frequencyInterval: 1` → `schedule: { type: 'weekly', days: ['MON', 'THU'], times: ['08:00'] }`
- `frequencyType: 'monthly', frequencyInterval: 1` → `schedule: { type: 'monthly', daysOfMonth: [1], times: ['08:00'] }`

- [ ] **Step 2: Build to verify**

```bash
cd ~/projects/pet-health-tracker-api && pnpm build 2>&1 | grep "error TS"
```

- [ ] **Step 3: Commit**

```bash
git add scripts/seed.ts
git commit -m "feat: update seed script to use schedule JSONB for medications"
```

---

## Task 16: Client — update types and API clients

**Files:**
- Modify: `src/types/index.ts` (in `pet-health-tracker-client`)
- Modify: `src/api/medications.ts`
- Modify: `src/api/reminders.ts`

- [ ] **Step 1: Update `src/types/index.ts`**

Replace the `Medication` interface and add `AdvanceNotice`:
```ts
export interface AdvanceNotice {
  amount: number;
  unit: 'minutes' | 'hours' | 'days';
}

export interface Medication {
  id: string;
  petId: string;
  name: string;
  dosage: { amount: number; unit: string };
  schedule: ReminderScheduleProps;
  startDate: string;
  endDate?: string;
  notes?: string;
  active: boolean;
  reminderEnabled: boolean;
  advanceNotice?: AdvanceNotice;
  createdAt: string;
}
```

- [ ] **Step 2: Update `src/api/medications.ts`**

```ts
import { apiClient } from './client';
import type { Medication, ReminderScheduleProps, AdvanceNotice } from '../types';

export interface CreateMedicationInput {
  name: string;
  dosageAmount: number;
  dosageUnit: string;
  schedule: ReminderScheduleProps;
  startDate: string;
  endDate?: string;
  notes?: string;
  reminder?: { enabled: boolean; advanceNotice?: AdvanceNotice };
}

export interface UpdateMedicationInput {
  name?: string;
  dosageAmount?: number;
  dosageUnit?: string;
  schedule?: ReminderScheduleProps;
  startDate?: string;
  endDate?: string | null;
  notes?: string | null;
  active?: boolean;
  reminder?: { enabled: boolean; advanceNotice?: AdvanceNotice };
}

export const medicationsApi = {
  list(petId: string): Promise<Medication[]> {
    return apiClient.get(`/pets/${petId}/medications`).then((r) => r.data);
  },

  create(petId: string, data: CreateMedicationInput): Promise<Medication> {
    return apiClient.post(`/pets/${petId}/medications`, data).then((r) => r.data);
  },

  update(petId: string, medicationId: string, data: UpdateMedicationInput): Promise<Medication> {
    return apiClient.put(`/pets/${petId}/medications/${medicationId}`, data).then((r) => r.data);
  },
};
```

- [ ] **Step 3: Update `src/api/reminders.ts`**

Update `configureMedicationReminder` to drop `schedule` from the body (medication route only):
```ts
configureMedicationReminder: (
  medicationId: string,
  data: { enabled: boolean; advanceNotice?: AdvanceNotice },
) => apiClient.put(`/medications/${medicationId}/reminder`, data),
```

Also add the `AdvanceNotice` import:
```ts
import type { Reminder, ReminderScheduleProps, AdvanceNotice } from '../types';
```

- [ ] **Step 4: Commit**

```bash
cd ~/projects/pet-health-tracker-client
git add src/types/index.ts src/api/medications.ts src/api/reminders.ts
git commit -m "feat: update client types and API for schedule/reminder merge"
```

---

## Task 17: Client — create `MedicationScheduleSection` component

**Files:**
- Create: `src/components/MedicationScheduleSection.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { Box, FormControlLabel, MenuItem, Switch, TextField, Typography } from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import type { ReminderScheduleProps, DayOfWeek, AdvanceNotice } from '../types';

const DAYS: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

const ADVANCE_NOTICE_OPTIONS: { label: string; value: AdvanceNotice | null }[] = [
  { label: 'At dose time', value: null },
  { label: '15 minutes before', value: { amount: 15, unit: 'minutes' } },
  { label: '30 minutes before', value: { amount: 30, unit: 'minutes' } },
  { label: '1 hour before', value: { amount: 1, unit: 'hours' } },
  { label: '2 hours before', value: { amount: 2, unit: 'hours' } },
  { label: '4 hours before', value: { amount: 4, unit: 'hours' } },
  { label: '1 day before', value: { amount: 1, unit: 'days' } },
];

function advanceNoticeKey(v: AdvanceNotice | null): string {
  if (!v) return 'none';
  return `${v.amount}-${v.unit}`;
}

interface Props {
  schedule: ReminderScheduleProps;
  onScheduleChange: (s: ReminderScheduleProps) => void;
  reminderEnabled: boolean;
  onReminderToggle: (enabled: boolean) => void;
  advanceNotice?: AdvanceNotice;
  onAdvanceNoticeChange: (v: AdvanceNotice | undefined) => void;
}

export function MedicationScheduleSection({
  schedule,
  onScheduleChange,
  reminderEnabled,
  onReminderToggle,
  advanceNotice,
  onAdvanceNoticeChange,
}: Props) {
  const handleTypeChange = (type: 'daily' | 'weekly' | 'monthly') => {
    if (type === 'daily') onScheduleChange({ type: 'daily', times: schedule.times });
    else if (type === 'weekly') onScheduleChange({ type: 'weekly', days: ['MON'], times: schedule.times });
    else onScheduleChange({ type: 'monthly', daysOfMonth: [1], times: schedule.times });
  };

  const handleTimeChange = (index: number, value: string) => {
    const times = [...schedule.times];
    times[index] = value;
    onScheduleChange({ ...schedule, times } as ReminderScheduleProps);
  };

  const addTime = () => {
    if (schedule.times.length >= 4) return;
    onScheduleChange({ ...schedule, times: [...schedule.times, '08:00'] } as ReminderScheduleProps);
  };

  const removeTime = (index: number) => {
    const times = schedule.times.filter((_, i) => i !== index);
    if (times.length === 0) return;
    onScheduleChange({ ...schedule, times } as ReminderScheduleProps);
  };

  const selectedAdvanceKey = advanceNoticeKey(advanceNotice ?? null);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <TextField
        select
        label="Schedule type"
        value={schedule.type}
        onChange={(e) => handleTypeChange(e.target.value as 'daily' | 'weekly' | 'monthly')}
        fullWidth
      >
        <MenuItem value="daily">Daily</MenuItem>
        <MenuItem value="weekly">Weekly</MenuItem>
        <MenuItem value="monthly">Monthly</MenuItem>
      </TextField>

      {schedule.type === 'weekly' && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {DAYS.map((d) => {
            const selected = (schedule as { days: DayOfWeek[] }).days.includes(d);
            return (
              <Box
                key={d}
                onClick={() => {
                  const days = selected
                    ? (schedule as { days: DayOfWeek[] }).days.filter((x) => x !== d)
                    : [...(schedule as { days: DayOfWeek[] }).days, d];
                  if (days.length > 0) onScheduleChange({ ...schedule, days } as ReminderScheduleProps);
                }}
                sx={{
                  px: 1.5, py: 0.5, borderRadius: 2, fontSize: '0.75rem', fontWeight: 700,
                  cursor: 'pointer', userSelect: 'none',
                  bgcolor: selected ? 'primary.main' : 'background.paper',
                  color: selected ? 'primary.contrastText' : 'text.secondary',
                  border: '1.5px solid',
                  borderColor: selected ? 'primary.main' : 'divider',
                }}
              >
                {d}
              </Box>
            );
          })}
        </Box>
      )}

      {schedule.type === 'monthly' && (
        <TextField
          label="Day(s) of month (comma-separated)"
          fullWidth
          value={(schedule as { daysOfMonth: number[] }).daysOfMonth.join(', ')}
          onChange={(e) => {
            const daysOfMonth = e.target.value
              .split(',')
              .map((s) => parseInt(s.trim()))
              .filter((n) => n >= 1 && n <= 31);
            if (daysOfMonth.length > 0)
              onScheduleChange({ ...schedule, daysOfMonth } as ReminderScheduleProps);
          }}
        />
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography variant="caption" color="text.secondary">Dose time(s)</Typography>
        {schedule.times.map((t, i) => (
          <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField
              label={`Time ${i + 1}`}
              type="time"
              value={t}
              onChange={(e) => handleTimeChange(i, e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ flex: 1 }}
            />
            {schedule.times.length > 1 && (
              <Box
                onClick={() => removeTime(i)}
                sx={{ cursor: 'pointer', color: 'text.disabled', px: 1, '&:hover': { color: 'error.main' } }}
              >✕</Box>
            )}
          </Box>
        ))}
        {schedule.times.length < 4 && (
          <Box
            onClick={addTime}
            sx={{ fontSize: '0.8rem', color: 'primary.main', cursor: 'pointer', pl: 0.5, '&:hover': { opacity: 0.7 } }}
          >
            + Add time
          </Box>
        )}
      </Box>

      {/* Reminder toggle */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: 'background.paper', border: '1.5px solid', borderColor: 'divider', borderRadius: 2, px: 1.5, py: 1 }}>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <NotificationsIcon sx={{ fontSize: 16 }} /> Enable reminder
          </Typography>
          <Typography variant="caption" color="text.secondary">Get notified before each dose</Typography>
        </Box>
        <Switch checked={reminderEnabled} onChange={(e) => onReminderToggle(e.target.checked)} />
      </Box>

      {/* Advance notice — only shown when reminder enabled */}
      {reminderEnabled && (
        <TextField
          select
          label="Remind me"
          value={selectedAdvanceKey}
          onChange={(e) => {
            const opt = ADVANCE_NOTICE_OPTIONS.find((o) => advanceNoticeKey(o.value) === e.target.value);
            onAdvanceNoticeChange(opt?.value ?? undefined);
          }}
          fullWidth
        >
          {ADVANCE_NOTICE_OPTIONS.map((opt) => (
            <MenuItem key={advanceNoticeKey(opt.value)} value={advanceNoticeKey(opt.value)}>
              {opt.label}
            </MenuItem>
          ))}
        </TextField>
      )}
    </Box>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd ~/projects/pet-health-tracker-client
git add src/components/MedicationScheduleSection.tsx
git commit -m "feat: add MedicationScheduleSection component (schedule + reminder toggle + advance notice)"
```

---

## Task 18: Client — update `AddMedicationDialog` in `PetDetailPage.tsx`

**Files:**
- Modify: `src/pages/health/PetDetailPage.tsx`

- [ ] **Step 1: Add import for `MedicationScheduleSection`**

Near the top of `PetDetailPage.tsx`, add:
```ts
import { MedicationScheduleSection } from '../../components/MedicationScheduleSection';
import type { ReminderScheduleProps, AdvanceNotice } from '../../types';
```

- [ ] **Step 2: Update `AddMedicationDialog` state and save**

Find `AddMedicationDialog` (around line 969). Update the state and form:

Replace the frequency state + `FrequencyPicker` with schedule + reminder state:
```tsx
function AddMedicationDialog({ open, saving, onClose, onSave }: {
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: (data: CreateMedicationInput) => void;
}) {
  const [form, setForm] = useState({
    name: '',
    dosageAmount: '',
    dosageUnit: 'mg',
    startDate: today(),
    endDate: '',
    notes: '',
  });
  const [schedule, setSchedule] = useState<ReminderScheduleProps>({ type: 'daily', times: ['08:00'] });
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [advanceNotice, setAdvanceNotice] = useState<AdvanceNotice | undefined>(undefined);
  const [hasEndDate, setHasEndDate] = useState(false);

  const set = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));
  const canSave = !!(form.name && form.dosageAmount && form.dosageUnit && form.startDate);

  const handleSave = () => {
    onSave({
      name: form.name,
      dosageAmount: parseFloat(form.dosageAmount),
      dosageUnit: form.dosageUnit,
      schedule,
      startDate: new Date(form.startDate).toISOString(),
      endDate: hasEndDate && form.endDate ? new Date(form.endDate).toISOString() : undefined,
      notes: form.notes || undefined,
      reminder: { enabled: reminderEnabled, advanceNotice },
    });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Add Medication</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField label="Medication name" value={form.name} onChange={(e) => set('name', e.target.value)} fullWidth required />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              label="Dose" type="number" value={form.dosageAmount}
              onChange={(e) => set('dosageAmount', e.target.value)}
              sx={{ flex: 1 }} required
              slotProps={{ htmlInput: { min: 0, step: 'any' } }}
            />
            <TextField
              select label="Unit" value={form.dosageUnit}
              onChange={(e) => set('dosageUnit', e.target.value)}
              sx={{ width: 130 }}
            >
              {DOSAGE_UNITS.map((u) => <MenuItem key={u} value={u}>{u}</MenuItem>)}
            </TextField>
          </Box>
          <TextField label="Start date" type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} fullWidth required slotProps={{ inputLabel: { shrink: true } }} />
          <FormControlLabel
            control={<Checkbox checked={hasEndDate} onChange={(e) => setHasEndDate(e.target.checked)} />}
            label="Set end date"
          />
          {hasEndDate && (
            <TextField label="End date" type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} fullWidth slotProps={{ inputLabel: { shrink: true } }} />
          )}
          <TextField label="Notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} fullWidth multiline rows={2} />
          <Typography sx={{ fontWeight: 800, fontSize: '0.6875rem', color: 'text.disabled', letterSpacing: '2px', textTransform: 'uppercase', mb: -1 }}>
            Schedule
          </Typography>
          <MedicationScheduleSection
            schedule={schedule}
            onScheduleChange={setSchedule}
            reminderEnabled={reminderEnabled}
            onReminderToggle={setReminderEnabled}
            advanceNotice={advanceNotice}
            onAdvanceNoticeChange={setAdvanceNotice}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!canSave || saving} onClick={handleSave}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

- [ ] **Step 3: Delete `FrequencyPicker` function**

Find and delete the entire `FrequencyPicker` function (around line 921–967) and the `freqLabel` helper if it's only used there.

Also delete the `FreqType` type alias if it's only used by `FrequencyPicker`.

- [ ] **Step 4: Build check**

```bash
cd ~/projects/pet-health-tracker-client && pnpm build 2>&1 | grep -E "error TS|Error" | head -20
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/health/PetDetailPage.tsx
git commit -m "feat: AddMedicationDialog uses MedicationScheduleSection; remove FrequencyPicker"
```

---

## Task 19: Client — update `MedicationDetailDialog` — remove tabs, use `MedicationScheduleSection`

**Files:**
- Modify: `src/components/MedicationDetailDialog.tsx`

- [ ] **Step 1: Replace the file**

```tsx
import { useEffect, useState } from 'react';
import {
  Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControlLabel, MenuItem, Switch, TextField, Typography,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Medication, ReminderScheduleProps, AdvanceNotice } from '../types';
import type { UpdateMedicationInput } from '../api/medications';
import { medicationsApi } from '../api/medications';
import { MedicationScheduleSection } from './MedicationScheduleSection';
import { getApiError } from '../api/client';
import { useNotification } from '../context/NotificationContext';

const DOSAGE_UNITS = ['mg', 'ml', 'g', 'mcg', 'tab', 'pip', 'injection', 'collar', 'drop'];

interface Props {
  med: Medication;
  petId: string;
  onClose: () => void;
}

export function MedicationDetailDialog({ med, petId, onClose }: Props) {
  const queryClient = useQueryClient();
  const { showError } = useNotification();

  const [form, setForm] = useState({
    name: med.name,
    dosageAmount: String(med.dosage.amount),
    dosageUnit: med.dosage.unit,
    startDate: med.startDate.slice(0, 10),
    endDate: med.endDate ? med.endDate.slice(0, 10) : '',
    notes: med.notes ?? '',
  });
  const [schedule, setSchedule] = useState<ReminderScheduleProps>(med.schedule);
  const [reminderEnabled, setReminderEnabled] = useState(med.reminderEnabled);
  const [advanceNotice, setAdvanceNotice] = useState<AdvanceNotice | undefined>(med.advanceNotice);
  const [hasEndDate, setHasEndDate] = useState(!!med.endDate);
  const [active, setActive] = useState(med.active);

  const set = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));
  const canSave = !!(form.name && form.dosageAmount && form.dosageUnit && form.startDate);

  const updateMutation = useMutation({
    mutationFn: (data: UpdateMedicationInput) => medicationsApi.update(petId, med.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medications', petId] });
      onClose();
    },
    onError: (err) => showError(getApiError(err)),
  });

  const handleSave = () => {
    updateMutation.mutate({
      name: form.name,
      dosageAmount: parseFloat(form.dosageAmount),
      dosageUnit: form.dosageUnit,
      schedule,
      startDate: new Date(form.startDate).toISOString(),
      endDate: hasEndDate && form.endDate ? new Date(form.endDate).toISOString() : null,
      notes: form.notes || null,
      active,
      reminder: { enabled: reminderEnabled, advanceNotice },
    });
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pb: 0, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        {med.name}
        {active ? (
          <Chip label="Active" size="small" sx={{ fontWeight: 800, borderRadius: 5, fontSize: '0.6875rem', bgcolor: '#34d39922', color: '#059669' }} />
        ) : (
          <Chip label="Inactive" size="small" sx={{ fontWeight: 800, borderRadius: 5, fontSize: '0.6875rem', bgcolor: '#f3f4f6', color: 'text.disabled' }} />
        )}
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography sx={{ fontWeight: 800, fontSize: '0.6875rem', color: 'text.disabled', letterSpacing: '2px', textTransform: 'uppercase', mb: -0.5 }}>
            Medication Details
          </Typography>
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
                <MenuItem key={u} value={u}>{u}</MenuItem>
              ))}
            </TextField>
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
          <Typography sx={{ fontWeight: 800, fontSize: '0.6875rem', color: 'text.disabled', letterSpacing: '2px', textTransform: 'uppercase', mb: -1 }}>
            Schedule
          </Typography>
          <MedicationScheduleSection
            schedule={schedule}
            onScheduleChange={setSchedule}
            reminderEnabled={reminderEnabled}
            onReminderToggle={setReminderEnabled}
            advanceNotice={advanceNotice}
            onAdvanceNoticeChange={setAdvanceNotice}
          />
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} color="inherit">Cancel</Button>
        <Button
          variant="contained"
          disabled={!canSave || updateMutation.isPending}
          onClick={handleSave}
        >
          {updateMutation.isPending ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

- [ ] **Step 2: Build check**

```bash
cd ~/projects/pet-health-tracker-client && pnpm build 2>&1 | grep -E "error TS|Error" | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/components/MedicationDetailDialog.tsx
git commit -m "feat: MedicationDetailDialog — remove tabs, inline schedule + reminder section"
```

---

## Task 20: Client — update `CalendarPage` — remove N+1 reminder queries

**Files:**
- Modify: `src/pages/calendar/CalendarPage.tsx`

- [ ] **Step 1: Remove `remindersApi` import and reminder queries**

In `CalendarPage.tsx`:

1. Remove the import: `import { remindersApi } from '../../api/reminders';`

2. Delete the entire `reminderQueries` block (lines ~121–136):
```ts
// DELETE this entire block:
const reminderQueries = useQueries({
  queries: allMedications.map((med) => ({
    queryKey: ['reminder', 'medication', med.id],
    queryFn: () => remindersApi.getMedicationReminder(med.id),
    staleTime: 5 * 60 * 1000,
  })),
});
const remindersMap = useMemo<Record<string, boolean>>(() => {
  const map: Record<string, boolean> = {};
  allMedications.forEach((med, i) => {
    const r = reminderQueries[i]?.data;
    map[med.id] = !!(r?.enabled);
  });
  return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [allMedications, reminderQueries.map((q) => q.dataUpdatedAt).join(',')]);
```

- [ ] **Step 2: Update `toCalendarEvents` to read `med.reminderEnabled` directly**

In the `toCalendarEvents` function, replace:
```ts
hasReminder: remindersMap[m.id] ?? false,
```
with:
```ts
hasReminder: m.reminderEnabled,
```

- [ ] **Step 3: Remove `remindersMap` from the `allEvents` useMemo dependency array**

```ts
// Before
[vetVisits, allMedications, remindersMap, monthKey]

// After
[vetVisits, allMedications, monthKey]
```

- [ ] **Step 4: Update the `toCalendarEvents` call — remove `remindersMap` argument**

```ts
// Before
const allEvents = useMemo(
  () => toCalendarEvents(vetVisits, allMedications, remindersMap, monthStart, monthEnd),
  ...

// After
const allEvents = useMemo(
  () => toCalendarEvents(vetVisits, allMedications, monthStart, monthEnd),
  ...
```

- [ ] **Step 5: Update `toCalendarEvents` function signature**

```ts
function toCalendarEvents(
  vetVisits: VetVisit[],
  medications: Medication[],
  monthStart: Date,
  monthEnd: Date,
): CalendarEvent[] {
```

- [ ] **Step 6: Build check**

```bash
cd ~/projects/pet-health-tracker-client && pnpm build 2>&1 | grep -E "error TS|Error" | head -20
```

- [ ] **Step 7: Commit**

```bash
git add src/pages/calendar/CalendarPage.tsx
git commit -m "feat: CalendarPage reads reminderEnabled from medication; remove N+1 reminder queries"
```

---

## Task 21: End-to-end smoke test

- [ ] **Step 1: Start the API**

```bash
cd ~/projects/pet-health-tracker-api && pnpm dev
```

Expected: `Database connected`, `Notification worker started`, `Server running on port 3000`

(If the DB has existing medications without `schedule`, run the migration script first: Task 6 Step 2)

- [ ] **Step 2: Start the client**

```bash
cd ~/projects/pet-health-tracker-client && pnpm dev
```

- [ ] **Step 3: Verify Add Medication**

1. Open a pet's health page
2. Click "Add Medication"
3. Confirm the dialog shows: name, dose, unit, start date, notes fields + Schedule section (daily/weekly/monthly picker + time chips + reminder toggle)
4. Add a medication with reminder enabled and "30 minutes before" advance notice
5. Save — confirm it appears in the medication list

- [ ] **Step 4: Verify Edit Medication**

1. Click an existing medication
2. Confirm: no tabs, single form with Schedule section
3. Change schedule to weekly (MON/THU), enable reminder, set advance notice
4. Save — confirm changes persist

- [ ] **Step 5: Verify Calendar**

1. Open the Calendar page
2. Confirm medication span bars appear
3. Confirm bell icon appears on medications with reminder enabled
4. Check browser network tab — confirm NO individual `/medications/:id/reminder` requests (only the medications list request)

- [ ] **Step 6: Final commit (if any tweaks were made)**

```bash
cd ~/projects/pet-health-tracker-api && git add -A && git commit -m "chore: smoke test fixes"
cd ~/projects/pet-health-tracker-client && git add -A && git commit -m "chore: smoke test fixes"
```
