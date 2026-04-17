# Google Places Vet Auto-fill Design

**Date:** 2026-04-17
**Status:** Approved

## Overview

Add an optional "Search Google Maps" enhancement to the Add Vet dialog. Users can search for a clinic by name, pick from a results list, and have the vet form fields auto-filled from Google Places data. Manual entry continues to work unchanged.

---

## 1. Data Model

### New field: `rating`

Add `rating?: number` (Google Places returns a float, e.g. `4.5`) to:

| Layer | Change |
|---|---|
| `src/domain/vet/Vet.ts` | Add `rating?: number` to `VetProps` and getter |
| `src/infrastructure/db/models/VetModel.ts` | Add `rating: { type: DataTypes.FLOAT, allowNull: true }` |
| `src/infrastructure/mappers/VetMapper.ts` | Map `rating` in both `toDomain` and `toResponse` |
| `src/application/vet/CreateVetUseCase.ts` | Add `rating?: number` to `CreateVetInput` |
| Client `Vet` type | Add `rating?: number` |
| `VetsPage.tsx` vet card | Show `⭐ 4.5` chip alongside phone/address chips when present |

No migration data loss risk — column is nullable, existing rows get `NULL`.

---

## 2. Backend: Places Proxy Endpoints

Two new authenticated routes under `/places`. Both require JWT. The Google API key lives in `GOOGLE_PLACES_API_KEY` env var, never exposed to the client.

### `GET /places/search?q=<query>`

Calls Google Places New API text search:
```
POST https://places.googleapis.com/v1/places:searchText
X-Goog-FieldMask: places.id,places.displayName,places.formattedAddress
Body: { textQuery: q, maxResultCount: 5 }
```

Returns up to 5 results:
```json
[{ "placeId": "ChIJ...", "name": "Hillcrest Animal Clinic", "address": "123 Main St, Cape Town" }]
```

Cost: ~$0.032/call (cheapest text search field mask).

### `GET /places/details?placeId=<id>`

Calls Google Places New API place details:
```
GET https://places.googleapis.com/v1/places/{placeId}
X-Goog-FieldMask: displayName,formattedAddress,internationalPhoneNumber,rating,regularOpeningHours,googleMapsUri
```

Backend maps the response:
- `displayName.text` → `name`
- `formattedAddress` → `address`
- `internationalPhoneNumber` → `phone`
- `regularOpeningHours.weekdayDescriptions` joined with `\n` → `workHours`
- `rating` → `rating`
- `googleMapsUri` → `googleMapsUrl`

Returns:
```json
{
  "name": "Hillcrest Animal Clinic",
  "address": "123 Main St, Cape Town",
  "phone": "+27 21 555 0100",
  "workHours": "Monday: 8:00 AM – 6:00 PM\nTuesday: 8:00 AM – 6:00 PM\n...",
  "rating": 4.5,
  "googleMapsUrl": "https://maps.google.com/?cid=..."
}
```

Cost: ~$0.017/call.

### New files

| File | Purpose |
|---|---|
| `src/infrastructure/external/GooglePlacesClient.ts` | Wraps both Google API calls; reads `GOOGLE_PLACES_API_KEY` |
| `src/infrastructure/http/controllers/PlacesController.ts` | `search` and `details` handlers |
| `src/infrastructure/http/routes/placesRoutes.ts` | Mounts at `/places`, behind JWT middleware |

---

## 3. Client UI

### New file: `src/api/places.ts`

```ts
placesApi.search(q: string): Promise<{ placeId, name, address }[]>
placesApi.details(placeId: string): Promise<{ name, address, phone, workHours, rating, googleMapsUrl }>
```

### `VetsPage.tsx` — Add Vet dialog

The dialog gains a search state machine with three states: `idle` → `searching` → `done`.

**`idle` state:**
A banner button sits above the manual form fields:
> 🔍 Search Google Maps to auto-fill details

**`searching` state (banner clicked):**
The banner is replaced by an inline search panel:
- Text input + "Search" button
- On submit: calls `placesApi.search(q)`, shows up to 5 results (name + address each)
- Clicking a result: calls `placesApi.details(placeId)`, fills form fields, transitions to `done`
- "✕ cancel search" link returns to `idle`

**`done` state:**
Search panel is replaced by a success indicator:
> ✓ Filled from Google Maps — edit freely

All form fields are populated and fully editable. User can still change any field before clicking Add.

### State variables added to `VetsPage`

```ts
type SearchState = 'idle' | 'searching' | 'done';
const [searchState, setSearchState] = useState<SearchState>('idle');
const [searchQuery, setSearchQuery] = useState('');
const [searchResults, setSearchResults] = useState<PlaceResult[]>([]);
const [isSearching, setIsSearching] = useState(false);
```

Reset `searchState` to `'idle'` and clear `searchQuery`/`searchResults` in both `handleClose` and `onSuccess`.

---

## 4. Error Handling

- Search fails (network/API error): show inline error message within the search panel; form remains usable manually
- Details fetch fails: show inline error; user can try again or enter manually
- No results: show "No results found" within the search panel

---

## 5. Environment

Add to API `.env`:
```
GOOGLE_PLACES_API_KEY=<your-key>
```

Google Cloud setup required: enable **Places API (New)** in the project console.

---

## Files Changed

### API
- `src/domain/vet/Vet.ts`
- `src/infrastructure/db/models/VetModel.ts`
- `src/infrastructure/mappers/VetMapper.ts`
- `src/application/vet/CreateVetUseCase.ts`
- `src/infrastructure/external/GooglePlacesClient.ts` *(new)*
- `src/infrastructure/http/controllers/PlacesController.ts` *(new)*
- `src/infrastructure/http/routes/placesRoutes.ts` *(new)*
- `src/infrastructure/http/app.ts` *(mount placesRoutes)*

### Client
- `src/types.ts` (add `rating` to `Vet`)
- `src/api/places.ts` *(new)*
- `src/pages/vets/VetsPage.tsx`
