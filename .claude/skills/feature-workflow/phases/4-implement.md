# Phase 4: Implement

You are the **Implementation Bot**. Write all code following the implementation plan.

---

## Prerequisites

Read the implementation plan from `{STATE_DIR}/plan.md`.

---

## Instructions

Create files in this order to avoid import errors:

### Step 1: Analytics

- `_analytics.ts` — define all events per the plan

### Step 2: Schemas (if forms exist)

- tRPC: `src/server/api/routers/<domain>/<procedure>.schema.ts`

### Step 3: External SDK Clients (if needed)

- `src/server/clients/<name>.ts` — helper functions wrapping external SDKs (Composio, Telegram, Supermemory, etc.)

### Step 4: tRPC Procedures (if creating new ones)

1. `src/server/api/routers/<domain>/<procedure>.ts` — one procedure per file, use `publicProcedure` or `protectedProcedure`
2. `src/server/api/routers/<domain>/index.ts` — register in router
3. `src/server/api/root.ts` — register router if new domain

### Step 5: Skeleton Components

- `_components/<name>.skeleton.tsx` — mirror layout with `<Skeleton />` from `~/components/ui/skeleton`

### Step 6: Client Components

- `_components/<name>.tsx` — one component per file
- Use tracked components for all interactable elements
- Import analytics events from `_analytics.ts`
- Wrap risky subtrees with `<ErrorBoundary>`

### Step 7: Page (Server Component)

```typescript
import { trackPageView } from "~/clients/analytics/server";
import { authServer } from "~/clients/auth/server";
import { PageViewEvent } from "./_analytics";

export default async function Page() {
  await trackPageView(PageViewEvent);

  const session = await authServer.getSession();
  if (!session) return null;
  const { user } = session;

  // Prefetch queries (fire-and-forget)
  // void trpcServer.api.domain.procedure.prefetch();

  return (
    <HydrateClient>
      <ClientComponent
        userEmail={user?.email}
      />
    </HydrateClient>
  );
}
```

---

## Key Rules

- **Mobile-first:** Write base styles for mobile, then add `sm:`, `md:`, `lg:` prefixes for larger screens. Every layout must work at 375px width. Use responsive grids (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`), stack navigation/sidebars on mobile (`flex-col md:flex-row`), wrap tables in `overflow-x-auto`, and ensure 44px minimum touch targets.
- **Theming:** NEVER hardcoded Tailwind colors (`text-gray-500`, `bg-blue-600`). ALWAYS theme variables: `bg-muted`, `text-foreground`, `border-border`, etc.
- **Navigation:** NEVER `<a>` tags → `<Link>` from `~/components/tracked`. NEVER `window.location` → `useRouter()` from `next/navigation`.
- **State:** NEVER `useState`/`useEffect` unless absolutely necessary. Use query/mutation hook states, `react-hook-form`, or server-passed session props.
- **Types:** NEVER `any` or `unknown`. NEVER separate "types" files. Infer from `RouterOutputs`.
- **One thing per file.** One component, one procedure, one schema.
- **No `console.log`.** No unnecessary comments.
- **Env vars:** ALWAYS `import { env } from "~/env"` — NEVER raw `process.env` (except in root config files like `next.config.js`).
- **`trackEvent={null}`** ONLY for nested tracked components (e.g., Button inside Link).
- **Icons:** ALWAYS from `lucide-react`. NEVER other icon libraries.
- **Error handling:** `trpcToastOnError` for mutations. `<ErrorDisplay>` for query failures. `<ErrorBoundary>` for crash isolation.
- **Mutations:** ALWAYS use `mutateAsync`, NEVER use `mutate`.

---

## Deliverable

After all files are created, write a summary to `{STATE_DIR}/implementation.md`:

```markdown
# Implementation Summary: {Feature Name}

## Files Created

- `path/to/file.ts` — description
- ...

## Files Modified

- `path/to/file.ts` — what changed
- ...

## Key Decisions

- {any implementation decisions worth noting}

## Lessons

{Note anything that tripped you up or was missing from CLAUDE.md / the plan / workflow phases. Examples: a convention you had to figure out by reading code, a pattern not documented, a CLAUDE.md rule that was wrong or ambiguous, a library gotcha. Write "None" if everything went smoothly.}

## Status

PASS
```
