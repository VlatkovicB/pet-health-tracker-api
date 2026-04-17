# Google Places Vet Auto-fill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional Google Places auto-fill to the Add Vet dialog — banner button → search → pick clinic → fields fill in.

**Architecture:** Two new proxy endpoints (`GET /places/search`, `GET /places/details`) sit behind JWT auth in the API and call Google Places New API with a server-side key. The client gets a `placesApi` module and a 3-state search UI inside the existing Add Vet dialog in `VetsPage.tsx`. `rating` is a new nullable field added to the Vet model; `sequelize.sync({ alter: true })` handles the column automatically.

**Tech Stack:** Node 20 native `fetch` (no new deps), TypeScript, sequelize-typescript, Express, typedi, React + MUI, TanStack Query

---

## File Map

### API repo (`~/projects/pet-health-tracker-api`)

| File | Action |
|---|---|
| `src/domain/vet/Vet.ts` | Modify — add `rating?: number` |
| `src/infrastructure/db/models/VetModel.ts` | Modify — add `rating` column |
| `src/infrastructure/mappers/VetMapper.ts` | Modify — map `rating` in all three methods |
| `src/application/vet/CreateVetUseCase.ts` | Modify — add `rating` to input |
| `src/infrastructure/external/GooglePlacesClient.ts` | Create — wraps Google Places API calls |
| `src/infrastructure/http/controllers/PlacesController.ts` | Create — `search` and `details` handlers |
| `src/infrastructure/http/routes/placesRoutes.ts` | Create — mounts at `/places` |
| `src/infrastructure/http/routes/index.ts` | Modify — mount `placesRoutes` |

### Client repo (`~/projects/pet-health-tracker-client`)

| File | Action |
|---|---|
| `src/types/index.ts` | Modify — add `rating?: number` to `Vet` |
| `src/api/places.ts` | Create — `placesApi.search` and `placesApi.details` |
| `src/pages/vets/VetsPage.tsx` | Modify — rating chip on card + search state machine in dialog |

---

### Task 1: Add `rating` to Vet domain entity

**Files:**
- Modify: `src/domain/vet/Vet.ts`

- [ ] **Step 1: Update `VetProps` and getter**

Open `src/domain/vet/Vet.ts`. Add `rating` to the interface and class:

```typescript
interface VetProps {
  userId: string;
  name: string;
  address?: string;
  phone?: string;
  workHours?: string;
  googleMapsUrl?: string;
  rating?: number;
  notes?: string;
  createdAt: Date;
}

export class Vet extends Entity<VetProps> {
  get userId(): string { return this.props.userId; }
  get name(): string { return this.props.name; }
  get address(): string | undefined { return this.props.address; }
  get phone(): string | undefined { return this.props.phone; }
  get workHours(): string | undefined { return this.props.workHours; }
  get googleMapsUrl(): string | undefined { return this.props.googleMapsUrl; }
  get rating(): number | undefined { return this.props.rating; }
  get notes(): string | undefined { return this.props.notes; }
  get createdAt(): Date { return this.props.createdAt; }

  static create(props: Omit<VetProps, 'createdAt'>, id?: UniqueEntityId): Vet {
    return new Vet({ ...props, createdAt: new Date() }, id);
  }

  static reconstitute(props: VetProps, id: UniqueEntityId): Vet {
    return new Vet(props, id);
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd ~/projects/pet-health-tracker-api
git add src/domain/vet/Vet.ts
git commit -m "feat(vet): add rating field to Vet domain entity"
```

---

### Task 2: Add `rating` to VetModel and VetMapper

**Files:**
- Modify: `src/infrastructure/db/models/VetModel.ts`
- Modify: `src/infrastructure/mappers/VetMapper.ts`

- [ ] **Step 1: Add column to VetModel**

In `src/infrastructure/db/models/VetModel.ts`, add after the `googleMapsUrl` column:

