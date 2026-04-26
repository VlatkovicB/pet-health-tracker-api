---
name: architecture
description: Deep architecture reference for pet-health-tracker-api — DDD layers, domain model, use cases, infrastructure, and API routes
---

## Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js + TypeScript |
| Framework | Express + routing-controllers |
| Validation | Zod (via custom `@Validate` decorator) |
| ORM | sequelize-typescript |
| Database | PostgreSQL |
| Auth | JWT (`jsonwebtoken`) + bcrypt |
| File uploads | multer (disk storage) |
| Job queue | BullMQ + Redis |
| Email | nodemailer (SMTP) |
| Dependency injection | typedi |
| Architecture | Domain-Driven Design (DDD), OOP |

## Project Structure

```
src/
  main.ts                  Entry point — syncs DB, starts queue worker, starts Express
  app.ts                   Express app factory — CORS, JSON, static /uploads, router
  container.ts             typedi DI bindings (tokens → implementations)
  domain/                  Pure domain layer — no framework dependencies
    shared/                Base classes: Entity, AggregateRoot, ValueObject, UniqueEntityId
    user/                  User aggregate + repository interface
    group/                 Group aggregate + repository interface
    pet/                   Pet aggregate + repository interface
    vet/                   Vet aggregate + repository interface
    health/                VetVisit, Medication, Symptom, HealthCheck + repository interface
    reminder/              Reminder aggregate + repository interface
  application/             Use cases — one file per operation, grouped by domain
  infrastructure/
    db/
      models/              Sequelize models (one per table)
      repositories/        Sequelize implementations of domain repository interfaces
    mappers/               Bidirectional model ↔ domain ↔ response DTO conversions
    http/
      controllers/         routing-controllers decorator classes (@JsonController, @Get, @Post, etc.)
      decorators/          Custom decorators — @Validate({ body?, query? }) for Zod validation
      schemas/             Zod schemas + inferred types, one file per resource
      middleware/          Auth, error handling, file upload
    email/                 EmailService (nodemailer)
    external/              Google Places API client
    queue/                 BullMQ queues, ReminderSchedulerService, ReminderWorker
  shared/
    errors/                AppError hierarchy (NotFoundError, ForbiddenError, …)
    types/                 Shared types: PaginationParams, PaginatedResult<T>
```

## Domain Model

### Aggregates / Entities
| Aggregate | Key fields | Notes |
|---|---|---|
| `User` | name, email, passwordHash, theme | Authentication principal; stores UI theme preference |
| `Pet` | name, species, breed, birthDate, color, photoUrl, userId | User-scoped |
| `Vet` | name, address, phone, workHours, googleMapsUrl, rating, placeId, notes, userId | User-scoped; `placeId` links to Google Places |

### Entities (within health domain)
| Entity | Key fields |
|---|---|
| `VetVisit` | petId, **type** (`logged`\|`scheduled`), vetId?, clinic?, vetName?, reason, notes, visitDate, imageUrls[], createdBy |
| `Medication` | petId, name, dosage, startDate, endDate, active, notes |
| `Symptom` | petId, description, severity, observedAt, notes |
| `HealthCheck` | petId, weight?, temperature?, checkedAt, notes |

### Value Objects
- `Dosage` — amount + unit
- `Severity` — mild | moderate | severe
- `ReminderSchedule` — discriminated union: `daily` (times[]), `weekly` (days[], times[]), `monthly` (daysOfMonth[], times[]); UTC; `toCronExpressions()` returns one cron string per time slot

### Base Classes (`domain/shared/`)
- `Entity<T>` — wraps `props: T`, protected; holds `UniqueEntityId`
- `AggregateRoot<T>` — extends Entity; marker for aggregate roots
- `ValueObject<T>` — structural equality

## Application Layer

Each use case is a single `@Service()` class with one `execute()` method.

### Auth
- `RegisterUserUseCase` — hashes password, creates User, returns JWT
- `LoginUserUseCase` — verifies credentials, returns JWT

### Pet
- `AddPetUseCase` — creates Pet for the requesting user
- `GetPetUseCase` — fetches single Pet (ownership required)
- `ListPetsUseCase` — paginated list of pets for the user
- `UpdatePetUseCase` — updates name/species/breed/birthDate/color/photoUrl

