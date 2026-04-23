# Notes Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Notes feature — dated, freeform journal entries optionally tagged to pets — visible on the calendar and in a Notes tab on each pet's detail page.

**Architecture:** Standalone `Note` domain entity scoped to `user_id`, with a `note_pet_tags` join table for multi-pet tagging. Backend: new `/notes` REST resource following existing DDD + typedi patterns. Frontend: new Notes tab in `PetDetailPage`, `kind: 'note'` calendar events, and a "Add Note" entry point in `DayDetailModal`.

**Tech Stack:** TypeScript, Express, Sequelize (sequelize-typescript), PostgreSQL, typedi, React, MUI v6, TanStack React Query, date-fns

**Spec:** `docs/superpowers/specs/2026-04-24-notes-design.md`

---

## File Map

### API (pet-health-tracker-api)

**Create:**
- `src/domain/note/Note.ts`
- `src/domain/note/NoteRepository.ts`
- `src/application/note/CreateNoteUseCase.ts`
- `src/application/note/ListNotesUseCase.ts`
- `src/application/note/UpdateNoteUseCase.ts`
- `src/application/note/DeleteNoteUseCase.ts`
- `src/application/note/AddNoteImageUseCase.ts`
- `src/infrastructure/db/models/NoteModel.ts`
- `src/infrastructure/db/models/NotePetTagModel.ts`
- `src/infrastructure/db/repositories/SequelizeNoteRepository.ts`
- `src/infrastructure/mappers/NoteMapper.ts`
- `src/infrastructure/http/controllers/NoteController.ts`
- `src/infrastructure/http/routes/noteRoutes.ts`

**Modify:**
- `src/infrastructure/db/database.ts` — add NoteModel, NotePetTagModel to models array
- `src/infrastructure/http/middleware/upload.ts` — add `uploadNoteImage`
- `src/infrastructure/http/routes/index.ts` — register `/notes` routes
- `src/container.ts` — wire NOTE_REPOSITORY

### Client (pet-health-tracker-client)

**Create:**
- `src/api/notes.ts`
- `src/components/NoteFormDialog.tsx`
- `src/components/NoteDetailDialog.tsx`

**Modify:**
- `src/types/index.ts` — add `Note` interface and `kind: 'note'` CalendarEvent variant
- `src/pages/health/PetDetailPage.tsx` — add Notes tab
- `src/pages/calendar/CalendarPage.tsx` — add notes query and event building
- `src/components/DayDetailModal.tsx` — add "Add Note" section

---

## Task 1: Domain Entity + Repository Interface

**Files:**
- Create: `src/domain/note/Note.ts`
- Create: `src/domain/note/NoteRepository.ts`

- [ ] **Step 1: Create the Note entity**

```ts
// src/domain/note/Note.ts
import { Entity } from '../shared/Entity';
import { UniqueEntityId } from '../shared/UniqueEntityId';

interface NoteProps {
  userId: string;
  title: string;
  description?: string;
  noteDate: string; // 'YYYY-MM-DD'
  petIds: string[];
  imageUrls: string[];
  createdAt: Date;
}

export class Note extends Entity<NoteProps> {
  get userId(): string { return this.props.userId; }
  get title(): string { return this.props.title; }
  get description(): string | undefined { return this.props.description; }
  get noteDate(): string { return this.props.noteDate; }
  get petIds(): string[] { return this.props.petIds; }
  get imageUrls(): string[] { return this.props.imageUrls; }
  get createdAt(): Date { return this.props.createdAt; }

  static create(props: Omit<NoteProps, 'createdAt' | 'imageUrls'>, id?: UniqueEntityId): Note {
    return new Note({ ...props, imageUrls: [], createdAt: new Date() }, id);
  }

  static reconstitute(props: NoteProps, id: UniqueEntityId): Note {
    return new Note(props, id);
  }

  static addImage(existing: Note, imageUrl: string): Note {
    return Note.reconstitute(
      { ...existing.props, imageUrls: [...existing.imageUrls, imageUrl] },
      existing.id,
    );
  }
}
```

- [ ] **Step 2: Create the NoteRepository interface**

```ts
// src/domain/note/NoteRepository.ts
import { Note } from './Note';

export const NOTE_REPOSITORY = 'NoteRepository';

export interface NoteRepository {
  save(note: Note): Promise<Note>;
  findById(id: string): Promise<Note | null>;
  findByUserId(
    userId: string,
    filters?: { petId?: string; from?: string; to?: string },
  ): Promise<Note[]>;
  delete(id: string): Promise<void>;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/domain/note/
git commit -m "feat(notes): add Note domain entity and repository interface"
```

---

## Task 2: Sequelize Models

**Files:**
- Create: `src/infrastructure/db/models/NoteModel.ts`
- Create: `src/infrastructure/db/models/NotePetTagModel.ts`
- Modify: `src/infrastructure/db/database.ts`

- [ ] **Step 1: Create NoteModel**

```ts
// src/infrastructure/db/models/NoteModel.ts
import { BelongsTo, Column, DataType, ForeignKey, HasMany, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { UserModel } from './UserModel';
import { NotePetTagModel } from './NotePetTagModel';

@Table({ tableName: 'notes', timestamps: false })
export class NoteModel extends Model {
  @PrimaryKey
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => UserModel)
  @Column({ type: DataType.UUID, allowNull: false, field: 'user_id' })
  declare userId: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare title: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare description: string | null;

  @Column({ type: DataType.DATEONLY, allowNull: false, field: 'note_date' })
  declare noteDate: string;

  @Column({ type: DataType.JSONB, allowNull: false, defaultValue: [], field: 'image_urls' })
  declare imageUrls: string[];

  @Column({ type: DataType.DATE, allowNull: false, field: 'created_at' })
  declare createdAt: Date;

  @BelongsTo(() => UserModel)
  declare user: UserModel;

  @HasMany(() => NotePetTagModel)
  declare petTags: NotePetTagModel[];
}
```

