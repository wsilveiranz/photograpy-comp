---
name: frontend-test
description: "Use when writing, running, or verifying tests for the React frontend or the Azure Functions backend — including after fixing or modifying a component or service to confirm no regressions. Covers Vitest conventions, mock patterns, and React Testing Library usage."
---

# Testing Conventions

## Running Tests

```bash
npm test                                   # all frontend tests (Vitest)
npm test -- src/services/votes.test.ts     # single test file
npm run test:watch                         # watch mode (if defined)
npx vitest run -t "rejects a 6th upload"   # single test by name
cd api && npm test                         # Azure Functions backend tests
```

## Test File Conventions

- Test files: `*.test.ts` / `*.test.tsx` colocated with the file under test
- Use **React Testing Library** + **@testing-library/user-event** for component tests
- Use `vi.mock(...)` to mock modules; use `vi.hoisted()` when the mock fn is referenced inside `vi.mock()`

## Mocking Patterns

### Service layer (frontend)
Components should be tested against a mocked service module, not a mocked `fetch`. Mock the
`src/services/*` function the component calls and assert on how the component renders each branch:

```typescript
vi.mock('../services/entries', () => ({
  listEntries: vi.fn().mockResolvedValue({ data: [{ id: 'e1', title: 'Sunset' }], error: null }),
  uploadEntry: vi.fn().mockResolvedValue({ data: { id: 'e2' }, error: null }),
}));
```

### Network (service tests)
When testing a `src/services/*` function itself, mock `fetch` (or the shared API client) and assert
it maps HTTP responses into `{ data, error }` tuples correctly — including the error branch.

```typescript
global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'e1' }) });
```

### Azure Storage (backend tests)
In `api/`, do not hit Azurite from unit tests. Extract pure business logic (the 5-photo limit,
vote gating, blob-name construction) into `api/src/shared` helpers and test those directly. Mock the
`@azure/data-tables` / `@azure/storage-blob` clients when a handler must be tested end-to-end.

### Resolve Aliases
Keep the `resolve.alias` in `vitest.config.ts` in sync with `vite.config.ts` so imports resolve
identically in tests and builds.

## Writing New Tests — Checklist

1. Create the test file colocated with source: `MyComponent.test.tsx`
2. Import `render`, `screen`, `waitFor` from `@testing-library/react`
3. Import `userEvent` from `@testing-library/user-event`
4. Mock external dependencies (services for components; `fetch`/storage clients for services/handlers)
5. Test the happy path first, then error states (e.g. upload rejected at the 5-photo limit, vote on a closed competition)
6. For async operations, use `waitFor` or `findBy*` queries
7. Verify the test passes: `npm test -- <file>`
