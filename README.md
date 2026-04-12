# Pet Health Tracker API

REST API for tracking pet health records across a shared group of users.

## Stack

- **Runtime:** Node.js + TypeScript
- **Framework:** Express
- **ORM:** sequelize-typescript + PostgreSQL
- **Auth:** JWT + bcrypt
- **File uploads:** multer (disk storage)
- **Job queue:** BullMQ + Redis (medication reminders)
- **Email:** nodemailer (SMTP)
- **DI:** typedi
- **Architecture:** DDD with OOP

## Features

- **Auth** — register/login, JWT-based
- **Groups** — users belong to groups with `owner` / `member` roles; owners can invite
- **Pets** — group-scoped pet profiles with photo upload
- **Vets** — group-scoped vet directory (name, address, phone, hours, maps link)
- **Vet visits** — create, update, attach photos; optional next-visit scheduling
- **Medications** — log medications with dosage; configurable reminders via BullMQ with precise daily/weekly/monthly schedules (exact times and days)

## API Routes

```
POST   /api/v1/auth/register
POST   /api/v1/auth/login

POST   /api/v1/groups
POST   /api/v1/groups/:groupId/invite
GET    /api/v1/groups/:groupId/pets
POST   /api/v1/groups/:groupId/pets
GET    /api/v1/groups/:groupId/pets/:petId
PUT    /api/v1/groups/:groupId/pets/:petId
POST   /api/v1/groups/:groupId/pets/:petId/photo
GET    /api/v1/groups/:groupId/vets
POST   /api/v1/groups/:groupId/vets

GET    /api/v1/pets/:petId/vet-visits
POST   /api/v1/pets/:petId/vet-visits
PUT    /api/v1/pets/:petId/vet-visits/:visitId
POST   /api/v1/pets/:petId/vet-visits/:visitId/images
POST   /api/v1/pets/:petId/medications
GET    /api/v1/pets/:petId/symptoms
POST   /api/v1/pets/:petId/symptoms
GET    /api/v1/pets/:petId/health-checks
POST   /api/v1/pets/:petId/health-checks

PUT    /api/v1/medications/:medicationId/reminder
PATCH  /api/v1/medications/:medicationId/reminder/toggle
```

All routes except auth require a `Authorization: Bearer <token>` header.  
List endpoints support `?page=1&limit=20` pagination.

## Setup

```bash
pnpm install
cp .env.example .env   # fill in DB, JWT, SMTP, Redis config
pnpm dev
```

Requires PostgreSQL and Redis running locally.