- [ ] **Step 2: Create NotePetTagModel**

```ts
// src/infrastructure/db/models/NotePetTagModel.ts
import { BelongsTo, Column, DataType, ForeignKey, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { NoteModel } from './NoteModel';
import { PetModel } from './PetModel';

@Table({ tableName: 'note_pet_tags', timestamps: false })
export class NotePetTagModel extends Model {
  @PrimaryKey
  @ForeignKey(() => NoteModel)
  @Column({ type: DataType.UUID, field: 'note_id' })
  declare noteId: string;

  @PrimaryKey
  @ForeignKey(() => PetModel)
  @Column({ type: DataType.UUID, field: 'pet_id' })
  declare petId: string;

  @BelongsTo(() => NoteModel)
  declare note: NoteModel;

  @BelongsTo(() => PetModel)
  declare pet: PetModel;
}
```

- [ ] **Step 3: Register models in database.ts**

Add two imports and two entries to the models array:

```ts
// Add after the existing ReminderNotifyUserModel import:
import { NoteModel } from './models/NoteModel';
import { NotePetTagModel } from './models/NotePetTagModel';

// Add to the models array:
    NoteModel,
    NotePetTagModel,
```

The full models array becomes:
```ts
  models: [
    UserModel,
    PetModel,
    VetModel,
    VetWorkHoursModel,
    VetVisitModel,
    MedicationModel,
    ReminderModel,
    ReminderNotifyUserModel,
    NoteModel,
    NotePetTagModel,
  ],
```

- [ ] **Step 4: Create the DB tables**

Run in psql or your preferred client:
```sql
CREATE TABLE notes (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  title VARCHAR NOT NULL,
  description TEXT,
  note_date DATE NOT NULL,
  image_urls JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP NOT NULL
);

CREATE TABLE note_pet_tags (
  note_id UUID NOT NULL REFERENCES notes(id),
  pet_id UUID NOT NULL REFERENCES pets(id),
  PRIMARY KEY (note_id, pet_id)
);
```

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/db/models/NoteModel.ts src/infrastructure/db/models/NotePetTagModel.ts src/infrastructure/db/database.ts
git commit -m "feat(notes): add NoteModel, NotePetTagModel, register in sequelize"
```

---

## Task 3: NoteMapper

**Files:**
- Create: `src/infrastructure/mappers/NoteMapper.ts`

- [ ] **Step 1: Create NoteMapper**

```ts
// src/infrastructure/mappers/NoteMapper.ts
import { Service } from 'typedi';
import { Note } from '../../domain/note/Note';
import { UniqueEntityId } from '../../domain/shared/UniqueEntityId';
import { NoteModel } from '../db/models/NoteModel';
import { NotePetTagModel } from '../db/models/NotePetTagModel';

export interface NoteResponseDto {
  id: string;
  userId: string;
  title: string;
  description?: string;
  noteDate: string;
  petIds: string[];
  imageUrls: string[];
  createdAt: string;
}

@Service()
export class NoteMapper {
  toDomain(model: NoteModel): Note {
    return Note.reconstitute(
      {
        userId: model.userId,
        title: model.title,
        description: model.description ?? undefined,
        noteDate: model.noteDate,
        petIds: (model.petTags ?? []).map((t: NotePetTagModel) => t.petId),
        imageUrls: model.imageUrls ?? [],
        createdAt: model.createdAt,
      },
      new UniqueEntityId(model.id),
    );
  }

