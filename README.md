# Pet Health Tracker API

REST API for tracking pet health records across a shared group of users.

## Stack

- **Runtime:** Node.js + TypeScript
- **Framework:** Express + routing-controllers
- **ORM:** sequelize-typescript + PostgreSQL
- **Auth:** JWT + bcrypt
- **File uploads:** multer (disk storage)
- **Job queue:** BullMQ + Redis (medication & vet visit reminders)
- **Email:** nodemailer (SMTP)
- **DI:** typedi
- **Validation:** Zod
- **Architecture:** DDD with OOP

## Features

- **Auth** — register/login, JWT-based
- **Pets** — group-scoped pet profiles with photo upload; sharing with per-user permissions; ownership transfer via email invite
- **Vets** — group-scoped vet directory (name, address, phone, hours, maps link); Google Places integration for address lookup
- **Vet visits** — `scheduled` (future) and `logged` (past) discriminated union; attach photos; configurable reminders
- **Medications** — log medications with dosage; configurable daily/weekly/monthly reminders via BullMQ with exact times and days
- **Notes** — multi-pet journal entries with image attachments
- **User profile** — display name, theme preference

## API Routes

All routes require `Authorization: Bearer <token>` except auth endpoints.  
List endpoints support `?page=1&limit=20` pagination.

```
POST   /api/v1/auth/register
POST   /api/v1/auth/login

GET    /api/v1/users/me
PATCH  /api/v1/users/me

GET    /api/v1/pets
POST   /api/v1/pets
GET    /api/v1/pets/:petId
PUT    /api/v1/pets/:petId
POST   /api/v1/pets/:petId/photo

POST   /api/v1/pets/:petId/transfer
DELETE /api/v1/pets/:petId/transfer

GET    /api/v1/pets/:petId/shares
POST   /api/v1/pets/:petId/shares
PUT    /api/v1/pets/:petId/shares/:shareId
DELETE /api/v1/pets/:petId/shares/:shareId
GET    /api/v1/pets/shared-with-me

GET    /api/v1/pets/:petId/vet-visits
POST   /api/v1/pets/:petId/vet-visits
PUT    /api/v1/pets/:petId/vet-visits/:visitId
PATCH  /api/v1/pets/:petId/vet-visits/:visitId/complete
GET    /api/v1/pets/:petId/vet-visits/:visitId/reminder
PUT    /api/v1/pets/:petId/vet-visits/:visitId/reminder
POST   /api/v1/pets/:petId/vet-visits/:visitId/images

GET    /api/v1/vet-visits/upcoming
GET    /api/v1/vet-visits

GET    /api/v1/pets/:petId/medications
POST   /api/v1/pets/:petId/medications
PUT    /api/v1/pets/:petId/medications/:medicationId

GET    /api/v1/medications/:medicationId/reminder
PUT    /api/v1/medications/:medicationId/reminder
PATCH  /api/v1/medications/:medicationId/reminder/toggle

GET    /api/v1/notes
POST   /api/v1/notes
PUT    /api/v1/notes/:noteId
DELETE /api/v1/notes/:noteId
POST   /api/v1/notes/:noteId/images

GET    /api/v1/vets
POST   /api/v1/vets
PUT    /api/v1/vets/:id

GET    /api/v1/places/search
GET    /api/v1/places/details

GET    /api/v1/pet-shares/pending
PATCH  /api/v1/pet-shares/:shareId/accept
PATCH  /api/v1/pet-shares/:shareId/decline

GET    /api/v1/pet-ownership-transfers/pending
PATCH  /api/v1/pet-ownership-transfers/:transferId/accept
PATCH  /api/v1/pet-ownership-transfers/:transferId/decline
```

## Known Issues

- `GET /pet-ownership-transfers/pending` response is missing `petName` and `fromUserEmail` fields expected by the frontend
- `PUT /medications/:medicationId/reminder` requires a `schedule` field that the frontend currently omits

## Setup

```bash
pnpm install
cp .env.example .env   # fill in DB, JWT, SMTP, Redis config
pnpm dev
```

Requires PostgreSQL and Redis running locally.
