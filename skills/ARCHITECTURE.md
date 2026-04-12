# Architecture

## Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js + TypeScript |
| Framework | Express |
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
  application/             Use cases — one file per operation, grouped by domain
  infrastructure/
    db/
      models/              Sequelize models (one per table)
      repositories/        Sequelize implementations of domain repository interfaces
    mappers/               Bidirectional model ↔ domain ↔ response DTO conversions
    http/
      controllers/         Express controller classes (injected via typedi)
      middleware/          Auth, error handling, file upload
      routes/              Express Router builders
    email/                 EmailService (nodemailer)
    queue/                 BullMQ queues, ReminderSchedulerService, ReminderWorker
  shared/
    errors/                AppError hierarchy (NotFoundError, ForbiddenError, …)
    types/                 Shared types: PaginationParams, PaginatedResult<T>
```

## Domain Model

### Aggregates
| Aggregate | Key fields | Notes |
|---|---|---|
| `User` | name, email, passwordHash | Authentication principal |
| `Group` | name, members (role: owner\|member) | Access boundary — all data is group-scoped |
| `Pet` | name, species, breed, birthDate, photoUrl, groupId | Belongs to one group |
| `Vet` | name, address, phone, workHours, googleMapsUrl, notes, groupId | Group-scoped vet directory entry |

### Entities (within health domain)
| Entity | Key fields |
|---|---|
| `VetVisit` | petId, vetId?, reason, notes, visitDate, nextVisitDate, imageUrls[] |
| `Medication` | petId, name, dosage, startDate, endDate, active, reminder? |
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

### Group
- `CreateGroupUseCase` — creates Group with requesting user as owner
- `InviteUserUseCase` — owner-only; adds member to group
- `ListGroupsUseCase` — paginated list of groups the user belongs to

### Pet
- `AddPetUseCase` — creates Pet in group (membership required)
- `GetPetUseCase` — fetches single Pet (membership required)
- `ListPetsUseCase` — paginated list of pets in a group
- `UpdatePetUseCase` — updates name/species/breed/birthDate/photoUrl

### Vet
- `CreateVetUseCase` — adds Vet to group directory
- `ListVetsUseCase` — paginated list of vets in a group

### Health
- `AddVetVisitUseCase` — records a new vet visit for a pet
- `UpdateVetVisitUseCase` — updates mutable fields of a vet visit (merges via public getters, not `props`)
- `AddVetVisitImageUseCase` — appends image URL to a vet visit via `VetVisit.addImage()`
- `ListVetVisitsUseCase` — paginated vet visit history for a pet
- `ListUpcomingVetVisitsUseCase` — returns all visits with `nextVisitDate > now` across a group, sorted ASC
- `LogMedicationUseCase` — records a medication for a pet
- `RecordSymptomUseCase` — records a symptom observation
- `AddHealthCheckUseCase` — records a health check measurement
- `ListSymptomsUseCase` — paginated symptoms for a pet
- `ListHealthChecksUseCase` — paginated health checks for a pet

### Reminder
- `ConfigureMedicationReminderUseCase` — sets reminder schedule on a medication; creates BullMQ repeatable jobs
- `ToggleMedicationReminderUseCase` — enables/disables a medication reminder

## Infrastructure

### Database Models (`infrastructure/db/models/`)
One Sequelize model per DB table. All use `timestamps: false` with explicit `created_at` columns.

| Model | Table | Notable columns |
|---|---|---|
| `UserModel` | `users` | email, password_hash |
| `GroupModel` | `groups` | name |
| `GroupMemberModel` | `group_members` | group_id, user_id, role, joined_at |
| `PetModel` | `pets` | name, species, breed, birth_date, photo_url, group_id |
| `VetModel` | `vets` | name, address, phone, work_hours, google_maps_url, group_id |
| `VetVisitModel` | `vet_visits` | pet_id, vet_id, visit_date, next_visit_date, image_urls (JSONB) |
| `ReminderModel` | `reminders` | entity_type, entity_id, schedule (JSONB), enabled, created_by |
| `MedicationModel` | `medications` | name, dosage (JSONB), reminder (JSONB), active |
| `SymptomModel` | `symptoms` | description, severity, observed_at |
| `HealthCheckModel` | `health_checks` | weight, temperature, checked_at |

### Repositories (`infrastructure/db/repositories/`)
Each implements its domain interface via Sequelize. List methods use `findAndCountAll` and return `PaginatedResult<T>`.

- `SequelizeUserRepository`
- `SequelizeGroupRepository`
- `SequelizePetRepository`
- `SequelizeVetRepository`
- `SequelizeHealthRecordRepository` — covers all health entities; `findUpcomingVetVisitsByGroupId` joins PetModel with `Op.gt` filter

### Mappers (`infrastructure/mappers/`)
Injectable `@Service()` classes. Each exports a response DTO interface and has three methods:
- `toDomain(model)` — Sequelize model → domain entity (used by repositories)
- `toPersistence(entity)` — domain entity → plain object for `upsert` (used by repositories)
- `toResponse(entity)` — domain entity → response DTO (used by controllers)

Mappers: `UserMapper`, `GroupMapper`, `PetMapper`, `VetMapper`, `VetVisitMapper`, `MedicationMapper`, `SymptomMapper`, `HealthCheckMapper`.

### Controllers (`infrastructure/http/controllers/`)
`@Service()` classes with arrow-function handlers. Injected via typedi; `req.auth.userId` set by `authMiddleware`.

- `AuthController` — register, login
- `GroupController` — create, list, invite, upcomingVetVisits
- `PetController` — create, list, get, update, uploadPhoto
- `VetController` — create, list
- `HealthController` — vet visits (get, create, update, uploadImage), medications, symptoms, health checks
- `ReminderController` — configure, toggle

### Middleware
- `authMiddleware` — validates JWT, attaches `req.auth.userId`
- `errorMiddleware` — maps `AppError` subclasses to HTTP status codes
- `upload.ts` — two multer instances: `uploadImage` (→ `uploads/vet-visits/`) and `uploadPetPhoto` (→ `uploads/pets/`); UUID filenames, 10 MB limit, images only

### Queue (`infrastructure/queue/`)
- `ReminderQueue` — BullMQ queue instance
- `ReminderSchedulerService` — registers one `upsertJobScheduler` entry per cron expression from `ReminderSchedule.toCronExpressions()`; scheduler IDs are `reminder--{entityId}--{index}`; cancellation removes all entries matching the entity prefix
- `ReminderWorker` — processes jobs; looks up `notifyUserIds`, sends email per user via `EmailService`
- `redis.ts` — shared Redis connection

## API Routes

All routes require `Authorization: Bearer <token>` except `/auth/*`.  
List endpoints support `?page=1&limit=20` (max 100).

```
POST   /api/v1/auth/register
POST   /api/v1/auth/login

GET    /api/v1/groups
POST   /api/v1/groups
POST   /api/v1/groups/:groupId/invite
GET    /api/v1/groups/:groupId/upcoming-vet-visits   ← flat array, sorted by nextVisitDate ASC

GET    /api/v1/groups/:groupId/pets
POST   /api/v1/groups/:groupId/pets
GET    /api/v1/groups/:groupId/pets/:petId
PUT    /api/v1/groups/:groupId/pets/:petId
POST   /api/v1/groups/:groupId/pets/:petId/photo     ← multipart/form-data field: photo

GET    /api/v1/groups/:groupId/vets
POST   /api/v1/groups/:groupId/vets

GET    /api/v1/pets/:petId/vet-visits
POST   /api/v1/pets/:petId/vet-visits
PUT    /api/v1/pets/:petId/vet-visits/:visitId
POST   /api/v1/pets/:petId/vet-visits/:visitId/images  ← multipart/form-data field: image

POST   /api/v1/pets/:petId/medications
GET    /api/v1/pets/:petId/symptoms
POST   /api/v1/pets/:petId/symptoms
GET    /api/v1/pets/:petId/health-checks
POST   /api/v1/pets/:petId/health-checks

PUT    /api/v1/medications/:medicationId/reminder
PATCH  /api/v1/medications/:medicationId/reminder/toggle
```

## Key Design Decisions

- **DDD with OOP** — domain entities use static factory methods (`create`, `reconstitute`, `addImage`). State changes produce new instances rather than mutating in place.
- **Protected `props`** — `Entity.props` is `protected`; use cases reconstruct entities via public getters, never by spreading `props` directly.
- **Injectable mappers** — mappers are `@Service()` instances injected via constructor, not static classes. This keeps them testable and avoids hidden global state.
- **BullMQ over cron** — reminder jobs survive restarts; repeatable jobs are keyed by medication + cron expression so schedule changes cleanly replace old jobs.
- **`sync({ alter: true })`** — DB schema is kept in sync by Sequelize on startup; no migration files. Run `pnpm seed` (uses `force: true`) to drop and recreate all tables with fresh data during development.
- **Flat uploads directory** — uploaded files are served statically from `/uploads`; URLs are stored as relative paths (e.g. `/uploads/pets/uuid.jpg`) so the server URL can change without a DB migration.
