---
name: regression-analysis
description: "Use when a change touches a cross-cutting surface — shared UI components, shared backend logic (api/src/shared), or an Azure Table entity shape / Blob naming scheme — to map blast radius, check interdependencies, and run targeted tests instead of a narrow test or a blind full suite."
---

# Regression Analysis — Blast Radius & Interdependency Workflow

Invoke during planning (to scope the work) and at the end of implementation (to verify nothing breaks outside your primary change).

## When to use

Changes in these CROSS-CUTTING SURFACES require this skill before testing:

| Surface | Path / concept | Why |
|---|---|---|
| Shared UI components | reusable components under `src/components/**` | Consumed by multiple pages; a prop or style change can silently break any of them |
| Shared backend logic | `api/src/shared/**` | Imported by multiple Functions; a signature or type change breaks callers |
| Table entity shapes | `Competition` / `Entry` / `Vote` + `PartitionKey`/`RowKey` conventions | Affects every Function and component that reads/writes the entity |
| Blob naming scheme | `${competitionId}/${entryId}` | Both the upload path and the read/display path must agree |

Goal: catch interdependencies **before** they reach CI — not just narrow-test the change, not blindly run everything.

## Step 1: Map the blast radius

Enumerate every consumer of what changed.

### Shared UI component change
```bash
# Which pages/components import the changed component?
grep -r "ComponentName" src --include="*.tsx" --include="*.ts" -l
```

### Shared backend logic change (api/src/shared)
```bash
# Which Functions import the changed module?
grep -r "shared/<module>" api/src/functions --include="*.ts" -l
```

### Table entity / field change
```bash
# Functions that reference the changed entity or field
grep -r "<Entity_or_field>" api/src --include="*.ts" -l
# Frontend types/services that mirror the entity
grep -r "<Entity_or_field>" src --include="*.ts" --include="*.tsx" -l
```
Also check:
- The shared TypeScript type in `src/types` — it must stay in sync with the Table entity.
- Any `PartitionKey`/`RowKey` assumption in queries (e.g. `Entries` partitioned by `competitionId`).

### Blob naming change
Identify both the **write** path (upload Function) and every **read** path (display/list) that
constructs or parses the blob name, and treat them as affected consumers.

## Step 2: Interdependency checklist

- **Client/server contract**: a change to a `src/services/*` request shape must be matched in the
  paired Azure Function (and vice-versa). They share no compiler — verify by hand.
- **Entity ↔ type parity**: an entity field change must update `src/types` and every reader.
- **Business rules live server-side**: the 5-photo limit and vote gating are enforced in
  `api/src/shared`; a UI change alone never changes the rule.
- **Prop additions**: a new required prop on a shared component needs a default or an update at every callsite.

## Step 3: Targeted testing

Run tests for every affected area. Do NOT run only the primary file; do NOT blindly run all.

```bash
npm test -- <path/to/affected.test.ts>   # affected frontend/service tests
npm run build                            # tsc -b && vite build — catches type/import breakage
cd api && npm test                       # backend tests, if the change touched api/
```

Fall back to the full `npm test` **only** when the blast radius is genuinely repo-wide (e.g. a
breaking change to a widely shared component or an entity shape).

## Step 4: Record findings

Before committing, add to the plan or PR description:

- **Blast radius**: every consumer identified in Step 1.
- **Gotchas found**: any interdependency issues from Step 2.
- **Tests run**: exact commands executed and their outcome.

This makes coverage easy to confirm and lets future changes reuse the blast-radius map.
