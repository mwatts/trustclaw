# OSS Fork Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strip TrustClaw to a clean, self-hostable OSS personal agent — no billing, no analytics, no Sentry, no Resend/magic-link, Google-only auth, restored pgvector memory layer.

**Architecture:** Sequential deletion-and-refactor across 9 workstreams, each ending in a buildable+lintable+committed state. No new tests added (out of scope per spec). Verification gate per task: `pnpm build` and `pnpm lint` both pass.

**Tech Stack:** Next.js 15 (App Router), tRPC, Prisma + Neon Postgres + pgvector, Better Auth (Google OAuth), Tailwind/shadcn.

**Spec:** [`docs/superpowers/specs/2026-04-29-oss-fork-refactor-design.md`](../specs/2026-04-29-oss-fork-refactor-design.md)

**CRITICAL safety constraint:** This branch must NEVER be pushed to `ComposioHQ/trustclaw`. Task 0 enforces this by removing the `origin` remote.

---

## Task 0: Safety prep — remove origin remote

**Files:** none (git config only)

- [ ] **Step 1: Confirm current remote**

```bash
git remote -v
```

Expected: shows `origin` pointing at `ComposioHQ/trustclaw` (or similar).

- [ ] **Step 2: Remove the origin remote**

```bash
git remote remove origin
git remote -v
```

Expected: no remotes listed. Any future `git push` will now fail with "no upstream" — this is the safety net.

- [ ] **Step 3: No commit needed (git config change)**

Move on to Task 1.

---

## Task 1: Delete dead-weight directories and files

Removes: `ralph/`, supermemory migration script, supermemory client.

**Files:**
- Delete: `ralph/` (whole directory)
- Delete: any file under `scripts/` matching supermemory migration (verify with `find`)
- Delete: `src/server/clients/supermemory.ts`

- [ ] **Step 1: Identify supermemory migration script**

```bash
find scripts -iname "*supermemory*" -o -iname "*migrate-memor*"
ls ralph/
```

Note the paths; you'll delete them next step.

- [ ] **Step 2: Delete the directories/files**

```bash
rm -rf ralph/
rm -f src/server/clients/supermemory.ts
# substitute the actual path(s) found in step 1:
rm -f scripts/migrate-to-supermemory.ts
```

- [ ] **Step 3: Find and remove supermemory imports across the codebase**

```bash
grep -rln "supermemory\|Supermemory" src/ prisma/
```

Open each file in the result. The supermemory client is used in:
- `src/server/api/routers/composioclaw/getMemoryGraph.ts` — will be deleted in Task 6
- `src/server/api/routers/composioclaw/getMemories.ts` — will be replaced in Task 6
- `src/server/api/routers/composioclaw/agent/setup.ts` — will be patched in Task 6
- `src/app/(authenticated)/dashboard/settings/_components/memory-settings.tsx` — will be rewritten in Task 6

For NOW, leave these references in place — they will be removed in Task 6 wholesale. The build will be temporarily broken at the end of this task; that's OK because the next task continues.

Actually — to keep the build green per the verification gate, comment out the supermemory client import lines in those four files for now (just enough to compile). Task 6 will replace them properly.

```bash
# Find the import lines:
grep -n "from \"~/server/clients/supermemory\"" src/server/api/routers/composioclaw/getMemoryGraph.ts src/server/api/routers/composioclaw/getMemories.ts src/server/api/routers/composioclaw/agent/setup.ts
```

- [ ] **Step 4: Stub broken imports temporarily**

In each file from Step 3, replace `import { supermemory } from "~/server/clients/supermemory";` with a placeholder that satisfies the type system. Easiest: leave the file fully broken and SKIP the build verification for this task — instead verify after Task 6.

