# Copilot Instructions — photography-comp

Internal photography competition site. Users upload up to **5 photos** per competition and
people **vote** for the best photo. The site supports running **multiple competitions** and is
built to be **reused** for future events.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Vite + React + TypeScript |
| Backend | Azure Functions (Node.js **v4** programming model, TypeScript) — deployed as SWA **managed** Functions |
| Hosting | Azure **Static Web Apps** (serves the built frontend and the `api/` Functions from one origin) |
| Storage | Azure Storage — **Blob** (photo files) + **Tables** (competitions, entries, votes) |
| Local emulation | Azurite (Blob + Table) + Azure Functions Core Tools (`func start`) |

**Deployment topology — only two Azure resources:**
1. **Static Web App** — hosts the static frontend **and** the managed Functions API (the `api/`
   folder). The API is served same-origin under `/api/*`, so the frontend calls `/api/...` with no
   CORS and no separate Function App.
2. **Storage account** — a single account shared as the system of record: **Blob** for photos,
   **Tables** for competitions/entries/votes.

Everything must run **locally** with no cloud dependency: Azurite emulates storage and the
Functions Core Tools runtime hosts the API. Do not introduce a separate database (Postgres,
Cosmos, etc.) — Azure Table storage is the system of record.

### SWA managed Functions — constraints to respect
- **HTTP triggers only.** No timer/queue/blob triggers (managed Functions don't support them). If
  background work is ever needed, do it inline in an HTTP call or revisit the topology.
- **No Managed Identity / Key Vault references.** The Functions reach the shared Storage account via
  a **connection string** in the `STORAGE_CONNECTION` app setting (locally: `UseDevelopmentStorage=true`
  for Azurite). Read it through `getStorageConnection()` in `api/src/shared/storage.ts`.
- **Node 20 runtime**, pinned via `platform.apiRuntime` in `public/staticwebapp.config.json`.
- Keep well under **~39 HTTP function registrations** (SWA managed-Functions cap); consolidate routes
  rather than adding many tiny functions.

## Architecture (big picture)

```text
src/                  → Vite + React frontend (browser)
  components/         → React components
  services/           → API client — the ONLY layer that calls the backend (fetch)
  lib/                → apiClient (calls `/api`), logger
  types/              → shared TypeScript types (Competition, Entry, Vote)
api/                  → Azure Functions app (Node/TypeScript) — deployed as SWA managed API
  src/functions/      → one file per HTTP-triggered function (route handler)
  src/shared/         → shared backend logic: Table/Blob clients, validation, business rules
public/
  staticwebapp.config.json → SWA routing + apiRuntime (Node 20) + SPA fallback
.github/workflows/azure-static-web-apps.yml → build & deploy (app "/", api "api", output "dist")
```

Request flow: **React component → `src/services/*` → `fetch('/api/...')` → SWA managed Function
(`api/src/functions/*`) → `api/src/shared/*` → Azure Storage (Blob/Table; Azurite locally)**.

Components never call `fetch` or storage SDKs directly — they go through `src/services`.
Functions never embed storage or business logic inline — they delegate to `api/src/shared`.

### Data model (Azure Tables)

Design table entities around `PartitionKey`/`RowKey` for efficient queries. Suggested shape
(keep these conventions consistent as the schema grows):

| Table | PartitionKey | RowKey | Notes |
|---|---|---|---|
| `Competitions` | `"competition"` | `competitionId` | `name`, `status` (`open`/`voting`/`closed`), timestamps |
| `Entries` | `competitionId` | `entryId` | `userId`, `blobName`, `title` — query all entries for a competition by partition |
| `Votes` | `competitionId` | `${userId}_${entryId}` | one row per vote; composite RowKey enforces one vote per user per entry |

Photos live in Blob storage keyed by `${competitionId}/${entryId}` so files are namespaced per
competition. The Table row references the blob by name; the blob is never the source of metadata.

### Core business rules (enforce server-side)

- A user may upload **at most 5 photos per competition** — validate in the Function, not only the UI.
- Voting and entry limits are scoped **per competition**; the same user can enter every competition.
- Competition `status` gates behaviour: uploads allowed while `open`, votes allowed while `voting`,
  neither while `closed`.
- Because the site is reused, never hardcode a single competition — always operate on a
  `competitionId`.

## Commands

> The repository is being scaffolded. These are the intended, standard workflows for this stack;
> prefer them and keep `package.json` scripts aligned with them.

```bash
# Frontend (repo root)
npm install
npm run dev            # Vite dev server
npm run build          # tsc -b && vite build
npm run lint           # ESLint
npm test               # Vitest (all tests)
npm test -- src/services/votes.test.ts   # run a SINGLE test file
npx vitest run -t "rejects a 6th upload"  # run a single test by name

# Backend (in api/)
cd api && npm install
npm start              # equivalent to `func start` — hosts Functions locally

# Local storage emulator (separate terminal)
npx azurite --silent --skipApiVersionCheck --location ./.azurite   # Blob + Table emulator
```

Local dev needs three processes: **Azurite**, **`func start`** (in `api/`, serves `:7071`), and
**`npm run dev`** (frontend, `:5173`). The Vite dev server proxies `/api` → `http://127.0.0.1:7071`,
so the frontend uses same-origin `/api/...` in both dev and production (matching SWA). For an
environment closest to production, use the SWA CLI instead: `swa start` (from
`@azure/static-web-apps-cli`) fronts the built app + the `api/` Functions on one port.

Deploy is automated by `.github/workflows/azure-static-web-apps.yml` (needs the
`AZURE_STATIC_WEB_APPS_API_TOKEN` repo secret from the Static Web App's deployment token). The
Storage account's connection string is set as the SWA `STORAGE_CONNECTION` application setting.

**npm registry split:** local installs use the internal package feed (per policy), which CI runners
cannot reach. The workflow therefore builds the frontend and `api/` itself with the **public**
registry (`npm install --registry=https://registry.npmjs.org/ --no-package-lock`) and uploads the
built artifacts (`skip_app_build`/`skip_api_build`), rather than letting the SWA action install from
the committed lockfile (whose `resolved` URLs point at the internal feed).

## Conventions

- **Env vars**: all frontend-exposed vars require the `VITE_` prefix (Vite requirement); the API
  base URL defaults to `/api` and rarely needs overriding. The backend reads the shared Storage
  connection from `STORAGE_CONNECTION` (set to `UseDevelopmentStorage=true` for Azurite) via
  `getStorageConnection()` — never Managed Identity (unsupported by SWA managed Functions).
- **Service layer**: `src/services/*` functions return `{ data, error }` tuples; components handle
  both branches. Never `throw` across the service boundary for expected errors.
- **TypeScript**: strict mode. Shared shapes (`Competition`, `Entry`, `Vote`) live in `src/types`
  and mirror the Table entities. Type-check with `npx tsc -b`, not `tsc --noEmit`.
- **Logging**: use the app logger (`src/lib/logger.ts` frontend, structured `context.log` in
  Functions). Every log line includes an `operation` field plus enough context (`competitionId`,
  `entryId`, `userId`) to reproduce. Do not log raw image bytes.
- **Storage clients**: construct Table/Blob clients once in `api/src/shared`, reuse them — do not
  new up a client per request.

## Lifecycle harness

This repo ships a Copilot lifecycle harness under `.github/`. It is **not** auto-loaded — invoke
skills explicitly with the `skill` tool when the triggers match. Hooks in
`.github/hooks/photography-comp.json` fire automatically.

### Skills

| Skill | Invoke when… |
|---|---|
| `/plan-mode` | Creating any implementation plan with 2+ todos for sub-agent dispatch |
| `/regression-analysis` | Change touches a cross-cutting surface: shared UI, `api/src/shared/**`, or the Table schema/entity shapes |
| `/debug-investigate` | A bug, failure, or "X doesn't work" report — instrument first, fix with evidence |
| `/ux-review` | Any React component was created or modified — run before committing |
| `/frontend-test` | Any component or service was modified — run existing tests |
| `/security-review` | Change touches credentials, config, auth/authz, storage access (connection strings, SAS/keys), or moderation |

### Hooks

| Hook | Event | Behaviour |
|---|---|---|
| Issue gate | `preToolUse` (edit/create) | **Blocks** code edits unless an issue is tracked (see below). Exempt: `.github/`, `docs/`, `*.md` |
| Secret scan | `preToolUse` (edit/create) | **Blocks** writes to `src/**`/`api/src/**` that embed hardcoded secrets/credentials (connection keys, private keys, tokens). Exempt: `.github/`, `docs/`, `*.md`, `local.settings.json`, `*.example`, test fixtures |
| Plan regression gate | `preToolUse` (exit_plan_mode) | **Blocks** plan finalisation unless the plan summary states a Regression Risk assessment |
| Sub-agent inject | `subagentStart` | Injects commit conventions + UX reminders into every sub-agent prompt |
| Post-turn verify | `agentStop` | Blocks stop if React components were modified without invoking `/ux-review` |
| Commit lint | `postToolUse` | Warns if a git commit lacks `Fixes #N` / `Closes #N` on non-exempt files |

## Git workflow

- **Issue first**: create or confirm a GitHub issue before writing code; reference it with
  `Fixes #N` or `Closes #N` in the commit. To satisfy the issue gate, write the number to
  `.copilot-issue` in the repo root (`echo 12 > .copilot-issue`) or set `COPILOT_ISSUE_NUMBER`.
  Keep `.copilot-issue` out of version control.
- Commit in small logical groups. Do not push until local testing is confirmed and the user asks.