```typescript
@Column({ type: DataType.FLOAT, allowNull: true })
declare rating: number | null;
```

The full file becomes:

```typescript
import { BelongsTo, Column, DataType, ForeignKey, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { UserModel } from './UserModel';

@Table({ tableName: 'vets', timestamps: false })
export class VetModel extends Model {
  @PrimaryKey
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => UserModel)
  @Column({ type: DataType.UUID, allowNull: false, field: 'user_id' })
  declare userId: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare name: string;

  @Column({ type: DataType.STRING, allowNull: true })
  declare address: string | null;

  @Column({ type: DataType.STRING, allowNull: true })
  declare phone: string | null;

  @Column({ type: DataType.STRING, allowNull: true, field: 'work_hours' })
  declare workHours: string | null;

  @Column({ type: DataType.STRING, allowNull: true, field: 'google_maps_url' })
  declare googleMapsUrl: string | null;

  @Column({ type: DataType.FLOAT, allowNull: true })
  declare rating: number | null;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare notes: string | null;

  @Column({ type: DataType.DATE, allowNull: false, field: 'created_at' })
  declare createdAt: Date;

  @BelongsTo(() => UserModel)
  declare user: UserModel;
}
```

- [ ] **Step 2: Update VetMapper**

Replace `src/infrastructure/mappers/VetMapper.ts` with:

```typescript
import { Service } from 'typedi';
import { VetModel } from '../db/models/VetModel';
import { Vet } from '../../domain/vet/Vet';
import { UniqueEntityId } from '../../domain/shared/UniqueEntityId';

export interface VetResponseDto {
  id: string;
  userId: string;
  name: string;
  address?: string;
  phone?: string;
  workHours?: string;
  googleMapsUrl?: string;
  rating?: number;
  notes?: string;
  createdAt: string;
}

@Service()
export class VetMapper {
  toDomain(model: VetModel): Vet {
    return Vet.reconstitute(
      {
        userId: model.userId,
        name: model.name,
        address: model.address ?? undefined,
        phone: model.phone ?? undefined,
        workHours: model.workHours ?? undefined,
        googleMapsUrl: model.googleMapsUrl ?? undefined,
        rating: model.rating ?? undefined,
        notes: model.notes ?? undefined,
        createdAt: model.createdAt,
      },
      new UniqueEntityId(model.id),
    );
  }

  toPersistence(vet: Vet): object {
    return {
      id: vet.id.toValue(),
      userId: vet.userId,
      name: vet.name,
      address: vet.address ?? null,
      phone: vet.phone ?? null,
      workHours: vet.workHours ?? null,
      googleMapsUrl: vet.googleMapsUrl ?? null,
      rating: vet.rating ?? null,
      notes: vet.notes ?? null,
      createdAt: vet.createdAt,
    };
  }

  toResponse(vet: Vet): VetResponseDto {
    return {
      id: vet.id.toValue(),
      userId: vet.userId,
      name: vet.name,
      address: vet.address,
      phone: vet.phone,
      workHours: vet.workHours,
      googleMapsUrl: vet.googleMapsUrl,
      rating: vet.rating,
      notes: vet.notes,
      createdAt: vet.createdAt.toISOString(),
    };
  }
}
```

- [ ] **Step 3: Update CreateVetUseCase**

In `src/application/vet/CreateVetUseCase.ts`, add `rating?: number` to `CreateVetInput` and pass it to `Vet.create`:

```typescript
import { Inject, Service } from 'typedi';
import { VetRepository, VET_REPOSITORY } from '../../domain/vet/VetRepository';
import { Vet } from '../../domain/vet/Vet';

interface CreateVetInput {
  name: string;
  address?: string;
  phone?: string;
  workHours?: string;
  googleMapsUrl?: string;
  rating?: number;
  notes?: string;
  requestingUserId: string;
}

@Service()
export class CreateVetUseCase {
  constructor(
    @Inject(VET_REPOSITORY) private readonly vetRepository: VetRepository,
  ) {}

  async execute(input: CreateVetInput): Promise<Vet> {
    const vet = Vet.create({
      userId: input.requestingUserId,
      name: input.name,
      address: input.address,
      phone: input.phone,
      workHours: input.workHours,
      googleMapsUrl: input.googleMapsUrl,
      rating: input.rating,
      notes: input.notes,
    });

    await this.vetRepository.save(vet);
    return vet;
  }
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd ~/projects/pet-health-tracker-api
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/db/models/VetModel.ts src/infrastructure/mappers/VetMapper.ts src/application/vet/CreateVetUseCase.ts
git commit -m "feat(vet): add rating field to VetModel, VetMapper, and CreateVetUseCase"
```

---

### Task 3: Create GooglePlacesClient

**Files:**
- Create: `src/infrastructure/external/GooglePlacesClient.ts`

- [ ] **Step 1: Create the client**

Create directory and file:

```bash
mkdir -p ~/projects/pet-health-tracker-api/src/infrastructure/external
```

Write `src/infrastructure/external/GooglePlacesClient.ts`:

```typescript
import { Service } from 'typedi';

export interface PlaceSearchResult {
  placeId: string;
  name: string;
  address: string;
}

export interface PlaceDetails {
  name: string;
  address: string;
  phone?: string;
  workHours?: string;
  rating?: number;
  googleMapsUrl?: string;
}

@Service()
export class GooglePlacesClient {
  private readonly apiKey = process.env.GOOGLE_PLACES_API_KEY ?? '';
  private readonly baseUrl = 'https://places.googleapis.com/v1';

  async search(query: string): Promise<PlaceSearchResult[]> {
    const res = await fetch(`${this.baseUrl}/places:searchText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress',
      },
      body: JSON.stringify({ textQuery: query, maxResultCount: 5 }),
    });

    if (!res.ok) {
      throw new Error(`Places search failed: ${res.status}`);
    }

    const data = await res.json() as { places?: Array<{ id: string; displayName: { text: string }; formattedAddress: string }> };

    return (data.places ?? []).map((p) => ({
      placeId: p.id,
      name: p.displayName.text,
      address: p.formattedAddress,
    }));
  }

  async details(placeId: string): Promise<PlaceDetails> {
    const fieldMask = [
      'displayName',
      'formattedAddress',
      'internationalPhoneNumber',
      'rating',
      'regularOpeningHours',
      'googleMapsUri',
    ].join(',');

    const res = await fetch(`${this.baseUrl}/places/${placeId}`, {
      headers: {
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask': fieldMask,
      },
    });

    if (!res.ok) {
      throw new Error(`Places details failed: ${res.status}`);
    }

    const p = await res.json() as {
      displayName?: { text: string };
      formattedAddress?: string;
      internationalPhoneNumber?: string;
      rating?: number;
      regularOpeningHours?: { weekdayDescriptions?: string[] };
      googleMapsUri?: string;
    };

    const weekdays = p.regularOpeningHours?.weekdayDescriptions ?? [];

    return {
      name: p.displayName?.text ?? '',
      address: p.formattedAddress ?? '',
      phone: p.internationalPhoneNumber,
      workHours: weekdays.length > 0 ? weekdays.join('\n') : undefined,
      rating: p.rating,
      googleMapsUrl: p.googleMapsUri,
    };
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd ~/projects/pet-health-tracker-api
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/external/GooglePlacesClient.ts
git commit -m "feat(places): add GooglePlacesClient wrapping Places New API"
```

---

### Task 4: Create PlacesController and placesRoutes, mount in router

**Files:**
- Create: `src/infrastructure/http/controllers/PlacesController.ts`
- Create: `src/infrastructure/http/routes/placesRoutes.ts`
- Modify: `src/infrastructure/http/routes/index.ts`

- [ ] **Step 1: Create PlacesController**

Write `src/infrastructure/http/controllers/PlacesController.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import { Service } from 'typedi';
import { GooglePlacesClient } from '../../external/GooglePlacesClient';

@Service()
export class PlacesController {
  constructor(private readonly placesClient: GooglePlacesClient) {}

  search = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const q = (req.query.q as string | undefined)?.trim();
      if (!q) {
        res.status(400).json({ message: 'Missing query parameter: q' });
        return;
      }
      const results = await this.placesClient.search(q);
      res.json(results);
    } catch (err) {
      next(err);
    }
  };

  details = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const placeId = (req.query.placeId as string | undefined)?.trim();
      if (!placeId) {
        res.status(400).json({ message: 'Missing query parameter: placeId' });
        return;
      }
      const detail = await this.placesClient.details(placeId);
      res.json(detail);
    } catch (err) {
      next(err);
    }
  };
}
```

- [ ] **Step 2: Create placesRoutes**

Write `src/infrastructure/http/routes/placesRoutes.ts`:

```typescript
import { Router } from 'express';
import { Container } from 'typedi';
import { PlacesController } from '../controllers/PlacesController';
import { authMiddleware } from '../middleware/authMiddleware';