### Vet
- `CreateVetUseCase` — adds Vet to user's directory
- `ListVetsUseCase` — paginated list of vets for the user
- `UpdateVetUseCase` — updates vet fields including workHours

### Health
- `AddVetVisitUseCase` — records a new vet visit (logged or scheduled)
- `UpdateVetVisitUseCase` — updates mutable fields of a vet visit
- `CompleteVetVisitUseCase` — transitions a `scheduled` visit to `logged`; cancels associated reminder
- `AddVetVisitImageUseCase` — appends image URL via `VetVisit.addImage()`
- `ListVetVisitsUseCase` — paginated vet visit history for a pet
- `ListVetVisitsByDateRangeUseCase` — returns visits within a date range (used for calendar)
- `LogMedicationUseCase` — records a medication for a pet
- `ListMedicationsUseCase` — paginated medications for a pet
- `UpdateMedicationUseCase` — updates medication fields
- `RecordSymptomUseCase` — records a symptom observation
- `AddHealthCheckUseCase` — records a health check measurement
- `ListSymptomsUseCase` — paginated symptoms for a pet
- `ListHealthChecksUseCase` — paginated health checks for a pet

### Reminder
- `ConfigureMedicationReminderUseCase` — sets reminder schedule; creates BullMQ repeatable jobs
- `ToggleMedicationReminderUseCase` — enables/disables a medication reminder

## Infrastructure

### Database Models (`infrastructure/db/models/`)
One Sequelize model per DB table. All use `timestamps: false` with explicit `created_at` columns.

| Model | Table | Notable columns |
|---|---|---|
| `UserModel` | `users` | email, password_hash, theme |
| `PetModel` | `pets` | name, species, breed, birth_date, photo_url, color, user_id |
| `VetModel` | `vets` | name, address, phone, google_maps_url, rating, place_id, user_id |
| `VetWorkHoursModel` | `vet_work_hours` | vet_id, day_of_week, open, start_time, end_time (7 rows per vet) |
| `VetVisitModel` | `vet_visits` | pet_id, vet_id, type, visit_date, clinic, vet_name, image_urls (JSONB) |
| `ReminderModel` | `reminders` | entity_type, entity_id, schedule (JSONB), enabled, created_by |
| `ReminderNotifyUserModel` | `reminder_notify_users` | reminder_id, user_id |
| `MedicationModel` | `medications` | name, dosage (JSONB), active, notes |
| `SymptomModel` | `symptoms` | description, severity, observed_at |
| `HealthCheckModel` | `health_checks` | weight, temperature, checked_at |

### Repositories (`infrastructure/db/repositories/`)
Each implements its domain interface via Sequelize. List methods use `findAndCountAll` and return `PaginatedResult<T>`.

- `SequelizeUserRepository`
- `SequelizePetRepository`
- `SequelizeVetRepository`
- `SequelizeHealthRecordRepository` — covers all health entities; `findVetVisitsByDateRange`, `findUpcomingVetVisits`
- `SequelizeReminderRepository`

### Mappers (`infrastructure/mappers/`)
Injectable `@Service()` classes. Each has three methods:
- `toDomain(model)` — Sequelize model → domain entity
- `toPersistence(entity)` — domain entity → plain object for `upsert`
- `toResponse(entity)` — domain entity → response DTO

### Controllers (`infrastructure/http/controllers/`)
`@JsonController` + `@Service()` classes using routing-controllers decorators. Auth enforced via `@UseBefore(authMiddleware)` at the class level (all except `AuthController`). `@CurrentUser()` resolves to `req.auth` (set by `authMiddleware`). Input validated by `@Validate({ body?, query? })` on mutation/query methods — Zod schemas live in `infrastructure/http/schemas/`. Return values are auto-serialized as JSON; no `res.json()` or try/catch needed.

- `AuthController` — register, login
- `UserController` — getMe, updateTheme
- `PetController` — create, list, get, update, uploadPhoto
- `VetController` — create, list, update
- `HealthController` — vet visits (list, create, update, complete, reminder), medications (list, create, update), symptoms, health checks, upcoming visits, visits by date range
- `ReminderController` — configure (medication), toggle (medication)
- `PlacesController` — search, details (Google Places proxy)

