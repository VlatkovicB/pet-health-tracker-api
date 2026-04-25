# routing-controllers + Zod Validation — Design Spec

**Date:** 2026-04-26
**Scope:** Migrate all Express controllers to `routing-controllers` and add Zod validation via a custom `@Validate` decorator.

---

## Overview

Replace manually wired Express controllers with `routing-controllers` decorator-driven classes, and introduce Zod validation at the HTTP boundary via a single `@Validate({ body?, query? })` method decorator. DI, domain layer, use cases, and error handling are unchanged.

---

## New Dependencies

```bash
pnpm add routing-controllers zod
pnpm add -D @types/routing-controllers  # if needed
```

`class-transformer` and `class-validator` are NOT added — Zod replaces them entirely.

---

## Architecture

### New files
- `src/infrastructure/http/decorators/Validate.ts` — the `@Validate` decorator
- `src/infrastructure/http/schemas/authSchemas.ts`
- `src/infrastructure/http/schemas/petSchemas.ts`
- `src/infrastructure/http/schemas/vetSchemas.ts`
- `src/infrastructure/http/schemas/reminderSchemas.ts`
- `src/infrastructure/http/schemas/noteSchemas.ts`
- `src/infrastructure/http/schemas/shareSchemas.ts`
- `src/infrastructure/http/schemas/transferSchemas.ts`
- `src/infrastructure/http/schemas/userSchemas.ts`

### Modified files
- All 8 controllers — rewritten with `routing-controllers` decorators
- `src/app.ts` — replace `buildRouter()` with `createExpressServer()`
- `src/infrastructure/http/routes/index.ts` — removed (routes are declared on controllers)

### Unchanged
- All use cases, domain entities, repositories
- `src/shared/errors/AppError.ts` (including `ValidationError`)
- `src/infrastructure/http/middleware/errorMiddleware.ts`
- `src/infrastructure/http/middleware/authMiddleware.ts`
- `src/container.ts`
- `src/main.ts`

---

## The `@Validate` Decorator

`src/infrastructure/http/decorators/Validate.ts`

```ts
import { UseBefore } from 'routing-controllers';
import { ZodSchema } from 'zod';
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

function toValidationError(issues: { path: (string | number)[]; message: string }[]) {
  const msg = issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
  return new ValidationError(msg);
}
```

- Mutates `req.body` / `req.query` with Zod's parsed output before the controller runs
- Throws `ValidationError` (existing AppError subclass → 400) with field-level messages joined as a string
- Implemented via `@UseBefore` so it runs before `@Body()` / `@QueryParams()` are read by routing-controllers

---

## Schema Organization

Each file exports Zod schemas and their inferred types. Controllers use the inferred types directly — no separate DTO classes.

```ts
// petSchemas.ts (example)
import { z } from 'zod';

export const CreatePetSchema = z.object({
  name: z.string().min(1),
  species: z.string().min(1),
  breed: z.string().optional(),
  birthDate: z.string().datetime().optional(),
  color: z.string().optional(),
});
export type CreatePetBody = z.infer<typeof CreatePetSchema>;

export const UpdatePetSchema = CreatePetSchema.partial();
export type UpdatePetBody = z.infer<typeof UpdatePetSchema>;

export const ListPetsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListPetsQuery = z.infer<typeof ListPetsQuerySchema>;
```

**Schema coverage per resource:**

| File | Schemas |
|---|---|
| `authSchemas.ts` | `RegisterSchema`, `LoginSchema` |
| `petSchemas.ts` | `CreatePetSchema`, `UpdatePetSchema`, `ListPetsQuerySchema` |
| `vetSchemas.ts` | `CreateVetSchema`, `UpdateVetSchema`, `ListVetsQuerySchema` |
| `reminderSchemas.ts` | `ConfigureReminderSchema`, `ToggleReminderSchema` |
| `noteSchemas.ts` | `CreateNoteSchema`, `UpdateNoteSchema`, `ListNotesQuerySchema` |
| `shareSchemas.ts` | `CreateShareSchema`, `UpdateSharePermissionsSchema` |
| `transferSchemas.ts` | `InitiateTransferSchema`, `AcceptTransferSchema` |
| `userSchemas.ts` | `UpdateThemeSchema` |

---

## Controller Shape

Controllers use `@JsonController`, `@Get`/`@Post`/`@Patch`/`@Delete`, `@Body`, `@Param`, `@QueryParams`, `@CurrentUser`, `@HttpCode`, `@UseBefore`.