  toResponse(note: Note): NoteResponseDto {
    return {
      id: note.id.toValue(),
      userId: note.userId,
      title: note.title,
      description: note.description,
      noteDate: note.noteDate,
      petIds: note.petIds,
      imageUrls: note.imageUrls,
      createdAt: note.createdAt.toISOString(),
    };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/infrastructure/mappers/NoteMapper.ts
git commit -m "feat(notes): add NoteMapper"
```

---

## Task 4: SequelizeNoteRepository

**Files:**
- Create: `src/infrastructure/db/repositories/SequelizeNoteRepository.ts`
- Modify: `src/container.ts`

- [ ] **Step 1: Create the repository**

```ts
// src/infrastructure/db/repositories/SequelizeNoteRepository.ts
import { Service } from 'typedi';
import { Op } from 'sequelize';
import { Note } from '../../../domain/note/Note';
import { NoteRepository } from '../../../domain/note/NoteRepository';
import { NoteModel } from '../models/NoteModel';
import { NotePetTagModel } from '../models/NotePetTagModel';
import { NoteMapper } from '../../mappers/NoteMapper';

@Service()
export class SequelizeNoteRepository implements NoteRepository {
  constructor(private readonly noteMapper: NoteMapper) {}

  async save(note: Note): Promise<Note> {
    const id = note.id.toValue();
    await NoteModel.upsert({
      id,
      userId: note.userId,
      title: note.title,
      description: note.description ?? null,
      noteDate: note.noteDate,
      imageUrls: note.imageUrls,
      createdAt: note.createdAt,
    });
    await NotePetTagModel.destroy({ where: { noteId: id } });
    if (note.petIds.length > 0) {
      await NotePetTagModel.bulkCreate(
        note.petIds.map((petId) => ({ noteId: id, petId })),
      );
    }
    return (await this.findById(id))!;
  }

  async findById(id: string): Promise<Note | null> {
    const model = await NoteModel.findByPk(id, {
      include: [{ model: NotePetTagModel }],
    });
    return model ? this.noteMapper.toDomain(model) : null;
  }

  async findByUserId(
    userId: string,
    filters: { petId?: string; from?: string; to?: string } = {},
  ): Promise<Note[]> {
    const where: Record<string, unknown> = { userId };
    if (filters.from || filters.to) {
      where.noteDate = {
        ...(filters.from ? { [Op.gte]: filters.from } : {}),
        ...(filters.to ? { [Op.lte]: filters.to } : {}),
      };
    }
    const models = await NoteModel.findAll({
      where,
      include: [{ model: NotePetTagModel }],
      order: [['note_date', 'DESC']],
    });
    const notes = models.map((m) => this.noteMapper.toDomain(m));
    if (filters.petId) {
      return notes.filter((n) => n.petIds.includes(filters.petId!));
    }
    return notes;
  }

  async delete(id: string): Promise<void> {
    await NotePetTagModel.destroy({ where: { noteId: id } });
    await NoteModel.destroy({ where: { id } });
  }
}
```

- [ ] **Step 2: Wire repository in container.ts**

Add import and registration:

```ts
// Add import after existing SequelizeReminderRepository import:
import { SequelizeNoteRepository } from './infrastructure/db/repositories/SequelizeNoteRepository';
import { NOTE_REPOSITORY } from './domain/note/NoteRepository';

// Add to registerDependencies():
  Container.set(NOTE_REPOSITORY, Container.get(SequelizeNoteRepository));
```

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/db/repositories/SequelizeNoteRepository.ts src/container.ts
git commit -m "feat(notes): add SequelizeNoteRepository, wire in container"
```

---

## Task 5: Use Cases

**Files:**
- Create: `src/application/note/CreateNoteUseCase.ts`
- Create: `src/application/note/ListNotesUseCase.ts`
- Create: `src/application/note/UpdateNoteUseCase.ts`
- Create: `src/application/note/DeleteNoteUseCase.ts`
- Create: `src/application/note/AddNoteImageUseCase.ts`

- [ ] **Step 1: CreateNoteUseCase**

```ts
// src/application/note/CreateNoteUseCase.ts
import { Inject, Service } from 'typedi';
import { Note } from '../../domain/note/Note';
import { NoteRepository, NOTE_REPOSITORY } from '../../domain/note/NoteRepository';

interface CreateNoteInput {
  userId: string;
  title: string;
  description?: string;
  noteDate: string;
  petIds?: string[];
}

@Service()
export class CreateNoteUseCase {
  constructor(@Inject(NOTE_REPOSITORY) private readonly noteRepo: NoteRepository) {}

  async execute(input: CreateNoteInput): Promise<Note> {
    const note = Note.create({
      userId: input.userId,
      title: input.title,
      description: input.description,
      noteDate: input.noteDate,
      petIds: input.petIds ?? [],
    });
    return this.noteRepo.save(note);
  }
}
```

- [ ] **Step 2: ListNotesUseCase**

```ts
// src/application/note/ListNotesUseCase.ts
import { Inject, Service } from 'typedi';
import { Note } from '../../domain/note/Note';
import { NoteRepository, NOTE_REPOSITORY } from '../../domain/note/NoteRepository';

interface ListNotesInput {
  userId: string;
  petId?: string;
  from?: string;
  to?: string;
}

@Service()
export class ListNotesUseCase {
  constructor(@Inject(NOTE_REPOSITORY) private readonly noteRepo: NoteRepository) {}

  async execute(input: ListNotesInput): Promise<Note[]> {
    return this.noteRepo.findByUserId(input.userId, {
      petId: input.petId,
      from: input.from,
      to: input.to,
    });
  }
}
```

- [ ] **Step 3: UpdateNoteUseCase**

```ts
// src/application/note/UpdateNoteUseCase.ts
import { Inject, Service } from 'typedi';
import { Note } from '../../domain/note/Note';
import { NoteRepository, NOTE_REPOSITORY } from '../../domain/note/NoteRepository';
import { NotFoundError } from '../../shared/errors/AppError';

interface UpdateNoteInput {
  noteId: string;
  userId: string;
  title?: string;
  description?: string;
  noteDate?: string;
  petIds?: string[];
}

@Service()
export class UpdateNoteUseCase {
  constructor(@Inject(NOTE_REPOSITORY) private readonly noteRepo: NoteRepository) {}

  async execute(input: UpdateNoteInput): Promise<Note> {
    const note = await this.noteRepo.findById(input.noteId);
    if (!note || note.userId !== input.userId) throw new NotFoundError('Note');

    const updated = Note.reconstitute(
      {
        userId: note.userId,
        title: input.title ?? note.title,
        description: input.description !== undefined ? (input.description || undefined) : note.description,
        noteDate: input.noteDate ?? note.noteDate,
        petIds: input.petIds ?? note.petIds,
        imageUrls: note.imageUrls,
        createdAt: note.createdAt,
      },
      note.id,
    );
    return this.noteRepo.save(updated);
  }
}
```

- [ ] **Step 4: DeleteNoteUseCase**

```ts
// src/application/note/DeleteNoteUseCase.ts
import { Inject, Service } from 'typedi';
import { NoteRepository, NOTE_REPOSITORY } from '../../domain/note/NoteRepository';
import { NotFoundError } from '../../shared/errors/AppError';

@Service()
export class DeleteNoteUseCase {
  constructor(@Inject(NOTE_REPOSITORY) private readonly noteRepo: NoteRepository) {}

  async execute(noteId: string, userId: string): Promise<void> {
    const note = await this.noteRepo.findById(noteId);
    if (!note || note.userId !== userId) throw new NotFoundError('Note');
    await this.noteRepo.delete(noteId);
  }
}
```

- [ ] **Step 5: AddNoteImageUseCase**

```ts
// src/application/note/AddNoteImageUseCase.ts
import { Inject, Service } from 'typedi';
import { Note } from '../../domain/note/Note';
import { NoteRepository, NOTE_REPOSITORY } from '../../domain/note/NoteRepository';
import { NotFoundError } from '../../shared/errors/AppError';

@Service()
export class AddNoteImageUseCase {
  constructor(@Inject(NOTE_REPOSITORY) private readonly noteRepo: NoteRepository) {}

  async execute(noteId: string, userId: string, imageUrl: string): Promise<Note> {
    const note = await this.noteRepo.findById(noteId);
    if (!note || note.userId !== userId) throw new NotFoundError('Note');
    const updated = Note.addImage(note, imageUrl);
    return this.noteRepo.save(updated);
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add src/application/note/
git commit -m "feat(notes): add all Note use cases"
```

---

## Task 6: Upload Middleware + NoteController + Routes

**Files:**
- Modify: `src/infrastructure/http/middleware/upload.ts`
- Create: `src/infrastructure/http/controllers/NoteController.ts`
- Create: `src/infrastructure/http/routes/noteRoutes.ts`
- Modify: `src/infrastructure/http/routes/index.ts`

- [ ] **Step 1: Add uploadNoteImage to upload.ts**

Append to the end of `src/infrastructure/http/middleware/upload.ts`:

```ts
export const uploadNoteImage = multer({
  storage: makeStorage(path.join(process.cwd(), 'uploads', 'notes')),
  fileFilter,
  limits,
});
```

- [ ] **Step 2: Create NoteController**

```ts
// src/infrastructure/http/controllers/NoteController.ts
import { Request, Response, NextFunction } from 'express';
import { Service } from 'typedi';
import { CreateNoteUseCase } from '../../../application/note/CreateNoteUseCase';
import { ListNotesUseCase } from '../../../application/note/ListNotesUseCase';
import { UpdateNoteUseCase } from '../../../application/note/UpdateNoteUseCase';
import { DeleteNoteUseCase } from '../../../application/note/DeleteNoteUseCase';
import { AddNoteImageUseCase } from '../../../application/note/AddNoteImageUseCase';
import { NoteMapper } from '../../mappers/NoteMapper';

@Service()
export class NoteController {
  constructor(
    private readonly createNote: CreateNoteUseCase,
    private readonly listNotes: ListNotesUseCase,
    private readonly updateNote: UpdateNoteUseCase,
    private readonly deleteNote: DeleteNoteUseCase,
    private readonly addNoteImage: AddNoteImageUseCase,
    private readonly noteMapper: NoteMapper,
  ) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const note = await this.createNote.execute({
        userId: req.auth.userId,
        title: req.body.title,
        description: req.body.description,
        noteDate: req.body.noteDate,
        petIds: req.body.petIds,
      });
      res.status(201).json(this.noteMapper.toResponse(note));
    } catch (err) {
      next(err);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const notes = await this.listNotes.execute({
        userId: req.auth.userId,
        petId: req.query.petId as string | undefined,
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined,
      });
      res.json(notes.map((n) => this.noteMapper.toResponse(n)));
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const note = await this.updateNote.execute({
        noteId: req.params.noteId,
        userId: req.auth.userId,
        title: req.body.title,
        description: req.body.description,
        noteDate: req.body.noteDate,
        petIds: req.body.petIds,
      });
      res.json(this.noteMapper.toResponse(note));
    } catch (err) {
      next(err);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.deleteNote.execute(req.params.noteId, req.auth.userId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  uploadImage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.file) { res.status(400).json({ message: 'No file uploaded' }); return; }
      const imageUrl = `/uploads/notes/${req.file.filename}`;
      const note = await this.addNoteImage.execute(req.params.noteId, req.auth.userId, imageUrl);
      res.json(this.noteMapper.toResponse(note));
    } catch (err) {
      next(err);
    }
  };
}
```

- [ ] **Step 3: Create noteRoutes.ts**

```ts
// src/infrastructure/http/routes/noteRoutes.ts
import { Router } from 'express';
import { Container } from 'typedi';
import { NoteController } from '../controllers/NoteController';
import { authMiddleware } from '../middleware/authMiddleware';
import { uploadNoteImage } from '../middleware/upload';

export function noteRoutes(): Router {
  const router = Router();
  const controller = Container.get(NoteController);

  router.get('/', authMiddleware, controller.list);
  router.post('/', authMiddleware, controller.create);
  router.put('/:noteId', authMiddleware, controller.update);
  router.delete('/:noteId', authMiddleware, controller.delete);
  router.post('/:noteId/images', authMiddleware, uploadNoteImage.single('image'), controller.uploadImage);

  return router;
}
```

- [ ] **Step 4: Register routes in index.ts**

Add import and route registration to `src/infrastructure/http/routes/index.ts`:

```ts
// Add import:
import { noteRoutes } from './noteRoutes';

// Add inside buildRouter(), after the existing router.use calls:
  router.use('/notes', noteRoutes());
```

- [ ] **Step 5: Verify the API compiles and starts**

```bash
pnpm build
```

Expected: no TypeScript errors.

```bash
pnpm dev
```

Test with curl (replace TOKEN with a valid JWT from login):

```bash
# Create a note
curl -X POST http://localhost:3000/api/v1/notes \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"First note","noteDate":"2026-04-24","petIds":[]}'
# Expected: 201 with note JSON

# List notes
curl http://localhost:3000/api/v1/notes \
  -H "Authorization: Bearer TOKEN"
# Expected: 200 with array containing the note

# List notes for a date range
curl "http://localhost:3000/api/v1/notes?from=2026-04-01&to=2026-04-30" \
  -H "Authorization: Bearer TOKEN"
# Expected: 200 with array

# Delete the note (replace NOTE_ID)
curl -X DELETE http://localhost:3000/api/v1/notes/NOTE_ID \
  -H "Authorization: Bearer TOKEN"
# Expected: 204
```

- [ ] **Step 6: Commit**

```bash
git add src/infrastructure/http/middleware/upload.ts \
        src/infrastructure/http/controllers/NoteController.ts \
        src/infrastructure/http/routes/noteRoutes.ts \
        src/infrastructure/http/routes/index.ts
git commit -m "feat(notes): add NoteController, noteRoutes, uploadNoteImage middleware"
```

---

## Task 7: Frontend Types + API Module

**Files:**
- Modify: `src/types/index.ts` (pet-health-tracker-client)
- Create: `src/api/notes.ts`

- [ ] **Step 1: Add Note type and CalendarEvent variant to types/index.ts**

Add the `Note` interface after the existing `Vet` interface:

```ts
export interface Note {
  id: string;
  userId: string;
  title: string;
  description?: string;
  noteDate: string;
  petIds: string[];
  imageUrls: string[];
  createdAt: string;
}
```

Add the `kind: 'note'` variant to the `CalendarEvent` union (append before the closing `;`):

```ts
  | {
      kind: 'note';
      id: string;
      noteDate: string;
      title: string;
      petIds: string[];
    };
```

- [ ] **Step 2: Create the notes API module**

```ts
// src/api/notes.ts
import { apiClient } from './client';
import type { Note } from '../types';

interface CreateNoteInput {
  title: string;
  noteDate: string;
  description?: string;
  petIds?: string[];
}

interface UpdateNoteInput {
  title?: string;
  noteDate?: string;
  description?: string;
  petIds?: string[];
}

interface ListNotesParams {
  petId?: string;
  from?: string;
  to?: string;
}

export const notesApi = {
  list: (params: ListNotesParams = {}): Promise<Note[]> =>
    apiClient.get<Note[]>('/notes', { params }).then((r) => r.data),

  create: (data: CreateNoteInput): Promise<Note> =>
    apiClient.post<Note>('/notes', data).then((r) => r.data),

  update: (noteId: string, data: UpdateNoteInput): Promise<Note> =>
    apiClient.put<Note>(`/notes/${noteId}`, data).then((r) => r.data),

  delete: (noteId: string): Promise<void> =>
    apiClient.delete(`/notes/${noteId}`).then(() => undefined),

  uploadImage: (noteId: string, file: File): Promise<Note> => {
    const form = new FormData();
    form.append('image', file);
    return apiClient
      .post<Note>(`/notes/${noteId}/images`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },
};
```

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts src/api/notes.ts
git commit -m "feat(notes): add Note type, CalendarEvent variant, notes API module"
```

---

## Task 8: NoteFormDialog

**Files:**
- Create: `src/components/NoteFormDialog.tsx`

This dialog handles both create and edit. When `initialNote` is provided it pre-fills the form (edit mode). The `defaultDate` prop pre-fills the date when opened from the calendar.

- [ ] **Step 1: Create NoteFormDialog**

```tsx
// src/components/NoteFormDialog.tsx
import { useState } from 'react';
import {
  Box, Button, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, TextField, Typography,
} from '@mui/material';
import type { Note, Pet } from '../types';

interface NoteFormDialogProps {
  open: boolean;
  saving: boolean;
  pets: Pet[];
  defaultDate?: string;       // 'YYYY-MM-DD', used when opened from calendar
  defaultPetIds?: string[];   // pre-selected pets, used when opened from pet detail
  initialNote?: Note;         // when editing an existing note
  onClose: () => void;
  onSave: (data: { title: string; noteDate: string; description?: string; petIds: string[] }) => void;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

export function NoteFormDialog({
  open, saving, pets, defaultDate, defaultPetIds, initialNote, onClose, onSave,
}: NoteFormDialogProps) {
  const [title, setTitle] = useState(initialNote?.title ?? '');
  const [noteDate, setNoteDate] = useState(initialNote?.noteDate ?? defaultDate ?? todayIso());
  const [description, setDescription] = useState(initialNote?.description ?? '');
  const [selectedPetIds, setSelectedPetIds] = useState<string[]>(
    initialNote?.petIds ?? defaultPetIds ?? [],
  );

  const togglePet = (petId: string) =>
    setSelectedPetIds((prev) =>
      prev.includes(petId) ? prev.filter((id) => id !== petId) : [...prev, petId],
    );

  const handleSave = () => {
    onSave({
      title: title.trim(),
      noteDate,
      description: description.trim() || undefined,
      petIds: selectedPetIds,
    });
  };

  const isEdit = !!initialNote;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{isEdit ? 'Edit Note' : 'Add Note'}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            fullWidth
            required
          />
          <TextField
            label="Date"
            type="date"
            value={noteDate}
            onChange={(e) => setNoteDate(e.target.value)}
            fullWidth
            required
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            rows={3}
          />
          {pets.length > 0 && (
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                Tag pets (optional)
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {pets.map((pet) => {
                  const selected = selectedPetIds.includes(pet.id);
                  return (
                    <Chip
                      key={pet.id}
                      label={pet.name}
                      size="small"
                      onClick={() => togglePet(pet.id)}
                      sx={selected
                        ? { fontWeight: 800, bgcolor: 'primary.main', color: 'white', cursor: 'pointer' }
                        : { fontWeight: 800, cursor: 'pointer' }
                      }
                    />
                  );
                })}
              </Box>
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!title.trim() || !noteDate || saving}
          onClick={handleSave}
        >
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/NoteFormDialog.tsx
git commit -m "feat(notes): add NoteFormDialog component"
```

---

## Task 9: NoteDetailDialog

**Files:**
- Create: `src/components/NoteDetailDialog.tsx`

- [ ] **Step 1: Create NoteDetailDialog**

```tsx
// src/components/NoteDetailDialog.tsx
import { useRef, useState } from 'react';
import {
  Box, Button, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, IconButton, Typography, useTheme,
} from '@mui/material';
import { AddAPhoto, Close, Delete, Edit } from '@mui/icons-material';
import type { Note, Pet } from '../types';
import { NoteFormDialog } from './NoteFormDialog';

interface NoteDetailDialogProps {
  note: Note;
  pets: Pet[];
  saving: boolean;
  uploading: boolean;
  deleting: boolean;
  onClose: () => void;
  onSave: (data: { title: string; noteDate: string; description?: string; petIds: string[] }) => void;
  onUploadImage: (file: File) => void;
  onDelete: () => void;
}

const serverUrl = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3000';

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

export function NoteDetailDialog({
  note, pets, saving, uploading, deleting, onClose, onSave, onUploadImage, onDelete,
}: NoteDetailDialogProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const taggedPets = pets.filter((p) => note.petIds.includes(p.id));

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onUploadImage(file);
    e.target.value = '';
  };

  return (
    <>
      <Dialog open onClose={onClose} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 800, fontSize: '1.0625rem' }}>{note.title}</Typography>
            <Typography variant="caption" color="text.secondary">{fmtDate(note.noteDate)}</Typography>
          </Box>
          <IconButton size="small" onClick={() => setEditOpen(true)} sx={{ color: 'text.secondary' }}>
            <Edit fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={() => setConfirmDeleteOpen(true)} sx={{ color: 'error.main' }}>
            <Delete fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent>
          {taggedPets.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
              {taggedPets.map((p) => (
                <Chip key={p.id} label={p.name} size="small" sx={{ fontWeight: 700 }} />
              ))}
            </Box>
          )}

          {note.description && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>
              {note.description}
            </Typography>
          )}

          {/* Photo grid */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {note.imageUrls.map((url) => (
              <Box
                key={url}
                component="img"
                src={`${serverUrl}${url}`}
                sx={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 1, border: '1px solid rgba(255,255,255,0.1)' }}
              />
            ))}
            <IconButton
              onClick={() => imageInputRef.current?.click()}
              disabled={uploading}
              sx={{
                width: 96, height: 96, borderRadius: 1,
                border: `1px dashed ${isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'}`,
                '&:hover': { borderColor: 'primary.main' },
              }}
            >
              {uploading ? <CircularProgress size={20} /> : <AddAPhoto fontSize="small" />}
            </IconButton>
          </Box>
          <input ref={imageInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImagePick} />
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Edit dialog */}
      {editOpen && (
        <NoteFormDialog
          open
          saving={saving}
          pets={pets}
          initialNote={note}
          onClose={() => setEditOpen(false)}
          onSave={(data) => { onSave(data); setEditOpen(false); }}
        />
      )}

