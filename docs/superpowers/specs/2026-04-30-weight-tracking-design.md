# Weight & Growth Tracking — Design Spec

**Date:** 2026-04-30
**Status:** Approved

---

## Overview

Add per-pet weight tracking: log weight entries over time, visualize trends in a line chart, and manage the log inline within the existing pet health dashboard. Covers the full DDD stack (API) and the React frontend.

---

## Data Model

### `WeightEntry` entity

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | uuid | yes | PK |
| `petId` | uuid | yes | FK → Pet |
| `date` | date (ISO string) | yes | When the weight was recorded |
| `value` | decimal | yes | The weight value |
| `unit` | enum: `kg` \| `lb` | yes | Per-entry — allows mixed unit history |
| `notes` | string | no | Optional context ("vet scale", "after grooming") |
| `createdAt` | timestamp | yes | Auto |

Unit is stored per-entry (not per-user) so historical entries remain accurate if the user switches units later. The frontend normalizes all values to the most recent entry's unit when rendering the chart.

---

## API

All routes are group-scoped — use cases verify the requesting user is a member of the pet's group before performing any operation.

### Routes

| Method | Path | Use Case | Description |
|---|---|---|---|
| `POST` | `/pets/:petId/weight` | `AddWeightEntryUseCase` | Add a new weight entry |
| `GET` | `/pets/:petId/weight` | `ListWeightEntriesUseCase` | List all entries, sorted by date desc |
| `PUT` | `/pets/:petId/weight/:id` | `UpdateWeightEntryUseCase` | Update an existing entry |
| `DELETE` | `/pets/:petId/weight/:id` | `DeleteWeightEntryUseCase` | Delete an entry |

### Request/Response shapes

**POST / PUT body:**
```json
{
  "date": "2026-04-30",
  "value": 4.2,
  "unit": "kg",
  "notes": "after morning meal"
}
```

**GET response:**
```json
[
  { "id": "...", "petId": "...", "date": "2026-04-30", "value": 4.2, "unit": "kg", "notes": "..." }
]
```

---

## Architecture — DDD Layers

### Domain (`src/domain/`)

- `WeightEntry.ts` — entity class with id, petId, date, value, unit, notes
- `IWeightEntryRepository.ts` — interface: `save`, `findByPetId`, `findById`, `delete`
- Token constant: `WEIGHT_ENTRY_REPOSITORY`

### Application (`src/application/`)

- `AddWeightEntryUseCase.ts` — validates petId belongs to user's group, creates and saves entry
- `ListWeightEntriesUseCase.ts` — fetches all entries for petId, sorted by date desc
- `UpdateWeightEntryUseCase.ts` — verifies ownership, updates fields
- `DeleteWeightEntryUseCase.ts` — verifies ownership, deletes entry

### Infrastructure (`src/infrastructure/`)

- `db/WeightEntryModel.ts` — Sequelize model matching the entity fields
- `db/SequelizeWeightEntryRepository.ts` — implements `IWeightEntryRepository`
- `http/WeightController.ts` — Express controller wiring the 4 routes to use cases
- `mappers/WeightEntryMapper.ts` — domain ↔ persistence mapping

### DI

`container.ts` binds `WEIGHT_ENTRY_REPOSITORY` token → `SequelizeWeightEntryRepository`.

---

## Frontend

### Chart library

Install **Recharts** (`pnpm add recharts`). Lightweight, React-first, composable — no existing chart library in the project.

### New files (`src/`)

- `api/weight.ts` — axios query/mutation hooks:
  - `useWeightEntries(petId)` — fetch list
  - `useAddWeightEntry()` — mutation
  - `useUpdateWeightEntry()` — mutation
  - `useDeleteWeightEntry()` — mutation
- `components/WeightChart.tsx` — Recharts `LineChart` with tooltip showing value + notes
- `components/WeightEntryDialog.tsx` — add/edit dialog (date, value, unit toggle, notes)
- `components/WeightSection.tsx` — section container: chart + log list + dialog trigger

### UI layout (within pet health dashboard)

1. **WeightChart** — line chart, x-axis = date, y-axis = weight. All values normalized to the most recent entry's unit for display. Tooltip on hover: date, value, unit, notes.
2. **Add Weight button** — opens `WeightEntryDialog` (same pattern as medication/vet visit dialogs). Fields: date (date picker), value (number input), unit (kg/lb toggle), notes (optional text).
3. **Weight log list** — scrollable list of all entries newest-first. Each row: date, value+unit, notes (truncated), edit/delete icon buttons. Infinite scroll consistent with rest of app.

### Unit normalization logic

When rendering the chart, convert all entries to the unit of the most recent entry:
- kg → lb: multiply by 2.20462
- lb → kg: divide by 2.20462

The log list always displays the original recorded unit per entry.

---

## Out of Scope

- Weight reminders/goals (can be added later)
- Target weight or healthy range overlays on the chart
- Export/PDF of weight history
