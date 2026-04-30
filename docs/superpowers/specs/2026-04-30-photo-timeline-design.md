# Photo Timeline — Design Spec

**Date:** 2026-04-30

## Overview

A top-level Photos page showing a chronological photo timeline across all pets. Photos can be standalone uploads or auto-collected from existing health events (vet visits, notes). Storage moves to Cloudflare R2 with pre-signed URL access. Existing disk-based image storage is migrated.

---

## Data Model

New `Photo` domain entity:

```
Photo
  id          UUID
  petId       UUID (FK → pets)
  groupId     UUID (FK → groups)
  s3Key       string  — R2 object key (e.g. "photos/uuid.jpg")
  takenAt     date    — when the photo was taken (not uploaded)
  caption     string? — optional
  sourceType  'standalone' | 'vet-visit' | 'note'
  sourceId    UUID?   — FK to VetVisit or Note; null for standalone
  createdAt   timestamp
```

- `VetVisit` and `Note` entities lose their `images: string[]` field
- Photos belonging to a visit/note are fetched via `Photo` repository filtered by `sourceId`

---

## Storage: Cloudflare R2

**Why R2:** No egress fees, 10GB free tier, S3-compatible API.

**SDK:** `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` + `multer-s3`

**Env vars required:**
```
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
```

**R2 endpoint:** `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`

**Upload flow:** multer-s3 streams file directly to R2. MIME type validated server-side before upload (using `file-type` package — checks magic bytes, not just extension). 10MB size limit retained.

**Read flow:** API generates pre-signed GET URLs (15-min TTL) for every `Photo` returned. Clients never construct R2 URLs directly.

**Static serving removed:** `express.static('/uploads')` is removed from `app.ts`. No files are served directly by Express in production.

---

## API Endpoints

```
POST   /photos                    Upload standalone photo (multipart/form-data)
                                  Body: file, petId, takenAt, caption?
DELETE /photos/:id                Delete photo (owner/edit permission required)

GET    /photos/timeline           Aggregated timeline
  ?year=2026                      Required — filter by year
  ?petIds[]=uuid                  Optional — filter by pet(s)

GET    /photos/years              List years that have photos (for year picker UI)
  ?petIds[]=uuid                  Optional — same pet filter as timeline

POST   /vet-visits/:id/photos     Attach photo to a vet visit
POST   /notes/:id/photos          Attach photo to a note
```

**Timeline response shape:**
```json
{
  "2026": {
    "04": [{ "id", "url", "takenAt", "caption", "sourceType", "sourceId", "pet": { "id", "name" } }],
    "03": [...]
  }
}
```

`url` is a fresh pre-signed R2 URL (15-min TTL) generated at response time.

---

## Security

1. **Pre-signed URLs** — R2 bucket is private. All photo access goes through API-generated signed URLs. No unauthenticated access.
2. **MIME type validation** — `file-type` checks magic bytes before upload to R2. Extension alone is not trusted.
3. **Group-scoped access** — all photo endpoints check group membership via existing `PetAccessService`. Users can only access photos for pets in their group.
4. **Shared pet permissions** — new `add-photos` permission added to `PetShare`. Required for shared-pet photo uploads (view inherits from existing view permission).
5. **10MB file size limit** — retained from existing upload middleware.

---

## Migration

One-time migration script runs against existing data:

1. **DB migration** — create `photos` table. For each existing image URL in `vet_visits.images` and `notes.images`, insert a `Photo` row with the correct `sourceType`/`sourceId` and an S3 key derived from the filename.
2. **File migration** — upload existing files from `uploads/vet-visits` and `uploads/notes` to R2 under the `photos/` prefix.
3. **Schema cleanup** — drop `images` columns from `vet_visits` and `notes` tables.

The DB migration runs in a transaction with rollback on failure. File uploads to R2 are idempotent (keyed by existing filename UUID).

---

## Client: Photos Page

**Route:** `/photos` — new top-level page added to main nav.

**Year scrapbook view (default):**
- 12 month cells in a grid
- Each cell shows the most recently taken photo as thumbnail + photo count badge
- Empty months shown as faded placeholders
- Year picker to navigate between years
- Pet filter chips at the top (filter by one or more pets)

**Month drill-down:**
- Clicking a month opens a photo grid for that period
- Each photo shows source label ("Vet visit", "Note", or none for standalone)
- Clicking a photo opens a lightbox with full image + caption + event link (if sourced from an event)

**Upload:**
- FAB button to add a standalone photo
- Dialog: file picker, pet selector, date picker (takenAt), optional caption

**API hooks:**
- `usePhotoTimeline(year, petIds)` — fetches grouped timeline data
- `usePhotoYears()` — fetches available years for year picker
- `useUploadPhoto()` — mutation for standalone upload
- `useDeletePhoto()` — mutation for deletion

---

## Out of Scope

- Video support
- Photo editing / cropping
- Sharing individual photos externally
- Cross-group photo access
