# Environment Configuration Notes

This document describes the environment variables used by the Ella API,
what changes between the development / staging / testing environments, and
the environment problems encountered while setting up the project on
Windows.

---

## 1. Environment variables reference

The application reads the following variables at runtime. They are loaded
by `@nestjs/config` from a `.env` file at the project root (and overridden
by Docker Compose when the app runs inside a container).

| Variable      | Purpose                                | Example value (dev)        |
|---------------|----------------------------------------|----------------------------|
| `PORT`        | HTTP port the Nest app listens on      | `4000`                     |
| `DB_HOST`     | Postgres host                          | `localhost` (dev) / `db` (Docker) |
| `DB_PORT`     | Postgres port                          | `5432`                     |
| `DB_USERNAME` | Postgres user                          | `postgres`                 |
| `DB_PASSWORD` | Postgres password                      | `postgres`                 |
| `DB_DATABASE` | Postgres database name                 | `ella`                     |

`.env.example` in the repo root is the template. Copy it to `.env` before
running the app locally.

### DB_HOST special case

`docker-compose.yml` overrides `DB_HOST` to `db` (the compose service name)
when the Nest container runs inside the same compose network. When the app
runs on the host (`npm run start:dev`), `DB_HOST` must be `localhost`.

---

## 2. Development vs staging vs testing

| Concern              | Development                            | Staging                                 | Testing                                    |
|----------------------|----------------------------------------|-----------------------------------------|--------------------------------------------|
| `NODE_ENV`           | `development`                          | `staging`                               | `test`                                     |
| Database             | Local Postgres in Docker               | Managed Postgres (RDS / Cloud SQL)      | Isolated DB per run (in-memory or CI service container) |
| Credentials source   | `.env` file (gitignored)               | Secrets manager (AWS SM / Vault / GH secrets) | Test fixtures / CI env vars          |
| Logging              | Verbose (`debug`)                      | Structured JSON at `info`               | Minimal (`error`) — quiet test output      |
| Error messages       | Full detail returned to clients        | Sanitised; details only in logs         | Asserted against; full detail allowed in tests |
| CORS                 | Permissive (`*`)                       | Restricted to staging origins           | Disabled                                   |
| Migrations           | `npm run migration:run` (manual)       | Run on deploy (CI step or entrypoint)   | Run once before test suite                 |
| Seed data            | Optional manual seed                   | Anonymised snapshot of production       | Fixtures created per test                  |
| Secrets in repo      | Never                                  | Never                                   | Fixed fake values for tests only           |
| Auto-reload          | `start:dev` (watch mode)               | None (restart on deploy)                | None                                       |

### What changes and why

- **Secrets:** dev uses plain `.env`; staging and production pull from a
  secrets manager. Nothing sensitive should ever be committed.
- **Error verbosity:** development returns full error detail to help
  debugging. Staging must sanitise responses so internal details are not
  exposed to a wider audience (see BUG-005 for a related leak in this API).
- **Migrations:** in development they are run manually; in staging they
  run automatically as part of the deploy step. In tests they run once
  against a fresh schema.
- **Logging:** dev logs everything; staging logs structured JSON so a log
  aggregator (CloudWatch, ELK, Datadog) can index it; tests log only what
  is needed for assertions.

---

## 3. Environment issues encountered during setup (Windows 11)

These are real problems that were hit while preparing this environment.
Each is documented with the symptom, the diagnosis, and the fix. They form
part of the DevOps take-home evidence.

### 3.1 `npm install` fails on Windows PowerShell with `||` syntax error

**Symptom:**
```
npm error command C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -c opencollective || exit 0
npm error The token '||' is not a valid statement separator in this version.
```

**Cause:** npm's `script-shell` on this machine is Windows PowerShell 5.1,
which does not support the `||` operator used by `@nestjs/core`'s
postinstall script.

**Diagnosis:** the error trace pointed directly at the shell and the
offending command. `npm config get script-shell` confirmed the setting.

**Fix:** run installs with `cmd.exe` as the script shell for this
invocation only:
```powershell
npm install --script-shell "C:\Windows\System32\cmd.exe"
```
No machine-wide config was changed.