export function placesRoutes(): Router {
  const router = Router();
  const controller = Container.get(PlacesController);

  router.get('/search', authMiddleware, controller.search);
  router.get('/details', authMiddleware, controller.details);

  return router;
}
```

- [ ] **Step 3: Mount in buildRouter**

In `src/infrastructure/http/routes/index.ts`, add the import and mount:

```typescript
import { Router } from 'express';
import { Container } from 'typedi';
import { authRoutes } from './authRoutes';
import { petRoutes } from './petRoutes';
import { healthRoutes } from './healthRoutes';
import { reminderRoutes } from './reminderRoutes';
import { vetRoutes } from './vetRoutes';
import { userRoutes } from './userRoutes';
import { placesRoutes } from './placesRoutes';
import { authMiddleware } from '../middleware/authMiddleware';
import { HealthController } from '../controllers/HealthController';

export function buildRouter(): Router {
  const router = Router();

  router.use('/auth', authRoutes());
  router.use('/users', userRoutes());
  router.use('/pets', petRoutes());
  router.use('/pets', healthRoutes());
  router.use('/vets', vetRoutes());
  router.use('/medications', reminderRoutes());
  router.use('/places', placesRoutes());
  router.get('/vet-visits/upcoming', authMiddleware, Container.get(HealthController).getUpcomingVetVisits);
  router.get('/vet-visits', authMiddleware, Container.get(HealthController).getVetVisitsByDateRange);

  return router;
}
```

- [ ] **Step 4: Add env var to .env**

Open `~/projects/pet-health-tracker-api/.env` and add:

```
GOOGLE_PLACES_API_KEY=your-key-here
```

(Get the key from Google Cloud Console → APIs & Services → Credentials. Enable **Places API (New)** in the project.)

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd ~/projects/pet-health-tracker-api
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Smoke test the endpoints**

Start the server:
```bash
npm run dev
```

In another terminal (replace `TOKEN` with a valid JWT from login):
```bash
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:3000/api/v1/places/search?q=animal+clinic"
```
Expected: JSON array of `{ placeId, name, address }` objects.

```bash
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:3000/api/v1/places/details?placeId=PLACE_ID_FROM_ABOVE"
```
Expected: JSON object with `{ name, address, phone, workHours, rating, googleMapsUrl }`.

- [ ] **Step 7: Commit**

```bash
git add src/infrastructure/http/controllers/PlacesController.ts \
        src/infrastructure/http/routes/placesRoutes.ts \
        src/infrastructure/http/routes/index.ts
