# OSS Fork Refactor — Design

**Date:** 2026-04-29
**Author:** Sarah Simionescu
**Status:** Approved (ready for implementation plan)

---

## CRITICAL Safety Constraint

This work produces a **new standalone repository**. The original `ComposioHQ/trustclaw` remote MUST NOT be pushed to under any circumstance.

**Workflow:**
1. All refactor work happens on the current worktree branch.
2. When complete, init a fresh repo elsewhere, copy the working tree (without `.git`), commit as the new repo's initial commit, and push to a new remote.
3. The original repo remains intact.

**Recommended pre-flight safety step:** run `git remote remove origin` in this worktree so an accidental `git push` has no destination. Re-add a different remote only when ready to publish the new repo.

History will be squashed; no need to preserve revertible commits during the refactor.

---

## Goals

Strip TrustClaw to a clean, self-hostable open-source personal agent:
- No billing
- No third-party analytics or error tracking
- No transactional email
- Single-provider auth (Google OAuth)
- Restored vector-DB (pgvector) memory layer with automatic flush-on-prune

## Non-goals

- Preserving git history
- Backwards compatibility with the existing deployment
- Gradual migration paths
- Multi-tenancy beyond what already exists
- Speculative abstraction layers for future extensibility

---

## Workstreams (in execution order)

Ordered so each step leaves the repo buildable. Schema changes go last because they cascade.

### 1. Delete dead weight

- `ralph/` directory
- Supermemory migration script (`scripts/migrate-to-supermemory*` or wherever located, per commit `0f4b14866`)
- `src/server/clients/supermemory.ts`
- **Sentry**: `sentry.edge.config.ts`, `sentry.server.config.ts`, Sentry init in `src/instrumentation.ts` and `src/instrumentation-client.ts`, the tRPC Sentry tracing middleware (commit `fa65c1552`), all `@sentry/*` deps in `package.json`, all `SENTRY_*` env vars
- **PostHog / analytics**: analytics client module, every `_analytics.ts` file in the repo, all `<TrackedPage>` calls, the `trackPageView` server helper
- `src/components/tracked/` directory (entire)

### 2. Auth simplification

- Remove `magicLink` plugin from `src/server/auth.ts`
- Remove `magicLinkClient` from `src/clients/auth/react.tsx`
- Remove Twitter from `socialProviders` in `src/server/auth.ts` (keep Google only)
- Delete `src/server/clients/resend.ts` (or wherever the Resend client lives) and `RESEND_API_KEY` from env
- Simplify `/login` UI to a single "Sign in with Google" button; delete magic-link form
- Run `pnpm auth:generate` after changes

### 3. Component sweep (mechanical)

- Replace every `<TrackedButton>` → `<Button>`, `<TrackedLink>` → `<Link>`, `<TrackedSelect>`, `<TrackedSheet>`, `<TrackedDialog>`, `<TrackedConfirmDialog>`, `<TrackedForm>`, `<TrackedSwitch>`, `<TrackedSearchInput>` — all map to their `~/components/ui/*` counterparts
- Drop all `trackEvent` props
- Delete every `_analytics.ts` file (find via `find src/app -name "_analytics.ts"`)
- Update root `CLAUDE.md`: remove "Track everything" principle, remove tracked-primitives sections, remove all `_analytics.ts` references

### 4. Billing removal

- Delete `src/server/api/routers/billing/` entirely
- Delete `src/server/clients/stripe.ts`
- Unregister billing router from `src/server/api/root.ts`
- Patch cross-cutting references — strip credit/plan checks from:
  - `src/server/api/routers/composioclaw/createInstance.ts`
  - `src/server/api/routers/composioclaw/agent/setup.ts`
  - `src/server/api/routers/composioclaw/toggleCronJob.ts`
- Delete UI:
  - Navbar credit balance component
  - Blocked-message UI (from the pricing overhaul, commits `e6bd21a94`, `1b918c326`, `e93e6c25e`, `a610b60c0`)
  - Pricing page
  - Checkout / setup-session pages
- Delete Stripe env vars (`STRIPE_*`)
- Delete Stripe webhook route handler (`src/app/api/stripe/webhook/route.ts` or similar)
- **Prisma schema:**
  - Drop `User.creditBalance`, `User.plan` (or whichever billing fields exist on User)
  - Drop subscription/invoice/webhook tables
  - Run `pnpm prisma db push` (verify `DATABASE_URL` points at dev Neon `ep-holy-salad`)

### 5. Bootstrap / identity collapse

- Delete `src/server/api/routers/composioclaw/agent/tools/bootstrap.ts` and `bootstrap.schema.ts`
- Remove from agent tools registry (`agent/tools/index.ts`)
- Delete `src/server/api/routers/composioclaw/setIdentity.ts`
- Unregister from the router
- Delete bootstrap-specific branches in `agent/system-prompt.ts`
- Remove identity-gating state/checks from `getStatus.ts`, `getInstance.ts`, and dashboard UI components that branch on "is bootstrapped?" state
- Agent reads soul directly from DB — onboarding is the sole writer

