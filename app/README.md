# console — app.codingagent.in

This is the authenticated CodingAgent console: an "agent workbench" UI (chat
pane, file tree, code editor, command palette, cron panel, memory panel,
skills panel, gateway panel, dashboard, web-bridge panel, mobile nav) for
driving a coding agent. It's the app the rest of this repo links to as
**`app.codingagent.in`** — see `web/src/app/Landing.tsx`, `web/src/app/layout.tsx`,
`frontend/src/features/home/HomePage.tsx`, `frontend/src/components/layout/PublicShell.tsx`,
and `README.md`'s `APP_ORIGINS=https://app.codingagent.in`. Those links had
been aspirational (the console was never actually deployed) until this app
was integrated into the repo.

## What it is / how it got here

This app was built with xAI's "Grok" app-builder tool as a separate project
and then folded into this repo as its own top-level deployable unit, the same
pattern as `frontend/`, `web/` and `backend/`. It is a TanStack Start + Vite +
React app, using `better-auth` for auth and Kysely/`pg` for Postgres (with its
own migration set under `migrations/auth/`).

`.grok/` holds the app-builder tooling's own state: build/deploy notes under
`.grok/references/*.md`, reusable skill docs under `.grok/skills/`, and the
build-flag file `.grok/app-env.json`. `AGENTS.md` is Grok Build's own sandbox
contract, not user-facing documentation.

## Auth and database are currently disabled — by design

`.grok/app-env.json` ships:

```json
{ "VITE_AUTH_ENABLED": "false", "deploy": { "database": false } }
```

Sign-in and the Postgres-backed data layer are switched off for this initial
integration. Wiring up real auth and a real database is an explicit, separate
follow-up — not part of getting this app into the repo. This app's Kysely/`pg`
layer and `migrations/` are unrelated to, and not connected to, this repo's
Neon schema under `neon/migrations/`.

`npm run build` runs `npm run db:migrate` (`scripts/migrate.mjs`) as its last
step. With no `DATABASE_URL` set, that step logs and exits 0 (a no-op) — the
PGLite fallback applies the same migration files at server start instead, so
the build itself never requires a live database.

## Scripts

- `npm install` — install dependencies (`npm ci` currently fails on this
  lockfile — see the CI job's comment for why)
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — `eslint .`
- `npm run test` — `node --test` over `scripts/**/*.test.mjs` and
  `src/lib/**/*.test.ts`
- `npm run build` — Vite + Nitro (`preset: "vercel"`) build, then
  `db:migrate`; output lands at `.vercel/output/` (the standard Vercel Build
  Output API location)
- `npm run dev` — local dev server on `0.0.0.0:8080`

## Deploying

Deploying this app requires a **new Vercel project rooted at `console/`**
(the same pattern as the `backend/` Vercel project), with the `app.codingagent.in`
domain assigned to it. That project creation and domain assignment is being
handled separately, outside of the change that added this app to the repo —
this directory does not configure or assume any specific Vercel project.
