# photography-comp

Internal photography competition site. Users upload up to **5 photos** per competition and vote
for the best photo. Supports running **multiple competitions** and is built to be reused.

> **Status: app shell.** Projects are scaffolded and build, but features are not implemented yet.

## Stack

- **Frontend:** Vite + React + TypeScript (repo root)
- **Backend:** Azure Functions (Node.js v4 model, TypeScript) in [`api/`](./api), deployed as
  **Static Web Apps managed Functions**
- **Hosting:** Azure **Static Web Apps** — serves the frontend and the `api/` Functions from one
  origin (`/api/*`)
- **Storage:** a single Azure Storage account shared by the app — Blob (photos) + Tables
  (competitions, entries, votes)
- **Local emulation:** Azurite + Azure Functions Core Tools

## Layout

```text
src/                 Vite + React frontend
  components/        React components
  services/          API client calls (the only layer that talks to the backend)
  lib/               apiClient, logger
  types/             shared TypeScript types (Competition, Entry, Vote)
api/                 Azure Functions app
  src/functions/     HTTP-triggered functions (health.ts placeholder)
  src/shared/        shared backend logic: storage clients, validation, business rules
.github/             Copilot instructions + lifecycle harness (skills, hooks)
```

## Local development

Run each in its own terminal:

```bash
# 1. Storage emulator (Blob + Table)
npx azurite --silent --location ./.azurite

# 2. Backend (Azure Functions)
cd api && npm install && npm start        # http://localhost:7071/api/health

# 3. Frontend
npm install && npm run dev                # http://localhost:5173  (proxies /api → :7071)
```

Instead of the CLI in step 1 you can use the **Azurite VS Code extension** (recommended in
`.vscode/extensions.json`): Command Palette → **Azurite: Start**, or the status-bar toggles. The
provided `.vscode/settings.json` (gitignored, so create your own if cloning fresh) pins its data to
`./.azurite`, so both launch methods share the same storage. Only run one Azurite instance at a
time (they share ports 10000–10002).

The API uses `api/local.settings.json` (gitignored — never committed) for local settings. Set
`ADMIN_ALLOWLIST` to a comma-separated list of administrator email addresses or Entra object IDs.
`STORAGE_CONNECTION` must be a **full** Azure Storage connection string (containing `AccountName`
and `AccountKey`) because the API mints short-lived read-only SAS URLs for images. For Azurite,
use the full development connection string (`DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=…;BlobEndpoint=…`)
rather than the `UseDevelopmentStorage=true` shorthand — the well-known emulator key is a
local-only, non-secret value and lives only in this untracked file, never in source.
`AzureWebJobsStorage` may keep `UseDevelopmentStorage=true`. Content Safety is a third Azure
resource, configured with `CONTENT_SAFETY_ENDPOINT` and `CONTENT_SAFETY_KEY`; pre-screening is
optional and gracefully disabled when these values are empty.

The Vite dev server proxies `/api` to the Functions host, so the frontend uses the same
`/api/...` URLs locally as it does in production. **However, sign-in does not work under plain
`npm run dev`** — the `/.auth/login/aad` endpoint is served by the Static Web Apps runtime, not by
Vite or the Functions host, so clicking "Sign in" there yields a *page not found*.

### Testing authentication locally

Authentication is fully delegated to **Microsoft Entra ID via SWA EasyAuth** — the app stores no
passwords or tokens. Login redirects to the platform endpoint `/.auth/login/aad`; the Functions read
the injected `x-ms-client-principal` header (`api/src/shared/auth.ts`). To exercise this locally,
run the **SWA CLI**, which emulates `/.auth/*` with a mock login form (no real Entra needed):

```bash
# with Azurite + `func start` (api) + `npm run dev` (frontend) already running:
npm run swa:start        # swa start app  → http://localhost:4280
```

Browse **http://localhost:4280** (not :5173) and use the mock login form to enter any username.
The emulator uses `swa-local/staticwebapp.config.json` (via `swaConfigLocation` in
`swa-cli.config.json`) — an auth-block-free copy of the production config — so it serves the mock
login instead of attempting real OIDC against the placeholder tenant. The production config in
`public/staticwebapp.config.json` keeps the real Entra registration.

To test **admin** features locally, set `ADMIN_ALLOWLIST` in `api/local.settings.json` to the
username you type into the mock login, then restart `func`.

`npm run build` is required before `swa start` if you want it to serve the built `dist` instead of
the Vite dev server.

Before making code changes, record the GitHub issue number in `.copilot-issue` (for example,
`Set-Content .copilot-issue 8`); this file is intentionally gitignored.

## Deployment

Deployed as an **Azure Static Web App** with **managed Functions** — only two Azure resources:

1. **Static Web App** — hosts the built frontend and the `api/` Functions (served at `/api/*`).
2. **Storage account** — shared for photos (Blob) and data (Tables).

CI/CD lives in [`.github/workflows/azure-static-web-apps.yml`](./.github/workflows/azure-static-web-apps.yml)
(`app_location: "/"`, `api_location: "api"`, `output_location: "dist"`). Configure:

- Repo secret `AZURE_STATIC_WEB_APPS_API_TOKEN` — the Static Web App's deployment token.
- SWA application setting `STORAGE_CONNECTION` — the shared Storage account connection string.
- SWA application settings `ADMIN_ALLOWLIST`, `CONTENT_SAFETY_ENDPOINT`, and
  `CONTENT_SAFETY_KEY` (configure secrets in the SWA environment; never commit them).
- Content Safety is a separate, third Azure resource; moderation remains optional when unset.

Managed-Functions constraints: HTTP triggers only, Node 20 (`platform.apiRuntime` in
`public/staticwebapp.config.json`), no Managed Identity, and keep under ~39 function registrations.

> **npm registry:** local installs use the internal package feed (per policy). CI can't reach that
> feed, so the workflow installs from the **public** registry (`--registry=https://registry.npmjs.org/
> --no-package-lock`) and builds before the SWA action uploads the artifacts.

## Scripts

Frontend (repo root):

| Command | Description |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | `tsc -b && vite build` |
| `npm run lint` | oxlint |
| `npm run preview` | Preview the production build |
| `npm test` | Run Vitest |
| `npm run swa:start` | Start the SWA CLI local proxy |

Backend (`api/`):

| Command | Description |
|---|---|
| `npm start` | Build then `func start` |
| `npm run build` | Compile TypeScript to `dist/` |

## Contributing

See [`.github/copilot-instructions.md`](./.github/copilot-instructions.md) for architecture,
conventions, and the issue-first workflow.
