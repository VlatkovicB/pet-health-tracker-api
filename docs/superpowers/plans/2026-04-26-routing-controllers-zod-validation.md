# routing-controllers + Zod Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate all Express controllers to `routing-controllers` decorator-driven classes and add Zod validation via a custom `@Validate({ body?, query? })` method decorator.

**Architecture:** `useExpressServer()` replaces manual route registration. Each controller becomes a `@JsonController` class with method decorators instead of arrow-function handlers. A `@Validate` method decorator wraps `@UseBefore` to validate `req.body`/`req.query` with Zod before the controller method runs — on failure it throws the existing `ValidationError` (→ 400). Auth is enforced per-controller via `@UseBefore(authMiddleware)` on all controllers except `AuthController`.

**Tech Stack:** `routing-controllers`, `zod`, `typedi` (existing), Express (existing)

---

## File Map

**New files:**
- `src/infrastructure/http/decorators/Validate.ts`
- `src/infrastructure/http/schemas/authSchemas.ts`
- `src/infrastructure/http/schemas/userSchemas.ts`
- `src/infrastructure/http/schemas/petSchemas.ts`
- `src/infrastructure/http/schemas/vetSchemas.ts`
- `src/infrastructure/http/schemas/healthSchemas.ts`
- `src/infrastructure/http/schemas/reminderSchemas.ts`
- `src/infrastructure/http/schemas/noteSchemas.ts`
- `src/infrastructure/http/schemas/shareSchemas.ts`
- `src/infrastructure/http/schemas/transferSchemas.ts`
- `src/infrastructure/http/schemas/placesSchemas.ts`
- `src/infrastructure/http/controllers/PetShareInboxController.ts`
- `src/infrastructure/http/controllers/PetTransferInboxController.ts`
- `src/infrastructure/http/controllers/VetVisitController.ts`
- `src/test/validate.test.ts`

**Modified files:**
- `src/app.ts`
- `src/infrastructure/http/controllers/AuthController.ts`
- `src/infrastructure/http/controllers/UserController.ts`
- `src/infrastructure/http/controllers/PetController.ts`
- `src/infrastructure/http/controllers/VetController.ts`
- `src/infrastructure/http/controllers/HealthController.ts`
- `src/infrastructure/http/controllers/ReminderController.ts`
- `src/infrastructure/http/controllers/NoteController.ts`
- `src/infrastructure/http/controllers/ShareController.ts`
- `src/infrastructure/http/controllers/TransferController.ts`
- `src/infrastructure/http/controllers/PlacesController.ts`

**Deleted files:**
- All `src/infrastructure/http/routes/*.ts` (replaced by controller decorators)

---

## Task 1: Install dependencies

**Files:** `package.json`

- [ ] **Step 1: Install runtime deps**

```bash
cd pet-health-tracker-api
pnpm add routing-controllers zod
```

- [ ] **Step 2: Install test dep**

```bash
pnpm add -D supertest @types/supertest
```

- [ ] **Step 3: Verify tsconfig is ready**

Open `tsconfig.json` — confirm these two options are present (they already are):
```json
"experimentalDecorators": true,
"emitDecoratorMetadata": true
```

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add routing-controllers, zod, supertest"
```

---

## Task 2: Create `@Validate` decorator + test

**Files:**
- Create: `src/infrastructure/http/decorators/Validate.ts`
- Create: `src/test/validate.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/test/validate.test.ts`:

```ts
import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { Validate } from '../infrastructure/http/decorators/Validate';
import { errorMiddleware } from '../infrastructure/http/middleware/errorMiddleware';

function makeApp(schema: Parameters<typeof Validate>[0]) {
  const app = express();
  app.use(express.json());
  const middleware = (Validate(schema) as any).middleware ?? [];
  // Validate returns a UseBefore decorator — extract the middleware function directly for testing
  // We'll call the inner function by simulating UseBefore manually
  app.post('/test', (req, res, next) => {
    const fn = (Validate(schema) as any);
    // Rebuild: create a minimal express route that runs the validation middleware
    next();
  }, (req, res) => res.json({ ok: true }));
  app.use(errorMiddleware);
  return app;
}

// NOTE: The above approach is awkward. Instead, test @Validate via a real Express middleware chain.

import { Request, Response, NextFunction } from 'express';

function extractMiddleware(schema: Parameters<typeof Validate>[0]): (req: Request, res: Response, next: NextFunction) => void {
  // Validate() returns a method decorator that calls UseBefore(fn).
  // We need to extract the raw middleware function for unit testing.
  // We do this by spying on what UseBefore receives.
  let captured: Function | undefined;
  const original = require('routing-controllers').UseBefore;
  jest.spyOn(require('routing-controllers'), 'UseBefore').mockImplementationOnce((fn: Function) => {
    captured = fn;
    return () => {};
  });
  Validate(schema);
  jest.restoreAllMocks();
  return captured as any;
}

