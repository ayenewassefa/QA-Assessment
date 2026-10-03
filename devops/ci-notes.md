# CI/CD Notes

## What the pipeline does

`.github/workflows/ci.yml` runs on every `push` and `pull_request` to `main`.
It executes four steps in sequence on a fresh `ubuntu-latest` runner:

1. **Install** — `npm ci --ignore-scripts --no-audit --no-fund`
2. **Lint** — `npm run lint`
3. **Build** — `npm run build`
4. **Test** — `npm test`

If **any** step exits with a non-zero status, the pipeline fails and the
check is marked red on the pull request. With branch protection enabled, a
red check blocks merging.

## Why these flags

- `npm ci` — faster and reproducible: installs exactly what is in
  `package-lock.json`, never mutates it, and fails if the lock file and
  `package.json` disagree.
- `--ignore-scripts` — skips post-install scripts. Prisma's postinstall
  attempts to download engine binaries from `binaries.prisma.sh`, which
  stalls on some networks. This project uses TypeORM, not Prisma, so the
  binaries are not needed.
- `--no-audit --no-fund` — skips the security audit and funding lookups.
  Both are informational and slow down the build.
- `node-version: '20'` — matches the LTS version this project targets.
  Pinning prevents future Node releases from breaking the build.

## Assumptions

- Repository is hosted on GitHub with the workflow file at
  `.github/workflows/ci.yml`.
- `npm run lint`, `npm run build`, and `npm test` are defined in
  `package.json` and pass locally (verified before committing).
- Unit test suite is non-empty: `src/products/products.service.spec.ts`.
- Target Node version is 20 LTS.

---

## Extending toward continuous deployment (CD)

The current pipeline is CI only — it verifies code, it does not ship it. To
extend toward CD:

### 1. Build and push a Docker image

After tests pass, add steps to build and push an image to a container
registry (AWS ECR / GCP Artifact Registry / Azure ACR / Docker Hub):

```yaml
- name: Build Docker image
  run: docker build -t ${{ secrets.REGISTRY }}/ella-api:${{ github.sha }} .

- name: Push image
  run: |
    echo "${{ secrets.REGISTRY_PASSWORD }}" | docker login \
      -u ${{ secrets.REGISTRY_USER }} --password-stdin
    docker push ${{ secrets.REGISTRY }}/ella-api:${{ github.sha }}
```

**Why tag with `github.sha`:** every build produces a unique, traceable
image. You always know exactly which commit is running in any environment.

### 2. Deploy to staging automatically

On merge to `main`, deploy to a staging server:

```yaml
- name: Deploy to staging
  if: github.ref == 'refs/heads/main'
  run: |
    ssh ${{ secrets.STAGING_HOST }} \
      "docker pull ${{ secrets.REGISTRY }}/ella-api:${{ github.sha }} && \
       docker compose -f docker-compose.yml up -d"
```

Staging stays in sync with `main`, so QA can test the newest code within a
minute of merge.

### 3. Smoke test against staging

After deployment, run a quick check against a health endpoint:

```yaml
- name: Smoke test
  run: curl --fail https://staging.ella.example/health
```

`curl --fail` fails the pipeline on any non-2xx response, so a broken
deployment is caught in seconds instead of by a user.

### 4. Production deploy behind manual approval

Use GitHub **Environments** with required reviewers:

```yaml
deploy-production:
  needs: build-and-test
  runs-on: ubuntu-latest
  environment: production
  steps:
    - name: Deploy to production
      run: |
        ssh ${{ secrets.PROD_HOST }} \
          "docker pull ... && docker compose up -d"
```

The job pauses until a designated reviewer approves. This gives a human
safety gate before user-facing changes ship.

### 5. Rollback strategy

Tag every image with both `${{ github.sha }}` and a semantic version
(e.g., `v1.4.2`). If a deploy breaks production, redeploy the previous
known-good tag:

```bash
ssh prod-host "docker pull registry/ella-api:v1.4.1 && \
  docker compose -f docker-compose.yml up -d"
```

See `deployment-runbook.md` for the concrete rollback procedure.

---

## Notes on the CI runner environment

CI runs on `ubuntu-latest`. Any Windows-specific quirks that affected local
development — PowerShell `||` failures on npm postinstall scripts,
`node_modules` file locks, slow CDN downloads — **do not affect the CI
run**. That is why the pipeline does not need the `--script-shell`
workaround used in the dev environment.

## Recommended branch protection

To make the CI pipeline effective, enable these rules on `main`:

- Require status checks to pass before merging.
- Require the **CI / Lint, build, and test** check.
- Require branches to be up to date before merging.
- Disallow force pushes to `main`.

With these rules, a red pipeline cannot be bypassed.