      {/* Delete confirmation */}
      <Dialog open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete note?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            "{note.title}" will be permanently deleted.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            disabled={deleting}
            onClick={onDelete}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/NoteDetailDialog.tsx
git commit -m "feat(notes): add NoteDetailDialog component"
```

---

## Task 10: PetDetailPage — Notes Tab

**Files:**
- Modify: `src/pages/health/PetDetailPage.tsx`

- [ ] **Step 1: Add imports at the top of PetDetailPage.tsx**

Add after the existing imports:

```tsx
import { notesApi } from '../../api/notes';
import { NoteFormDialog } from '../../components/NoteFormDialog';
import { NoteDetailDialog } from '../../components/NoteDetailDialog';
import type { Note } from '../../types';
```

- [ ] **Step 2: Extend TabValue union**

Change:
```ts
type TabValue = 'vet-visits' | 'medications';
```
To:
```ts
type TabValue = 'vet-visits' | 'medications' | 'notes';
```

- [ ] **Step 3: Add notes state variables**

After the existing `const [detailMed, setDetailMed] = useState<Medication | null>(null);` line, add:

```tsx
const [addNoteOpen, setAddNoteOpen] = useState(false);
const [detailNote, setDetailNote] = useState<Note | null>(null);
```

- [ ] **Step 4: Add notes query and mutations**

After the `addMedMutation` block, add:

```tsx
// Notes
const notesQuery = useQuery({
  queryKey: ['notes', petId],
  queryFn: () => notesApi.list({ petId: petId! }),
  enabled: !!petId && tab === 'notes',
});
const notes = notesQuery.data ?? [];

const createNoteMutation = useMutation({
  mutationFn: (data: Parameters<typeof notesApi.create>[0]) => notesApi.create(data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['notes', petId] });
    setAddNoteOpen(false);
  },
  onError: (err) => showError(getApiError(err)),
});