Decision for this plan: **skip `pnpm build` verification for Task 1. Verify at the end of Task 6.** Build will be broken until Task 6 completes.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove ralph, supermemory client, and migration script"
```

---

## Task 2: Remove Sentry

**Files:**
- Delete: `sentry.edge.config.ts`
- Delete: `sentry.server.config.ts` (if exists at repo root)
- Modify: `src/instrumentation.ts` — strip Sentry init
- Modify: `src/instrumentation-client.ts` — strip Sentry init
- Modify: `src/env.ts` — drop `SENTRY_*` vars
- Modify: `src/server/api/trpc.ts` — remove Sentry tracing middleware (commit `fa65c1552`)
- Modify: `next.config.js` — remove `withSentryConfig` wrapper if present
- Modify: `package.json` — drop `@sentry/*` deps

- [ ] **Step 1: Locate all Sentry references**

```bash
grep -rln "@sentry\|Sentry\.\|SENTRY_" src/ next.config.js sentry*.ts package.json
```

- [ ] **Step 2: Delete Sentry config files**

```bash
rm -f sentry.edge.config.ts sentry.server.config.ts sentry.client.config.ts
```

- [ ] **Step 3: Strip Sentry from instrumentation files**

Open `src/instrumentation.ts` — remove all `Sentry.*` calls and `@sentry/*` imports. If the file becomes empty, delete it entirely.

Open `src/instrumentation-client.ts` — same treatment.

- [ ] **Step 4: Remove Sentry tracing middleware from tRPC**

Open `src/server/api/trpc.ts`. Find the Sentry tracing middleware introduced in commit `fa65c1552` (look for `Sentry.startSpan` or similar). Remove the middleware definition AND its `.use(...)` registration on the procedure builders.

- [ ] **Step 5: Remove Sentry from `next.config.js`**

Open `next.config.js`. Remove `import { withSentryConfig } from "@sentry/nextjs"` and unwrap the export so it returns the plain config (no `withSentryConfig(...)` wrapper).

- [ ] **Step 6: Remove Sentry env vars**

Open `src/env.ts`. Delete these lines from both the schema and the `runtimeEnv` mapping:
- `SENTRY_DSN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`
- `SENTRY_AUTH_TOKEN` (if present)
- `NEXT_PUBLIC_SENTRY_DSN`

- [ ] **Step 7: Remove Sentry deps**

```bash
pnpm remove @sentry/nextjs
# also any other @sentry/* — check package.json first:
grep "@sentry" package.json
```

- [ ] **Step 8: Verify no Sentry references remain**

```bash
grep -rln "@sentry\|Sentry\.\|SENTRY_\|withSentryConfig" src/ next.config.js
```

Expected: no results.

- [ ] **Step 9: Commit (build still broken from Task 1, skip verify)**

```bash
git add -A
git commit -m "chore: remove Sentry entirely"
```

---

## Task 3: Remove PostHog and the analytics layer

**Files:**
- Delete: every `_analytics.ts` file (7 known files — verify with find)
- Delete: PostHog client module(s) — likely `src/clients/analytics/*` or similar
- Delete: `trackPageView` server helper
- Modify: `src/env.ts` — drop `NEXT_PUBLIC_POSTHOG_*`
- Modify: every page that calls `trackPageView` or renders `<TrackedPage>`
- Modify: `package.json` — drop `posthog-js`, `posthog-node`

- [ ] **Step 1: Locate analytics surface**

```bash
find src/app -name "_analytics.ts"
find src/clients -iname "*analytic*" -o -iname "*posthog*"
grep -rln "posthog\|PostHog\|trackPageView\|TrackedPage" src/
```

- [ ] **Step 2: Delete every `_analytics.ts`**

```bash
find src/app -name "_analytics.ts" -delete
```

- [ ] **Step 3: Delete the analytics client module**

Substitute the actual path discovered in Step 1:

```bash
rm -rf src/clients/analytics
```

- [ ] **Step 4: Strip `trackPageView` and analytics imports from pages**

For each result of `grep -rln "trackPageView\|@/clients/analytics\|~/clients/analytics" src/app`:
- Remove the `await trackPageView(...)` call from server pages
- Remove the import line
- Remove any `import { ...Event } from "./_analytics"` lines (the `_analytics.ts` files are gone)

- [ ] **Step 5: Remove `<TrackedPage>` usages**

```bash
grep -rln "TrackedPage" src/
```

For each file, replace `<TrackedPage pageViewEvent={...}>...</TrackedPage>` with just the inner children. Remove the import.

The `tracked-page.tsx` component itself will be deleted in Task 4 along with the rest of `components/tracked/`.

- [ ] **Step 6: Remove PostHog env vars**

In `src/env.ts`, delete:
- `NEXT_PUBLIC_POSTHOG_KEY`
- `NEXT_PUBLIC_POSTHOG_HOST` (if present)

- [ ] **Step 7: Remove deps**

```bash
pnpm remove posthog-js posthog-node
```

- [ ] **Step 8: Verify no analytics references remain**

```bash
grep -rln "posthog\|PostHog\|trackPageView\|_analytics" src/
```

Expected: only matches inside `src/components/tracked/` (which Task 4 deletes) and any docs.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: remove PostHog analytics layer"
```

---

## Task 4: Sweep `~/components/tracked` and replace with plain `~/components/ui`

This is the largest mechanical change (~34 files import from `~/components/tracked`).

**Files:**
- Delete: `src/components/tracked/` (whole directory)
- Modify: every file in `grep -rl "components/tracked" src/`

**Mapping table:**

| Tracked import | Replace with |
|---|---|
| `~/components/tracked/button` | `~/components/ui/button` |
| `~/components/tracked/link` | `next/link` |
| `~/components/tracked/dialog` | `~/components/ui/dialog` |
| `~/components/tracked/sheet` | `~/components/ui/sheet` |
| `~/components/tracked/select` | `~/components/ui/select` |
| `~/components/tracked/switch` | `~/components/ui/switch` |
| `~/components/tracked/tabs` | `~/components/ui/tabs` |
| `~/components/tracked/form` | `~/components/ui/form` |
| `~/components/tracked/search-input` | `~/components/ui/input` (verify shape) |
| `~/components/tracked/confirm-dialog` | (likely a custom — see Step 4 below) |
| `~/components/tracked` (barrel) | resolve per-symbol via the barrel exports |

- [ ] **Step 1: List all consuming files**

```bash
grep -rl "components/tracked\|from \"~/components/tracked" src/ > /tmp/tracked-consumers.txt
wc -l /tmp/tracked-consumers.txt
cat /tmp/tracked-consumers.txt
```

- [ ] **Step 2: Inspect the `confirm-dialog` tracked variant**

```bash
cat src/components/tracked/confirm-dialog.tsx
```

If it's a custom composition (not just a wrapper around a single shadcn primitive), copy the non-tracking parts into `src/components/core/confirm-dialog.tsx` and import from there going forward. If it IS just a wrapper around `~/components/ui/alert-dialog`, consumers can import from there directly.

- [ ] **Step 3: Bulk find/replace imports**

For each consuming file (from Step 1), do these replacements:

```bash
# Run from repo root. Adjust commands per your sed flavor (macOS = sed -i ''):
for f in $(cat /tmp/tracked-consumers.txt); do
  sed -i '' \
    -e 's|~/components/tracked/button|~/components/ui/button|g' \
    -e 's|~/components/tracked/dialog|~/components/ui/dialog|g' \
    -e 's|~/components/tracked/sheet|~/components/ui/sheet|g' \
    -e 's|~/components/tracked/select|~/components/ui/select|g' \
    -e 's|~/components/tracked/switch|~/components/ui/switch|g' \
    -e 's|~/components/tracked/tabs|~/components/ui/tabs|g' \
    -e 's|~/components/tracked/form|~/components/ui/form|g' \
    -e 's|~/components/tracked/link|next/link|g' \
    "$f"
done
```

For barrel imports (`from "~/components/tracked"`), open each file individually and resolve to the per-component import.

- [ ] **Step 4: Strip `trackEvent` props**

Each tracked component had a required or optional `trackEvent` prop. Remove these from JSX. Search:

```bash
grep -rln "trackEvent=" src/
```

For each file, remove the `trackEvent={...}` and `trackEventOnRetry={...}` props. The TS compiler will surface any remaining mismatches.

- [ ] **Step 5: Delete the tracked components directory**

```bash
rm -rf src/components/tracked
```

- [ ] **Step 6: Verify**

```bash
grep -rln "components/tracked" src/
grep -rln "trackEvent" src/
```

Both expected: no results.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: replace tracked components with plain ui primitives"
```

---

## Task 5: Auth simplification — Google only, drop magic link, drop Twitter, drop Resend

**Files:**
- Modify: `src/server/auth.ts` — remove `magicLink` plugin, remove `twitter` from `socialProviders`
- Modify: `src/clients/auth/react.tsx` — remove `magicLinkClient`
- Delete: any Resend client (verify with `find`); env import too
- Modify: `src/env.ts` — drop `RESEND_API_KEY`
- Modify: `src/app/login/page.tsx` (or wherever the login UI lives) — Google-only button
- Modify: `package.json` — drop `resend` and any Better Auth Resend integration package

- [ ] **Step 1: Inspect current auth server config**

```bash
grep -n "plugin\|socialProviders\|magicLink\|twitter\|resend" src/server/auth.ts
```

- [ ] **Step 2: Edit `src/server/auth.ts`**

In `socialProviders`, delete the `twitter` block (keep `google`). Remove the `magicLink({ ... })` entry from the `plugins` array. Remove the `magicLink` import from `better-auth/plugins`. Remove any Resend import and the `sendMagicLink` callback that called Resend.

- [ ] **Step 3: Edit `src/clients/auth/react.tsx`**

Remove `magicLinkClient` from `better-auth/client/plugins` import and from the `plugins` array passed to `createAuthClient`.

- [ ] **Step 4: Find and delete Resend client**

```bash
grep -rln "resend\|Resend" src/server/ src/clients/
find src/server -iname "*resend*"
```

Delete any Resend client file. Remove `RESEND_API_KEY` references throughout.

- [ ] **Step 5: Strip RESEND_API_KEY from env**

In `src/env.ts`, delete:
- The `RESEND_API_KEY: z.string()` line in the server schema
- The `RESEND_API_KEY: process.env.RESEND_API_KEY` line in `runtimeEnv`

- [ ] **Step 6: Simplify the login page**

Open `src/app/login/page.tsx` (or wherever the login UI lives — verify with `find src/app -iname "*login*"`). Remove the magic-link email form. Keep only a "Sign in with Google" button that calls:

```tsx
import { authClient } from "~/clients/auth/react";

await authClient.signIn.social({
  provider: "google",
  callbackURL: "/dashboard",
});
```

Remove any Twitter/X sign-in button.

- [ ] **Step 7: Remove deps**

```bash
pnpm remove resend
# check Better Auth Resend integration if present:
grep -E "@better-auth/resend|better-auth-resend" package.json
# remove if found
```

- [ ] **Step 8: Regenerate Better Auth client types**

```bash
pnpm auth:generate
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: simplify auth to Google OAuth only, remove magic link and Resend"
```

---

## Task 6: Restore pgvector memory layer

This is the highest-risk task per the spec. Source-of-truth commits to read:
- Last good pre-supermemory state: just before `11dff6974`
- Specifically inspect: `git show 11dff6974^ -- src/server/api/routers/composioclaw/agent/tools/`
- Memory flush layer: deleted in `83c241167`. Read with `git show 83c241167^ -- src/server/api/routers/composioclaw/agent/`

**Files:**
- Restore: `src/server/api/routers/composioclaw/agent/tools/memory_save.ts` (or the names used in the old code — verify)
- Restore: `src/server/api/routers/composioclaw/agent/tools/memory_search.ts`
- Modify: `src/server/api/routers/composioclaw/agent/tools/index.ts` — register restored tools, remove supermemory tools if any
- Modify: `src/server/api/routers/composioclaw/agent/setup.ts` — remove supermemory middleware, restore `searchMemoriesForContext` injection
- Restore: memory flush layer in `src/server/api/routers/composioclaw/agent/compaction/` (adapted to current Phase 3 pruning shape)
- Replace: `src/server/api/routers/composioclaw/getMemories.ts` — pgvector-backed
- Delete: `src/server/api/routers/composioclaw/getMemoryGraph.ts`
- Modify: `src/server/api/routers/composioclaw/index.ts` — unregister `getMemoryGraph`
- Rewrite: `src/app/(authenticated)/dashboard/settings/_components/memory-settings.tsx` — plain list, no graph, no Supermemory branding
- Modify: `src/env.ts` — drop `SUPERMEMORY_API_KEY`, ensure `OPENAI_API_KEY` present

The Prisma `Memory` model already exists in `prisma/schema.prisma` (verified — the supermemory migration didn't drop it). No schema changes needed for memory.

- [ ] **Step 1: Read the old memory tool code**

```bash
git show 11dff6974^ -- src/server/api/routers/composioclaw/agent/tools/ | less
```

Save the old `memory_save.ts` and `memory_search.ts` contents — you'll port them into the current code. Note the exact embedding model (likely OpenAI `text-embedding-3-large` with 1024 dims, matching the schema).

- [ ] **Step 2: Read the old memory flush layer**

```bash
git show 83c241167^ -- src/server/api/routers/composioclaw/agent/ | less
```

Find the file(s) that implemented "flush messages → memories on prune." Note the LLM extraction prompt and the call site.

- [ ] **Step 3: Restore `memory_save` agent tool**

Create `src/server/api/routers/composioclaw/agent/tools/memory_save.ts` based on the old code. The tool:
- Takes a `content: string` input
- Generates an embedding via OpenAI `text-embedding-3-large` (output dimensions: 1024 — this matches the existing pgvector schema)
- Inserts into the `composio_claw_memory` table via `$queryRaw`

Use the patterns from CLAUDE.md (raw SQL for pgvector with `Zod` validation):

```typescript
const embeddingString = `[${embedding.join(",")}]`;
await prisma.$queryRaw`
  INSERT INTO composio_claw_memory (id, "instanceId", content, embedding, "createdAt")
  VALUES (${id}, ${instanceId}, ${content}, ${embeddingString}::vector, NOW())
`;
```

- [ ] **Step 4: Restore `memory_search` agent tool**

Create `src/server/api/routers/composioclaw/agent/tools/memory_search.ts`. The tool:
- Takes a `query: string` and optional `limit: number`
- Generates a query embedding
- Performs cosine similarity search and returns top results

```typescript
import { z } from "zod";

const memoryRow = z.object({
  id: z.string(),
  content: z.string(),
  similarity: z.number(),
});

const queryEmbeddingString = `[${queryEmbedding.join(",")}]`;
const results = z.array(memoryRow).parse(
  await prisma.$queryRaw`
    SELECT id, content, 1 - (embedding <=> ${queryEmbeddingString}::vector) AS similarity
    FROM composio_claw_memory
    WHERE "instanceId" = ${instanceId}
    ORDER BY embedding <=> ${queryEmbeddingString}::vector
    LIMIT ${limit}
  `,
);
```

- [ ] **Step 5: Register the restored tools**

Open `src/server/api/routers/composioclaw/agent/tools/index.ts`. Remove any supermemory tool registrations. Add `memory_save` and `memory_search` to the tools registry.

- [ ] **Step 6: Patch `agent/setup.ts`**

Open `src/server/api/routers/composioclaw/agent/setup.ts`. Remove:
- The supermemory middleware import and its registration
- Any other supermemory references

Add: a `searchMemoriesForContext` function that runs before each agent turn, embeds the latest user message, queries top-K memories from pgvector, and injects them as a system message. Match the shape from the pre-supermemory code (read `git show 11dff6974^ -- .../agent/setup.ts`).

- [ ] **Step 7: Restore the memory flush layer in compaction**

Open `src/server/api/routers/composioclaw/agent/compaction/run-compaction.ts`. Add a step BEFORE messages are pruned (Phase 3 logic) that:
1. Takes the message group about to be dropped
2. Sends them to a small LLM with a "extract durable facts as memories" prompt (port the prompt from `git show 83c241167^`)
3. Persists each extracted memory via the same code path used by `memory_save`

Adapt to the current Phase 3 structure — don't blindly cherry-pick.

- [ ] **Step 8: Replace `getMemories.ts`**

Open `src/server/api/routers/composioclaw/getMemories.ts`. Remove all supermemory SDK calls. Replace with a Prisma query:

```typescript
return ctx.prisma.memory.findMany({
  where: { instanceId },
  select: { id: true, content: true, createdAt: true },
  orderBy: { createdAt: "desc" },
});
```

(`Memory` is the already-existing Prisma model.)

- [ ] **Step 9: Delete `getMemoryGraph.ts`**

```bash
rm src/server/api/routers/composioclaw/getMemoryGraph.ts
```

Open `src/server/api/routers/composioclaw/index.ts` and remove the `getMemoryGraph` registration from the router.

- [ ] **Step 10: Rewrite memory-settings UI**

Open `src/app/(authenticated)/dashboard/settings/_components/memory-settings.tsx`. Strip out:
- "Powered by Supermemory" branding
- Any graph visualization component
- Any references to supermemory client or `getMemoryGraph`

Replace with a plain list:
- Render `trpc.composioclaw.getMemories.useQuery()` results as a `<Card>` per memory showing `content` + relative time via `moment(...).fromNow()`
- (Optional, only if a delete procedure already exists) Add a delete button per row

- [ ] **Step 11: Update env**

In `src/env.ts`:
- Delete `SUPERMEMORY_API_KEY` from the schema and `runtimeEnv`
- Verify `OPENAI_API_KEY: z.string()` is in the server schema and `runtimeEnv`. If absent, add it.

- [ ] **Step 12: Verify no supermemory references remain**

```bash
grep -rln "supermemory\|Supermemory\|SUPERMEMORY" src/ prisma/
```

Expected: no results.

- [ ] **Step 13: Build + lint**

```bash
pnpm build
pnpm lint
```

Both must pass. This is the first build verification since Task 1 — fix any errors before continuing.

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "feat: restore pgvector memory layer with flush-on-prune"
```

---

## Task 7: Remove billing

**Files:**
- Delete: `src/server/api/routers/billing/` (whole dir)
- Delete: `src/server/clients/stripe.ts`
- Delete: any Stripe webhook route under `src/app/api/stripe/`
- Delete: pricing page, checkout pages, navbar credit balance component, blocked-message UI
- Modify: `src/server/api/root.ts` — remove `billingRouter`
- Modify: `src/server/api/routers/composioclaw/createInstance.ts` — strip credit/plan checks
- Modify: `src/server/api/routers/composioclaw/agent/setup.ts` — strip credit deduction
- Modify: `src/server/api/routers/composioclaw/toggleCronJob.ts` — strip plan gating
- Modify: `prisma/schema.prisma` — drop `User.stripeCustomerId`, the `creditBalance`/`transactions` relations on `User`, and the models: `CreditBalance`, `Transaction`, `UsageRecord`, `AutoRefillSettings`, `StripeEvent`
- Modify: `src/env.ts` — drop `STRIPE_*`
- Modify: `package.json` — drop `stripe`

- [ ] **Step 1: Inventory billing surface**

```bash
ls src/server/api/routers/billing/
grep -rln "stripe\|Stripe\|creditBalance\|CreditBalance\|stripeCustomerId" src/ prisma/
find src/app -iname "*pricing*" -o -iname "*checkout*" -o -iname "*billing*"
find src/app/api -iname "*stripe*"
```

- [ ] **Step 2: Delete the billing router**

```bash
rm -rf src/server/api/routers/billing
```

Open `src/server/api/root.ts`. Remove:
- `import { billingRouter } from "./routers/billing";`
- The `billing: billingRouter,` line in `appRouter`

- [ ] **Step 3: Delete the Stripe client and webhook route**

```bash
rm -f src/server/clients/stripe.ts
rm -rf src/app/api/stripe
```

- [ ] **Step 4: Delete billing UI**

```bash
# substitute actual paths from Step 1 inventory:
rm -rf src/app/\(authenticated\)/dashboard/billing
rm -rf src/app/\(authenticated\)/dashboard/pricing
rm -rf src/app/\(authenticated\)/dashboard/usage
# also delete any checkout-related pages and the blocked-message component
```

Find the navbar credit balance component:

```bash
grep -rln "creditBalance\|CreditBalance\|credit-balance\|navbar.*credit" src/components/ src/app/
```

Delete the file(s) and remove their import + render from the navbar.

Find the blocked-message UI:

```bash
grep -rln "blockedMessage\|BlockedMessage\|messageBlocked" src/
```

Delete the component(s) and remove their renders from chat UI.

- [ ] **Step 5: Patch cross-cutting tRPC procedures**

Open `src/server/api/routers/composioclaw/createInstance.ts`. Remove any block that:
- Checks `creditBalance`
- Initializes a Stripe customer
- References `stripeCustomerId`

Open `src/server/api/routers/composioclaw/agent/setup.ts`. Remove any block that:
- Reads/decrements `creditBalance`
- Creates `Transaction` rows
- Gates on `plan` or message limits

Open `src/server/api/routers/composioclaw/toggleCronJob.ts`. Remove plan-gating checks.

- [ ] **Step 6: Drop billing fields/models from Prisma schema**

Open `prisma/schema.prisma`. In `model User`:
- Delete `stripeCustomerId   String?`
- Delete the relations `creditBalance CreditBalance?` and `transactions Transaction[]`
- Delete `AutoRefillSettings` relation if present on User

Delete these whole models:
- `model CreditBalance`
- `model Transaction`
- `model UsageRecord`
- `model AutoRefillSettings`
- `model StripeEvent`

- [ ] **Step 7: Push schema**

```bash
echo $DATABASE_URL | grep ep-holy-salad
```

Expected: shows the dev Neon DB. If it shows a prod URL — STOP and ask.

```bash
pnpm prisma db push
```

This is destructive (drops billing tables). Confirm at the prompt.

- [ ] **Step 8: Drop Stripe env vars**

In `src/env.ts`, delete from server schema and `runtimeEnv`:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- Any other `STRIPE_*` or `NEXT_PUBLIC_STRIPE_*`

- [ ] **Step 9: Remove Stripe deps**

```bash
pnpm remove stripe
grep -E "stripe|@stripe" package.json
# remove any remaining stripe-adjacent packages
```

- [ ] **Step 10: Verify**

```bash
grep -rln "stripe\|Stripe\|creditBalance\|CreditBalance\|billing\|Billing\|StripeEvent\|UsageRecord" src/ prisma/
pnpm build
pnpm lint
```

`grep` should return no functional code matches (a stray "billing" in a comment or doc string is fine — handle in Task 9). Build and lint must pass.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat!: remove billing entirely"
```

---

## Task 8: Bootstrap / identity collapse — onboarding owns the soul

**Files:**
- Delete: `src/server/api/routers/composioclaw/agent/tools/bootstrap.ts`
- Delete: `src/server/api/routers/composioclaw/agent/tools/bootstrap.schema.ts`
- Delete: `src/server/api/routers/composioclaw/setIdentity.ts`
- Modify: `src/server/api/routers/composioclaw/agent/tools/index.ts` — unregister bootstrap tool
- Modify: `src/server/api/routers/composioclaw/index.ts` — unregister `setIdentity`
- Modify: `src/server/api/routers/composioclaw/agent/system-prompt.ts` — strip bootstrap branches
- Modify: `src/server/api/routers/composioclaw/getStatus.ts` — remove identity gating
- Modify: `src/server/api/routers/composioclaw/getInstance.ts` — remove identity gating if present
- Modify: dashboard UI components that branch on "is bootstrapped?" state

- [ ] **Step 1: Inspect bootstrap surface**

```bash
cat src/server/api/routers/composioclaw/agent/tools/bootstrap.ts
cat src/server/api/routers/composioclaw/setIdentity.ts
grep -rln "bootstrap\|setIdentity\|isBootstrapped\|hasIdentity" src/
```

- [ ] **Step 2: Delete the agent bootstrap tool**

```bash
rm -f src/server/api/routers/composioclaw/agent/tools/bootstrap.ts \
      src/server/api/routers/composioclaw/agent/tools/bootstrap.schema.ts
```

Open `src/server/api/routers/composioclaw/agent/tools/index.ts` and remove the bootstrap tool registration (import line + tools-record entry).

- [ ] **Step 3: Delete `setIdentity` procedure**

```bash
rm -f src/server/api/routers/composioclaw/setIdentity.ts
```

Open `src/server/api/routers/composioclaw/index.ts` and remove the `setIdentity` registration.

- [ ] **Step 4: Strip bootstrap branches from system prompt**

Open `src/server/api/routers/composioclaw/agent/system-prompt.ts`. Find any conditional logic like `if (!isBootstrapped)` or "you are in bootstrap mode" prompt sections. Delete those branches. The agent should always assume the soul exists in the DB (because onboarding wrote it).

- [ ] **Step 5: Remove identity gating from status/instance procedures**

Open `src/server/api/routers/composioclaw/getStatus.ts`. Remove any field or check related to `isBootstrapped`/`hasIdentity`. The status enum should no longer include a "needs identity" state.

Open `src/server/api/routers/composioclaw/getInstance.ts`. Same treatment if present.

- [ ] **Step 6: Update dashboard UI consumers**

```bash
grep -rln "isBootstrapped\|needsIdentity\|hasIdentity\|setIdentity" src/app/
```

For each file:
- Remove conditional rendering branches that gate on bootstrap state
- Remove any `trpc.composioclaw.setIdentity` mutation calls
- Trust that the agent UI can render unconditionally for authenticated users with completed onboarding

- [ ] **Step 7: Verify**

```bash
grep -rln "bootstrap\|setIdentity\|isBootstrapped\|hasIdentity\|needsIdentity" src/
```

Expected: only matches inside onboarding code (which keeps the *result* of identity setup) and possibly docs.

```bash
pnpm build
pnpm lint
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: collapse bootstrap, onboarding now owns soul creation"
```

---

## Task 9: Rename `composioclaw` → `trustclaw`

**Files:**
- Rename: `src/server/api/routers/composioclaw/` → `src/server/api/routers/trustclaw/`
- Modify: `src/server/api/root.ts` — rename import and key
- Find/replace: every `trpc.composioclaw.` → `trpc.trustclaw.` in client code
- Modify: `src/server/api/routers/trustclaw/agent/CLAUDE.md`

- [ ] **Step 1: Rename the router directory**

```bash
git mv src/server/api/routers/composioclaw src/server/api/routers/trustclaw
```

- [ ] **Step 2: Update the root router**

Open `src/server/api/root.ts`. Change:

```typescript
import { composioClawRouter } from "./routers/composioclaw";
// → 
import { trustclawRouter } from "./routers/trustclaw";
```

In the `appRouter` definition:

```typescript
composioclaw: composioClawRouter,
// →
trustclaw: trustclawRouter,
```

- [ ] **Step 3: Update the router file's own export**

Open `src/server/api/routers/trustclaw/index.ts`. Rename the exported router constant:

```typescript
export const composioClawRouter = router({...});
// →
export const trustclawRouter = router({...});
```

- [ ] **Step 4: Find/replace client-side tRPC calls**

```bash
grep -rln "trpc\.composioclaw" src/ | xargs sed -i '' 's|trpc\.composioclaw|trpc.trustclaw|g'
grep -rln "trpc\.composioclaw" src/
```

Second grep should return nothing.

- [ ] **Step 5: Update `RouterOutputs`/`RouterInputs` references**

```bash
grep -rln "RouterOutputs\[\"composioclaw\"\]\|RouterInputs\[\"composioclaw\"\]" src/
```

For each match, replace `"composioclaw"` with `"trustclaw"`.

- [ ] **Step 6: Update agent CLAUDE.md doc**

Open `src/server/api/routers/trustclaw/agent/CLAUDE.md`. Find/replace `composioclaw` → `trustclaw` (case-sensitive on both `composioclaw` and `composioClaw` / `ComposioClaw` if used).

- [ ] **Step 7: Verify**

```bash
grep -rln "composioclaw\|composioClaw\|ComposioClaw" src/
pnpm build
pnpm lint
```

`grep` is allowed to still match the Prisma model name `ComposioClawInstance` and the table mapping `composio_claw_memory` — those stay (they're the DB schema, and renaming would require a destructive DB migration that's not worth it). Otherwise expect no matches in TypeScript code.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: rename composioclaw router to trustclaw"
```

---

## Task 10: OSS polish — README, LICENSE, .env.example, CLAUDE.md cleanup, package.json

**Files:**
- Create: `LICENSE` (MIT)
- Create or rewrite: `README.md`
- Create: `.env.example`
- Modify: `CLAUDE.md` (root)
- Modify: `package.json`

- [ ] **Step 1: Add MIT LICENSE**

Create `LICENSE` at the repo root with the standard MIT text:

```
MIT License

Copyright (c) 2026 Sarah Simionescu

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 2: Write the new README**

Replace `README.md` with:

```markdown
# TrustClaw

A self-hostable personal AI agent with persistent memory, Composio tool access, and a Telegram interface.

## What it is

TrustClaw is a Next.js app that lets you run a personal Claude-powered agent with:
- **Persistent vector memory** — pgvector-backed; memories are saved automatically as context is pruned and recalled via semantic search
- **Composio tools** — your agent can use any Composio toolkit you connect (Gmail, Calendar, GitHub, etc.)
- **Telegram interface** — chat with your agent from your phone
- **Soul / persona** — set the agent's name, writing style, and personality during onboarding

## Architecture

Single Next.js app with a tRPC backend. Auth via Better Auth (Google OAuth only). Database: Postgres with pgvector (Neon recommended). Agent runs on the Anthropic API.

```
┌────────────────────────┐
│   Next.js Dashboard    │
│   (App Router + tRPC)  │
└────────┬───────────────┘
         │
         ▼
┌────────────────────────┐    ┌────────────────────┐
│  Postgres + pgvector   │    │   Anthropic API    │
│  (memories, instance)  │    │   (agent runtime)  │
└────────────────────────┘    └────────────────────┘
         │
         ▼
┌────────────────────────┐
│   Composio + Telegram  │
└────────────────────────┘
```

## Setup

```bash
git clone <your-fork>
cd trustclaw
pnpm install
cp .env.example .env
# fill in env values — see .env.example for what each one is
pnpm prisma db push
pnpm dev
```

Open http://localhost:3000 and sign in with Google.

## Required env vars

See `.env.example` for the complete list with descriptions. Minimum to run:
- `DATABASE_URL` — Postgres with pgvector enabled
- `BETTER_AUTH_SECRET` — random 32+ char string
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — Google OAuth
- `ANTHROPIC_API_KEY` — for the agent
- `OPENAI_API_KEY` — for memory embeddings
- `COMPOSIO_API_KEY` — for tool access
- `TELEGRAM_BOT_TOKEN` — your Telegram bot

## Tech stack

- Next.js 15 (App Router) + tRPC
- Tailwind + shadcn/ui
- Better Auth (Google OAuth)
- Prisma + Postgres (pgvector for memory embeddings)
- Anthropic SDK (agent), OpenAI (embeddings), Composio (tools), Telegram Bot API

## License

MIT — see [LICENSE](./LICENSE).
```

- [ ] **Step 3: Write `.env.example`**

Use the schema in `src/env.ts` as the source of truth. Read it first:

```bash
cat src/env.ts
```

Then create `.env.example` with every var, grouped, with one-line comments. Template:

```bash
# --- Database ---
# Postgres with pgvector extension. Neon's free tier works.
DATABASE_URL=

# --- Auth (Better Auth) ---
# Random 32+ char string. Generate: openssl rand -base64 32
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000

# --- Google OAuth ---
# Create at https://console.cloud.google.com/apis/credentials
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# --- Agent ---
# https://console.anthropic.com/
ANTHROPIC_API_KEY=

# --- Memory embeddings ---
# https://platform.openai.com/api-keys (uses text-embedding-3-large @ 1024 dims)
OPENAI_API_KEY=

# --- Composio (tool access) ---
# https://app.composio.dev/
COMPOSIO_API_KEY=

# --- Telegram bot ---
# Create with @BotFather
TELEGRAM_BOT_TOKEN=
```

Cross-check against `src/env.ts` — every key in the schema must appear here, every key here must exist in the schema. Adjust per the actual final state of `src/env.ts`.

- [ ] **Step 4: Update root `CLAUDE.md`**

Open `CLAUDE.md`. Make these changes:

1. **Tech Stack section:** Remove any mention of Sentry, PostHog, Resend, Stripe, Supermemory.
2. **Auth section:** Replace "Magic link login only" with "Google OAuth only via Better Auth (no magic link, no other social providers)."
3. **Principles → "Track everything":** Delete this principle entirely.
4. **Repo structure tree:** Remove `tracked/` from `src/components/`, remove the `_analytics.ts` line from the page-folder example, remove `billing/` from the routers example, rename `composioclaw/` to `trustclaw/`.
5. **Tracked Primitive Components section:** Delete this entire subsection.
6. **Pages section:** Remove the `_analytics.ts` requirement and the `await trackPageView(...)` requirement.
7. **Components section:** Replace "MAXIMALLY use ... `~/components/tracked` ... otherwise pull from `~/components/ui`" with just "MAXIMALLY use shadcn primitives from `~/components/ui`."
8. **Icons example:** Strip the `trackEvent` prop from the example.
9. **Environment Variables section:** Update the example list — remove Resend/Stripe/Sentry/Supermemory, keep the live ones.
10. **External SDK Clients section:** Remove `supermemory.ts` from the listed clients.

- [ ] **Step 5: Update `package.json`**

Open `package.json`. Update these fields (substitute your fork URL):

```json
{
  "name": "trustclaw",
  "description": "A self-hostable personal AI agent with vector memory, Composio tools, and Telegram.",
  "repository": {
    "type": "git",
    "url": "https://github.com/<your-username>/trustclaw"
  },
  "license": "MIT"
}
```

Verify no `@sentry/*`, `posthog-*`, `resend`, `stripe`, `@stripe/*`, or `supermemory` packages remain in `dependencies` or `devDependencies`. Run:

```bash
grep -E "sentry|posthog|resend|stripe|supermemory" package.json
```

Expected: no matches.

- [ ] **Step 6: Final verification**

```bash
pnpm install
pnpm build
pnpm lint
```

All three must succeed.

- [ ] **Step 7: Manual smoke test**

```bash
pnpm dev
```

In the browser:
1. Sign in with Google
2. Complete onboarding (set name, personality, etc.)
3. Open the dashboard, send the agent a fact: "Remember my favorite color is blue"
4. Refresh the page, ask "what's my favorite color?" — it should recall via memory_search
5. Open settings → memory list — the saved fact should appear
6. (If Telegram bot is configured) link Telegram, send a message, get a reply

If any step fails, fix and re-verify before committing.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "docs: add OSS README, LICENSE, .env.example, and update CLAUDE.md"
```

---

## Task 11: Final hand-off — prepare for new repo

This task does NOT push to any remote. It only prepares the working tree for copying into a fresh repo.

- [ ] **Step 1: Final repo-wide grep for stragglers**

```bash
grep -rln "supermemory\|sentry\|posthog\|resend\|stripe" src/ prisma/ next.config.js package.json | grep -v node_modules
```

Expected: zero matches in source.

- [ ] **Step 2: Verify `git remote -v` is empty**

```bash
git remote -v
```

Expected: no output. (Confirms Task 0 still in effect.)

- [ ] **Step 3: Document next steps in a final commit message**

```bash
git log --oneline | head -15
```

Confirm the refactor commits are visible.

- [ ] **Step 4: Hand-off**

The branch is ready. To publish as a new OSS repo:

1. Create a new empty repo on GitHub (e.g. `<you>/trustclaw-oss`).
2. From a fresh directory:
   ```bash
   mkdir ~/trustclaw-oss && cd ~/trustclaw-oss
   git init
   ```
3. Copy the working tree from this worktree (excluding `.git`):
   ```bash
   rsync -a --exclude='.git' --exclude='node_modules' --exclude='.next' \
     /Users/sarahsimionescu/Documents/GitHub/trustclaw/.claude/worktrees/brave-napier-949c43/ \
     ./
   ```
4. Single initial commit:
   ```bash
   git add -A
   git commit -m "Initial commit"
   ```
5. Add the new remote and push:
   ```bash
   git remote add origin git@github.com:<you>/trustclaw-oss.git
   git push -u origin main
   ```

The original `ComposioHQ/trustclaw` is untouched.

---

## Self-Review Notes

- **Spec coverage:** All 8 spec workstreams + safety constraint covered (Task 0 = safety, Tasks 1–10 = workstreams 1–8 from spec, Task 11 = handoff). No gaps.
- **Build verification gap:** Tasks 1–5 deliberately skip `pnpm build` because they leave the build temporarily broken (Task 1 stubs supermemory imports; Task 6 fixes them). First green build is at end of Task 6. This is called out in Task 1 Step 4.
- **Destructive ops flagged:** Task 7 Step 7 (prisma db push dropping billing tables) has an explicit env-check guard before the destructive command.
- **Tracked confirm-dialog handling:** Task 4 Step 2 inspects the file before deciding the migration path, since shadcn doesn't have a 1:1 `confirm-dialog` primitive — could be a custom composition.
- **Schema rename intentionally avoided:** Task 9 Step 7 documents that `ComposioClawInstance` model name and `composio_claw_memory` table mapping stay as-is. Renaming them would require a destructive DB migration that's not worth the cost. The router/code uses `trustclaw` everywhere; only the DB layer keeps the old names.