### 3.2 `npm install` hangs downloading Prisma engine binaries

**Symptom:** the install stalls indefinitely after fetching the registry
metadata for the last few packages. Verbose output shows it hanging while
resolving optional dependencies and the Prisma postinstall.

**Cause:** TypeORM declares several optional native database drivers
(`oracledb`, `mssql`, `mysql2`, `better-sqlite3`, `pg-native`,
`mongodb-client-encryption`, `kerberos`, etc.). Their binary tarballs and
Prisma's engine downloader are hosted off-registry and stall on this
network.

**Fix:**
```powershell
npm install --script-shell "C:\Windows\System32\cmd.exe" `
            --ignore-scripts --no-audit --no-fund --omit=optional
```
Prisma is not used by this project (TypeORM is), so skipping the script is
safe.

### 3.3 Slow npm registry from Ethiopia

**Symptom:** even after the above fixes, downloads from
`registry.npmjs.org` were slow and produced `ECONNRESET` errors mid-install.

**Fix:** switch to the `npmmirror.com` registry, increase retry/timeout
settings, and reduce concurrent sockets so a slow link isn't split too many
ways:
```powershell
npm config set registry https://registry.npmmirror.com
npm config set fetch-retries 10
npm config set fetch-retry-mintimeout 30000
npm config set fetch-retry-maxtimeout 600000
npm config set fetch-timeout 900000
npm config set maxsockets 3
```
Because npm's cache is persistent, each retry needed to download fewer
tarballs, and the install eventually completed.

### 3.4 Node 24 locally vs Node 20 in CI

**Observation:** the machine has Node 24 installed. The project targets
Node 20 LTS. CI pins Node 20 via `actions/setup-node`, which avoids the
same category of problems in the cloud.

**Recommendation:** developers should use Node 20 locally via
`nvm-windows`, `fnm`, or `volta`. This is not required for the assessment
environment but is the standard practice.

### 3.5 Docker container name conflict on fresh clone

**Symptom:**
```
Error response from daemon: Conflict. The container name "/shop-db" is
already in use by container "...".
```

**Cause:** `docker-compose.dev.yml` hardcodes `container_name: shop-db`.
Only one project can use that name at a time.

**Fix:**
```powershell
docker rm -f shop-db
docker compose -f docker-compose.dev.yml up -d
```
Alternatively, drop the `container_name:` field so Docker auto-names by
project (`ellaqa-db-1`, etc.) and multiple clones can coexist.

### 3.6 `version:` key obsolete warning

**Symptom:**
```
level=warning msg="...the attribute `version` is obsolete, it will be
ignored, please remove it..."
```

**Cause:** Docker Compose v2 no longer needs the top-level `version:` key.

**Fix:** remove the `version: '3.9'` line from `docker-compose.dev.yml`.
The warning is otherwise harmless.

### 3.7 Malformed `.env` value caused a confusing database error

**Symptom:**
```
error: database "ellanpm install" does not exist
```

**Cause:** copy-pasting `.env` content merged `DB_DATABASE=ella` with the
text `npm install`, producing the value `ellanpm install`. Postgres then
reported the error far from the actual mistake.

**Fix:** open `.env`, ensure the last line is exactly `DB_DATABASE=ella`
with a trailing newline, and no other text.

**Recommendation:** add a startup config-validation step (Joi or
`class-validator` on the config object) so invalid values fail fast with a
clear message instead of producing an obscure runtime error.

---

## 4. Recommendations for other environments

- **Secrets:** use a secret store. Never commit `.env`.
- **Config validation:** validate required env vars on startup and exit
  with a clear message if any are missing or malformed.
- **Version parity:** pin Node, Postgres, and Docker image versions across
  dev, CI, and staging.
- **Health checks:** every environment should expose `GET /health` (this
  API already does) and have it monitored by the platform's load balancer.
- **Migrations on deploy:** run migrations as a pre-deploy step (CI job or
  container entrypoint), never automatically on app boot, to avoid race
  conditions with multiple replicas.