const updateNoteMutation = useMutation({
  mutationFn: ({ noteId, data }: { noteId: string; data: Parameters<typeof notesApi.update>[1] }) =>
    notesApi.update(noteId, data),
  onSuccess: (updated) => {
    queryClient.invalidateQueries({ queryKey: ['notes', petId] });
    setDetailNote(updated);
  },
  onError: (err) => showError(getApiError(err)),
});

const uploadNoteImageMutation = useMutation({
  mutationFn: ({ noteId, file }: { noteId: string; file: File }) =>
    notesApi.uploadImage(noteId, file),
  onSuccess: (updated) => {
    queryClient.invalidateQueries({ queryKey: ['notes', petId] });
    setDetailNote(updated);
  },
  onError: (err) => showError(getApiError(err)),
});

const deleteNoteMutation = useMutation({
  mutationFn: (noteId: string) => notesApi.delete(noteId),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['notes', petId] });
    setDetailNote(null);
  },
  onError: (err) => showError(getApiError(err)),
});
```

- [ ] **Step 5: Add the Notes tab label**

In the `<Tabs>` block, add after the Medications Tab:

```tsx
<Tab value="notes" label="Notes" />
```

And add the corresponding Add button in the `<Box>` next to Tabs:

```tsx
{tab === 'notes' && (
  <Button variant="contained" startIcon={<Add />} onClick={() => setAddNoteOpen(true)} size="small">Add</Button>
)}
```

- [ ] **Step 6: Add the Notes tab content panel**

After the `{tab === 'medications' && ...}` block, add:

```tsx
{tab === 'notes' && (
  notesQuery.isLoading ? <LoadingState /> : notesQuery.isError ? (
    <Box sx={{ p: 2 }}><Alert severity="error">{getApiError(notesQuery.error)}</Alert></Box>
  ) : notes.length === 0 ? <EmptyState label="No notes yet" /> : (
    <>
      {notes.map((n) => (
        <Box
          key={n.id}
          onClick={() => setDetailNote(n)}
          sx={{
            bgcolor: 'background.paper', borderRadius: 2, p: 2, mb: 1.25,
            boxShadow: isDark
              ? '0 2px 12px rgba(0,0,0,0.25)'
              : '0 2px 12px rgba(108,99,255,0.08)',
            cursor: 'pointer',
            '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(108,99,255,0.04)' },
          }}
        >
          <Typography sx={{ fontWeight: 800, fontSize: '0.9375rem', color: 'text.primary' }} noWrap>
            {n.title}
          </Typography>
          <Typography sx={{ fontWeight: 600, fontSize: '0.8125rem', color: 'text.secondary', mt: 0.375 }}>
            {new Date(n.noteDate + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
            {n.description ? ` · ${n.description.slice(0, 60)}${n.description.length > 60 ? '…' : ''}` : ''}
          </Typography>
          {n.imageUrls.length > 0 && (
            <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled', mt: 0.25 }}>
              {n.imageUrls.length} photo{n.imageUrls.length !== 1 ? 's' : ''}
            </Typography>
          )}
        </Box>
      ))}
    </>
  )
)}
```

- [ ] **Step 7: Add dialogs at the bottom of the JSX (before the closing `</Box>`)**

After the `{detailMed && ...}` block, add:

```tsx
{/* Add note dialog */}
<NoteFormDialog
  open={addNoteOpen}
  saving={createNoteMutation.isPending}
  pets={pet ? [pet] : []}
  defaultPetIds={pet ? [pet.id] : []}
  onClose={() => setAddNoteOpen(false)}
  onSave={(data) => createNoteMutation.mutate(data)}
/>

{/* Note detail dialog */}
{detailNote && (
  <NoteDetailDialog
    key={detailNote.id}
    note={detailNote}
    pets={pet ? [pet] : []}
    saving={updateNoteMutation.isPending}
    uploading={uploadNoteImageMutation.isPending}
    deleting={deleteNoteMutation.isPending}
    onClose={() => setDetailNote(null)}
    onSave={(data) => updateNoteMutation.mutate({ noteId: detailNote.id, data })}
    onUploadImage={(file) => uploadNoteImageMutation.mutate({ noteId: detailNote.id, file })}
    onDelete={() => deleteNoteMutation.mutate(detailNote.id)}
  />
)}
```

- [ ] **Step 8: Verify in browser**

Start both dev servers (`pnpm dev` in both projects). Open a pet detail page. You should see a "Notes" tab. Click it, add a note, verify it appears. Click the note card, verify the detail dialog opens. Test edit and delete.

- [ ] **Step 9: Commit**

```bash
git add src/pages/health/PetDetailPage.tsx
git commit -m "feat(notes): add Notes tab to PetDetailPage"
```

---

## Task 11: Calendar Integration

**Files:**
- Modify: `src/pages/calendar/CalendarPage.tsx`
- Modify: `src/components/DayDetailModal.tsx`

- [ ] **Step 1: Add notes query to CalendarPage.tsx**

Add import at the top:
```tsx
import { notesApi } from '../../api/notes';
import type { Note } from '../../types';
```

After the `allMedications` memo, add:

```tsx
const { data: calendarNotes = [] } = useQuery({
  queryKey: ['calendar-notes', monthKey],
  queryFn: () => notesApi.list({
    from: format(monthStart, 'yyyy-MM-dd'),
    to: format(monthEnd, 'yyyy-MM-dd'),
  }),
  staleTime: 5 * 60 * 1000,
});
```

- [ ] **Step 2: Extend toCalendarEvents to include notes**

In `calendarUtils.ts` (or inline in CalendarPage if defined there), update the function signature and body:

In `CalendarPage.tsx`, change the `toCalendarEvents` call:
```tsx
const allEvents = useMemo(
  () => toCalendarEvents(vetVisits, allMedications, calendarNotes, monthStart, monthEnd),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [vetVisits, allMedications, calendarNotes, monthKey],
);
```

Replace the entire `toCalendarEvents` function (defined near the top of `CalendarPage.tsx`) with this updated version that accepts and maps notes:

```ts
function toCalendarEvents(
  vetVisits: VetVisit[],
  medications: Medication[],
  notes: Note[],
  monthStart: Date,
  monthEnd: Date,
): CalendarEvent[] {
  const visitEvents: CalendarEvent[] = vetVisits.map((v) => ({
    kind: 'vet-visit',
    id: v.id,
    petId: v.petId,
    date: v.visitDate,
    type: v.type,
    reason: v.reason,
    vetName: v.vetName,
    clinic: v.clinic,
  }));

  const medEvents: CalendarEvent[] = medications
    .filter((m) => {
      const start = new Date(m.startDate);
      const end = m.endDate ? new Date(m.endDate) : null;
      return start <= monthEnd && (end === null || end >= monthStart);
    })
    .map((m) => ({
      kind: 'medication',
      id: m.id,
      petId: m.petId,
      startDate: m.startDate,
      endDate: m.endDate,
      name: m.name,
      dosageLabel: `${m.dosage.amount} ${m.dosage.unit}`,
      frequencyLabel: m.schedule.type.charAt(0).toUpperCase() + m.schedule.type.slice(1),
      hasReminder: m.reminderEnabled,
      active: m.active,
    }));

  const noteEvents: CalendarEvent[] = notes.map((n) => ({
    kind: 'note' as const,
    id: n.id,
    noteDate: n.noteDate,
    title: n.title,
    petIds: n.petIds,
  }));

  return [...visitEvents, ...medEvents, ...noteEvents];
}
```

Also update the import from `../../types` to include `Note`:
```tsx
import type { CalendarEvent, Pet, Vet, VetVisit, Medication, Note } from '../../types';
```

- [ ] **Step 3: Add notes display to DayDetailModal**

In `DayDetailModal.tsx`, add to the filter lines near the top:

```tsx
const notes = events.filter((e): e is CalendarEvent & { kind: 'note' } => e.kind === 'note');
```

Add the "Add Note" state and callback. First add to the props interface:

```tsx
  onAddNote: (date: Date) => void;
```

Then add the notes section after the medications section (before the `{pets.length > 0 && ...}` block):

```tsx
{notes.length > 0 && <Divider sx={{ my: 1.25 }} />}

{notes.length > 0 && (
  <Box sx={{ mb: 1 }}>
    <Typography variant="caption" sx={{ fontWeight: 800, fontSize: '0.6875rem', color: 'text.disabled', letterSpacing: '2px', textTransform: 'uppercase', mb: 1 }}>
      Notes
    </Typography>
    <Box sx={{ mt: 0.75, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      {notes.map((n) => (
        <Box
          key={n.id}
          sx={{
            p: 1.25, borderRadius: 1, border: '1px solid', borderColor: 'divider',
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 700 }}>{n.title}</Typography>
        </Box>
      ))}
    </Box>
  </Box>
)}

{/* Add Note button */}
<Divider sx={{ my: 1.25 }} />
<Button
  variant="outlined"
  size="small"
  fullWidth
  onClick={() => { onAddNote(date!); handleClose(); }}
>
  Add Note
</Button>
```

- [ ] **Step 4: Wire onAddNote in CalendarPage**

In CalendarPage, add state for the note form:

```tsx
const [noteFormDate, setNoteFormDate] = useState<string | null>(null);
```

Pass `onAddNote` to `DayDetailModal`:

```tsx
onAddNote={(d) => { setNoteFormDate(format(d, 'yyyy-MM-dd')); }}
```

Add the create note mutation and form dialog (after existing mutations):

```tsx
const createCalendarNoteMutation = useMutation({
  mutationFn: (data: Parameters<typeof notesApi.create>[0]) => notesApi.create(data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['calendar-notes', monthKey] });
    setNoteFormDate(null);
  },
});
```

Add the dialog at the bottom of the CalendarPage JSX:

```tsx
{noteFormDate && (
  <NoteFormDialog
    open
    saving={createCalendarNoteMutation.isPending}
    pets={pets}
    defaultDate={noteFormDate}
    onClose={() => setNoteFormDate(null)}
    onSave={(data) => createCalendarNoteMutation.mutate(data)}
  />
)}
```

Add the import at the top of CalendarPage:
```tsx
import { NoteFormDialog } from '../../components/NoteFormDialog';
```

- [ ] **Step 5: Verify in browser**

Open the calendar. Note events should appear on their respective days. Click a day that has a note — it shows in the modal. Click "Add Note" — the NoteFormDialog opens with that date pre-filled. Create a note and verify it appears on the calendar.

- [ ] **Step 6: Commit**

```bash
git add src/pages/calendar/CalendarPage.tsx src/components/DayDetailModal.tsx
git commit -m "feat(notes): integrate notes into calendar — events + Add Note entry point"
```

---

## Self-Review Checklist

After completing all tasks:

- [ ] API compiles with `pnpm build` (no TS errors)
- [ ] Client compiles with `pnpm build`
- [ ] Can create a note from PetDetailPage Notes tab
- [ ] Can create a note from calendar DayDetailModal
- [ ] Notes appear on the correct calendar day
- [ ] Notes tab on pet detail shows only notes tagged to that pet
- [ ] Can edit a note (title, date, description, pet tags)
- [ ] Can add images to a note via NoteDetailDialog
- [ ] Delete requires confirmation and removes the note
- [ ] Notes with no pets still appear on the calendar
