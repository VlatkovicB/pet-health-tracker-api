# Notes Feature Design

**Date:** 2026-04-24
**Status:** Approved

## Overview

A freeform Notes feature that allows users to log dated journal entries optionally tagged to one or more pets. Notes appear on the calendar and in a dedicated Notes tab on each pet's detail page.

---

## Requirements

- A note has: title (required), description (optional), date (required, date-only), images (optional), pet tags (optional, 0 or more), creator (auto from auth user).
- Notes are always dated and always appear on the calendar.
- Notes are scoped to the authenticated user (`user_id`).
- Notes can tag zero or more pets. When tagged, the note appears in those pets' Notes tab.
- Images can be attached at create time or added later via edit.
- Notes are editable and deletable. Deletion requires a confirmation dialog.

---

## Data Model

### `notes` table

| column | type | notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK → users | scoped to user, same as pets |
| `title` | VARCHAR NOT NULL | |
| `description` | TEXT | optional |
| `note_date` | DATE NOT NULL | date-only (no time component) |
| `image_urls` | JSONB default `[]` | same pattern as `vet_visits.image_urls` |
| `created_at` | TIMESTAMP | |

### `note_pet_tags` table (join table)

| column | type | notes |
|---|---|---|
| `note_id` | UUID FK → notes | composite PK with `pet_id` |
| `pet_id` | UUID FK → pets | composite PK with `note_id` |

Pet tags are replaced wholesale on update (delete existing rows, insert new ones).

---

## Backend Architecture

### New files

```
domain/note/
  Note.ts                         # Entity: title, description, noteDate, petIds[], imageUrls[], createdBy
  NoteRepository.ts               # Interface + NOTE_REPOSITORY token

application/note/
  CreateNoteUseCase.ts
  ListNotesUseCase.ts             # accepts optional petId, from, to params
  UpdateNoteUseCase.ts
  DeleteNoteUseCase.ts
  AddNoteImageUseCase.ts

infrastructure/
  db/models/
    NoteModel.ts
    NotePetTagModel.ts
  db/repositories/
    SequelizeNoteRepository.ts    # findByPetId JOINs note_pet_tags
  mappers/
    NoteMapper.ts
  http/
    controllers/NoteController.ts
    routes/noteRoutes.ts
  http/middleware/upload.ts       # add uploadNoteImage (dir: uploads/notes)
```

### Routes — mounted at `/notes`

| method | path | use case | notes |
|---|---|---|---|
| `POST` | `/notes` | CreateNoteUseCase | body: title, description?, noteDate, petIds? |
| `GET` | `/notes` | ListNotesUseCase | query: `petId?`, `from?`, `to?` |
| `PUT` | `/notes/:noteId` | UpdateNoteUseCase | body: title?, description?, noteDate?, petIds? |
| `DELETE` | `/notes/:noteId` | DeleteNoteUseCase | |
| `POST` | `/notes/:noteId/images` | AddNoteImageUseCase | multipart: `image` |

All routes protected by `authMiddleware`. `userId` from `req.user`.

### `container.ts`

One new line:
```ts
Container.set(NOTE_REPOSITORY, Container.get(SequelizeNoteRepository));
```

---

## Frontend Architecture

### Types (`src/types/index.ts`)

```ts
export interface Note {
  id: string;
  userId: string;
  title: string;
  description?: string;
  noteDate: string;        // date-only ISO string e.g. "2026-04-24"
  petIds: string[];
  imageUrls: string[];
  createdAt: string;
}
```

`CalendarEvent` union gets a new variant:

```ts
| { kind: 'note'; id: string; noteDate: string; title: string; petIds: string[] }
```

### New files

```
src/api/notes.ts           # create, list, update, delete, uploadImage
src/components/
  NoteFormDialog.tsx        # create/edit: title, date, description, pet multi-select, image upload
  NoteDetailDialog.tsx      # view + inline edit + delete with confirmation dialog
```

### PetDetailPage changes

- Add `'notes'` to the `TabValue` union.
- Add a Notes tab rendered after Medications.
- Notes tab fetches `GET /notes?petId=:petId` (infinite scroll, same sentinel pattern).
- Each note card shows: title, date, pet tag chips, description preview (truncated), image thumbnails.
- Add button opens `NoteFormDialog` with the current pet pre-selected.
- Clicking a card opens `NoteDetailDialog`.

### CalendarPage changes

- Add a `GET /notes?from=&to=` query (alongside existing vet-visit and medication queries).
- `toCalendarEvents` extended to map notes to `kind: 'note'` events.
- Notes appear on calendar days as a distinct chip/dot (neutral color — notes may have no pet or multiple pets).
- `DayDetailModal` gets an "Add Note" button that opens `NoteFormDialog` with the selected date pre-filled.

### NoteFormDialog

Fields: title (required), date (date picker, defaults to today/selected day), description (multiline optional), pet tags (multi-select chips from the user's pet list). Images are not uploaded at create time — they are added via the detail dialog after the note is saved (same two-step pattern as VetVisit).

### NoteDetailDialog

- View mode: shows all fields, pet tag chips, image grid, "Add photo" button.
- Edit mode: same inline-edit pattern as `VetVisitDetailDialog` (pencil icon toggles form, save prompts confirmation).
- Delete button: opens a confirmation dialog before calling `DELETE /notes/:noteId`.

---

## Error Handling

- 404 if note not found or belongs to a different user.
- 403 if attempting to tag a pet that doesn't belong to the user.
- Image upload: 10 MB limit, image types only (reuses existing `fileFilter`).

---

## Out of Scope

- Reminders/notifications for notes.
- Sharing notes between users.
- Rich text / markdown in descriptions.
