# Vet Visit Refactor & Medication Reminder UI — Design Spec

**Date:** 2026-04-13  
**Status:** Approved

---

## Problem

The current vet visit model requires a logged visit (`visitDate` = today/past) before a future visit can be scheduled — done by setting `nextVisitDate` on the logged record. This is awkward: you are forced to create a visit that hasn't happened yet just to schedule one. Additionally, the medication reminder system exists in the backend but has no client UI.

## Goals

1. Allow creating scheduled (upcoming) vet visits independently, without first logging a current visit.
2. Maintain vet visit history (logged visits) as a distinct concept from scheduled visits.
3. Scheduled vet visits use the existing `Reminder` infrastructure for repeating reminders, plus the existing one-time lead-time job.
4. Add medication reminder configuration UI to the client.

---

## Section 1: Domain & Data Model

### VetVisit entity

Add `type: 'logged' | 'scheduled'` to `VetVisitProps`.

- **`logged`**: `visitDate` = when the visit occurred (past or today). Notes, images, vet details all apply.
- **`scheduled`**: `visitDate` = the appointment date (future). Notes not applicable pre-visit.

`visitDate` remains required on both types.

`nextVisitDate` is **removed** from the entity and the DB. Its role is replaced by the "Also schedule next visit" shortcut in the Add form, which creates a second `VetVisit` with `type: 'scheduled'` in a single API call.

### DB migration

One new column on `vet_visits`:

```sql
ALTER TABLE vet_visits
  ADD COLUMN type VARCHAR(10) NOT NULL DEFAULT 'logged';
```

Existing rows are backfilled as `'logged'` automatically by the column default.

### Reminder linkage for scheduled visits

Scheduled visits support two independent reminder mechanisms:

| Kind | Mechanism | When fired | Configurable? |
|---|---|---|---|
| Lead-time | One-time delayed BullMQ job | 24h before `visitDate` | No — always auto-created |
| Repeating | Cron-based `Reminder` entity (existing infrastructure) | Per user-configured schedule | Yes — via new endpoint |

Both are cancelled when the visit is marked as done.

### "Mark as done" conversion

`PATCH /health/:petId/vet-visits/:visitId/complete`

- Validates visit is `type: 'scheduled'`
- Flips `type` → `'logged'`
- Accepts optional `notes` body field
- Cancels lead-time BullMQ job and cron `Reminder`

---

## Section 2: Backend Use Cases & API

### Modified use cases

**`AddVetVisitUseCase`**

Input changes:
- Remove `nextVisitDate`
- Add `scheduleNextVisit?: { visitDate: Date; vetId?: string; reason?: string }`

Behaviour:
- Derives `type` from `visitDate`: future → `'scheduled'`; past/today → `'logged'`
- If `type === 'scheduled'`: auto-calls `reminderScheduler.scheduleVetVisitReminder()` for the lead-time job
- If `scheduleNextVisit` provided: creates a second `VetVisit` with `type: 'scheduled'` and its own lead-time job in the same operation
- Returns `{ visit: VetVisit; nextVisit?: VetVisit }`

**`UpdateVetVisitUseCase`**

- Removes `nextVisitDate` from updatable fields
- If `visitDate` changes on a `scheduled` visit: reschedules the lead-time BullMQ job

### New use cases

**`CompleteVetVisitUseCase`**

- Validates visit exists, belongs to the requesting user's pet, and `type === 'scheduled'`
- Sets `type = 'logged'`; applies optional `notes`
- Calls `reminderScheduler.cancelVetVisitReminder(visitId)` and `reminderScheduler.cancelReminders(visitId)`
- Saves updated visit

**`ConfigureVetVisitReminderUseCase`**

Mirrors `ConfigureMedicationReminderUseCase` exactly, with `entityType: 'vet_visit'`. Upserts a `Reminder` record for the visit and syncs the cron scheduler.

### API surface

| Method | Path | Handler |
|---|---|---|
| `POST` | `/health/:petId/vet-visits` | Modified — drops `nextVisitDate`, adds `scheduleNextVisit?` |
| `PUT` | `/health/:petId/vet-visits/:visitId` | Modified — drops `nextVisitDate` |
| `PATCH` | `/health/:petId/vet-visits/:visitId/complete` | New — `CompleteVetVisitUseCase` |
| `GET` | `/reminders/vet-visit/:visitId` | New — fetch repeating reminder for a scheduled visit |
| `PUT` | `/reminders/vet-visit/:visitId` | New — `ConfigureVetVisitReminderUseCase` |

