# Medication Schedule + Reminder Merge

**Date:** 2026-04-20  
**Status:** Approved  
**Scope:** API (`pet-health-tracker-api`) + Client (`pet-health-tracker-client`)

## Summary

Replace the simple `FrequencySchedule` value object on `Medication` with the rich `ReminderSchedule` shape already used by the reminder system. Add an inline reminder toggle and advance-notice selector to the medication form (Add and Edit), eliminating the separate "Reminder" tab. Show reminder-enabled status on the calendar without N+1 queries.

## Decisions

- **Drop hourly frequency** — users express hourly dosing as explicit daily times (e.g. 4 times for "every 6 hours").
- **Form layout B** — reminder toggle is always visible; advance-notice selector reveals only after toggle is turned on.
- **Architecture Option 1** — replace `FrequencySchedule` with `ReminderSchedule` on the `Medication` entity; keep the separate `Reminder` entity, synced from the medication schedule on save.

---

## Domain & Data Model

### Deleted
- `src/domain/health/value-objects/FrequencySchedule.ts` — removed entirely.

### Modified: `Medication` entity
```ts
// Before
frequency: FrequencySchedule  // { type: hourly|daily|weekly|monthly, interval: number }

// After
schedule: ReminderSchedule    // { type: daily|weekly|monthly, times: string[], days?, daysOfMonth? }
```

### Modified: `Reminder` entity
Add optional `advanceNotice` field:
```ts
advanceNotice?: { amount: number; unit: 'minutes' | 'hours' | 'days' }
```
`Reminder.schedule` is kept and stays synced with `Medication.schedule` — it remains the source of truth for BullMQ job scheduling.

### Modified: `ReminderSchedule.toCronExpressions()`
Accept an optional `advanceNotice` offset. Subtract the offset from each time before generating cron strings. Example: time `08:00` + offset `30 minutes` → cron at `07:30`. Handle midnight crossing: if the offset pushes a time before `00:00` (e.g. `00:15` - 30 min), wrap to `23:45` of the previous day — this requires adjusting the day-of-week/day-of-month expression accordingly. In practice this edge case is rare; a TODO comment is acceptable if deferred.

### DB Migrations (2)

**Migration 1 — `medications` table:**
- Rename column `frequency` → `schedule`
- Reformat existing JSONB rows using best-effort defaults:
  - `{ type: 'daily', interval: N }` → `{ type: 'daily', times: ['08:00'] }`
  - `{ type: 'weekly', interval: N }` → `{ type: 'weekly', days: ['MON'], times: ['08:00'] }`
  - `{ type: 'monthly', interval: N }` → `{ type: 'monthly', daysOfMonth: [1], times: ['08:00'] }`
  - `{ type: 'hourly', interval: N }` → `{ type: 'daily', times: ['08:00'] }` (lossy but acceptable; hourly is dropped)

**Migration 2 — `reminders` table:**
- Add nullable JSONB column `advance_notice`

---

## API Layer

### `LogMedicationUseCase`
Input changes:
```ts
// Before
frequency: { type: FrequencyType; interval: number }

// After
schedule: ReminderScheduleProps
reminder?: { enabled: boolean; advanceNotice?: AdvanceNotice }
```
If `reminder` is provided, the use case upserts the `Reminder` atomically — no second API call needed.

### `UpdateMedicationUseCase`
Same input changes as above. When schedule changes and a reminder exists, `Reminder.schedule` is synced to match.

### `ConfigureMedicationReminderUseCase`
Simplified — no longer accepts `schedule` (schedule always comes from the medication). New input:
```ts
{ medicationId, enabled, advanceNotice?, requestingUserId }
```
Used for toggling reminder on/off without re-saving the full medication.

### `ReminderSchedulerService`
`scheduleReminder()` receives `advanceNotice` and applies the offset when calling `toCronExpressions()`.

### HTTP routes
No new routes. Existing routes updated:
- `POST /pets/:id/medications` — accepts extended input
- `PUT /pets/:id/medications/:id` — accepts extended input
- `POST /reminders/medication/:id/configure` — simplified input (no `schedule`)

### `ListMedicationsUseCase`
Updated to LEFT JOIN the `reminders` table on `entity_id = medication.id` and include `reminderEnabled` + `advanceNotice` in the returned data.

### `MedicationModel` (Sequelize)
- Rename column mapping `frequency` → `schedule`
- Add association/join to `ReminderModel` for list queries

### `MedicationMapper`
- Map `schedule` (ReminderSchedule shape) instead of `frequency`
- Map `reminderEnabled` and `advanceNotice` from joined reminder data

### `MedicationController`
- Pass `schedule` + `reminder` from request body to use cases (previously passed `frequency`)

### Medication list response
`GET /pets/:id/medications` gains two fields per medication (joined from `reminders` table):
```ts
reminderEnabled: boolean
advanceNotice?: { amount: number; unit: 'minutes' | 'hours' | 'days' }
```
This eliminates N+1 reminder queries on the calendar page.

---

## Client UI

### New component: `MedicationScheduleSection`
Shared between Add and Edit dialogs. Renders:
1. **Schedule type selector** — Daily / Weekly / Monthly dropdown
2. **Day selectors** — day-of-week chips (weekly) or day-of-month input (monthly)
3. **Time chips** — list of `HH:MM` times with add/remove; max 4
4. **Reminder toggle** — `🔔 Enable reminder` switch, always visible
5. **Advance notice dropdown** — reveals only when toggle is ON:
   - Presets: "At dose time", "15 min before", "30 min before", "1 hour before", "2 hours before", "4 hours before", "1 day before"

### `AddMedicationDialog` (`PetDetailPage.tsx`)
- Remove `FrequencyPicker`
- Add `MedicationScheduleSection`
- `onSave` payload gains `schedule: ReminderScheduleProps` + optional `reminder: { enabled, advanceNotice }`

### `MedicationDetailDialog`
- Remove tabs (`details` / `reminder`)
- Single scrollable form with `MedicationScheduleSection` replacing the frequency row
- Save button submits medication update + reminder config in one call

### `ReminderScheduleEditor`
- Keep as-is (still used by vet visit reminders)

### `types/index.ts`
```ts
// Medication type
interface Medication {
  // ...
  schedule: ReminderScheduleProps  // was: frequency: { type, interval, label }
  reminderEnabled: boolean         // new
  advanceNotice?: AdvanceNotice    // new
}

// New type
interface AdvanceNotice {
  amount: number
  unit: 'minutes' | 'hours' | 'days'
}
```

### `api/medications.ts`
```ts
interface CreateMedicationInput {
  // ...
  schedule: ReminderScheduleProps   // was: frequency: { type, interval }
  reminder?: { enabled: boolean; advanceNotice?: AdvanceNotice }
}

interface UpdateMedicationInput {
  // ...
  schedule?: ReminderScheduleProps  // was: frequency?
  reminder?: { enabled: boolean; advanceNotice?: AdvanceNotice }
}
```

---

## Calendar

### `CalendarPage`
- Remove `reminderQueries` (array of per-medication reminder queries)
- Remove `remindersMap` computation
- `toCalendarEvents()` reads `med.reminderEnabled` directly instead of `remindersMap[m.id]`

### `CalendarEvent` type
No change — `hasReminder: boolean` remains on the medication event shape.

---

## Out of Scope

- Vet visit reminders — no changes; `ReminderScheduleEditor` stays for that flow
- Calendar display (span bars, bell icon) — no visual changes
- Notification content/email templates — no changes
