# Notification Scheduling Refactor

**Date:** 2026-04-13  
**Status:** Approved

## Problem

`FrequencySchedule` (type + interval) is too coarse to drive actionable reminders. "Twice a week" doesn't say which days; "twice daily" doesn't say which hours. Users need to select exact times and days so reminders fire at predictable, meaningful moments.

## Decisions

- **Approach:** Discriminated union value object — one variant per schedule type, each carrying exactly what it needs.
- **No interval-based scheduling** — explicit time selection only (no "every N hours").
- **Day-of-month support** — monthly schedules require selecting specific days (e.g., 1st and 15th).
- **UTC only** — no per-user or per-reminder timezone; all cron expressions run in UTC.
- **Drop and recreate DB** — no migration files; `sync({ force: true })` on seed and startup.

---

## Section 1: Domain Layer

### `ReminderSchedule` value object

Rewrite `src/domain/health/value-objects/ReminderSchedule.ts` as a discriminated union:

```typescript
type DayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN'

type DailySchedule   = { type: 'daily';   times: string[] }
type WeeklySchedule  = { type: 'weekly';  days: DayOfWeek[];     times: string[] }
type MonthlySchedule = { type: 'monthly'; daysOfMonth: number[]; times: string[] }

type ReminderScheduleProps = DailySchedule | WeeklySchedule | MonthlySchedule
```

`times` values are `"HH:MM"` strings (UTC). `toCronExpressions()` returns one cron string per time slot:

| Schedule | Example input | Cron output |
|---|---|---|
| daily | `times: ["08:00","20:00"]` | `["0 8 * * *", "0 20 * * *"]` |
| weekly | `days: ["MON","WED"], times: ["09:00"]` | `["0 9 * * 1,3"]` |
| monthly | `daysOfMonth: [1,15], times: ["09:00"]` | `["0 9 1,15 * *"]` |

Validation in `create()`:
- `times` must be non-empty for all variants
- `times` values must match `HH:MM` format, hours 0–23, minutes 0–59
- weekly: `days` must be non-empty
- monthly: `daysOfMonth` must be non-empty, values 1–31

### `Reminder` entity

`src/domain/reminder/Reminder.ts` — swap `FrequencySchedule` import for `ReminderSchedule`. Add `updateSchedule(schedule: ReminderSchedule)` method alongside the existing `toggle()`.

### `FrequencySchedule`

`src/domain/health/value-objects/FrequencySchedule.ts` — **unchanged**. Still used by `Medication.frequency` as a display label ("Twice daily", etc.).

---

## Section 2: Database & Mapper

### `ReminderModel`

`src/infrastructure/db/models/ReminderModel.ts` — remove `scheduleType` (STRING) and `scheduleInterval` (INTEGER); add `schedule` (JSONB, `allowNull: false`).

Stored JSON matches the discriminated union directly:
```json
{ "type": "daily", "times": ["08:00", "20:00"] }
{ "type": "weekly", "days": ["MON", "WED", "FRI"], "times": ["08:00"] }
{ "type": "monthly", "daysOfMonth": [1, 15], "times": ["09:00"] }
```

### `ReminderMapper`

`src/infrastructure/mappers/ReminderMapper.ts`:
- `toDomain`: parse `model.schedule` (JSON) → `ReminderSchedule.create(model.schedule)`
- `toPersistence`: serialize `reminder.schedule.props` as plain object for the `schedule` column
- `toResponse`: return schedule as-is — `{ type, times, days?, daysOfMonth? }` — replacing the old `{ type, interval, label }`

---

## Section 3: Application Layer & Queue

### `ConfigureMedicationReminderUseCase`

`src/application/reminder/ConfigureMedicationReminderUseCase.ts` — replace `frequencyType` + `frequencyInterval` input fields with a single `schedule` field:

```typescript
interface ConfigureReminderInput {
  medicationId: string;
  schedule: DailySchedule | WeeklySchedule | MonthlySchedule;
  enabled: boolean;
  requestingUserId: string;
}
```

Pass `schedule` directly to `ReminderSchedule.create()`. When updating an existing reminder, call `existing.updateSchedule(schedule)` and `existing.toggle(enabled)`.

### `ReminderSchedulerService`

`src/infrastructure/queue/ReminderSchedulerService.ts` — replace `notificationQueue.add(..., { repeat: { every: ... } })` with `upsertJobScheduler` per cron expression:

```
reminder--{entityId}--0   →  first cron expression
reminder--{entityId}--1   →  second cron expression
...
```

`cancelReminders(entityId)`: fetch all job schedulers, remove those whose ID starts with `reminder--{entityId}--`. This handles schedule updates that change the number of time slots.

---

## Section 4: Cleanup, Seed & Docs

### Cleanup

- Remove all `FrequencySchedule` imports from reminder-related files (`Reminder.ts`, `ReminderMapper.ts`, `ConfigureMedicationReminderUseCase.ts`)
- `FrequencySchedule.ts` itself is kept (used by `Medication`)

### Seed

`scripts/seed.ts`:
- Change `sync({ force: false })` → `sync({ force: true })` so each run drops and recreates all tables
- Medication templates keep `frequencyType`/`frequencyInterval` — valid for medication display, unchanged

### Docs

`README.md`:
- Update Medications feature bullet to reflect precise schedule selection

`skills/ARCHITECTURE.md`:
- Update `ReminderSchedule` value objects entry to describe the discriminated union
- Update `ReminderModel` table row: replace `schedule_type`/`schedule_interval` columns with `schedule (JSONB)`
- Update `ReminderSchedulerService` description: `upsertJobScheduler` + cron, one entry per expression
- Update `sync({ alter: true })` note → `sync({ force: true })` in dev
