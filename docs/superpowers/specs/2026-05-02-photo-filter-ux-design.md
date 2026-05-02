# Photo Timeline Filter UX Redesign

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the confusing two-row chip filter with a unified toolbar strip that uses icon toggles for source type and an avatar-button dropdown for pet selection, and move source type filtering server-side.

**Architecture:** New `FilterToolbar` component encapsulates all filter state. API gains `sourceTypes` query param on both timeline and years endpoints. Filter state semantics invert from "selected = include" to "excluded = hide" (empty exclusion set = show all).

**Tech Stack:** React, MUI v9, TanStack Query, Express/routing-controllers, Zod, Sequelize/PostgreSQL

---

## UI Design

### Filter Toolbar (new `FilterToolbar.tsx` component)

A single unified horizontal strip replaces the two unlabeled chip rows. Three zones:

**Left — Pet filter button**
- Default label: `🐾 All pets ▾`
- When some pets excluded: shows included pet names, e.g. `🐾 Milo ▾`
- Clicking opens a MUI Popover anchored to the button containing avatar toggle buttons — one per pet
- Avatar buttons: circular initial badge (color assigned by index from a fixed palette: indigo, pink, teal, amber…), pet name below, all active (highlighted border) by default
- Click a pet avatar to exclude it (dims to low opacity, border removed)

**Center — Source type icon toggles**
- Four icon buttons inline: 🏥 Vet · 📝 Notes · ⚖️ Weight · 📷 Uploads
- All active by default (color + subtle glow/shadow)
- Click any to exclude (grayscale + opacity 0.35)
- No label text — icons are self-explanatory; tooltips via MUI `Tooltip` for accessibility

**Right — Year navigation**
- `‹ 2026 ›` unchanged from current implementation

### State semantics (inversion from current)

| | Current | New |
|---|---|---|
| Default state | nothing selected = show all | nothing excluded = show all |
| User action | click to include | click to exclude |
| Mental model | "show only these" | "hide these" |

The new model is less surprising: the page opens showing everything, and users opt out of categories they don't want.

### No summary hint text

The icon active/inactive visual state is sufficient feedback. No "Showing: X, Y, Z" text is needed.

---

## API Changes

### `src/domain/photo/PhotoRepository.ts`
Add `sourceTypes?: PhotoSourceType[]` to the `GetTimelineOptions` interface (or equivalent parameter type for `getTimeline`).

### `src/infrastructure/db/repositories/SequelizePhotoRepository.ts`
In `getTimeline()`: when `sourceTypes` is provided and non-empty, add a `WHERE source_type = ANY(:sourceTypes)` clause (Sequelize: `where: { source_type: { [Op.in]: sourceTypes } }`).

### `src/application/photo/GetPhotoTimelineUseCase.ts`
Accept `sourceTypes?: PhotoSourceType[]` in the execute input. Pass through to repo.

### `src/application/photo/GetPhotoYearsUseCase.ts`
Accept `sourceTypes?: PhotoSourceType[]` in the execute input. Pass through to repo so year availability reflects the active filter.

### `src/infrastructure/http/schemas/photoSchemas.ts`
Add `sourceTypes` to `PhotoTimelineQuerySchema` and `PhotoYearsQuerySchema`:
```typescript
sourceTypes: z
  .union([z.enum(['standalone','vet-visit','note','weight-entry']), z.array(z.enum([...]))])
  .optional()
  .transform((v) => (v ? (Array.isArray(v) ? v : [v]) : undefined)),
```

### `src/infrastructure/http/controllers/PhotoController.ts`
Pass `sourceTypes` from validated query to both `getPhotoTimeline.execute()` and `getPhotoYears.execute()`.

---

## Client Changes

### `src/api/photos.ts`
- `usePhotoTimeline(year, petIds?, sourceTypes?)`: include `sourceTypes` in query params as `params['sourceTypes[]']` (same pattern as petIds). Include `sourceTypes` in the React Query key.
- `usePhotoYears(petIds?, sourceTypes?)`: same treatment.

### `src/pages/photos/FilterToolbar.tsx` (new file)
Props:
```typescript
interface FilterToolbarProps {
  pets: Pet[];
  excludedPets: string[];
  excludedTypes: PhotoSourceType[];
  year: number;
  minYear: number;
  maxYear: number;
  loading: boolean;
  onTogglePet: (petId: string) => void;
  onToggleType: (type: PhotoSourceType) => void;
  onYearChange: (year: number) => void;
}
```

Renders the three-zone strip. Manages pet popover open/close state internally. Uses MUI `Popover`, `IconButton`, `Tooltip`.

Source type icons mapped to MUI icons (or emoji fallback):
- `vet-visit` → `LocalHospital` icon
- `note` → `Notes` icon  
- `weight-entry` → `FitnessCenter` icon
- `standalone` → `PhotoCamera` icon

### `src/pages/photos/PhotosPage.tsx`
- Replace `petFilter: string[]` + `sourceFilter: string[]` state with `excludedPets: string[]` + `excludedTypes: PhotoSourceType[]` (both default `[]`)
- Derive `activePetIds = pets.filter(p => !excludedPets.includes(p.id)).map(p => p.id)` — pass to hooks only when it doesn't equal the full pet list
- Derive `activeSourceTypes = ALL_SOURCE_TYPES.filter(t => !excludedTypes.includes(t))` — pass to hooks only when not all types included
- Remove client-side `filteredTimeline` computation entirely — pass `timeline` directly to `YearScrapbook` and `MonthGrid`
- Replace two chip row JSX blocks with `<FilterToolbar ... />`

---

## Out of Scope
- Persisting filter state to localStorage or URL params
- Animating the toolbar popover
- Pet avatar photos (initials only for now)