git commit -m "feat(places): add Places proxy endpoints for search and details"
```

---

### Task 5: Add `rating` to client Vet type and show on card

**Files:**
- Modify: `src/types/index.ts` (client repo)
- Modify: `src/pages/vets/VetsPage.tsx` (client repo)

- [ ] **Step 1: Update Vet type**

In `~/projects/pet-health-tracker-client/src/types/index.ts`, update the `Vet` interface:

```typescript
export interface Vet {
  id: string;
  userId: string;
  name: string;
  address?: string;
  phone?: string;
  workHours?: string;
  googleMapsUrl?: string;
  rating?: number;
  notes?: string;
  createdAt: string;
}
```

- [ ] **Step 2: Add rating chip to vet card in VetsPage**

In `src/pages/vets/VetsPage.tsx`, add a `Star` icon import and rating chip. Find the chip row (around line 110) and add the rating chip:

```tsx
import { Add, Phone, LocationOn, AccessTime, Map, MedicalServices, Star } from '@mui/icons-material';
```

Inside the chips `Box`, add after the phone chip and before workHours:

```tsx
{vet.rating && (
  <Chip
    icon={<Star sx={{ fontSize: '14px !important', color: 'warning.main !important' }} />}
    label={vet.rating.toFixed(1)}
    size="small"
    variant="outlined"
  />
)}
```

The full chips section becomes:

```tsx
{(vet.phone || vet.rating || vet.workHours || vet.address || vet.googleMapsUrl) && (
  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
    {vet.phone && (
      <Chip icon={<Phone sx={{ fontSize: '14px !important' }} />} label={vet.phone} size="small" variant="outlined" />
    )}
    {vet.rating && (
      <Chip
        icon={<Star sx={{ fontSize: '14px !important', color: 'warning.main !important' }} />}
        label={vet.rating.toFixed(1)}
        size="small"
        variant="outlined"
      />
    )}
    {vet.workHours && (
      <Chip icon={<AccessTime sx={{ fontSize: '14px !important' }} />} label={vet.workHours} size="small" variant="outlined" />
    )}
    {vet.address && (
      <Chip icon={<LocationOn sx={{ fontSize: '14px !important' }} />} label={vet.address} size="small" variant="outlined" />
    )}
    {vet.googleMapsUrl && (
      <Chip
        icon={<Map sx={{ fontSize: '14px !important' }} />}
        label={<Link href={vet.googleMapsUrl} target="_blank" rel="noopener" underline="none" color="primary">Maps</Link>}
        size="small"
        variant="outlined"
        color="primary"
      />
    )}
  </Box>
)}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd ~/projects/pet-health-tracker-client
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd ~/projects/pet-health-tracker-client
git add src/types/index.ts src/pages/vets/VetsPage.tsx
git commit -m "feat(vet): add rating field to Vet type and show star chip on vet card"
```

---

### Task 6: Create client Places API module

**Files:**
- Create: `src/api/places.ts` (client repo)

- [ ] **Step 1: Create places.ts**

Write `~/projects/pet-health-tracker-client/src/api/places.ts`:

```typescript
import { apiClient } from './client';

export interface PlaceSearchResult {
  placeId: string;
  name: string;
  address: string;
}

export interface PlaceDetails {
  name: string;
  address: string;
  phone?: string;
  workHours?: string;
  rating?: number;
  googleMapsUrl?: string;
}