Existing `GET /reminders/medication/:medicationId` and `PUT /reminders/medication/:medicationId` are unchanged.

---

## Section 3: Frontend

### `PetDetailPage` — vet visits tab

Two rendering zones, stacked vertically:

**Pinned upcoming banner** (rendered only when `visits.filter(v => v.type === 'scheduled').length > 0`):
- Horizontally scrollable row of chips, sorted by `visitDate` ascending
- Each chip: reason + days-until countdown
- Clicking a chip opens `ScheduledVisitDetailDialog`

**History list** (logged visits, sorted newest-first):
- Existing `ListItemButton` rows
- Remove the urgency bubble (was tied to `nextVisitDate`, now gone)
- Clicking opens the existing `VetVisitDetailDialog`

Single **Add** button on the tab header opens `AddVetVisitDialog`.

---

### `AddVetVisitDialog` (modified)

Single form. Behaviour adapts based on `visitDate`:

**Past/today date → logged visit:**
- Fields: reason (required), vet/clinic, visit date, notes
- "Also schedule next visit" checkbox at the bottom
  - If checked: reveals a second date picker (required) + optional reason override
  - On save: POSTs with `scheduleNextVisit` in body; backend creates both visits

**Future date → scheduled visit:**
- Fields: reason (required), vet/clinic, scheduled date
- Notes field hidden (not applicable pre-visit)
- "Set repeating reminder" collapsible section using `ReminderScheduleEditor`
- Lead-time reminder is created automatically on the backend — no UI needed for it

---

### `ScheduledVisitDetailDialog` (new)

Opened by clicking an upcoming chip. Contents:

- Visit date, reason, vet/clinic (read-only header; editable via existing edit flow)
- **Repeating reminder section**: `ReminderScheduleEditor` — loads existing reminder via `GET /reminders/vet-visit/:visitId`, saves via `PUT /reminders/vet-visit/:visitId`
- **"Mark as done" button**: reveals an inline notes field → confirm → calls `PATCH .../complete` → on success: invalidates `['vet-visits', petId]`, closes dialog

---

### `VetVisitDetailDialog` (minor changes)

- Remove "Schedule next visit" checkbox from the edit form (field no longer exists)
- Everything else unchanged

---

### `MedicationDetailDialog` (new, replaces `EditMedicationDialog`)

Two tabs, same outer `Dialog`:

**Details tab** — exact same fields as current `EditMedicationDialog`:
- Name, dose, unit, frequency, start date, optional end date, notes, active toggle

**Reminder tab**:
- Loads existing reminder via `GET /reminders/medication/:medicationId` on mount
- Renders `ReminderScheduleEditor`
- Auto-saves on change (or explicit Save button — implementation detail)

`MedicationRow` click now opens `MedicationDetailDialog` instead of `EditMedicationDialog`.

---

### `ReminderScheduleEditor` (new shared component)

```ts
interface ReminderScheduleEditorProps {
  enabled: boolean;
  onToggleEnabled: (v: boolean) => void;
  schedule: ReminderScheduleProps | null;
  onChange: (s: ReminderScheduleProps) => void;
  saving: boolean;
}
```

Renders:
1. Enable/disable `Switch`
2. If enabled: schedule type selector (`daily` / `weekly` / `monthly`)
3. Based on type:
   - **daily**: time picker(s) (HH:mm)
   - **weekly**: day-of-week multi-select + time picker(s)
   - **monthly**: day-of-month number input(s) + time picker(s)

Uses the existing `ReminderScheduleProps` discriminated union from `domain/health/value-objects/ReminderSchedule.ts`. Shared between `ScheduledVisitDetailDialog` and `MedicationDetailDialog`.

---

### Type changes (`src/types.ts`)

```ts
// VetVisit — add type, remove nextVisitDate
export interface VetVisit {
  id: string;
  petId: string;
  type: 'logged' | 'scheduled';
  visitDate: string;
  vetId?: string;
  clinic?: string;
  vetName?: string;
  reason: string;
  notes?: string;
  imageUrls: string[];
  createdBy: string;
  createdAt: string;
}

// New
export interface Reminder {
  id: string;
  entityType: 'medication' | 'vet_visit';
  entityId: string;
  schedule: ReminderScheduleProps;
  enabled: boolean;
  notifyUserIds: string[];
}
```

---

## Out of scope

- Cancelling a scheduled visit (can be done by deleting — no cancellation state needed now)
- Group member notification preferences for vet visit reminders
- Push notifications (email only, consistent with existing implementation)
