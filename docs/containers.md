# HABLAR production containers

This packages the website and the **existing Python/FastAPI API**, without
changing application behavior. The original Node API packaging plan was updated
with approval because this repository no longer contains that server.
No host is deployed and no production database is created.

## Requirements and configuration

- Docker Engine with Compose **2.30+** (raw environment-file support).
- Linux **amd64** images only. The pnpm workspace deliberately excludes native
  build dependencies for other architectures. ARM hosts need amd64 emulation.
- An externally managed PostgreSQL database reachable from the API container.
  `localhost` in a database URL means the container, not the Docker host.
- Apply the existing schema in `lib/db/src/schema/` through your normal,
  reviewed database migration process before accepting signups. Startup does
  not create tables, and a healthy API does not prove the signup schema exists.
- A stable `SESSION_SECRET` of at least 32 bytes. For an existing database, use
  its **existing secret**. Changing it makes encrypted contacts unreadable and
  changes duplicate-detection hashes; rotation requires a coordinated data
  migration. For a new installation, generate a random secret in your host's
  secret manager, not in source control.

From the repository root:

```sh
cp .env.example .env
cp .env.api.example .env.api
chmod 600 .env.api
# Edit .env.api with the real DATABASE_URL and stable SESSION_SECRET.
docker compose up --build -d --wait --wait-timeout 180
```

The literal values in `.env.api.example` are placeholders, not working
credentials. `.env` and `.env.api` are ignored by Git and the Docker build
context. Use an external file by setting `API_ENV_FILE=/secure/path/hablar.env`
in `.env` or your shell. The API environment file uses raw `KEY=value` entries:
do not quote the values; `$` and `#` within values remain literal. Never run
`docker compose config` without `--quiet` in shared logs because the expanded
configuration includes credentials.

| Setting | Where | Meaning |
| --- | --- | --- |
| `DATABASE_URL` | API env file | PostgreSQL URL; TLS required by default. `sslmode=disable` is only appropriate for a trusted local/test database. |
| `SESSION_SECRET` | API env file | Stable contact-encryption source secret, at least 32 bytes. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL` | API env file | Required for email delivery. Port 465 uses implicit TLS; other ports require STARTTLS. Put credentials in the host's secret manager/Replit Secrets, not source control. |
| `ADMIN_NOTIFICATION_EMAIL` | API env file | HABLAR administrator recipient for one notification per newly saved signup. |
| `API_ENV_FILE` | Compose `.env` / shell | External API settings file; defaults to `.env.api`. |
| `HTTP_PORT` | Compose `.env` / shell | Host website port, default `8080`. |
| `BIND_ADDRESS` | Compose `.env` / shell | Defaults to `127.0.0.1`. Set deliberately if exposing to a host proxy/network. |
| `WEBSITE_IMAGE`, `API_IMAGE` | Compose `.env` / shell | Local image names by default; replace with GHCR references to pull published images. |
| `SITE_ORIGIN` | Website build argument / Compose `.env` / GitHub repository variable | Verified public HTTPS origin, without a path or trailing route. Used for canonical URLs, social URLs and the sitemap. Blank produces a noindex build with crawling disabled and an empty sitemap; no preview hostname is substituted. |

Only nginx is exposed on the host. It serves the SPA at `/`, serves
route-specific HTML heads for `/privacy` and `/terms`, and proxies `/api` without stripping
the prefix. Missing API URLs return API errors, not HTML. Static assets under
`/brand` are included. The website's `BASE_PATH=/`, `NODE_ENV=production` and
config-required `PORT=8080` are supplied **at build time**. The static website
does not read runtime Vite variables; don't put secrets in Vite settings.

### Search and sharing configuration

No production domain has been verified in this repository. Once the owner has
verified the public origin, set `SITE_ORIGIN` in Compose's `.env` before building,
or pass `--build-arg SITE_ORIGIN="$SITE_ORIGIN"` to `docker build`. GHCR builds use
the GitHub repository variable `SITE_ORIGIN` (not a secret). For a direct Vite
build, supply `SITE_ORIGIN` in the build environment or the website artifact's
`.env.production.local`. The value must be an HTTPS origin only; preview hosts,
credentials, ports, paths, queries and fragments are rejected.

Rebuild the website after changing the origin; setting a runtime variable on an
existing static image cannot change its metadata. With an origin configured,
`/robots.txt` allows public pages and points to `/sitemap.xml`, which lists `/`,
`/privacy` and `/terms`. Without it, all page heads are `noindex`, robots disallows
crawling, and the valid sitemap has no entries. This explicitly prevents
indexing the wrong host while the public domain is undecided.

SEO checks: `pnpm --filter @workspace/hablar-coming-soon run test:seo`.

The API defaults to `PORT=8080` and binds `0.0.0.0`. Compose fixes that port
to match nginx. Standalone API containers can set another `PORT`; their
health check follows it. Standalone website containers accept `API_UPSTREAM`
(default `http://api:8080`) on a Docker network, and listen on `8080`.
Compose trusts forwarded client addresses only because nginx overwrites the
header and the API is not host-published. Do not publish the API directly or
attach untrusted containers to its network with this trust setting.

