# Pet Sharing & Ownership Transfer — Design Spec

**Date:** 2026-04-24  
**Status:** Approved

## Overview

Pets can be shared between users with granular, per-resource permissions (view/edit for vet visits, medications, notes). A pet has exactly one owner at all times. Ownership can be transferred to another user. All sharing and transfer actions require recipient acceptance.

---

## Data Model

### `pet_shares` table

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `pet_id` | UUID FK → pets | |
| `owner_id` | UUID FK → users | the user who created the share |
| `shared_with_user_id` | UUID FK → users, nullable | null until invite is linked to an account |
| `invited_email` | string | used to link share when a new user registers |
| `status` | `pending` \| `accepted` | |
| `can_view_vet_visits` | boolean | |
| `can_edit_vet_visits` | boolean | edit implies view |
| `can_view_medications` | boolean | |
| `can_edit_medications` | boolean | |
| `can_view_notes` | boolean | |
| `can_edit_notes` | boolean | |
| `created_at` | timestamp | |

Constraint: one active share per `(pet_id, invited_email)` — duplicates rejected.

### `pet_ownership_transfers` table

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `pet_id` | UUID FK → pets | max one active (pending) transfer per pet |
| `from_user_id` | UUID FK → users | |
| `to_user_id` | UUID FK → users, nullable | null for non-existing users |
| `invited_email` | string | |
| `status` | `pending` \| `accepted` \| `declined` \| `cancelled` \| `expired` | |
| `expires_at` | timestamp | `created_at + 7 days` |
| `created_at` | timestamp | |

---

## Domain Layer

### New aggregates

**`PetShare`** (`domain/share/PetShare.ts`)
- Props: `petId`, `ownerId`, `sharedWithUserId?`, `invitedEmail`, `status`, permissions (`canViewVetVisits`, `canEditVetVisits`, `canViewMedications`, `canEditMedications`, `canViewNotes`, `canEditNotes`), `createdAt`
- Methods: `accept()`, `hasPermission(permission: PetPermission): boolean`
- Repository: `PetShareRepository` with `findById`, `findByPetId`, `findPendingForUser`, `findByPetIdAndEmail`, `findAcceptedByPetIdAndUserId`, `save`, `delete`

**`PetOwnershipTransfer`** (`domain/transfer/PetOwnershipTransfer.ts`)
- Props: `petId`, `fromUserId`, `toUserId?`, `invitedEmail`, `status`, `expiresAt`, `createdAt`
- Methods: `cancel()`, `expire()`, `accept()`, `decline()`
- Repository: `PetOwnershipTransferRepository` with `findById`, `findActivePendingByPetId`, `findPendingForUser`, `save`

### Permission type

```typescript
// domain/share/PetPermission.ts
type PetPermission =
  | 'view_pet'
  | 'owner'
  | 'view_vet_visits' | 'edit_vet_visits'
  | 'view_medications' | 'edit_medications'
  | 'view_notes'      | 'edit_notes';
```

`view_pet` — granted to any accepted sharer regardless of other permissions; allows reading basic pet info (name, species, photo, etc).

`owner` — exclusive to `pet.userId === requestingUserId`; required for update pet, manage shares, initiate/cancel transfer.

---

## Application Layer — `PetAccessService`

**`application/pet/PetAccessService.ts`** — `@Service()`, injected by typedi.

```typescript
assertCanAccess(petId: string, userId: string, permission: PetPermission): Promise<Pet>
```

1. Load pet — throw `NotFoundError('Pet')` if missing
2. If `pet.userId === userId` → owner; allow all permissions; return pet
3. Load accepted `PetShare` for `(petId, userId)` — throw `ForbiddenError` if none
4. For `'owner'` permission → always throw `ForbiddenError`
5. For `'view_pet'` → allow (any accepted sharer)
6. For resource permissions → check `share.hasPermission(permission)`; throw `ForbiddenError` if false
7. Return pet

All existing use cases replace their inline `pet.userId !== requestingUserId` guard with `await this.petAccessService.assertCanAccess(...)`.

---

## Application Layer — New Use Cases

### Share management (`application/share/`)

| Use case | Permission | Description |
|---|---|---|
| `SharePetUseCase` | `owner` | Create share; email lookup; invite new users |
| `UpdateSharePermissionsUseCase` | `owner` | Update permissions on existing share |
| `RevokeShareUseCase` | `owner` | Delete share regardless of status |
| `ListPetSharesUseCase` | `owner` | List all shares for a pet |
| `ListPendingSharesUseCase` | — | List pending shares for requesting user |
| `AcceptShareUseCase` | — | Set status → accepted |
| `DeclineShareUseCase` | — | Delete the share row |
| `ListSharedPetsUseCase` | — | Pets from all accepted shares for requesting user |

### Transfer management (`application/transfer/`)

| Use case | Permission | Description |
|---|---|---|
| `InitiateOwnershipTransferUseCase` | `owner` | Create transfer; rejects if pending transfer exists |
| `CancelOwnershipTransferUseCase` | `owner` | Sets status → cancelled |
| `ListPendingTransfersUseCase` | — | Pending transfer requests for requesting user |
| `AcceptOwnershipTransferUseCase` | — | Accepts transfer; updates `pet.userId`; optionally creates share for original owner |
| `DeclineOwnershipTransferUseCase` | — | Sets status → declined |
| `ExpireOwnershipTransferUseCase` | — | Internal; called by BullMQ job |