export const placesApi = {
  search: (q: string) =>
    apiClient.get<PlaceSearchResult[]>('/places/search', { params: { q } }).then((r) => r.data),

  details: (placeId: string) =>
    apiClient.get<PlaceDetails>('/places/details', { params: { placeId } }).then((r) => r.data),
};
```

- [ ] **Step 2: Commit**

```bash
cd ~/projects/pet-health-tracker-client
git add src/api/places.ts
git commit -m "feat(places): add client-side Places API module"
```

---

### Task 7: Add Google Maps search UI to Add Vet dialog

**Files:**
- Modify: `src/pages/vets/VetsPage.tsx` (client repo)

This is the largest change. The dialog gets a 3-state search machine: `idle` → `searching` → `done`.

- [ ] **Step 1: Add search state and handlers to VetsPage**

At the top of `VetsPage`, add the import and state variables. Add these imports alongside existing ones:

```tsx
import { placesApi, PlaceSearchResult, PlaceDetails } from '../../api/places';
```

Add these state variables inside `VetsPage` (after existing `form` state):

```tsx
type SearchState = 'idle' | 'searching' | 'done';
const [searchState, setSearchState] = useState<SearchState>('idle');
const [searchQuery, setSearchQuery] = useState('');
const [searchResults, setSearchResults] = useState<PlaceSearchResult[]>([]);
const [isSearchLoading, setIsSearchLoading] = useState(false);
const [searchError, setSearchError] = useState<string | null>(null);
```

Add these handlers inside `VetsPage` (before the `return`):

```tsx
const handleSearch = async () => {
  if (!searchQuery.trim()) return;
  setIsSearchLoading(true);
  setSearchError(null);
  setSearchResults([]);
  try {
    const results = await placesApi.search(searchQuery.trim());
    setSearchResults(results);
  } catch {
    setSearchError('Search failed. Try again or enter details manually.');
  } finally {
    setIsSearchLoading(false);
  }
};

const handlePickPlace = async (placeId: string) => {
  setIsSearchLoading(true);
  setSearchError(null);
  try {
    const details: PlaceDetails = await placesApi.details(placeId);
    setForm((f) => ({
      ...f,
      name: details.name || f.name,
      address: details.address || f.address,
      phone: details.phone || f.phone,
      workHours: details.workHours || f.workHours,
      googleMapsUrl: details.googleMapsUrl || f.googleMapsUrl,
      rating: details.rating !== undefined ? String(details.rating) : f.rating,
    }));
    setSearchState('done');
  } catch {
    setSearchError('Could not load details. Try again or enter manually.');
  } finally {
    setIsSearchLoading(false);
  }
};

