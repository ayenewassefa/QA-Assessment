# Ella API — Deployment Runbook

**Service:** Ella API (NestJS + PostgreSQL)  
**Audience:** Engineers on call, DevOps  
**Last updated:** 2026-09-14

This runbook covers building, deploying, verifying, and rolling back the
Ella API, plus the common failures you are likely to see and how to fix
them.

---

## 1. Architecture at a glance

```
       ┌──────────────┐        ┌──────────────────┐
       │  Client /    │  HTTP  │  NestJS API      │
       │  Browser     ├───────▶│  (Node 20)       │
       └──────────────┘        │  port 4000       │
                               └────────┬─────────┘
                                        │ TCP 5432
                                        ▼
                               ┌──────────────────┐
                               │  PostgreSQL 16   │
                               │  (Docker volume) │
                               └──────────────────┘
```

- **App container:** built from the repo's `Dockerfile`.
- **DB container:** `postgres:16`, defined in `docker-compose.dev.yml`
  (dev) and `docker-compose.yml` (full stack).
- **Ports:** app `4000`, database `5432` (published on dev only).
- **State:** database volume `db_data` persists between container restarts.

---

## 2. Prerequisites

| Tool              | Minimum version | Notes                                |
|-------------------|-----------------|--------------------------------------|
| Node.js           | 20 LTS          | `nvm-windows` recommended on Windows |
| Docker Desktop    | Latest          | Must be running before any compose command |
| Git               | Any recent      |                                      |
| PowerShell        | 5.1 or 7+       | Windows only                         |

---

## 3. First-time setup (local developer)

```powershell
git clone https://github.com/ellatech-eth/QA-Assessment.git
cd QA-Assessment

# 1. Create .env from the template
Copy-Item .env.example .env
# Edit .env if needed; defaults work for local dev

# 2. Install dependencies (Windows-safe flags — see env notes)
npm install --script-shell "C:\Windows\System32\cmd.exe" `
            --ignore-scripts --no-audit --no-fund --omit=optional

# 3. Start the database
docker compose -f docker-compose.dev.yml up -d

# 4. Apply migrations
npm run migration:run

# 5. Start the API in watch mode
npm run start:dev
```

The API is reachable at `http://localhost:4000` and the Swagger UI is at
`http://localhost:4000/api`.

---

## 4. Build

### 4.1 Build the app locally (TypeScript compile only)

```powershell
npm run build
```
Output goes to `dist/`. A successful build exits 0 with no errors.

### 4.2 Build the full Docker image + DB stack

```powershell
docker compose up -d --build
```

This does three things:
1. Builds the API image from the repo `Dockerfile`.
2. Pulls `postgres:16` if not already present.
3. Starts both containers on a shared Docker network.

Verify containers:

```powershell
docker compose ps
```

Expected: two containers `Up` (the DB may briefly show `starting` until
its healthcheck passes).

---

## 5. Deploy

### 5.1 Local / development deploy

```powershell
git pull
docker compose -f docker-compose.dev.yml up -d
npm run migration:run
npm run start:dev
```

### 5.2 Docker (staging-like) deploy

```powershell
git pull
docker compose down
docker compose up -d --build
docker compose logs -f app     # watch startup
```

Press `Ctrl+C` to stop following logs (containers keep running).

### 5.3 Production-style deploy (via CD)

In a full CD setup, deployment is triggered automatically by the CI
pipeline after merge to `main` (see `ci-notes.md`). The pipeline:
1. Builds and pushes a Docker image tagged with `${{ github.sha }}`.
2. SSHes into the target host and pulls the new image.
3. Runs `docker compose up -d` on the host.
4. Runs a smoke test (`curl --fail /health`).
5. Pauses for manual approval before promoting to production.

---

## 6. Verify a deployment

Run these checks after every deploy:

```powershell
# 1. Containers are running
docker compose ps

# 2. App health endpoint responds
curl.exe http://127.0.0.1:4000/health

# 3. Swagger UI loads
#    Open in browser: http://127.0.0.1:4000/api

# 4. A real endpoint returns data
curl.exe http://127.0.0.1:4000/products
```

**Expected:**
- `/health` returns `{"status":"ok","database":"up",...}`
- `/products` returns HTTP 200 with a JSON array.

If any of these fail, jump to **Section 9 — Common failures**.

---

## 7. Logs and monitoring