describe('@Validate decorator', () => {
  const BodySchema = z.object({ name: z.string().min(1), age: z.number() });
  const QuerySchema = z.object({ page: z.coerce.number().default(1) });

  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    const bodyMiddleware = extractMiddleware({ body: BodySchema });
    const queryMiddleware = extractMiddleware({ query: QuerySchema });
    app.post('/body', bodyMiddleware, (_req, res) => res.json({ name: _req.body.name }));
    app.get('/query', queryMiddleware, (_req, res) => res.json({ page: _req.query.page }));
    app.use(errorMiddleware);
  });

  it('passes valid body and mutates req.body with parsed data', async () => {
    const res = await request(app).post('/body').send({ name: 'Rex', age: 3 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ name: 'Rex' });
  });

  it('rejects invalid body with 400 and field-level message', async () => {
    const res = await request(app).post('/body').send({ age: 'not-a-number' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name/);
  });

  it('passes valid query and applies coerce transform', async () => {
    const res = await request(app).get('/query?page=3');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ page: 3 });
  });

  it('uses default value when query param is missing', async () => {
    const res = await request(app).get('/query');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ page: 1 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test src/test/validate.test.ts
```

Expected: FAIL — `Cannot find module '../infrastructure/http/decorators/Validate'`

- [ ] **Step 3: Create `Validate.ts`**

Create `src/infrastructure/http/decorators/Validate.ts`:

```ts
import { UseBefore } from 'routing-controllers';
import { ZodSchema, ZodIssue } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../../../shared/errors/AppError';

export function Validate(options: { body?: ZodSchema; query?: ZodSchema }) {
  return UseBefore((req: Request, _res: Response, next: NextFunction) => {
    try {
      if (options.body) {
        const result = options.body.safeParse(req.body);
        if (!result.success) throw toValidationError(result.error.issues);
        req.body = result.data;
      }
      if (options.query) {
        const result = options.query.safeParse(req.query);
        if (!result.success) throw toValidationError(result.error.issues);
        req.query = result.data as any;
      }
      next();
    } catch (err) {
      next(err);
    }
  });
}

function toValidationError(issues: ZodIssue[]) {
  const msg = issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
  return new ValidationError(msg);
}
```

- [ ] **Step 4: Run tests and verify they pass**

```bash
pnpm test src/test/validate.test.ts
```

Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/http/decorators/Validate.ts src/test/validate.test.ts
git commit -m "feat: add @Validate decorator with Zod schema validation"
```

---

## Task 3: Create Zod schemas

**Files:** All files in `src/infrastructure/http/schemas/`

Each schema file exports Zod schemas and `z.infer<>` type aliases. Controllers use these types directly.

- [ ] **Step 1: Create `authSchemas.ts`**

```ts
// src/infrastructure/http/schemas/authSchemas.ts
import { z } from 'zod';

export const RegisterSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});
export type RegisterBody = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginBody = z.infer<typeof LoginSchema>;
```

- [ ] **Step 2: Create `userSchemas.ts`**

```ts
// src/infrastructure/http/schemas/userSchemas.ts
import { z } from 'zod';

export const UpdateThemeSchema = z.object({
  theme: z.enum(['light', 'dark']),
});
export type UpdateThemeBody = z.infer<typeof UpdateThemeSchema>;
```

- [ ] **Step 3: Create `petSchemas.ts`**

```ts
// src/infrastructure/http/schemas/petSchemas.ts
import { z } from 'zod';

export const CreatePetSchema = z.object({
  name: z.string().min(1),
  species: z.string().min(1),
  breed: z.string().optional(),
  birthDate: z.string().optional(),
  color: z.string().optional(),
});
export type CreatePetBody = z.infer<typeof CreatePetSchema>;

export const UpdatePetSchema = CreatePetSchema.partial();
export type UpdatePetBody = z.infer<typeof UpdatePetSchema>;

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
```

- [ ] **Step 4: Create `vetSchemas.ts`**

```ts
// src/infrastructure/http/schemas/vetSchemas.ts
import { z } from 'zod';

const WorkHoursEntrySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  open: z.boolean(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
});

export const CreateVetSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  website: z.string().optional(),
  placeId: z.string().optional(),
  googleMapsUrl: z.string().optional(),
  rating: z.number().optional(),
  workHours: z.array(WorkHoursEntrySchema).optional(),
});
export type CreateVetBody = z.infer<typeof CreateVetSchema>;

export const UpdateVetSchema = CreateVetSchema.partial();
export type UpdateVetBody = z.infer<typeof UpdateVetSchema>;
```

- [ ] **Step 5: Create `reminderSchemas.ts`**

```ts
// src/infrastructure/http/schemas/reminderSchemas.ts
import { z } from 'zod';

const DailyScheduleSchema = z.object({
  type: z.literal('daily'),
  times: z.array(z.string()).min(1),
});

const WeeklyScheduleSchema = z.object({
  type: z.literal('weekly'),
  days: z.array(z.string()).min(1),
  times: z.array(z.string()).min(1),
});

const MonthlyScheduleSchema = z.object({
  type: z.literal('monthly'),
  daysOfMonth: z.array(z.number()).min(1),
  times: z.array(z.string()).min(1),
});

export const ReminderScheduleSchema = z.discriminatedUnion('type', [
  DailyScheduleSchema,
  WeeklyScheduleSchema,
  MonthlyScheduleSchema,
]);
export type ReminderSchedule = z.infer<typeof ReminderScheduleSchema>;

export const ConfigureReminderSchema = z.object({
  schedule: ReminderScheduleSchema,
  notifyUserIds: z.array(z.string()).optional(),
  advanceNotice: z.number().optional(),
  enabled: z.boolean().optional(),
});
export type ConfigureReminderBody = z.infer<typeof ConfigureReminderSchema>;

export const ToggleReminderSchema = z.object({
  enabled: z.boolean(),
});
export type ToggleReminderBody = z.infer<typeof ToggleReminderSchema>;

export const ConfigureVetVisitReminderSchema = z.object({
  schedule: ReminderScheduleSchema,
  enabled: z.boolean().optional(),
});
export type ConfigureVetVisitReminderBody = z.infer<typeof ConfigureVetVisitReminderSchema>;
```

- [ ] **Step 6: Create `healthSchemas.ts`**

```ts
// src/infrastructure/http/schemas/healthSchemas.ts
import { z } from 'zod';
import { ReminderScheduleSchema } from './reminderSchemas';

const toDate = (s: string) => new Date(s);

const ScheduleNextVisitSchema = z.object({
  visitDate: z.string().transform(toDate),
  reason: z.string().optional(),
  notes: z.string().optional(),
  vetId: z.string().optional(),
  clinic: z.string().optional(),
  vetName: z.string().optional(),
});

export const CreateVetVisitSchema = z.object({
  type: z.enum(['logged', 'scheduled']),
  reason: z.string().min(1),
  notes: z.string().optional(),
  visitDate: z.string().transform(toDate),
  vetId: z.string().optional(),
  clinic: z.string().optional(),
  vetName: z.string().optional(),
  scheduleNextVisit: ScheduleNextVisitSchema.optional(),
  imageUrls: z.array(z.string()).optional(),
});
export type CreateVetVisitBody = z.infer<typeof CreateVetVisitSchema>;

export const UpdateVetVisitSchema = z.object({
  vetId: z.string().optional(),
  reason: z.string().optional(),
  notes: z.string().optional(),
  visitDate: z.string().transform(toDate).optional(),
});
export type UpdateVetVisitBody = z.infer<typeof UpdateVetVisitSchema>;

export const CompleteVetVisitSchema = z.object({
  notes: z.string().optional(),
});
export type CompleteVetVisitBody = z.infer<typeof CompleteVetVisitSchema>;

export const VetVisitsByDateRangeQuerySchema = z.object({
  from: z.string().min(1, '`from` query param is required (YYYY-MM-DD)'),
  to: z.string().min(1, '`to` query param is required (YYYY-MM-DD)'),
});
export type VetVisitsByDateRangeQuery = z.infer<typeof VetVisitsByDateRangeQuerySchema>;

const MedicationReminderSchema = z.object({
  enabled: z.boolean(),
  schedule: ReminderScheduleSchema.optional(),
  advanceNotice: z.number().optional(),
}).optional();

export const CreateMedicationSchema = z.object({
  name: z.string().min(1),
  dosageAmount: z.number().positive(),
  dosageUnit: z.string().min(1),
  schedule: z.string().optional(),
  startDate: z.string().transform(toDate),
  endDate: z.string().transform(toDate).optional(),
  notes: z.string().optional(),
  reminder: MedicationReminderSchema,
});
export type CreateMedicationBody = z.infer<typeof CreateMedicationSchema>;

export const UpdateMedicationSchema = z.object({
  name: z.string().optional(),
  dosageAmount: z.number().positive().optional(),
  dosageUnit: z.string().optional(),
  schedule: z.string().optional(),
  startDate: z.string().transform(toDate).optional(),
  endDate: z.string().transform(toDate).nullable().optional(),
  notes: z.string().nullable().optional(),
  active: z.boolean().optional(),
  reminder: MedicationReminderSchema,
});
export type UpdateMedicationBody = z.infer<typeof UpdateMedicationSchema>;
```

- [ ] **Step 7: Create `noteSchemas.ts`**

```ts
// src/infrastructure/http/schemas/noteSchemas.ts
import { z } from 'zod';

export const CreateNoteSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  noteDate: z.string(),
  petIds: z.array(z.string()).optional(),
  imageUrls: z.array(z.string()).optional(),
});
export type CreateNoteBody = z.infer<typeof CreateNoteSchema>;

export const UpdateNoteSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  noteDate: z.string().optional(),
  petIds: z.array(z.string()).optional(),
});
export type UpdateNoteBody = z.infer<typeof UpdateNoteSchema>;

export const ListNotesQuerySchema = z.object({
  petId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});
export type ListNotesQuery = z.infer<typeof ListNotesQuerySchema>;
```

- [ ] **Step 8: Create `shareSchemas.ts`**

```ts
// src/infrastructure/http/schemas/shareSchemas.ts
import { z } from 'zod';

const PermissionsSchema = z.object({
  canViewVetVisits: z.boolean().optional(),
  canEditVetVisits: z.boolean().optional(),
  canViewMedications: z.boolean().optional(),
  canEditMedications: z.boolean().optional(),
  canViewNotes: z.boolean().optional(),
  canEditNotes: z.boolean().optional(),
});

export const CreateShareSchema = z.object({
  email: z.string().email(),
  permissions: PermissionsSchema.optional(),
});
export type CreateShareBody = z.infer<typeof CreateShareSchema>;

export const UpdateSharePermissionsSchema = PermissionsSchema;
export type UpdateSharePermissionsBody = z.infer<typeof UpdateSharePermissionsSchema>;
```

- [ ] **Step 9: Create `transferSchemas.ts`**

```ts
// src/infrastructure/http/schemas/transferSchemas.ts
import { z } from 'zod';

export const InitiateTransferSchema = z.object({
  email: z.string().email(),
});
export type InitiateTransferBody = z.infer<typeof InitiateTransferSchema>;

export const AcceptTransferSchema = z.object({
  retainAccessForOriginalOwner: z.boolean().optional(),
});
export type AcceptTransferBody = z.infer<typeof AcceptTransferSchema>;
```

- [ ] **Step 10: Create `placesSchemas.ts`**

```ts
// src/infrastructure/http/schemas/placesSchemas.ts
import { z } from 'zod';

export const PlacesSearchQuerySchema = z.object({
  q: z.string().min(1, 'Missing query parameter: q'),
});
export type PlacesSearchQuery = z.infer<typeof PlacesSearchQuerySchema>;

export const PlacesDetailsQuerySchema = z.object({
  placeId: z.string().min(1, 'Missing query parameter: placeId'),
});
export type PlacesDetailsQuery = z.infer<typeof PlacesDetailsQuerySchema>;
```

- [ ] **Step 11: Commit**

```bash
git add src/infrastructure/http/schemas/
git commit -m "feat: add Zod schemas for all HTTP request shapes"
```

---

## Task 4: Rewrite `AuthController`

**Files:**
- Modify: `src/infrastructure/http/controllers/AuthController.ts`

No `@UseBefore(authMiddleware)` — register and login are public.

- [ ] **Step 1: Rewrite `AuthController.ts`**

```ts
// src/infrastructure/http/controllers/AuthController.ts
import { JsonController, Post, Body, HttpCode } from 'routing-controllers';
import { Service } from 'typedi';
import { RegisterUserUseCase } from '../../../application/auth/RegisterUserUseCase';
import { LoginUserUseCase } from '../../../application/auth/LoginUserUseCase';
import { Validate } from '../decorators/Validate';
import { RegisterSchema, RegisterBody, LoginSchema, LoginBody } from '../schemas/authSchemas';

@JsonController('/auth')
@Service()
export class AuthController {
  constructor(
    private readonly registerUser: RegisterUserUseCase,
    private readonly loginUser: LoginUserUseCase,
  ) {}

  @Post('/register')
  @HttpCode(201)
  @Validate({ body: RegisterSchema })
  async register(@Body() body: RegisterBody) {
    return this.registerUser.execute(body);
  }

  @Post('/login')
  @Validate({ body: LoginSchema })
  async login(@Body() body: LoginBody) {
    return this.loginUser.execute(body);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/infrastructure/http/controllers/AuthController.ts
git commit -m "refactor: migrate AuthController to routing-controllers + Zod"
```

---

## Task 5: Rewrite `UserController`

**Files:**
- Modify: `src/infrastructure/http/controllers/UserController.ts`

- [ ] **Step 1: Rewrite `UserController.ts`**

```ts
// src/infrastructure/http/controllers/UserController.ts
import { JsonController, Get, Patch, Body, UseBefore, CurrentUser } from 'routing-controllers';
import { Service, Inject } from 'typedi';
import { UserRepository, USER_REPOSITORY } from '../../../domain/user/UserRepository';
import { UserMapper } from '../../mappers/UserMapper';
import { NotFoundError } from '../../../shared/errors/AppError';
import { authMiddleware, AuthPayload } from '../middleware/authMiddleware';
import { Validate } from '../decorators/Validate';
import { UpdateThemeSchema, UpdateThemeBody } from '../schemas/userSchemas';

@JsonController('/users')
@Service()
@UseBefore(authMiddleware)
export class UserController {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    private readonly userMapper: UserMapper,
  ) {}

  @Get('/me')
  async getMe(@CurrentUser() user: AuthPayload) {
    const found = await this.userRepo.findById(user.userId);
    if (!found) throw new NotFoundError('User');
    return this.userMapper.toResponse(found);
  }

  @Patch('/me')
  @Validate({ body: UpdateThemeSchema })
  async updateTheme(@Body() body: UpdateThemeBody, @CurrentUser() user: AuthPayload) {
    await this.userRepo.updateTheme(user.userId, body.theme);
    return { theme: body.theme };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/infrastructure/http/controllers/UserController.ts
git commit -m "refactor: migrate UserController to routing-controllers + Zod"
```

---

## Task 6: Rewrite `PetController`

**Files:**
- Modify: `src/infrastructure/http/controllers/PetController.ts`

Note: `uploadPhoto` uses multer — keep `@UseBefore(uploadPetPhoto.single('photo'))` on that method. No `@Validate` on upload endpoints.

- [ ] **Step 1: Rewrite `PetController.ts`**

```ts
import { JsonController, Get, Post, Put, Body, Param, QueryParams, UseBefore, CurrentUser, HttpCode, Req } from 'routing-controllers';
import { Request } from 'express';
import { Service } from 'typedi';
import { AddPetUseCase } from '../../../application/pet/AddPetUseCase';
import { ListPetsUseCase } from '../../../application/pet/ListPetsUseCase';
import { GetPetUseCase } from '../../../application/pet/GetPetUseCase';
import { UpdatePetUseCase } from '../../../application/pet/UpdatePetUseCase';
import { PetMapper } from '../../mappers/PetMapper';
import { authMiddleware, AuthPayload } from '../middleware/authMiddleware';
import { uploadPetPhoto } from '../middleware/upload';
import { Validate } from '../decorators/Validate';
import {
  CreatePetSchema, CreatePetBody,
  UpdatePetSchema, UpdatePetBody,
  PaginationQuerySchema, PaginationQuery,
} from '../schemas/petSchemas';

@JsonController('/pets')
@Service()
@UseBefore(authMiddleware)
export class PetController {
  constructor(
    private readonly addPet: AddPetUseCase,
    private readonly listPets: ListPetsUseCase,
    private readonly getPet: GetPetUseCase,
    private readonly updatePet: UpdatePetUseCase,
    private readonly mapper: PetMapper,
  ) {}

  @Get('/')
  @Validate({ query: PaginationQuerySchema })
  async list(@QueryParams() query: PaginationQuery, @CurrentUser() user: AuthPayload) {
    const result = await this.listPets.execute(user.userId, query);
    return { ...result, items: result.items.map(p => this.mapper.toResponse(p)) };
  }

  @Post('/')
  @HttpCode(201)
  @Validate({ body: CreatePetSchema })
  async create(@Body() body: CreatePetBody, @CurrentUser() user: AuthPayload) {
    const pet = await this.addPet.execute({
      ...body,
      birthDate: body.birthDate ? new Date(body.birthDate) : undefined,
      requestingUserId: user.userId,
    });
    return this.mapper.toResponse(pet);
  }

  @Get('/:petId')
  async get(@Param('petId') petId: string, @CurrentUser() user: AuthPayload) {
    const pet = await this.getPet.execute(petId, user.userId);
    return this.mapper.toResponse(pet);
  }

  @Put('/:petId')
  @Validate({ body: UpdatePetSchema })
  async update(@Param('petId') petId: string, @Body() body: UpdatePetBody, @CurrentUser() user: AuthPayload) {
    const pet = await this.updatePet.execute({
      petId,
      ...body,
      birthDate: body.birthDate ? new Date(body.birthDate) : undefined,
      requestingUserId: user.userId,
    });
    return this.mapper.toResponse(pet);
  }

  @Post('/:petId/photo')
  @UseBefore(uploadPetPhoto.single('photo'))
  async uploadPhoto(@Param('petId') petId: string, @Req() req: Request, @CurrentUser() user: AuthPayload) {
    if (!req.file) throw new (require('../../../shared/errors/AppError').AppError)('No file uploaded', 400);
    const photoUrl = `/uploads/pets/${req.file.filename}`;
    const pet = await this.updatePet.execute({ petId, photoUrl, requestingUserId: user.userId });
    return this.mapper.toResponse(pet);
  }
}
```

- [ ] **Step 2: Check `upload.ts` exports — verify `uploadPetPhoto` is exported**

Open `src/infrastructure/http/middleware/upload.ts`. Confirm `uploadPetPhoto` is the export name. If it's named differently (e.g. `uploadImage`), adjust the import in `PetController.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/http/controllers/PetController.ts
git commit -m "refactor: migrate PetController to routing-controllers + Zod"
```

---

## Task 7: Rewrite `VetController`

**Files:**
- Modify: `src/infrastructure/http/controllers/VetController.ts`

- [ ] **Step 1: Rewrite `VetController.ts`**

```ts
// src/infrastructure/http/controllers/VetController.ts
import { JsonController, Get, Post, Put, Body, Param, QueryParams, UseBefore, CurrentUser, HttpCode } from 'routing-controllers';
import { Service } from 'typedi';
import { CreateVetUseCase } from '../../../application/vet/CreateVetUseCase';
import { ListVetsUseCase } from '../../../application/vet/ListVetsUseCase';
import { UpdateVetUseCase } from '../../../application/vet/UpdateVetUseCase';
import { VetMapper } from '../../mappers/VetMapper';
import { authMiddleware, AuthPayload } from '../middleware/authMiddleware';
import { Validate } from '../decorators/Validate';
import { CreateVetSchema, CreateVetBody, UpdateVetSchema, UpdateVetBody } from '../schemas/vetSchemas';
import { PaginationQuerySchema, PaginationQuery } from '../schemas/petSchemas';

@JsonController('/vets')
@Service()
@UseBefore(authMiddleware)
export class VetController {
  constructor(
    private readonly createVet: CreateVetUseCase,
    private readonly listVets: ListVetsUseCase,
    private readonly updateVet: UpdateVetUseCase,
    private readonly mapper: VetMapper,
  ) {}

  @Get('/')
  @Validate({ query: PaginationQuerySchema })
  async list(@QueryParams() query: PaginationQuery, @CurrentUser() user: AuthPayload) {
    const result = await this.listVets.execute(user.userId, query);
    return { ...result, items: result.items.map(v => this.mapper.toResponse(v)) };
  }

  @Post('/')
  @HttpCode(201)
  @Validate({ body: CreateVetSchema })
  async create(@Body() body: CreateVetBody, @CurrentUser() user: AuthPayload) {
    const vet = await this.createVet.execute({ ...body, requestingUserId: user.userId });
    return this.mapper.toResponse(vet);
  }

  @Put('/:id')
  @Validate({ body: UpdateVetSchema })
  async update(@Param('id') id: string, @Body() body: UpdateVetBody, @CurrentUser() user: AuthPayload) {
    const vet = await this.updateVet.execute({ vetId: id, ...body, requestingUserId: user.userId });
    return this.mapper.toResponse(vet);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/infrastructure/http/controllers/VetController.ts
git commit -m "refactor: migrate VetController to routing-controllers + Zod"
```

---

## Task 8: Rewrite `NoteController`

**Files:**
- Modify: `src/infrastructure/http/controllers/NoteController.ts`

- [ ] **Step 1: Rewrite `NoteController.ts`**

```ts
// src/infrastructure/http/controllers/NoteController.ts
import { JsonController, Get, Post, Put, Delete, Body, Param, QueryParams, UseBefore, CurrentUser, HttpCode, OnUndefined, Req } from 'routing-controllers';
import { Request } from 'express';
import { Service } from 'typedi';
import { CreateNoteUseCase } from '../../../application/note/CreateNoteUseCase';
import { ListNotesUseCase } from '../../../application/note/ListNotesUseCase';
import { UpdateNoteUseCase } from '../../../application/note/UpdateNoteUseCase';
import { DeleteNoteUseCase } from '../../../application/note/DeleteNoteUseCase';
import { AddNoteImageUseCase } from '../../../application/note/AddNoteImageUseCase';
import { authMiddleware, AuthPayload } from '../middleware/authMiddleware';
import { uploadNoteImage } from '../middleware/upload';
import { Validate } from '../decorators/Validate';
import { CreateNoteSchema, CreateNoteBody, UpdateNoteSchema, UpdateNoteBody, ListNotesQuerySchema, ListNotesQuery } from '../schemas/noteSchemas';
import { AppError } from '../../../shared/errors/AppError';

@JsonController('/notes')
@Service()
@UseBefore(authMiddleware)
export class NoteController {
  constructor(
    private readonly createNote: CreateNoteUseCase,
    private readonly listNotes: ListNotesUseCase,
    private readonly updateNote: UpdateNoteUseCase,
    private readonly deleteNote: DeleteNoteUseCase,
    private readonly addNoteImage: AddNoteImageUseCase,
  ) {}

  @Post('/')
  @HttpCode(201)
  @Validate({ body: CreateNoteSchema })
  async create(@Body() body: CreateNoteBody, @CurrentUser() user: AuthPayload) {
    return this.createNote.execute({ userId: user.userId, ...body });
  }

  @Get('/')
  @Validate({ query: ListNotesQuerySchema })
  async list(@QueryParams() query: ListNotesQuery, @CurrentUser() user: AuthPayload) {
    return this.listNotes.execute({ userId: user.userId, ...query });
  }

  @Put('/:noteId')
  @Validate({ body: UpdateNoteSchema })
  async update(@Param('noteId') noteId: string, @Body() body: UpdateNoteBody, @CurrentUser() user: AuthPayload) {
    return this.updateNote.execute({ userId: user.userId, noteId, ...body });
  }

  @Delete('/:noteId')
  @OnUndefined(204)
  async delete(@Param('noteId') noteId: string, @CurrentUser() user: AuthPayload) {
    await this.deleteNote.execute({ userId: user.userId, noteId });
  }

  @Post('/:noteId/images')
  @UseBefore(uploadNoteImage.single('image'))
  async addImage(@Param('noteId') noteId: string, @Req() req: Request, @CurrentUser() user: AuthPayload) {
    if (!req.file) throw new AppError('No file uploaded', 400);
    const imageUrl = `/uploads/notes/${req.file.filename}`;
    return this.addNoteImage.execute({ userId: user.userId, noteId, imageUrl });
  }
}
```

**NOTE:** Check `src/infrastructure/http/middleware/upload.ts` for the correct export name for notes upload. If it's `uploadImage` (shared), use `uploadImage` instead of `uploadNoteImage`.

- [ ] **Step 2: Commit**

```bash
git add src/infrastructure/http/controllers/NoteController.ts
git commit -m "refactor: migrate NoteController to routing-controllers + Zod"
```

---

## Task 9: Rewrite `ReminderController`

**Files:**
- Modify: `src/infrastructure/http/controllers/ReminderController.ts`

Routes: `GET/PUT /medications/:medicationId/reminder` and `PATCH /medications/:medicationId/reminder/toggle`

- [ ] **Step 1: Rewrite `ReminderController.ts`**

```ts
// src/infrastructure/http/controllers/ReminderController.ts
import { JsonController, Get, Put, Patch, Body, Param, UseBefore, CurrentUser, OnUndefined } from 'routing-controllers';
import { Inject, Service } from 'typedi';
import { ConfigureMedicationReminderUseCase } from '../../../application/reminder/ConfigureMedicationReminderUseCase';
import { ToggleMedicationReminderUseCase } from '../../../application/reminder/ToggleMedicationReminderUseCase';
import { ReminderRepository, REMINDER_REPOSITORY } from '../../../domain/reminder/ReminderRepository';
import { ReminderMapper } from '../../mappers/ReminderMapper';
import { NotFoundError } from '../../../shared/errors/AppError';
import { authMiddleware, AuthPayload } from '../middleware/authMiddleware';
import { Validate } from '../decorators/Validate';
import { ConfigureReminderSchema, ConfigureReminderBody, ToggleReminderSchema, ToggleReminderBody } from '../schemas/reminderSchemas';

@JsonController('/medications')
@Service()
@UseBefore(authMiddleware)
export class ReminderController {
  constructor(
    private readonly configureReminder: ConfigureMedicationReminderUseCase,
    private readonly toggleReminder: ToggleMedicationReminderUseCase,
    @Inject(REMINDER_REPOSITORY) private readonly reminderRepo: ReminderRepository,
    private readonly reminderMapper: ReminderMapper,
  ) {}

  @Get('/:medicationId/reminder')
  async getReminder(@Param('medicationId') medicationId: string) {
    const reminder = await this.reminderRepo.findByEntityId(medicationId);
    if (!reminder) throw new NotFoundError('Reminder');
    return this.reminderMapper.toResponse(reminder);
  }

  @Put('/:medicationId/reminder')
  @OnUndefined(204)
  @Validate({ body: ConfigureReminderSchema })
  async configure(@Param('medicationId') medicationId: string, @Body() body: ConfigureReminderBody, @CurrentUser() user: AuthPayload) {
    await this.configureReminder.execute({ medicationId, ...body, requestingUserId: user.userId });
  }

  @Patch('/:medicationId/reminder/toggle')
  @OnUndefined(204)
  @Validate({ body: ToggleReminderSchema })
  async toggle(@Param('medicationId') medicationId: string, @Body() body: ToggleReminderBody, @CurrentUser() user: AuthPayload) {
    await this.toggleReminder.execute(medicationId, body.enabled, user.userId);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/infrastructure/http/controllers/ReminderController.ts
git commit -m "refactor: migrate ReminderController to routing-controllers + Zod"
```

---

## Task 10: Rewrite `ShareController` + create `PetShareInboxController`

**Files:**
- Modify: `src/infrastructure/http/controllers/ShareController.ts`
- Create: `src/infrastructure/http/controllers/PetShareInboxController.ts`

The original ShareController covered two route prefixes (`/pets` and `/pet-shares`). In routing-controllers, each controller has a single prefix, so we split into two classes.

- [ ] **Step 1: Rewrite `ShareController.ts`** (handles `/pets/*` share routes)

```ts
// src/infrastructure/http/controllers/ShareController.ts
import { JsonController, Get, Post, Put, Delete, Body, Param, UseBefore, CurrentUser, HttpCode, OnUndefined } from 'routing-controllers';
import { Service } from 'typedi';
import { SharePetUseCase } from '../../../application/share/SharePetUseCase';
import { UpdateSharePermissionsUseCase } from '../../../application/share/UpdateSharePermissionsUseCase';
import { RevokeShareUseCase } from '../../../application/share/RevokeShareUseCase';
import { ListPetSharesUseCase } from '../../../application/share/ListPetSharesUseCase';
import { ListSharedPetsUseCase } from '../../../application/share/ListSharedPetsUseCase';
import { PetShareMapper } from '../../mappers/PetShareMapper';
import { PetMapper } from '../../mappers/PetMapper';
import { authMiddleware, AuthPayload } from '../middleware/authMiddleware';
import { Validate } from '../decorators/Validate';
import { CreateShareSchema, CreateShareBody, UpdateSharePermissionsSchema, UpdateSharePermissionsBody } from '../schemas/shareSchemas';

@JsonController('/pets')
@Service()
@UseBefore(authMiddleware)
export class ShareController {
  constructor(
    private readonly sharePet: SharePetUseCase,
    private readonly updateSharePermissions: UpdateSharePermissionsUseCase,
    private readonly revokeShare: RevokeShareUseCase,
    private readonly listPetShares: ListPetSharesUseCase,
    private readonly listSharedPets: ListSharedPetsUseCase,
    private readonly shareMapper: PetShareMapper,
    private readonly petMapper: PetMapper,
  ) {}

  @Get('/shared-with-me')
  async listSharedWithMe(@CurrentUser() user: AuthPayload) {
    const results = await this.listSharedPets.execute(user.userId);
    return results.map(({ pet, share }) => ({
      ...this.petMapper.toResponse(pet),
      permissions: this.shareMapper.toResponse(share).permissions,
      shareId: share.id.toValue(),
    }));
  }

  @Get('/:petId/shares')
  async listForPet(@Param('petId') petId: string, @CurrentUser() user: AuthPayload) {
    const shares = await this.listPetShares.execute(petId, user.userId);
    return shares.map(s => this.shareMapper.toResponse(s));
  }

  @Post('/:petId/shares')
  @HttpCode(201)
  @Validate({ body: CreateShareSchema })
  async create(@Param('petId') petId: string, @Body() body: CreateShareBody, @CurrentUser() user: AuthPayload) {
    const share = await this.sharePet.execute({ petId, requestingUserId: user.userId, ...body });
    return this.shareMapper.toResponse(share);
  }

  @Put('/:petId/shares/:shareId')
  @Validate({ body: UpdateSharePermissionsSchema })
  async update(@Param('petId') petId: string, @Param('shareId') shareId: string, @Body() body: UpdateSharePermissionsBody, @CurrentUser() user: AuthPayload) {
    const share = await this.updateSharePermissions.execute({ petId, shareId, requestingUserId: user.userId, ...body });
    return this.shareMapper.toResponse(share);
  }

  @Delete('/:petId/shares/:shareId')
  @OnUndefined(204)
  async revoke(@Param('petId') petId: string, @Param('shareId') shareId: string, @CurrentUser() user: AuthPayload) {
    await this.revokeShare.execute(petId, shareId, user.userId);
  }
}
```

- [ ] **Step 2: Create `PetShareInboxController.ts`** (handles `/pet-shares/*` routes)

```ts
// src/infrastructure/http/controllers/PetShareInboxController.ts
import { JsonController, Get, Patch, Param, UseBefore, CurrentUser, OnUndefined } from 'routing-controllers';
import { Service } from 'typedi';
import { ListPendingSharesUseCase } from '../../../application/share/ListPendingSharesUseCase';
import { AcceptShareUseCase } from '../../../application/share/AcceptShareUseCase';
import { DeclineShareUseCase } from '../../../application/share/DeclineShareUseCase';
import { PetShareMapper } from '../../mappers/PetShareMapper';
import { authMiddleware, AuthPayload } from '../middleware/authMiddleware';

@JsonController('/pet-shares')
@Service()
@UseBefore(authMiddleware)
export class PetShareInboxController {
  constructor(
    private readonly listPendingShares: ListPendingSharesUseCase,
    private readonly acceptShare: AcceptShareUseCase,
    private readonly declineShare: DeclineShareUseCase,
    private readonly shareMapper: PetShareMapper,
  ) {}

  @Get('/pending')
  async listPending(@CurrentUser() user: AuthPayload) {
    const shares = await this.listPendingShares.execute(user.userId);
    return shares.map(s => this.shareMapper.toResponse(s));
  }

  @Patch('/:shareId/accept')
  @OnUndefined(204)
  async accept(@Param('shareId') shareId: string, @CurrentUser() user: AuthPayload) {
    await this.acceptShare.execute(shareId, user.userId);
  }

  @Patch('/:shareId/decline')
  @OnUndefined(204)
  async decline(@Param('shareId') shareId: string, @CurrentUser() user: AuthPayload) {
    await this.declineShare.execute(shareId, user.userId);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/http/controllers/ShareController.ts src/infrastructure/http/controllers/PetShareInboxController.ts
git commit -m "refactor: migrate ShareController to routing-controllers, extract PetShareInboxController"
```

---

## Task 11: Rewrite `TransferController` + create `PetTransferInboxController`

**Files:**
- Modify: `src/infrastructure/http/controllers/TransferController.ts`
- Create: `src/infrastructure/http/controllers/PetTransferInboxController.ts`

- [ ] **Step 1: Rewrite `TransferController.ts`** (handles `/pets/:petId/transfer` routes)

```ts
// src/infrastructure/http/controllers/TransferController.ts
import { JsonController, Post, Delete, Body, Param, UseBefore, CurrentUser, HttpCode, OnUndefined } from 'routing-controllers';
import { Service } from 'typedi';
import { InitiateOwnershipTransferUseCase } from '../../../application/transfer/InitiateOwnershipTransferUseCase';
import { CancelOwnershipTransferUseCase } from '../../../application/transfer/CancelOwnershipTransferUseCase';
import { PetOwnershipTransferMapper } from '../../mappers/PetOwnershipTransferMapper';
import { authMiddleware, AuthPayload } from '../middleware/authMiddleware';
import { Validate } from '../decorators/Validate';
import { InitiateTransferSchema, InitiateTransferBody } from '../schemas/transferSchemas';

@JsonController('/pets')
@Service()
@UseBefore(authMiddleware)
export class TransferController {
  constructor(
    private readonly initiateTransfer: InitiateOwnershipTransferUseCase,
    private readonly cancelTransfer: CancelOwnershipTransferUseCase,
    private readonly mapper: PetOwnershipTransferMapper,
  ) {}

  @Post('/:petId/transfer')
  @HttpCode(201)
  @Validate({ body: InitiateTransferSchema })
  async initiate(@Param('petId') petId: string, @Body() body: InitiateTransferBody, @CurrentUser() user: AuthPayload) {
    const transfer = await this.initiateTransfer.execute(petId, user.userId, body.email);
    return this.mapper.toResponse(transfer);
  }

  @Delete('/:petId/transfer')
  @OnUndefined(204)
  async cancel(@Param('petId') petId: string, @CurrentUser() user: AuthPayload) {
    await this.cancelTransfer.execute(petId, user.userId);
  }
}
```

- [ ] **Step 2: Create `PetTransferInboxController.ts`** (handles `/pet-ownership-transfers/*` routes)

```ts
// src/infrastructure/http/controllers/PetTransferInboxController.ts
import { JsonController, Get, Patch, Body, Param, UseBefore, CurrentUser, OnUndefined } from 'routing-controllers';
import { Service } from 'typedi';
import { ListPendingTransfersUseCase } from '../../../application/transfer/ListPendingTransfersUseCase';
import { AcceptOwnershipTransferUseCase } from '../../../application/transfer/AcceptOwnershipTransferUseCase';
import { DeclineOwnershipTransferUseCase } from '../../../application/transfer/DeclineOwnershipTransferUseCase';
import { PetOwnershipTransferMapper } from '../../mappers/PetOwnershipTransferMapper';
import { authMiddleware, AuthPayload } from '../middleware/authMiddleware';
import { Validate } from '../decorators/Validate';
import { AcceptTransferSchema, AcceptTransferBody } from '../schemas/transferSchemas';

@JsonController('/pet-ownership-transfers')
@Service()
@UseBefore(authMiddleware)
export class PetTransferInboxController {
  constructor(
    private readonly listPendingTransfers: ListPendingTransfersUseCase,
    private readonly acceptTransfer: AcceptOwnershipTransferUseCase,
    private readonly declineTransfer: DeclineOwnershipTransferUseCase,
    private readonly mapper: PetOwnershipTransferMapper,
  ) {}

  @Get('/pending')
  async listPending(@CurrentUser() user: AuthPayload) {
    const transfers = await this.listPendingTransfers.execute(user.userId);
    return transfers.map(t => this.mapper.toResponse(t));
  }

  @Patch('/:transferId/accept')
  @OnUndefined(204)
  @Validate({ body: AcceptTransferSchema })
  async accept(@Param('transferId') transferId: string, @Body() body: AcceptTransferBody, @CurrentUser() user: AuthPayload) {
    await this.acceptTransfer.execute(transferId, user.userId, body.retainAccessForOriginalOwner === true);
  }

  @Patch('/:transferId/decline')
  @OnUndefined(204)
  async decline(@Param('transferId') transferId: string, @CurrentUser() user: AuthPayload) {
    await this.declineTransfer.execute(transferId, user.userId);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/http/controllers/TransferController.ts src/infrastructure/http/controllers/PetTransferInboxController.ts
git commit -m "refactor: migrate TransferController to routing-controllers, extract PetTransferInboxController"
```

---

## Task 12: Rewrite `HealthController` + create `VetVisitController`

**Files:**
- Modify: `src/infrastructure/http/controllers/HealthController.ts`
- Create: `src/infrastructure/http/controllers/VetVisitController.ts`

The original HealthController also served global vet visit routes (`/vet-visits/upcoming` and `/vet-visits`). Split these out into `VetVisitController`.

- [ ] **Step 1: Rewrite `HealthController.ts`** (all `/pets/:petId/*` health routes)

```ts
// src/infrastructure/http/controllers/HealthController.ts
import { JsonController, Get, Post, Put, Patch, Body, Param, QueryParams, UseBefore, CurrentUser, HttpCode, OnUndefined, Req } from 'routing-controllers';
import { Request } from 'express';
import { Inject, Service } from 'typedi';
import { AddVetVisitUseCase } from '../../../application/health/AddVetVisitUseCase';
import { AddVetVisitImageUseCase } from '../../../application/health/AddVetVisitImageUseCase';
import { UpdateVetVisitUseCase } from '../../../application/health/UpdateVetVisitUseCase';
import { CompleteVetVisitUseCase } from '../../../application/health/CompleteVetVisitUseCase';
import { ListVetVisitsUseCase } from '../../../application/health/ListVetVisitsUseCase';
import { LogMedicationUseCase } from '../../../application/health/LogMedicationUseCase';
import { UpdateMedicationUseCase } from '../../../application/health/UpdateMedicationUseCase';
import { ListMedicationsUseCase } from '../../../application/health/ListMedicationsUseCase';
import { ConfigureVetVisitReminderUseCase } from '../../../application/reminder/ConfigureVetVisitReminderUseCase';
import { ReminderRepository, REMINDER_REPOSITORY } from '../../../domain/reminder/ReminderRepository';
import { VetVisitMapper } from '../../mappers/VetVisitMapper';
import { MedicationMapper } from '../../mappers/MedicationMapper';
import { ReminderMapper } from '../../mappers/ReminderMapper';
import { NotFoundError, AppError } from '../../../shared/errors/AppError';
import { authMiddleware, AuthPayload } from '../middleware/authMiddleware';
import { uploadImage } from '../middleware/upload';
import { Validate } from '../decorators/Validate';
import {
  CreateVetVisitSchema, CreateVetVisitBody,
  UpdateVetVisitSchema, UpdateVetVisitBody,
  CompleteVetVisitSchema, CompleteVetVisitBody,
  CreateMedicationSchema, CreateMedicationBody,
  UpdateMedicationSchema, UpdateMedicationBody,
} from '../schemas/healthSchemas';
import { ConfigureVetVisitReminderSchema, ConfigureVetVisitReminderBody } from '../schemas/reminderSchemas';
import { PaginationQuerySchema, PaginationQuery } from '../schemas/petSchemas';

@JsonController('/pets')
@Service()
@UseBefore(authMiddleware)
export class HealthController {
  constructor(
    private readonly addVetVisit: AddVetVisitUseCase,
    private readonly addVetVisitImage: AddVetVisitImageUseCase,
    private readonly updateVetVisit: UpdateVetVisitUseCase,
    private readonly completeVetVisitUseCase: CompleteVetVisitUseCase,
    private readonly listVetVisits: ListVetVisitsUseCase,
    private readonly logMedication: LogMedicationUseCase,
    private readonly updateMedication: UpdateMedicationUseCase,
    private readonly listMedications: ListMedicationsUseCase,
    private readonly configureVetVisitReminder: ConfigureVetVisitReminderUseCase,
    private readonly vetVisitMapper: VetVisitMapper,
    private readonly medicationMapper: MedicationMapper,
    private readonly reminderMapper: ReminderMapper,
    @Inject(REMINDER_REPOSITORY) private readonly reminderRepo: ReminderRepository,
  ) {}

  // --- Vet Visits ---

  @Get('/:petId/vet-visits')
  @Validate({ query: PaginationQuerySchema })
  async getVetVisits(@Param('petId') petId: string, @QueryParams() query: PaginationQuery, @CurrentUser() user: AuthPayload) {
    const result = await this.listVetVisits.execute(petId, user.userId, query);
    return { ...result, items: result.items.map(v => this.vetVisitMapper.toResponse(v)) };
  }

  @Post('/:petId/vet-visits')
  @HttpCode(201)
  @Validate({ body: CreateVetVisitSchema })
  async createVetVisit(@Param('petId') petId: string, @Body() body: CreateVetVisitBody, @CurrentUser() user: AuthPayload) {
    const result = await this.addVetVisit.execute({
      ...body,
      petId,
      requestingUserId: user.userId,
    });
    return {
      visit: this.vetVisitMapper.toResponse(result.visit),
      nextVisit: result.nextVisit ? this.vetVisitMapper.toResponse(result.nextVisit) : undefined,
    };
  }

  @Put('/:petId/vet-visits/:visitId')
  @Validate({ body: UpdateVetVisitSchema })
  async updateVetVisit(@Param('visitId') visitId: string, @Body() body: UpdateVetVisitBody, @CurrentUser() user: AuthPayload) {
    const visit = await this.updateVetVisit.execute({ visitId, ...body, requestingUserId: user.userId });
    return this.vetVisitMapper.toResponse(visit);
  }

  @Patch('/:petId/vet-visits/:visitId/complete')
  @Validate({ body: CompleteVetVisitSchema })
  async completeVetVisit(@Param('visitId') visitId: string, @Body() body: CompleteVetVisitBody, @CurrentUser() user: AuthPayload) {
    const visit = await this.completeVetVisitUseCase.execute({ visitId, ...body, requestingUserId: user.userId });
    return this.vetVisitMapper.toResponse(visit);
  }

  @Get('/:petId/vet-visits/:visitId/reminder')
  async getVetVisitReminder(@Param('visitId') visitId: string) {
    const reminder = await this.reminderRepo.findByEntityId(visitId);
    if (!reminder) throw new NotFoundError('Reminder');
    return this.reminderMapper.toResponse(reminder);
  }

  @Put('/:petId/vet-visits/:visitId/reminder')
  @OnUndefined(204)
  @Validate({ body: ConfigureVetVisitReminderSchema })
  async configureVetVisitReminder(@Param('visitId') visitId: string, @Body() body: ConfigureVetVisitReminderBody, @CurrentUser() user: AuthPayload) {
    await this.configureVetVisitReminder.execute({ visitId, ...body, requestingUserId: user.userId });
  }

  @Post('/:petId/vet-visits/:visitId/images')
  @UseBefore(uploadImage.single('image'))
  async uploadVetVisitImage(@Param('visitId') visitId: string, @Req() req: Request, @CurrentUser() user: AuthPayload) {
    if (!req.file) throw new AppError('No file uploaded', 400);
    const imageUrl = `/uploads/vet-visits/${req.file.filename}`;
    const visit = await this.addVetVisitImage.execute(visitId, imageUrl, user.userId);
    return this.vetVisitMapper.toResponse(visit);
  }

  // --- Medications ---

  @Get('/:petId/medications')
  async getMedications(@Param('petId') petId: string, @CurrentUser() user: AuthPayload) {
    const summaries = await this.listMedications.execute(petId, user.userId);
    return summaries.map(s => this.medicationMapper.toResponse(s.medication, s.reminderEnabled, s.advanceNotice));
  }

  @Post('/:petId/medications')
  @HttpCode(201)
  @Validate({ body: CreateMedicationSchema })
  async createMedication(@Param('petId') petId: string, @Body() body: CreateMedicationBody, @CurrentUser() user: AuthPayload) {
    const medication = await this.logMedication.execute({
      petId,
      ...body,
      requestingUserId: user.userId,
    });
    return this.medicationMapper.toResponse(medication, body.reminder?.enabled ?? false, body.reminder?.advanceNotice);
  }

  @Put('/:petId/medications/:medicationId')
  @Validate({ body: UpdateMedicationSchema })
  async updateMedication(@Param('medicationId') medicationId: string, @Body() body: UpdateMedicationBody, @CurrentUser() user: AuthPayload) {
    const medication = await this.updateMedication.execute({ medicationId, ...body, requestingUserId: user.userId });
    return this.medicationMapper.toResponse(medication, body.reminder?.enabled ?? false, body.reminder?.advanceNotice);
  }
}
```

- [ ] **Step 2: Create `VetVisitController.ts`** (global vet visit routes `/vet-visits/*`)

```ts
// src/infrastructure/http/controllers/VetVisitController.ts
import { JsonController, Get, QueryParams, UseBefore, CurrentUser } from 'routing-controllers';
import { Inject, Service } from 'typedi';
import { ListVetVisitsByDateRangeUseCase } from '../../../application/health/ListVetVisitsByDateRangeUseCase';
import { HealthRecordRepository, HEALTH_RECORD_REPOSITORY } from '../../../domain/health/HealthRecordRepository';
import { VetVisitMapper } from '../../mappers/VetVisitMapper';
import { authMiddleware, AuthPayload } from '../middleware/authMiddleware';
import { Validate } from '../decorators/Validate';
import { VetVisitsByDateRangeQuerySchema, VetVisitsByDateRangeQuery } from '../schemas/healthSchemas';

@JsonController('/vet-visits')
@Service()
@UseBefore(authMiddleware)
export class VetVisitController {
  constructor(
    private readonly listVetVisitsByDateRange: ListVetVisitsByDateRangeUseCase,
    @Inject(HEALTH_RECORD_REPOSITORY) private readonly healthRepo: HealthRecordRepository,
    private readonly vetVisitMapper: VetVisitMapper,
  ) {}

  @Get('/upcoming')
  async getUpcoming(@CurrentUser() user: AuthPayload) {
    const visits = await this.healthRepo.findUpcomingVetVisitsByUserId(user.userId);
    return visits.map(v => this.vetVisitMapper.toResponse(v));
  }

  @Get('/')
  @Validate({ query: VetVisitsByDateRangeQuerySchema })
  async getByDateRange(@QueryParams() query: VetVisitsByDateRangeQuery, @CurrentUser() user: AuthPayload) {
    const fromDate = new Date(query.from);
    const toDate = new Date(query.to);
    toDate.setHours(23, 59, 59, 999);
    const visits = await this.listVetVisitsByDateRange.execute(user.userId, fromDate, toDate);
    return visits.map(v => this.vetVisitMapper.toResponse(v));
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/http/controllers/HealthController.ts src/infrastructure/http/controllers/VetVisitController.ts
git commit -m "refactor: migrate HealthController to routing-controllers, extract VetVisitController"
```

---

## Task 13: Rewrite `PlacesController`

**Files:**
- Modify: `src/infrastructure/http/controllers/PlacesController.ts`

- [ ] **Step 1: Rewrite `PlacesController.ts`**

```ts
// src/infrastructure/http/controllers/PlacesController.ts
import { JsonController, Get, QueryParams, UseBefore } from 'routing-controllers';
import { Service } from 'typedi';
import { GooglePlacesClient } from '../../external/GooglePlacesClient';
import { authMiddleware } from '../middleware/authMiddleware';
import { Validate } from '../decorators/Validate';
import { PlacesSearchQuerySchema, PlacesSearchQuery, PlacesDetailsQuerySchema, PlacesDetailsQuery } from '../schemas/placesSchemas';

@JsonController('/places')
@Service()
@UseBefore(authMiddleware)
export class PlacesController {
  constructor(private readonly placesClient: GooglePlacesClient) {}

  @Get('/search')
  @Validate({ query: PlacesSearchQuerySchema })
  async search(@QueryParams() query: PlacesSearchQuery) {
    return this.placesClient.search(query.q);
  }

  @Get('/details')
  @Validate({ query: PlacesDetailsQuerySchema })
  async details(@QueryParams() query: PlacesDetailsQuery) {
    return this.placesClient.details(query.placeId);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/infrastructure/http/controllers/PlacesController.ts
git commit -m "refactor: migrate PlacesController to routing-controllers + Zod"
```

---

## Task 14: Update `app.ts` + register all controllers

**Files:**
- Modify: `src/app.ts`

- [ ] **Step 1: Rewrite `app.ts`**

```ts
// src/app.ts
import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { useExpressServer } from 'routing-controllers';
import { Container } from 'typedi';
import { errorMiddleware } from './infrastructure/http/middleware/errorMiddleware';
import { devRoutes } from './infrastructure/http/routes/devRoutes';

import { AuthController } from './infrastructure/http/controllers/AuthController';
import { UserController } from './infrastructure/http/controllers/UserController';
import { PetController } from './infrastructure/http/controllers/PetController';
import { VetController } from './infrastructure/http/controllers/VetController';
import { HealthController } from './infrastructure/http/controllers/HealthController';
import { VetVisitController } from './infrastructure/http/controllers/VetVisitController';
import { ReminderController } from './infrastructure/http/controllers/ReminderController';
import { NoteController } from './infrastructure/http/controllers/NoteController';
import { ShareController } from './infrastructure/http/controllers/ShareController';
import { PetShareInboxController } from './infrastructure/http/controllers/PetShareInboxController';
import { TransferController } from './infrastructure/http/controllers/TransferController';
import { PetTransferInboxController } from './infrastructure/http/controllers/PetTransferInboxController';
import { PlacesController } from './infrastructure/http/controllers/PlacesController';

export function createApp(): express.Application {
  const app = express();

  app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173', credentials: true }));
  app.use(express.json());
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  useExpressServer(app, {
    routePrefix: '/api/v1',
    controllers: [
      AuthController,
      UserController,
      PetController,
      VetController,
      HealthController,
      VetVisitController,
      ReminderController,
      NoteController,
      ShareController,
      PetShareInboxController,
      TransferController,
      PetTransferInboxController,
      PlacesController,
    ],
    container: Container,
    defaultErrorHandler: false,
    currentUserChecker: (action) => action.request.auth,
  });

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  if (process.env.NODE_ENV !== 'production') {
    app.use('/api/v1/dev', devRoutes());
  }

  app.use(errorMiddleware);

  return app;
}
```

- [ ] **Step 2: Verify `devRoutes` is still used correctly**

`devRoutes` is a plain Express router — it stays as-is and is mounted directly on `app`. No change needed.

- [ ] **Step 3: Commit**

```bash
git add src/app.ts
git commit -m "refactor: replace buildRouter with useExpressServer in app.ts"
```

---

## Task 15: Delete old routes directory

**Files:**
- Delete: `src/infrastructure/http/routes/` (all files except `devRoutes.ts`)

- [ ] **Step 1: Delete route files that are now replaced by controller decorators**

```bash
cd pet-health-tracker-api
rm src/infrastructure/http/routes/authRoutes.ts
rm src/infrastructure/http/routes/petRoutes.ts
rm src/infrastructure/http/routes/healthRoutes.ts
rm src/infrastructure/http/routes/reminderRoutes.ts
rm src/infrastructure/http/routes/vetRoutes.ts
rm src/infrastructure/http/routes/userRoutes.ts
rm src/infrastructure/http/routes/placesRoutes.ts
rm src/infrastructure/http/routes/noteRoutes.ts
rm src/infrastructure/http/routes/shareRoutes.ts
rm src/infrastructure/http/routes/petShareInboxRoutes.ts
rm src/infrastructure/http/routes/transferRoutes.ts
rm src/infrastructure/http/routes/petTransferInboxRoutes.ts
rm src/infrastructure/http/routes/index.ts
```

`devRoutes.ts` is kept.

- [ ] **Step 2: Build to confirm no compile errors**

```bash
pnpm build
```

Expected: Clean compile with no errors. If TypeScript errors appear, fix them before committing.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: delete Express route files replaced by routing-controllers decorators"
```

---

## Task 16: Smoke test

- [ ] **Step 1: Start the server**

```bash
pnpm dev
```

Expected: `Server running on port 3000` with no startup errors.

- [ ] **Step 2: Test public endpoint (no auth)**

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@example.com","password":"password123"}' | jq .
```

Expected: `{ "token": "..." }` or similar success response.

- [ ] **Step 3: Test validation rejection**

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"","email":"not-an-email","password":"short"}' | jq .
```

Expected: `{ "error": "name.: String must contain at least 1 character(s); email.: Invalid email; password.: String must contain at least 8 character(s)" }` (400 status)

- [ ] **Step 4: Test auth-protected endpoint without token**

```bash
curl -s http://localhost:3000/api/v1/pets | jq .
```

Expected: `{ "error": "Unauthorized" }` (401 status)

- [ ] **Step 5: Run unit tests**

```bash
pnpm test
```

Expected: All tests pass (validate.test.ts).

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "test: verify routing-controllers migration smoke tests pass"
```
