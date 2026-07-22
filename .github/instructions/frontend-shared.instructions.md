---
applyTo: "src/**,api/**"
---

# Shared Frontend & Backend — Critical Rules

## Service Layer (frontend)

- All backend calls go through service files in `src/services/` — never call `fetch` or an Azure
  Storage SDK directly from a component.
- Services return `{ data, error }` tuples; components must handle both branches.
- Keep each service function's request/response shape in sync with its paired Azure Function.

## Azure Functions (backend)

- One HTTP-triggered function per file under `api/src/functions/`; the handler stays thin.
- Storage access and business rules live in `api/src/shared/` — construct Table/Blob clients once
  and reuse them, never per request.
- Enforce domain rules server-side: the **5-photo-per-competition limit** and **vote gating by
  competition `status`** must be validated in the Function, not only the UI.

## Azure Storage

- **Blob**: photos are stored keyed by `${competitionId}/${entryId}`. Call
  `createIfNotExists()` on the container before first use.
- **Tables**: `Competitions` / `Entries` / `Vote` entities use deliberate `PartitionKey`/`RowKey`
  conventions (`Entries` partitioned by `competitionId`; `Votes` RowKey `${userId}_${entryId}`).
  Query by partition; never scan all partitions when a `competitionId` is known.

## Environment Variables

- All frontend env vars require the `VITE_` prefix (Vite requirement) and are read via `import.meta.env`.
- The backend reads the storage connection from `AzureWebJobsStorage`; set it to
  `UseDevelopmentStorage=true` to target Azurite locally.
- Never hardcode connection strings, keys, or a single competition id.

## TypeScript

- Strict mode enabled.
- Entity/API types live in `src/types/` and must mirror the Table entity shapes.
- Prefer interfaces for API/entity shapes, types for unions/aliases.
- **Local type-checking must use `npx tsc -b`** (build mode with project references), not
  `tsc --noEmit` — the latter can miss errors at project-reference boundaries.

## Structured Logging

- Frontend uses `src/lib/logger.ts`; Functions use `context.log`.
- New code must not use raw `console.log/error/warn` — use the logger.
- Every log entry includes an `operation` field plus enough context (`competitionId`, `entryId`,
  `userId`) to reproduce the issue. Never log raw image bytes.