### 6. Memory restoration (pgvector)

**Source-of-truth commits** (for porting reference, not cherry-picking): pre-`11dff6974`. Specifically `536b4101e` and earlier. The supermemory migration PR is `#25` (`408d661b3`).

- Restore `composio_claw_memory` table in `prisma/schema.prisma`:
  - `id String @id`
  - `instanceId String`
  - `content String`
  - `embedding Unsupported("VECTOR(1024)")`
  - `createdAt DateTime @default(now())`
  - Verify whether the table still exists; if so, no migration needed beyond adding the model.
- Restore agent tools `memory_save` and `memory_search` (deleted in commit `11dff6974`); reference the pre-deletion code via `git show 11dff6974^:<path>`
- Restore `searchMemoriesForContext` middleware injection in `agent/setup.ts` (was removed when supermemory middleware replaced it)
- **Restore the memory flush layer** in `agent/compaction/` (deleted in `83c241167`):
  - Adapt to current Phase 3 pruning structure (drops oldest message group when context > 80% of token window)
  - Before pruned messages are dropped, distill them into memories via an LLM call and persist
  - Don't blindly cherry-pick — port the logic into the current code shape
- **Embeddings provider:** restore OpenAI `text-embedding-3-large` (or whichever model the old code used — verify by reading the pre-deletion source). Add `OPENAI_API_KEY` to env if not already present.
- Replace `getMemories.ts` and `getMemoryGraph.ts` with pgvector-backed versions:
  - `getMemories` returns a list using `$queryRaw` with Zod validation per CLAUDE.md
  - Drop `getMemoryGraph` entirely (graph viz was a Supermemory-specific feature) — settings UI shows a plain list
- Update `src/app/(authenticated)/dashboard/settings/_components/memory-settings.tsx`:
  - Remove "powered by Supermemory" branding
  - Remove graph visualization
  - Show plain list of memories with delete action

### 7. Rename `composioclaw` → `trustclaw`

- Move `src/server/api/routers/composioclaw/` → `src/server/api/routers/trustclaw/`
- Update root router registration in `src/server/api/root.ts`: key `composioclaw:` → `trustclaw:`
- Find/replace all `trpc.composioclaw.*` → `trpc.trustclaw.*` across client code
- Update `agent/CLAUDE.md` doc references
- Update root `CLAUDE.md` repo-structure section

### 8. OSS polish

- **README.md** (full rewrite):
  - What it is (one-paragraph elevator pitch)
  - Architecture diagram (reuse the one in CLAUDE.md, simplified)
  - Setup steps (clone → `pnpm install` → `.env` → `pnpm prisma db push` → `pnpm dev`)
  - Env vars table
  - Tech stack summary
  - License + contribution note
- **LICENSE** — MIT
- **.env.example** — every required env var documented inline with one-line description
- **Root `CLAUDE.md` updates:**
  - Remove billing, analytics, Sentry, Resend sections
  - Update Tech Stack section
  - Update Auth section: "Google OAuth only"
  - Remove `~/components/tracked` references throughout
  - Update repo-structure tree
- **`package.json`:**
  - Update `name`
  - Update `description`
  - Update `repository.url`
  - Remove deps: `@sentry/*`, `posthog-js`, `posthog-node`, `resend`, `@better-auth/resend` (or whichever Resend integration), `stripe`, `@stripe/*`

---

## Risks & Mitigations

1. **Memory flush layer reconstruction** — old code is in history but won't cleanly restore around current Phase 3 pruning. **Mitigation:** read pre-`11dff6974` state of compaction/context files, port logic into the current code shape, don't blindly cherry-pick.

2. **Schema column drops** — `prisma db push` will permanently delete billing data on the dev Neon DB. **Mitigation:** acceptable for dev; confirm before pushing that no production DB is targeted.

3. **`tracked` component sweep is large** — many files touched, risk of missed references. **Mitigation:** single mechanical pass, then `pnpm build` and `pnpm lint`. The TS compiler will surface any miss.

4. **Auth change invalidates existing sessions** — removing `magicLink` plugin may force re-auth. **Mitigation:** acceptable for an OSS fork; document in README.

## Verification

**Per workstream:** `pnpm build` + `pnpm lint` must pass before moving to the next.

**Memory restoration smoke test:** start dev, tell agent a fact ("My favorite color is blue"), restart server, ask agent the fact, confirm recall.

**Billing removal smoke test:** create instance, send messages, verify no credit/plan checks fire and no UI shows balance.

**Final end-to-end:** full local dev run exercising onboarding → chat → memory recall → telegram integration.

## Out of Scope

- New features
- Test coverage additions
- Docker / deployment scripts (README documents Vercel + Neon path; contributors can add)
- Refactoring beyond what's needed to remove the listed systems
- Abstraction layers for future auth providers, payment providers, etc.