```powershell
# Follow all container logs
docker compose logs -f

# Follow only the app container
docker compose logs -f app

# Show last 200 lines
docker compose logs --tail=200 app
```

**What to look for:**
- `Nest application successfully started` on boot.
- Repeated `QueryFailedError` or 5xx in logs → DB or migration issue.
- `ECONNREFUSED ...5432` → DB not ready / wrong host in `.env`.

For a real environment, ship these logs to a central system
(CloudWatch / Loki / ELK / Datadog). See the health-check and monitoring
section in `environment-notes.md`.

---

## 8. Rollback

### 8.1 Roll back the app (Docker)

If the latest image is broken, redeploy the previous known-good tag:

```powershell
# In production, images are tagged with the git SHA or semantic version
docker pull registry.example/ella-api:v1.4.1
docker compose down
docker compose up -d
```

### 8.2 Roll back the database (migrations)

Migrations are **not** automatically reversible. If a bad migration ran:

1. Stop the app: `docker compose stop app`.
2. Restore the DB from the most recent backup:
   ```powershell
   docker exec -i <db-container> psql -U postgres -d ella < backup.sql
   ```
3. Redeploy the previous app version.

**Best practice:** always take a DB backup before applying migrations in
staging or production.

### 8.3 Roll back code only

```powershell
git checkout <previous-tag>
npm install --script-shell "C:\Windows\System32\cmd.exe" `
            --ignore-scripts --omit=optional
docker compose up -d --build
```

---

## 9. Common failures and fixes

### 9.1 `Nest application successfully started` never appears

**Likely cause:** startup crash — DB unreachable or migration error.

**Fix:**
```powershell
docker compose logs app
```
Look for the first `Error` line. Common cases:
- `ECONNREFUSED 127.0.0.1:5432` → DB container not running. Start it.
- `password authentication failed` → wrong `DB_PASSWORD` in `.env`.
- `relation "user" does not exist` → migrations not applied. Run
  `npm run migration:run`.

### 9.2 Port 4000 already in use

**Symptom:** `EADDRINUSE` on boot.

**Fix:**
```powershell
# Find the process
netstat -ano | findstr :4000
# Kill it
Stop-Process -Id <PID> -Force
```
Or change `PORT=4001` in `.env` and restart.

### 9.3 `docker compose up` fails with container name conflict

**Symptom:**
```
Conflict. The container name "/shop-db" is already in use
```

**Fix:**
```powershell
docker rm -f shop-db
docker compose -f docker-compose.dev.yml up -d
```

### 9.4 `npm install` hangs or fails on Windows

See `environment-notes.md` §3 for the full list. Short version:

```powershell
npm install --script-shell "C:\Windows\System32\cmd.exe" `
            --ignore-scripts --no-audit --no-fund --omit=optional
```

### 9.5 Database is empty after `docker compose up`

**Cause:** migrations were not run.

**Fix:**
```powershell
npm run migration:run
# or inside the app container:
docker compose exec app npm run migration:run
```

### 9.6 Swagger at `/api` returns 404

**Cause:** app is running but Swagger setup did not execute (possibly a
stale build).

**Fix:**
```powershell
docker compose down
docker compose up -d --build
```

If still failing, check `src/main.ts` for the `SwaggerModule.setup()` call.

### 9.7 `database "ellanpm install" does not exist`

**Cause:** `.env` has malformed content (paste artifact).

**Fix:** open `.env`, ensure the last line is exactly:

```
DB_DATABASE=ella
```

Save, restart the app.

### 9.8 Healthcheck shows `(unhealthy)` but container is `Up`

**Diagnosis:**
```powershell
docker inspect --format='{{json .State.Health}}' shop-db
```

**Cause:** usually a mismatch between `POSTGRES_USER` / `POSTGRES_DB` in
compose and the healthcheck's `pg_isready -U ... -d ...`.

**Fix:** ensure the compose file's environment and healthcheck refer to
the same user and database names, then recreate the container:
```powershell
docker rm -f shop-db
docker compose -f docker-compose.dev.yml up -d
```

---

## 10. Escalation

If the steps above don't resolve the issue:

1. Capture logs: `docker compose logs --tail=500 > incident.log`.
2. Note the exact command that failed and its full output.
3. Check the `.env` file for typos or mismatched values.
4. If in a cloud environment, check the platform's service health
   (AWS status page, GCP status, etc.).
5. Escalate to the on-call engineer with the logs and a one-line summary.