const resetSearch = () => {
  setSearchState('idle');
  setSearchQuery('');
  setSearchResults([]);
  setSearchError(null);
};
```

- [ ] **Step 2: Add `rating` to form state**

Update the `form` state initializer (and its reset in `onSuccess` and the close handler) to include `rating`:

```tsx
const [form, setForm] = useState({
  name: '', address: '', phone: '', workHours: '', googleMapsUrl: '', notes: '', rating: '',
});
```

In the `mutation` `onSuccess` callback:
```tsx
setForm({ name: '', address: '', phone: '', workHours: '', googleMapsUrl: '', notes: '', rating: '' });
resetSearch();
```

In the dialog's `onClose` handler (update the `setOpen(false)` button):
```tsx
onClick={() => { setOpen(false); setForm({ name: '', address: '', phone: '', workHours: '', googleMapsUrl: '', notes: '', rating: '' }); resetSearch(); }}
```

- [ ] **Step 3: Pass `rating` in the mutation**

Update the `mutationFn` in the mutation:

```tsx
const mutation = useMutation({
  mutationFn: () => vetsApi.create({
    name: form.name,
    address: form.address || undefined,
    phone: form.phone || undefined,
    workHours: form.workHours || undefined,
    googleMapsUrl: form.googleMapsUrl || undefined,
    rating: form.rating ? Number(form.rating) : undefined,
    notes: form.notes || undefined,
  }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['vets'] });
    queryClient.invalidateQueries({ queryKey: ['vets-all'] });
    setOpen(false);
    setForm({ name: '', address: '', phone: '', workHours: '', googleMapsUrl: '', notes: '', rating: '' });
    resetSearch();
  },
  onError: (err) => showError(getApiError(err)),
});
```

- [ ] **Step 4: Replace dialog content with search-aware version**

Replace the `<DialogContent>` block entirely:

```tsx
<DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 0.5 }}>
  {/* --- Search banner / panel --- */}
  {searchState === 'idle' && (
    <Box
      onClick={() => setSearchState('searching')}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1.5,
        px: 2, py: 1.25, borderRadius: 2,
        border: '1px dashed', borderColor: 'primary.main',
        color: 'primary.main', cursor: 'pointer',
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      <Map sx={{ fontSize: 18 }} />
      <Typography variant="body2">Search Google Maps to auto-fill details</Typography>
    </Box>
  )}

  {searchState === 'searching' && (
    <Box sx={{ border: '1px solid', borderColor: 'primary.main', borderRadius: 2, p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Search for a clinic..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
          autoFocus
        />
        <Button
          variant="contained"
          size="small"
          onClick={handleSearch}
          disabled={isSearchLoading || !searchQuery.trim()}
          sx={{ whiteSpace: 'nowrap' }}
        >
          {isSearchLoading ? '...' : 'Search'}
        </Button>
      </Box>

      {searchError && (
        <Typography variant="caption" color="error">{searchError}</Typography>
      )}

      {searchResults.length === 0 && !isSearchLoading && !searchError && searchQuery && (
        <Typography variant="caption" color="text.secondary">No results found</Typography>
      )}

      {searchResults.map((r) => (
        <Box
          key={r.placeId}
          onClick={() => handlePickPlace(r.placeId)}
          sx={{
            px: 1.5, py: 1, borderRadius: 1, cursor: 'pointer',
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }}>{r.name}</Typography>
          <Typography variant="caption" color="text.secondary">{r.address}</Typography>
        </Box>
      ))}

      <Box sx={{ textAlign: 'right' }}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ cursor: 'pointer', '&:hover': { color: 'text.primary' } }}
          onClick={resetSearch}
        >
          ✕ cancel search
        </Typography>
      </Box>
    </Box>
  )}

  {searchState === 'done' && (
    <Box
      sx={{
        display: 'flex', alignItems: 'center', gap: 1,
        px: 2, py: 1, borderRadius: 2,
        bgcolor: 'success.main', color: 'success.contrastText',
        opacity: 0.85,
      }}
    >
      <Typography variant="caption">✓ Filled from Google Maps — edit freely</Typography>
    </Box>
  )}

  {/* --- Manual form fields --- */}
  <TextField label="Name" value={form.name} onChange={set('name')} fullWidth required autoFocus={searchState === 'idle'} />
  <TextField label="Phone" value={form.phone} onChange={set('phone')} fullWidth />
  <TextField label="Address" value={form.address} onChange={set('address')} fullWidth />
  <TextField label="Work Hours" placeholder="e.g. Mon–Fri 8:00–18:00" value={form.workHours} onChange={set('workHours')} fullWidth multiline rows={2} />
  <TextField label="Google Maps URL" value={form.googleMapsUrl} onChange={set('googleMapsUrl')} fullWidth />
  <TextField label="Notes" value={form.notes} onChange={set('notes')} fullWidth multiline rows={3} />
</DialogContent>
```

Also update the `Cancel` button's `onClick` to call the reset:

```tsx
<Button onClick={() => { setOpen(false); setForm({ name: '', address: '', phone: '', workHours: '', googleMapsUrl: '', notes: '', rating: '' }); resetSearch(); }} color="inherit">Cancel</Button>
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd ~/projects/pet-health-tracker-client
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Manual smoke test**

Start both API and client. Open Vets page, click "Add Vet". Verify:
- Banner button visible
- Clicking it shows search panel
- Typing and searching returns results
- Clicking a result fills the form fields
- Green "Filled from Google Maps" banner appears
- Fields are editable after fill
- Submitting saves the vet with `rating` populated
- Vet card shows ⭐ rating chip
- Cancel resets everything cleanly
- Adding a vet manually (ignoring banner) still works

- [ ] **Step 7: Commit**

```bash
cd ~/projects/pet-health-tracker-client
git add src/pages/vets/VetsPage.tsx src/api/places.ts src/types/index.ts
git commit -m "feat(vets): add Google Maps Places search to Add Vet dialog"
```
