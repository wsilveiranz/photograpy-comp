---
name: debug-investigate
description: "Use when investigating bugs, diagnosing failures, debugging runtime issues, or when a fix attempt hasn't worked. Provides structured debugging workflow: instrument first, gather evidence, never commit speculative fixes."
---

# Debugging & Investigation Workflow

## Step 1: Instrument Before Investigating

If structured logging or error handling is missing from the code under investigation, add it FIRST. Treat missing instrumentation as a bug to fix before diagnosing the actual issue.

```typescript
// Frontend (src/lib/logger.ts) or Azure Function (context.log) — add before the suspected failure:
logger.info({ operation: 'castVote', competitionId, entryId, userId }, 'Starting operation');
try {
  // ... suspected code ...
  logger.info({ operation: 'castVote', result }, 'Operation succeeded');
} catch (err) {
  logger.error({ operation: 'castVote', err: err.message, competitionId, entryId }, 'Operation failed');
  throw err;
}
```

## Step 2: Gather Evidence

Do NOT commit speculative fixes. Instead:

1. Add diagnostic logging at suspected failure points
2. Run the failing scenario
3. Read the logs/output
4. Identify the actual root cause from evidence

If a fix doesn't work on the first attempt, STOP guessing. Add more diagnostics instead.

## Step 3: Fix With Evidence

Only commit a fix when you have:
- Clear evidence of what was wrong (log output, error message, stack trace)
- Confidence the fix addresses the root cause (not just a symptom)
- Verified the fix works (ran the scenario again)

## Step 4: Commit Immediately When Fixed

Once uncommitted changes resolve the issue:
1. Run `git add` and `git commit` immediately (with `Fixes #N`)
2. Do NOT continue investigating root causes or alternatives
3. Ask the user if they want deeper analysis after committing

## Azure Functions Debugging

For 4xx/5xx errors from a Function:
1. Check the `func start` console output first — `context.log`/`context.error` lines
2. Verify the storage connection is loaded: `AzureWebJobsStorage` must be
   `UseDevelopmentStorage=true` for Azurite, and **Azurite must be running**
3. Confirm the route/method matches the function binding (`route`, `methods` in the trigger)
4. If logs are insufficient, request the browser Network-tab request/response from the user

## Azure Storage (Azurite) Debugging

### Blob issues
- "The specified blob/container does not exist" → the container was never created. Ensure the
  Function calls `createIfNotExists()` on startup, and that the blob name matches
  `${competitionId}/${entryId}`.
- Uploads succeed but images 404 in the browser → check the returned blob name/SAS URL and CORS.

### Table issues
- Query returns nothing unexpectedly → verify the `PartitionKey` filter. `Entries` are partitioned
  by `competitionId`; querying the wrong partition silently returns zero rows.
- "EntityAlreadyExists" on insert → a `RowKey` collision. For `Votes`, the composite
  `${userId}_${entryId}` RowKey is intentional — an existing row means the user already voted.
- Azurite not reachable → confirm the emulator process is up and the connection string points at it.

## Common Patterns

### Business-rule failures (5-photo limit / voting)
- The 5-photo limit must be checked **server-side** by counting the user's `Entries` in the
  partition before insert. A UI-only check is bypassable — reproduce via direct API call.
- Vote gating depends on competition `status` (`open`/`voting`/`closed`). A failing vote is often a
  status mismatch, not a storage error — log the competition status.

### React State Issues
If UI isn't updating after a successful operation:
1. Check if the service function (`src/services/*`) returns the updated data
2. Verify the component re-renders (add a `console.log` in the render body)
3. Check for a stale closure (common with `useEffect` dependencies)

## Step 5: Post-Fix Verification

After committing the fix, co-invoke related skills:
- If the fix touched visual presentation, layout, or CSS → invoke `/ux-review`
- If tests exist for the affected component/service → invoke `/frontend-test`