### Middleware
- `authMiddleware` — validates JWT, attaches `req.auth` (`{ userId, email }`); applied per-controller via `@UseBefore(authMiddleware)`, not globally
- `errorMiddleware` — maps `AppError` subclasses to HTTP status codes
- `upload.ts` — two multer instances: `uploadImage` (→ `uploads/vet-visits/`) and `uploadPetPhoto` (→ `uploads/pets/`); UUID filenames, 10 MB limit

### Queue (`infrastructure/queue/`)
- `ReminderSchedulerService` — registers one `upsertJobScheduler` entry per cron expression; scheduler IDs use `--` separator: `reminder--{entityId}--{index}` (BullMQ v5 forbids `:`)
- `ReminderWorker` — processes jobs; looks up `notifyUserIds`, sends email per user via `EmailService`

## API Routes

All routes require `Authorization: Bearer <token>` except `/auth/*`.  
List endpoints support `?page=1&limit=20`.

```
POST   /api/v1/auth/register
POST   /api/v1/auth/login

GET    /api/v1/users/me
PATCH  /api/v1/users/me                            ← update theme

GET    /api/v1/pets
POST   /api/v1/pets
GET    /api/v1/pets/:petId
PUT    /api/v1/pets/:petId
POST   /api/v1/pets/:petId/photo                   ← multipart field: photo

GET    /api/v1/vets
POST   /api/v1/vets
PUT    /api/v1/vets/:id

GET    /api/v1/pets/:petId/vet-visits
POST   /api/v1/pets/:petId/vet-visits
PUT    /api/v1/pets/:petId/vet-visits/:visitId
PATCH  /api/v1/pets/:petId/vet-visits/:visitId/complete
GET    /api/v1/pets/:petId/vet-visits/:visitId/reminder
PUT    /api/v1/pets/:petId/vet-visits/:visitId/reminder
POST   /api/v1/pets/:petId/vet-visits/:visitId/images  ← multipart field: image

GET    /api/v1/pets/:petId/medications
POST   /api/v1/pets/:petId/medications
PUT    /api/v1/pets/:petId/medications/:medicationId

GET    /api/v1/pets/:petId/symptoms
POST   /api/v1/pets/:petId/symptoms
GET    /api/v1/pets/:petId/health-checks
POST   /api/v1/pets/:petId/health-checks

PUT    /api/v1/medications/:medicationId/reminder
PATCH  /api/v1/medications/:medicationId/reminder/toggle

GET    /api/v1/vet-visits/upcoming                 ← across all user's pets
GET    /api/v1/vet-visits                          ← ?start=&end= date range for calendar

GET    /api/v1/places/search                       ← Google Places text search proxy
GET    /api/v1/places/details                      ← Google Places details proxy
```

## Key Design Decisions

- **User-scoped data** — pets and vets belong directly to a user (`userId`). The group domain layer still exists but is not actively used in the current routes.
- **VetVisit type discriminator** — `type: 'logged' | 'scheduled'`; `CompleteVetVisitUseCase` transitions scheduled → logged and cancels any reminder.
- **DDD with OOP** — domain entities use static factory methods (`create`, `reconstitute`, `addImage`). `Entity.props` is `protected`; use cases access state only via public getters.
- **Injectable mappers** — mappers are `@Service()` instances injected via constructor, not static classes.
- **BullMQ over cron** — reminder jobs survive restarts; repeatable jobs keyed by entity + cron expression so schedule changes cleanly replace old jobs.
- **routing-controllers + Zod** — controllers use `@JsonController`, `@Get`/`@Post`/etc. from `routing-controllers`. `app.ts` uses `useExpressServer(app, { container: Container, defaultErrorHandler: false, currentUserChecker: action => action.request.auth })`. Zod validation via `@Validate({ body?, query? })` — a method decorator wrapping `@UseBefore`; mutates `req.body`/`req.query` with parsed data and throws `ValidationError` on failure.
- **`sync({ alter: true })`** — DB schema kept in sync by Sequelize on startup; no migration files. `pnpm seed` uses `force: true` to drop and recreate all tables.
- **Flat uploads directory** — files served statically from `/uploads`; URLs stored as relative paths so server URL can change without a DB migration.
- **VetWorkHours as separate table** — 7 rows per vet (one per day); `WorkHoursEditor` on the client manages these as a structured array.
