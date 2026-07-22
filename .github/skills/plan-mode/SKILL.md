---
name: plan-mode
description: "Use when creating any implementation plan with 2+ todos that will be dispatched to sub-agents. Enforces model selection per todo, parallel structure, and issue-to-todo mapping. Invoke DURING planning, before execution begins."
---

# Plan Mode — Model & Structure Enforcement

This skill ensures every implementation plan is well-formed BEFORE sub-agent dispatch begins. Invoke it when you're building a plan with 2+ independent work items.

## Why This Exists

A post-hoc hook cannot enforce model selection — by the time a `task` call is made, the agent is committed and denial causes retry loops. This skill front-loads the decision into planning where it belongs.

## Mandatory Plan Structure

Every plan with sub-agent work MUST include:

1. **GitHub issue reference** — `Fixes #N` for each todo
2. **Model assignment per todo** — using the complexity guide below
3. **Parallel grouping** — independent todos must NOT have artificial sequential dependencies
4. **Issue-to-todo mapping table** — at the end of the plan
5. **Regression risk assessment** — every plan must state its regression risk (see below)

## Model Selection Guide

| Complexity | When to use | Recommended model | Reasoning effort |
|-----------|-------------|-------------------|------------------|
| 🟢 Simple | Config changes, UI tweaks, boilerplate, docs, single-file fixes | `gpt-5.6-luna` | `low` |
| 🟡 Medium | Feature builds, Functions, schemas, debugging, multi-file changes | `gpt-5.6-terra` | `medium` |
| 🔴 Complex | Novel architecture, multi-system integration, security-sensitive | `gpt-5.6-sol` | `high` |

### Complexity Defaults

| Area | Default complexity | Rationale |
|-------|-------------------|-----------|
| React components / UI | 🟢 Simple | Mostly presentational unless multi-component state or auth |
| `src/services/*` client + Azure Function pair | 🟡 Medium | Client/server contract must stay in sync |
| `api/src/shared/*` storage or business rules | 🟡 Medium | Table/Blob logic and the 5-photo/voting rules are nuanced |
| Table schema / entity-shape change | 🔴 Complex | Touches every consumer of the entity |
| general-purpose | 🟡 Medium | Default for cross-cutting work |

### Override Triggers

Bump UP one level when:
- Todo involves auth or vote-integrity logic
- Todo changes an Azure Table entity shape consumed by multiple functions/components
- Todo requires coordinating 3+ files across layers (component + service + function)

Bump DOWN one level when:
- Todo is purely additive (new file, no existing logic affected)
- Todo is a direct copy of an existing pattern with minor changes

## Regression Risk Assessment

Do this **first — before drafting todos**, not as a write-up after the plan is built. The analysis is an *input* to the plan: its blast-radius output determines which todos and tests the plan contains.

**Step 1 — scope check.** As the opening step of planning, decide whether the intended change touches any **cross-cutting surface**:

- Shared UI components reused across pages
- `api/src/shared/**` — storage clients, validation, business rules used by multiple functions
- Azure Table **entity shapes** (`Competition`, `Entry`, `Vote`) and their `PartitionKey`/`RowKey` conventions
- Blob naming scheme (`${competitionId}/${entryId}`)

**Step 2a — if NONE are touched:** state, before writing todos:
> `Regression Risk: none — no cross-cutting surfaces touched`

**Step 2b — if ANY are touched:** invoke the `/regression-analysis` skill *before you write the todos*, then let its output drive the plan. The resulting **"Regression Risk Analysis"** section must:
1. Name the affected consumers and blast radius (which components / functions are impacted)
2. List the specific tests and builds to run to confirm no regressions
3. Add a dedicated todo — derived from the analysis — that runs those tests/builds during implementation, before commit

So the ordering is: **scope check → `/regression-analysis` → todos shaped by its findings → plan summary states the risk.** The plan-exit hook only checks that the summary states a Regression Risk marker; it cannot do the analysis for you.

## Plan Template

When building your plan, structure each todo like:

```
Todo: <kebab-case-id>
Title: <gerund form — "Creating...", "Fixing...", "Adding...">
Agent: <general-purpose or task>
Model: <from guide above>
Reasoning effort: <low | medium | high — from guide above>
Complexity: 🟢/🟡/🔴
Depends on: <other-todo-id or "none">
Description: <full self-contained description including file paths, issue number, acceptance criteria>
```

## Issue-to-Todo Mapping (required at end of plan)

```
| Issue | Todo(s) |
|-------|---------|
| #N    | todo-1, todo-2 |
```

## Validation Checklist (before exiting plan mode)

- [ ] Every todo has a `model` field
- [ ] Every todo has a `reasoning_effort` field (low/medium/high per the guide)
- [ ] Every non-exempt agent type (`task`, `general-purpose`, custom agents) has model specified
- [ ] Exempt agents (`explore`, `rubber-duck`, `code-review`, `research`) don't need model
- [ ] No artificial sequential dependencies between truly independent todos
- [ ] Each todo description is self-contained (agent doesn't need to read the plan)
- [ ] Issue-to-todo mapping table is present
- [ ] Regression risk stated — `Regression Risk: none …` OR a Regression Risk Analysis section is present when cross-cutting surfaces are touched
