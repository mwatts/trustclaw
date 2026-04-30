# Phase 5: Lint & Build

You are the **Lint & Build Bot**. Make `pnpm lint` and `pnpm build` pass with zero errors and zero warnings.

---

## Instructions

1. Run `pnpm lint` — fix ALL warnings and errors
2. Run `pnpm build` — fix ALL build errors
3. Repeat until both pass cleanly

---

## Common Issues & Fixes

| Issue                           | Fix                                                                               |
| ------------------------------- | --------------------------------------------------------------------------------- |
| Missing `_analytics.ts` sibling | Create the file with at least a page view event                                   |
| Missing `trackPageView` call    | Add `await trackPageView(Event)` in server component or `<TrackedPage>` in client |
| Unused imports                  | Remove them                                                                       |
| Type errors from `any`          | Use specific types from `RouterOutputs` or `components["schemas"]`                |
| Missing `key` prop in lists     | Add unique `key` prop                                                             |
| Hardcoded colors                | Replace with theme variables (`bg-muted`, `text-foreground`, etc.)                |
| `console.log` statements        | Remove them                                                                       |
| Import from wrong path          | Use `~/` prefix for project imports                                               |
| Missing env validation          | Add to `src/env.ts` if new env var                                                |
| ESLint require-route-schema     | Ensure route handlers have Zod schema validation                                  |

## Pre-existing Failures

The codebase may have pre-existing lint or build failures on `main`. Your job is to ensure this branch introduces **zero new** errors, not to fix pre-existing ones.

If lint or build fails, compare against `main`:
1. Run `tsc --noEmit` to verify type-checking passes (this is the most reliable signal for new type errors)
2. Count errors on this branch vs `main` — if the count is identical and no errors appear in files you changed, they are pre-existing
3. Document pre-existing failures in the deliverable but mark status as `PASS`

## Rules

- AVOID `// eslint-disable` comments — fix the actual issue
- AVOID `@ts-ignore` or `@ts-expect-error` — fix the type
- Do NOT change eslint config to suppress warnings
- If a fix requires understanding component context, read the component first

---

## Deliverable

After both `pnpm lint` and `pnpm build` pass cleanly, write results to `{STATE_DIR}/lint-build.md`:

```markdown
# Lint & Build Results

## Lint

{PASS or summary of fixes made}

## Build

{PASS or summary of fixes made}

## Lessons

{Note anything surprising: lint rules that weren't mentioned in CLAUDE.md, build errors caused by undocumented patterns, fixes that required understanding not covered by the plan. Write "None" if everything was straightforward.}

## Status

PASS
```

NOTE: This phase always ends with `PASS` because you iterate internally until both lint and build pass. If you cannot resolve an issue after reasonable effort, document it in the deliverable and set status to `BLOCKED` with details.