Both application containers run as non-root users, with dropped capabilities
and read-only roots in Compose. Only temporary runtime files are writable.
There is no persistent app volume; contact data stays in the external database.
If SMTP settings are missing or invalid, API startup logs the setting names
that need attention and signups remain saveable; email delivery is skipped.
The owner must confirm the configured SMTP provider's identity before naming it
in the Privacy Notice.

## Build, operate, and check

Build individually from the **repository root**, never an artifact subdirectory:

```sh
docker build --platform linux/amd64 -f docker/website.Dockerfile -t hablar-website:local .
docker build --platform linux/amd64 -f docker/api.Dockerfile -t hablar-api:local .
docker compose up -d --no-build --wait
curl --fail http://127.0.0.1:8080/healthz
curl --fail http://127.0.0.1:8080/api/healthz
docker compose ps
docker compose logs --tail 100 website api
docker compose down
```

The website health endpoint returns `ok`; the proxied API health endpoint
returns `{"status":"ok"}`. API startup fails explicitly if the database cannot
connect or required configuration is missing. Health checks run every 30
seconds. `depends_on: service_healthy` gates initial startup only; Docker does
not automatically restart a live-but-unhealthy process. Restart policies act
on process exits. Monitor health and errors on your chosen host.

Dependency installs use `pnpm@10.26.1 --frozen-lockfile` and
`uv@0.13.4 sync --locked --no-dev` with the committed lockfiles. The API image
contains its Python environment, source, and branded email PNG under
`/app/assets/`, not the Node workspace.
The website runtime contains only nginx, its configuration, and built assets.

Run the disposable container checks on a normal Docker host:

```sh
pnpm install --frozen-lockfile
pnpm run typecheck
bash scripts/container-smoke.sh
```

The script builds both production Dockerfiles from the current checkout's
repository root with unique local-only image tags and a unique Compose project.
It ignores the checkout's `.env`, removes inherited host certificate mounts and
published ports, and replaces the API environment with synthetic settings (no
SMTP credentials). Before starting services, it runs
`docker/check-email-assets.py` inside the built API image with no network,
mounts, database, or user override. That check requires UID/GID `10001:10001`,
reads nonempty PNG bytes at `/app/assets/hablar-email-logo.png`, and constructs
and serializes all three branded messages through the real email asset loader.

The script then uses a temporary test-only PostgreSQL container
and synthetic credentials, verifies health, SPA routes, real static assets,
API error/POST forwarding, and non-root users, then removes only its uniquely
named containers, local image tags, and disposable resources.
It never connects to your external database, applies schema, or submits real
contact data. The test override `docker/compose.smoke.yaml` is **not** a
production Compose file. Containers need working Docker exec/health-check
support; restricted nested-container environments may not support those.

## GitHub Actions and image tags

