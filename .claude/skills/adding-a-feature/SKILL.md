---
name: adding-a-feature
description: Step-by-step checklist for adding a new domain feature to pet-health-tracker-api. Follow in order to avoid missing layers.
---

# Adding a Feature — API

Follow these steps in order. Every layer must be present or the feature will not work.

---

## 1. Domain Entity or Value Object (if new)

File: `src/domain/<domain>/`

- Create entity class extending `Entity<TProps>` or `AggregateRoot<TProps>`
- Define a `Props` interface (all fields, no ORM types)
- Add a static `create(props, id?)` factory — validates inputs, returns `Result` or throws
- Add a static `reconstitute(props, id)` factory — no validation, for DB reads
- Add public getters for each prop (no direct `props` access from outside)
- Add a repository interface `I<Name>Repository` with the methods you'll need

---

## 2. Sequelize Model (if new table)

File: `src/infrastructure/db/models/<Name>Model.ts`

- Extend `Model` with `@Table({ tableName: '...', timestamps: false })`
- Use explicit `@Column` decorators; use `DataType.JSONB` for discriminated unions or arrays
- Add explicit `created_at` column
- Import and register in `src/main.ts` via `sequelize.addModels([...])`

---

## 3. Mapper

File: `src/infrastructure/mappers/<Name>Mapper.ts`

- `@Service()` class, injectable via constructor
- `toDomain(model): Entity` — calls `Entity.reconstitute()`
- `toPersistence(entity): object` — returns plain object for `upsert` / `create`
- `toResponse(entity): DTO` — returns the JSON shape the controller sends

---

## 4. Repository Implementation

File: `src/infrastructure/db/repositories/Sequelize<Name>Repository.ts`

- Implements `I<Name>Repository`
- Decorated `@Service()`
- Inject mapper via constructor: `constructor(private mapper: <Name>Mapper) {}`
- List methods use `findAndCountAll` and return `PaginatedResult<T>` via `{ items: rows.map(toDomain), total, nextPage }`

---

## 5. Use Case

File: `src/application/<domain>/<ActionName>UseCase.ts`

- `@Service()` class with `execute(dto, userId)` method
- Inject repositories by token: `@Inject(PET_REPOSITORY) private petRepo: IPetRepository`
- Look up the resource, assert ownership (`entity.userId !== userId` → throw `ForbiddenError`)
- Return the mapped response DTO

---

## 6. Controller Handler

File: `src/infrastructure/http/controllers/<Domain>Controller.ts`

- Inject use case via constructor
- Arrow-function handler: `myAction = async (req: Request, res: Response) => { ... }`
- Read `req.auth.userId` (set by `authMiddleware`)
- Call `await this.useCase.execute(dto, userId)`
- Respond with `res.status(200).json(result)` (or 201 for creates)

---

## 7. Route Registration

File: `src/infrastructure/http/routes/<domain>Routes.ts`

- Import controller from typedi container: `const ctrl = container.get(<Domain>Controller)`
- Add `router.<method>('<path>', authMiddleware, ctrl.myAction)`
- Ensure the router is mounted in `src/app.ts` under `/api/v1/<resource>`

---

## 8. DI Binding

File: `src/container.ts`

- Bind repository token → implementation:
  ```ts
  container.bind<I<Name>Repository>(<NAME>_REPOSITORY).to(Sequelize<Name>Repository)
  ```
- Token constant lives in `src/domain/<domain>/index.ts` (e.g. `export const PET_REPOSITORY = new Token<IPetRepository>('PetRepository')`)

---

## Common Mistakes

- **Forgetting `container.ts`** — use case injects by token but token is never bound → runtime `ServiceNotFoundError`
- **Missing `addModels`** — new Sequelize model not registered → table never created
- **Calling `create()` instead of `reconstitute()` in the mapper** — triggers validation on DB reads
- **Returning `entity.props` directly** — always use `mapper.toResponse()` to shape the DTO
- **BullMQ job IDs** — never use `:` in custom job IDs; use `--` as separator (BullMQ v5 rejects colons)
- **Date comparisons** — ISO date-only strings parse as UTC midnight; use `startOfToday()` + `Op.gte` for "upcoming" queries, not `new Date()` + `Op.gt`