### Registration hook

`RegisterUserUseCase` — after creating the user, look up `PetShare` rows with `invitedEmail = email` and set `sharedWithUserId` to the new user's id. Same for `PetOwnershipTransfer`.

---

## Permission mapping for existing use cases

| Use case | Required permission |
|---|---|
| `GetPetUseCase` | `view_pet` |
| `UpdatePetUseCase` | `owner` |
| `ListVetVisitsUseCase`, `ListVetVisitsByDateRangeUseCase` | `view_vet_visits` |
| `AddVetVisitUseCase`, `UpdateVetVisitUseCase`, `CompleteVetVisitUseCase`, `AddVetVisitImageUseCase` | `edit_vet_visits` |
| `ListMedicationsUseCase` | `view_medications` |
| `LogMedicationUseCase`, `UpdateMedicationUseCase` | `edit_medications` |
| `ListNotesUseCase`, `GetNoteUseCase` | `view_notes` |
| `CreateNoteUseCase`, `UpdateNoteUseCase`, `DeleteNoteUseCase` | `edit_notes` |
| Reminder use cases (configure, toggle) | `view_pet` — reminders are personal per user |

---

## Share flow

1. Owner `POST /api/v1/pets/:petId/shares` `{ email, permissions }`
2. API looks up user by email:
   - Existing user → create `PetShare` (pending, `sharedWithUserId` set), send notification email
   - No account → create `PetShare` (pending, `sharedWithUserId = null`), send invite email with registration link
3. On new user registration → `RegisterUserUseCase` links pending shares/transfers by `invitedEmail`
4. Recipient sees pending invites at `GET /api/v1/pet-shares/pending`
5. Recipient accepts (`PATCH .../accept`) or declines (`PATCH .../decline`)
6. Owner can view shares at `GET /api/v1/pets/:petId/shares`, update permissions (`PUT .../shares/:shareId`), or revoke (`DELETE .../shares/:shareId`)

---

## Transfer flow

1. Owner `POST /api/v1/pets/:petId/transfer` `{ email }`
2. Rejected if a `pending` transfer already exists for this pet
3. Same email lookup pattern as shares; create `PetOwnershipTransfer` with `expires_at = now + 7 days`
4. BullMQ job scheduled at creation to fire after 7 days; sets status `expired` if still `pending`
5. Owner can cancel: `DELETE /api/v1/pets/:petId/transfer`
6. Recipient sees pending at `GET /api/v1/pet-ownership-transfers/pending`
7. Recipient accepts: `PATCH .../accept` `{ retainAccessForOriginalOwner: boolean }`
   - Update `pet.userId` → new owner
   - If `retainAccessForOriginalOwner = true` → create accepted `PetShare` for original owner (all permissions true)
   - All other existing shares carry over unchanged
8. Recipient declines: `PATCH .../decline` → status `declined`

---

## Infrastructure

### New Sequelize models
- `PetShareModel` (`pet_shares`)
- `PetOwnershipTransferModel` (`pet_ownership_transfers`)

### New repositories
- `SequelizePetShareRepository`
- `SequelizePetOwnershipTransferRepository`

### New mappers
- `PetShareMapper`
- `PetOwnershipTransferMapper`

### BullMQ — transfer expiry
New queue `TransferExpiryQueue` + `TransferExpiryWorker`. Job scheduled on transfer creation using job ID `transfer--{transferId}`. Fires once (not repeatable) after 7 days. Calls `ExpireOwnershipTransferUseCase`.

### Email templates
- `petShareInvite` — invite non-existing user; includes registration link
- `petShareNotification` — notify existing user of new share
- `petTransferInvite` — invite non-existing user for transfer
- `petTransferNotification` — notify existing user of transfer request

---

## API Routes

All routes require `Authorization: Bearer <token>`.

```
# Pet sharing (owner-facing)
GET    /api/v1/pets/:petId/shares
POST   /api/v1/pets/:petId/shares
PUT    /api/v1/pets/:petId/shares/:shareId
DELETE /api/v1/pets/:petId/shares/:shareId

# Pet sharing (recipient-facing)
GET    /api/v1/pet-shares/pending
PATCH  /api/v1/pet-shares/:shareId/accept
PATCH  /api/v1/pet-shares/:shareId/decline

# Shared pets list
GET    /api/v1/pets/shared-with-me

# Ownership transfer (owner-facing)
POST   /api/v1/pets/:petId/transfer
DELETE /api/v1/pets/:petId/transfer

# Ownership transfer (recipient-facing)
GET    /api/v1/pet-ownership-transfers/pending
PATCH  /api/v1/pet-ownership-transfers/:transferId/accept
PATCH  /api/v1/pet-ownership-transfers/:transferId/decline
```

---

## Frontend changes (client)

- `GET /api/v1/pets/shared-with-me` → "Shared with me" section on pet list page; each pet card shows permission badges
- Sharing management UI on pet detail page (owner-only): list sharers, invite by email, edit permissions, revoke
- Pending shares inbox (recipient): accept/decline UI
- Transfer initiation UI (owner-only): search by email, confirm dialog
- Pending transfers inbox (recipient): accept with "retain access for original owner" toggle
- All pet detail tabs (vet visits, medications, notes) conditionally rendered based on share permissions returned with `GET /api/v1/pets/shared-with-me`