`.github/workflows/containers.yaml` validates all workspace types, runs the
offline waitlist/launch email unit tests with locked Python dependencies, and runs the
container checks on pull requests, pushes to `main`, pushes of `v*` tags, and
manual runs. Publication happens **only on pushes to `main` or `v*` tags**,
after validation succeeds. Manual runs validate without publishing.

Images are:

```text
ghcr.io/<lowercase-owner>/<lowercase-repository>-website:<tag>
ghcr.io/<lowercase-owner>/<lowercase-repository>-api:<tag>
```

- Every published build: `sha-<full-40-character-commit-sha>`.
- Main branch: `main` (moving tag).
- Release tag, e.g. `v1.2.3`: `v1.2.3` (exact Git tag).
- No implicit `latest`. Pin both services to the same commit or release.
  For stronger immutability, use each image's registry digest.

Only the publish job has `packages: write`; validation and PR jobs get
`contents: read`. Login uses the built-in `GITHUB_TOKEN`, not a stored PAT.
Repository/organization settings must allow Actions to publish packages.
For an existing GHCR package, grant this repository Actions access to it.
Tags don't require a host or a deploy credential. Never include runtime
database credentials in GitHub build arguments.

## Pull and start on a chosen host

Copy `compose.yaml` and the configuration examples to the operator host
(or check out this repository), create the protected external API file, and
set both image references in `.env`, for example:

```dotenv
WEBSITE_IMAGE=ghcr.io/example/hablar-website:v1.2.3
API_IMAGE=ghcr.io/example/hablar-api:v1.2.3
API_ENV_FILE=/secure/path/hablar.env
HTTP_PORT=8080
BIND_ADDRESS=127.0.0.1
```

For private packages, authenticate interactively using an operator credential
with `read:packages` and package access; never put it in this repository:

```sh
docker login ghcr.io
docker compose pull
docker compose up -d --no-build --wait --wait-timeout 180
docker compose ps
curl --fail http://127.0.0.1:8080/api/healthz
```

`--no-build` is important: running published images needs no source/build
context on the host. To update or revert, set **both** image references to the
desired known-good version, pull, and repeat `up`. Preserve the encryption
secret and database; verify database-schema compatibility before reverting.

TLS termination, domain routing, database backups, secret delivery and
host monitoring remain operator responsibilities. Keep the default loopback
binding behind a trusted HTTPS reverse proxy. If terminating HTTPS upstream,
review forwarded-protocol handling as part of that host's proxy configuration.
The existing workflow also deploys successful `main` pushes to UAT, as described
below. It does not target LIVE.

## UAT API email-asset rollout (operator action only)

This packaging fix does not authorize a VPS or LIVE deployment. No rollout was
performed as part of the fix. The workflow's existing `deploy` job is retained:
after validation/publication on `main`, it SSHs on port `3141`, changes to
`/var/www/uat-landing.hablar.co.in`, and invokes
`./deployscripts/deploy.sh '<full github.sha>'`.
**That VPS script is absent from this checkout and has not been verified.**
Before authorizing a merge that triggers UAT deployment, review the host-side
script to confirm it pulls the matching SHA-tagged images and recreates the API,
rather than merely restarting the old container. Do not assume this from the
workflow's invocation alone.

Use the **final merged `main` SHA**, not a task-branch SHA or pre-merge base SHA.
The normal push workflow publishes
`ghcr.io/siddort/hablar-api:sha-<full-40-character-merged-sha>` only after its
validation job (including the checkout-built API smoke test) passes. A manual
workflow run validates but does not publish. Wait for the matching push run to
finish successfully; do not substitute the moving `main` image tag. Obtain the
API image digest from that publication for a strictly immutable image reference.

For an explicitly authorized **API-only** manual UAT update, use the existing
UAT Compose project and its existing protected configuration. Do not copy
example secrets, change `SESSION_SECRET`, apply schemas/migrations, change
database settings, remove volumes, or run `down`. The checked-in `compose.yaml`
currently reads API settings directly from its environment/Compose `.env`;
`API_ENV_FILE` alone does **not** inject settings into that file. Preserve the
host's actual existing configuration mechanism.

