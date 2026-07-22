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
# 1. Storage emulator
npx azurite --silent --location ./.azurite

# 2. Backend (Azure Functions)
cd api && npm install && npm start        # http://localhost:7071/api/health

# 3. Frontend
npm install && npm run dev                # http://localhost:5173  (proxies /api → :7071)
```

The API uses `api/local.settings.json` for local settings. Set `ADMIN_ALLOWLIST` to a
comma-separated list of administrator email addresses or Entra object IDs. `STORAGE_CONNECTION`
and `AzureWebJobsStorage` use `UseDevelopmentStorage=true` with Azurite. Content Safety is a
third Azure resource, configured with `CONTENT_SAFETY_ENDPOINT` and `CONTENT_SAFETY_KEY`;
pre-screening is optional and gracefully disabled when these values are empty.

The Vite dev server proxies `/api` to the Functions host, so the frontend uses the same
`/api/...` URLs locally as it does in production. For an environment closest to Azure Static Web
Apps, use the SWA CLI instead: `npm run build` followed by `swa start` (or `npx swa start`).
The checked-in `swa-cli.config.json` supplies the app, API, and development-server locations.

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
