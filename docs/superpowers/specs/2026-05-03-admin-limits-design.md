# Admin Profile & User Limits — Design Spec

**Date:** 2026-05-03  
**Status:** Approved

---

## Overview

Add an admin role and per-user resource limits to prevent abuse (storage hoarding, Places API abuse). Admins can view user statistics, manage roles, and set per-user limits. Users can view their own usage at any time.

---

## 1. Data Model

### `users` table — new column
```
role  ENUM('user', 'admin')  NOT NULL  DEFAULT 'user'
```

User domain entity gains:
- `role` getter → `UserRole` (`'user' | 'admin'`)
- `setRole(role: UserRole)` method

JWT payload gains `role: UserRole` field.

### New `user_limits` table
One row per user, created on-demand when admin sets a limit. All limit columns nullable — `NULL` means fall back to system default from env.

```
user_limits
  id                           UUID         PK
  user_id                      UUID         FK → users (unique, not null)
  max_pets                     INTEGER      NULL
  max_vets                     INTEGER      NULL
  max_medications              INTEGER      NULL
  max_notes                    INTEGER      NULL
  max_storage_bytes            BIGINT       NULL
  storage_used_bytes           BIGINT       NOT NULL  DEFAULT 0
  max_places_searches_monthly  INTEGER      NULL
  places_searches_this_month   INTEGER      NOT NULL  DEFAULT 0
  places_searches_month        DATE         NOT NULL  DEFAULT CURRENT_DATE
  created_at                   TIMESTAMP    NOT NULL
  updated_at                   TIMESTAMP    NOT NULL
```

### Env defaults (`.env.example`)
```
DEFAULT_MAX_PETS=10
DEFAULT_MAX_VETS=20
DEFAULT_MAX_MEDICATIONS=50
DEFAULT_MAX_NOTES=50
DEFAULT_MAX_STORAGE_BYTES=104857600
DEFAULT_MAX_PLACES_SEARCHES_MONTHLY=50
```

Resolution order per limit: per-user row value (if not NULL) → env default → no limit.

---

## 2. Auth & Admin Middleware

### JWT payload
```ts
{ userId: string, email: string, role: UserRole }
```

### `requireAdmin` middleware
- Reads `req.auth.role`
- Throws `ForbiddenError` if not `'admin'`
- Applied via `@UseBefore(authMiddleware, requireAdmin)` on `AdminController`

### Admin routes — `AdminController` at `/api/v1/admin`
```
GET    /api/v1/admin/users                  paginated list with per-user stats
GET    /api/v1/admin/users/:userId          single user detail + stats
PATCH  /api/v1/admin/users/:userId/role     set role
PUT    /api/v1/admin/users/:userId/limits   upsert user_limits row
DELETE /api/v1/admin/users/:userId          delete user + cascade all data
```

Stats object per user (included in list and detail responses):
```ts
{
  pets: number
  vets: number
  vetVisits: number
  medications: number
  symptoms: number
  healthChecks: number
  notes: number
  photos: number
  reminders: number
  storageUsedBytes: number
  placesSearchesThisMonth: number
}
```

---

## 3. Limit Enforcement

### `LimitService` — injectable `@Service()`
Responsibilities:
- `getEffectiveLimits(userId)` — loads `user_limits` row, resolves per-user vs env defaults
- `checkLimit(userId, resource)` — counts current usage, throws `ForbiddenError` if at/over limit
- `incrementStorage(userId, bytes)` — called after successful file upload
- `decrementStorage(userId, bytes)` — called after file deletion
- `checkAndIncrementPlacesSearch(userId)` — resets counter if `places_searches_month` ≠ current month, then checks + increments atomically

### Enforcement points
| Use Case / Controller | Limit checked |
|---|---|
| `AddPetUseCase` | `maxPets` — count user's pets |
| `CreateVetUseCase` | `maxVets` — count user's vets |
| `LogMedicationUseCase` | `maxMedications` — count user's medications |
| `AddNoteUseCase` | `maxNotes` — count user's notes |
| `AddVetVisitImageUseCase` | `maxStorageBytes` — `storageUsedBytes + newFileBytes` |
| `UploadPetPhotoUseCase` | `maxStorageBytes` — same storage check |
| `PlacesController` (search) | `maxPlacesSearchesMonthly` — monthly counter |

Error response on limit hit: `403 Forbidden` with descriptive message (e.g., `"Pet limit reached (10/10)"`).

---

## 4. User-Facing Limits

### New endpoint
```
GET /api/v1/users/me/limits
```

Response:
```json
{
  "pets":           { "used": 3,        "max": 10 },
  "vets":           { "used": 12,       "max": 20 },
  "medications":    { "used": 8,        "max": 50 },
  "notes":          { "used": 2,        "max": 50 },
  "storage":        { "usedBytes": 45000000, "maxBytes": 104857600 },
  "placesSearches": { "usedThisMonth": 11, "max": 50 }
}
```

`max: null` means no limit configured and no env default set.

### `GET /api/v1/users/me` change
Gains `role` field in response so the client knows if the current user is admin.

### Client usage pattern
- Fetch `/users/me/limits` on app load, store in context
- Profile page shows usage bars for all resources
- Warn at 80% (yellow), 95% (red) — thresholds handled client-side
- Disable/warn upload buttons, places search when at/near limit

---

## 5. Domain Layer Changes

- `UserRole` type: `'user' | 'admin'` exported from `domain/user/`
- `User` entity: add `role` to `UserProps`, `role` getter, `setRole()` method
- `UserLimits` entity or value object in `domain/user/` representing the limits + usage snapshot
- `UserLimitsRepository` interface in `domain/user/`

---

## 6. Infrastructure

- `UserModel`: add `role` column
- `UserLimitsModel`: new Sequelize model for `user_limits`
- `SequelizeUserLimitsRepository`: implements `UserLimitsRepository`
- `UserLimitsMapper`: `toDomain`, `toPersistence`, `toResponse`
- `LimitService`: injectable service in `infrastructure/` (crosses infra boundary, not domain logic)
- `requireAdmin.ts`: new middleware in `infrastructure/http/middleware/`
- `AdminController`: new controller in `infrastructure/http/controllers/`
- `adminSchemas.ts`: Zod schemas for admin request bodies

---

## Out of Scope

- Tier-based defaults (planned future work — NULL fallback pattern already supports it)
- Time-spent / session tracking
- Rate limiting by requests-per-second
- Admin UI (separate client feature)
