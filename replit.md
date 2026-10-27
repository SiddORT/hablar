# HABLAR

A coming-soon website with an encrypted email/phone launch-update waitlist.

## Run & Operate

- Use Replit's Run button to start the managed frontend and API workflows.
- Frontend: `artifacts/hablar-coming-soon: web`, served at `/`.
- API: `artifacts/api-server: API Server`, served at `/api`; health check: `/api/healthz`.
- Install workspace dependencies with `pnpm install --frozen-lockfile`.
- The API's existing `uv run --locked` command installs Python dependencies from `uv.lock`.
- Production containers and GHCR delivery: see `docs/containers.md`.
- `pnpm --filter @workspace/api-server run dev` — run the FastAPI server (default port 8080)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required secrets: `DATABASE_URL` (PostgreSQL) and `SESSION_SECRET` (at least 32 bytes). Both are configured in Replit; never print them.
- Keep `SESSION_SECRET` stable: it protects stored contact data and duplicate-detection hashes. Rotation requires a coordinated data migration.
- Managed frontend workflows supply `PORT=25179` and `BASE_PATH=/`. For a manual build: `PORT=25179 BASE_PATH=/ pnpm --filter @workspace/hablar-coming-soon run build`.
- `pnpm --filter @workspace/hablar-coming-soon run test:seo` — existing SEO regression tests.
- `SITE_ORIGIN` is optional for development. Without an explicitly configured public HTTPS origin, the site intentionally stays noindex and omits canonical URLs and sitemap entries.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite
- API: Python 3.12 + FastAPI, uvicorn, asyncpg
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Frontend build: Vite; Python dependencies: uv with `uv.lock`

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
