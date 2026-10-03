# Ella API — QA / DevOps Intern Assessment Submission

**Candidate:** Ayenew Assefa  
**Date:** 2026-09-14  
**Repository:** https://github.com/ellatech-eth/QA-Assessment (fork)

---

## What this submission contains

This is my submission for the QA / DevOps Intern take-home assessment. It
covers both tracks:

- **Track A — Quality Assurance:** exploratory testing and bug reports,
  manual test cases for the Products module, Jest unit tests, a Postman
  collection, and a k6 performance script.
- **Track B — DevOps:** a GitHub Actions CI pipeline, containerization
  notes, environment configuration documentation, a deployment runbook,
  and a cloud deployment plan.

---

## Repository structure

```
.
├── qa/
│   ├── BUGS.md                    # 6 bug reports (exploratory testing)
│   ├── test-cases.md              # 12 manual test cases — Products module
│   ├── postman-collection.json    # API test collection (Postman v2.1)
│   └── k6-script.js               # Load test for GET /products
├── devops/
│   ├── ci-notes.md                # CI pipeline + CD extension plan
│   ├── environment-notes.md       # Env vars, per-environment diffs, setup issues
│   └── deployment-runbook.md      # Build / deploy / rollback / troubleshooting
├── .github/
│   └── workflows/
│       └── ci.yml                 # GitHub Actions CI pipeline
├── src/
│   └── products/
│       └── products.service.spec.ts   # Jest unit tests
└── README-SUBMISSION.md           # this file
```

---

## How to run everything

### 1. Setup (one-time)

```powershell
git clone <this-repo>
cd <repo>

# Create .env from template
Copy-Item .env.example .env

# Install dependencies (Windows-safe flags)
npm install --script-shell "C:\Windows\System32\cmd.exe" `
            --ignore-scripts --no-audit --no-fund --omit=optional

# Start the database
docker compose -f docker-compose.dev.yml up -d

# Apply migrations
npm run migration:run
```

### 2. Run the API

```powershell
npm run start:dev
```
- API: http://localhost:4000
- Swagger UI: http://localhost:4000/api

### 3. Run the unit tests

```powershell
npm test
```
Expected: 4 tests passing in `src/products/products.service.spec.ts`.

### 4. Run the Postman collection

1. Open Postman.
2. Import `qa/postman-collection.json`.
3. Set the `baseUrl` variable to `http://127.0.0.1:4000`.
4. Run the collection (Postman **Desktop** — the web version cannot reach localhost).

### 5. Run the k6 load test

Requires [k6](https://k6.io/docs/get-started/installation/).

```powershell
k6 run qa/k6-script.js
```

### 6. Run the CI pipeline

Push to GitHub. The workflow at `.github/workflows/ci.yml` runs on every
push and pull request: install → lint → build → test.

---

## Summary of findings

### Track A — QA

**Bugs found (see `qa/BUGS.md` for full details):**

| ID      | Severity | Area          | Summary                                                          |
|---------|----------|---------------|------------------------------------------------------------------|
| BUG-001 | High     | Users         | `POST /users` returns a fabricated user (`id: 0`)                |
| BUG-002 | Critical | Users         | Duplicate email accepted, returns 201 instead of 409             |
| BUG-003 | Critical | Transactions  | `POST /transactions` increases stock instead of decreasing it    |
| BUG-004 | High     | Products      | `POST /products` accepts negative prices                         |
| BUG-005 | Medium   | All           | Non-numeric `:id` → 500 with leaked Postgres error               |
| BUG-006 | High     | Products      | `PUT /products/:id` overwrites price with quantity value         |

**Test execution results:** 12 manual test cases executed for the Products
module — **9 passed, 3 failed**. Failures map to BUG-004, BUG-005, and
BUG-006.

**Unit tests:** 4 Jest tests cover `ProductsService.create`, `.findAll`,
and `.findOne`. All pass.

**Postman:** 14 requests across Users, Products, Transactions, and Health.
Assertions cover status codes, response shape, and response time.

**k6:** Load test for `GET /products` at 20 virtual users for 2 minutes,
with `p(95) < 500ms` and `error rate < 1%` thresholds.

### Track B — DevOps

**CI pipeline:** `.github/workflows/ci.yml` runs lint, build, and unit
tests on every push and PR to `main`. Fails on any step failure. See
`devops/ci-notes.md` for CD extension plan.

**Docker:** the full stack builds and runs via `docker compose up -d
--build`. Real issues encountered during setup (Windows PowerShell `||`
failures, Prisma postinstall hangs, slow registry downloads, container
name conflicts) are documented in `devops/environment-notes.md` §3.

**Environment configuration:** development, staging, and testing
environments documented in `devops/environment-notes.md`. Key differences:
secrets management, error verbosity, log format, and migration timing.

**Health check:** the API exposes `GET /health` returning status, database
connectivity, uptime, and a timestamp. Used as the smoke test in the
deployment runbook.

**Deployment runbook:** `devops/deployment-runbook.md` covers build,
deploy, verify, rollback, and 8 common failure modes with fixes.

**Cloud deployment plan:** described in `devops/ci-notes.md` §
"Extending toward continuous deployment."

---

## Decisions made

- **Chose Products module** for the deeper QA deliverables (test cases and
  unit tests) because it has the most varied CRUD surface and two
  high-impact bugs (`PUT` price corruption, negative price acceptance).
- **Applied one non-behavioral fix** to the repo: `as unknown as User` in
  `src/users/users.service.ts` (line 38). Without this, the project does
  not compile, which blocks all other testing. The runtime bug (BUG-001)
  is intentionally preserved so it could be documented. A proper fix is
  suggested in BUG-001.
- **Postman collection built manually** rather than via OpenAPI import, so
  the collection can be self-contained and portable.
- **CI uses `--ignore-scripts`** because Prisma's postinstall hangs on
  some networks. This project uses TypeORM, so the Prisma binaries are
  unnecessary.

---

## Assumptions and limitations

- Tests were run against a local Postgres in Docker with persistent
  volume. Test data from previous runs remained in the DB between
  sessions. Ideally each test run starts from a clean schema.
- The unit tests cover service-level logic only. Full end-to-end tests
  (supertest) would provide better coverage of HTTP-layer behavior.
- The Postman collection was authored manually rather than imported from
  the OpenAPI spec, so endpoint parameters might not exactly match a
  freshly-generated collection.
- No authentication or authorization is implemented in this API, so
  those aspects were not tested.

---

## Suggested improvements (with more time)

1. **Add input validation:**
   - `@IsEmail()` on `CreateUserDto.email`
   - `@Min(0)` on `CreateProductDto.price` and `.quantity`
   - `ParseIntPipe` on all `:id` path parameters
2. **Return correct status codes:** 409 for duplicate email, 400 for
   malformed `:id`, 400 for negative price.
3. **Fix the transaction direction:** `product.quantity -= dto.quantity`.
4. **Add a global exception filter** to stop leaking raw Postgres errors
   in 5xx responses.
5. **Add E2E tests** using `supertest` covering all three modules.
6. **Add a separate test database** (`ella_test`) and run migrations at
   the start of the test suite.
7. **Add authentication** (JWT or session-based) — this API is currently
   fully open.
8. **Add rate limiting** on `POST` endpoints.

---

## References

- Swagger UI: http://localhost:4000/api
- OpenAPI JSON: http://localhost:4000/api-json
- Repo README: `README.md`