```ts
// PetController.ts (example)
@JsonController('/pets')
@Service()
export class PetController {
  constructor(
    private readonly addPet: AddPetUseCase,
    private readonly listPets: ListPetsUseCase,
    private readonly getPet: GetPetUseCase,
    private readonly updatePet: UpdatePetUseCase,
    private readonly mapper: PetMapper,
  ) {}

  @Get('/')
  @Validate({ query: ListPetsQuerySchema })
  async list(@QueryParams() query: ListPetsQuery, @CurrentUser() user: AuthUser) {
    const result = await this.listPets.execute(user.userId, query);
    return { ...result, items: result.items.map(p => this.mapper.toResponse(p)) };
  }

  @Post('/')
  @HttpCode(201)
  @Validate({ body: CreatePetSchema })
  async create(@Body() body: CreatePetBody, @CurrentUser() user: AuthUser) {
    const pet = await this.addPet.execute({ ...body, requestingUserId: user.userId });
    return this.mapper.toResponse(pet);
  }

  @Patch('/:petId')
  @Validate({ body: UpdatePetSchema })
  async update(
    @Param('petId') petId: string,
    @Body() body: UpdatePetBody,
    @CurrentUser() user: AuthUser,
  ) {
    const pet = await this.updatePet.execute({ petId, ...body, requestingUserId: user.userId });
    return this.mapper.toResponse(pet);
  }
}
```

**Migration rules (applied to every controller method):**
1. `(req, res, next) => { try { ... } catch(err) { next(err) } }` → plain `async` method, no try/catch
2. `res.json(x)` → `return x`
3. `res.status(201).json(x)` → `@HttpCode(201)` + `return x`
4. `res.status(204).send()` → `@OnUndefined(204)` + `return undefined` (or just `return` and configure routing-controllers to allow undefined)
5. `req.auth.userId` → `@CurrentUser() user: AuthUser` → `user.userId`
6. `req.params.x` → `@Param('x') x: string`
7. `req.query.x` → `@QueryParams() query: QueryType` (after `@Validate`)
8. `req.body` → `@Body() body: BodyType` (after `@Validate`)
9. Manual pagination clamping in controllers removed — handled by `ListPetsQuerySchema` with `.coerce` and `.max()`

---

## App Setup

`src/app.ts` replaces `buildRouter()` with `useExpressServer()`. We use `useExpressServer` (not `createExpressServer`) so that we control middleware ordering — cors, json parsing, and static files are registered before routing-controllers attaches its routes.

```ts
import express from 'express';
import cors from 'cors';
import path from 'path';
import { useExpressServer } from 'routing-controllers';
import { Container } from 'typedi';
// ... all controller imports

export function createApp(): express.Application {
  const app = express();

  app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173', credentials: true }));
  app.use(express.json());
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  useExpressServer(app, {
    routePrefix: '/api/v1',
    controllers: [
      AuthController, UserController, PetController, VetController,
      ReminderController, NoteController, ShareController, TransferController,
      PlacesController, HealthController,
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

- `currentUserChecker` returns `req.auth` (JWT payload already set by `authMiddleware` on the controller) — this is what `@CurrentUser()` resolves to
- `defaultErrorHandler: false` keeps our `errorMiddleware` as the sole error handler
- No global `authorizationChecker` — auth is enforced at the controller level (see below)

## Auth Middleware Per Controller

`authMiddleware` always throws `UnauthorizedError` on missing/invalid tokens, so it cannot be applied globally (auth routes have no token). Instead, apply it at the controller class level via `@UseBefore`:

```ts
// All protected controllers
@JsonController('/pets')
@Service()
@UseBefore(authMiddleware)
export class PetController { ... }

// AuthController — no @UseBefore(authMiddleware)
@JsonController('/auth')
@Service()
export class AuthController { ... }
```

`@CurrentUser()` works because `authMiddleware` has already run and set `req.auth` before `currentUserChecker` reads it.

---

## Error Handling

No changes to `errorMiddleware`. Errors thrown by controllers (including `ValidationError` from `@Validate`) propagate through routing-controllers and are caught by `errorMiddleware` as usual.

Validation failure response example:
```json
{ "error": "name: Required; species: Required" }
```

---

## Constraints & Notes

- `reflect-metadata` is already imported in `main.ts` — no change needed
- `routing-controllers` requires `emitDecoratorMetadata: true` in `tsconfig.json` — verify this is already set (typedi requires it too, so it should be)
- File upload endpoints (`uploadPhoto` on Pet, `addImage` on Note) keep their existing multer middleware via `@UseBefore(upload.single('...'))` — `@Validate` is not applied to these
- `PlacesController` and `HealthController` have no mutation endpoints — no `@Validate` needed, just decorator conversion
- `devRoutes` remain as plain Express — no migration needed