Example operator commands (replace both placeholders with verified values;
`UAT_ENV_FILE` must be the current protected Compose environment file, not a new
file, and preserve any existing project-name/override flags):

```sh
cd /var/www/uat-landing.hablar.co.in
UAT_ENV_FILE=/absolute/path/to/existing/uat-compose.env
# Digest from the successful publication for the final merged SHA:
export API_IMAGE='ghcr.io/siddort/hablar-api@sha256:<verified-api-digest>'
# Persist that same API_IMAGE reference in the existing UAT configuration
# without changing any other values.
docker compose --env-file "$UAT_ENV_FILE" -f compose.yaml config --quiet
docker compose --env-file "$UAT_ENV_FILE" -f compose.yaml pull api
docker compose --env-file "$UAT_ENV_FILE" -f compose.yaml up \
  -d --no-build --no-deps --force-recreate --wait --wait-timeout 180 api

# Confirm the running container uses the pulled image ID and default user.
cid="$(docker compose --env-file "$UAT_ENV_FILE" -f compose.yaml ps -q api)"
test -n "$cid"
test "$(docker inspect --format '{{.Image}}' "$cid")" = \
  "$(docker image inspect --format '{{.Id}}' "$API_IMAGE")"
test "$(docker inspect --format '{{.Config.User}}' "$cid")" = 10001:10001

# Use the check file from a checkout of the same final merged SHA.
CHECKOUT=/absolute/path/to/verified/merged-checkout
docker compose --env-file "$UAT_ENV_FILE" -f compose.yaml exec -T api \
  python - < "$CHECKOUT/docker/check-email-assets.py"
curl --fail https://uat-landing.hablar.co.in/api/healthz
```

The expected offline result is
`Email assets readable as UID/GID 10001; all three branded templates rendered offline.`
The check runs as the container's default non-root user, verifies the exact logo
path and embedded bytes, imports only the email module, and never invokes SMTP
or the API/database lifecycle. Do not submit signups or call launch-send routes
for this verification. Confirm API health is `{"status":"ok"}` and check UAT
website availability. `restart api` alone is insufficient: it cannot replace
the old image or supply a missing asset.

### Packaging-fix verification handoff

Changed files: `.dockerignore`, `docker/api.Dockerfile`,
`docker/compose.smoke.yaml`, `docker/check-email-assets.py`,
`scripts/container-smoke.sh`, `.github/workflows/containers.yaml`, and this
document. API source, email delivery behavior, logo artwork, database schemas,
stored contacts, encryption secrets, and existing persistent volumes are
unchanged.

Executed in the development workspace:

- `bash -n scripts/container-smoke.sh` — passed.
- `uv run --locked python -m unittest discover -s artifacts/api-server/tests -p 'test_waitlist_email.py'`
  — 11 passed, with mocked database and SMTP.
- `uv run --locked python -m unittest discover -s artifacts/api-server/tests -p 'test_launch_update.py'`
  — 6 passed, with mocked database and SMTP.
- Merged Compose configuration assertions — passed: checkout API Dockerfile,
  unique local image, only disposable database dependency, synthetic-only API
  environment even with a sentinel SMTP value set, no API mounts, one loopback
  website port, and no inherited host certificate mount.
- `bash scripts/container-smoke.sh` — both production images built; the
  network-disabled, default-user API image check passed for the exact logo
  path and all three branded templates. The full service/HTTP checks could
  not finish because this nested Docker host rejects container exec, including
  PostgreSQL health checks, with `OCI runtime exec failed` / `setns`.
  This is **not** a passing full smoke run. The same unchanged health gates
  must pass on a capable Docker host/normal CI before image publication.

The existing CI publication uses the same repository-root production
Dockerfiles and remains gated on validation; the UAT invocation is unchanged.
No remote CI run or host-side deployment script was verified here, no image
was published, and no UAT/LIVE deployment was performed. Use the task handoff
for the actual task-branch commit SHA; the final merge/publication SHA is only
available after merge and must be taken from the successful `main` push run.
