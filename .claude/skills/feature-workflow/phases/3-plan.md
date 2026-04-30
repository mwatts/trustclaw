# Phase 3: Plan

You are the **Planning Bot**. Produce a detailed implementation plan from the journey and research documents.

---

## Prerequisites

Read these documents from the state directory:

- `{STATE_DIR}/journey.md` — user journey from Phase 1
- `{STATE_DIR}/research.md` — research notes from Phase 2

---

## Instructions

Answer these six questions and save the plan to `{STATE_DIR}/plan.md`.

### Q1: Route Placement

- Requires auth? → Inside `app/(authenticated)/`
- Public page? → Directly in `app/`
- Auth callback / cookie-setting flow? → Route Handler (`route.ts`), not `page.tsx`

### Q2: Endpoints

For each endpoint:

| Field     | Value                                                                    |
| --------- | ------------------------------------------------------------------------ |
| Client    | `trpc` or `external SDK` (e.g., Composio, Telegram, Supermemory)         |
| Action    | `create` (tRPC) or `call` (external SDK)                                 |
| Path      | e.g., `tools.getList` or SDK method name                                 |
| Type      | `query` / `mutation` / `infiniteQuery` / `subscription`                  |
| Input     | Zod schema                                                               |
| Output    | Return type (optional)                                                   |
| Prefetch? | Yes/No — if yes, note tRPC prefetch pattern                              |

**External SDK clients** live in `src/server/clients/` and are used inside tRPC procedures only (never on the client). Each file exports helper functions, not raw SDK instances. API keys come from `env` or from the database (per-instance keys).

### Q3: Frontend Components

For each component, plan:

- **File location:** `_components/` (co-located), `core/`, `tracked/`, or `ui/`
- **Queries/mutations** — handle all three states:

  | State       | Queries                                                                                            | Mutations                                                                                       |
  | ----------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
  | **Error**   | `<ErrorDisplay>` with `trackEventOnRetry` for page-level errors, or custom error message otherwise | `trpcToastOnError` / `showTrpcErrorToast(error)` — from `~/components/core/toast-notifications` |
  | **Loading** | Co-located `.skeleton.tsx`                                                                         | `mutation.isPending` + disabled button and/or `<Spinner />`                                     |
  | **Success** | Render data                                                                                        | `showSuccessToast()` + `utils.invalidate()`                                                     |

- **Error isolation:** Wrap risky client subtrees with `<ErrorBoundary>` from `~/components/core/error-boundary`

- **Forms:**
  - tRPC mutation → import schema from `src/server/api/routers/<domain>/<procedure>.schema.ts`

- **Props typing:**
  - tRPC data → `RouterOutputs["domain"]["procedure"]` from `~/clients/trpc`

- **Skeletons:** every component with a loading state needs a sibling `.skeleton.tsx` using `<Skeleton />` from `~/components/ui/skeleton`

### Q4: Responsive Layout

For each page and component, plan the mobile and desktop experience:

- **Layout strategy:** How does the layout change from mobile to desktop? (e.g., stacked → side-by-side, single column → grid)
- **Hidden/visible elements:** What gets hidden or condensed on mobile? (e.g., sidebar collapsed, table → card list)
- **Touch targets:** Are all interactive elements at least 44px on mobile?
- **Text/content overflow:** Where might long text break the layout? Plan `truncate` / `line-clamp-*` usage.
- **Dialogs vs Sheets:** Should any large dialogs become bottom sheets on mobile?
- **Tables:** Plan `overflow-x-auto` wrapper or card-based alternative for mobile.

### Q5: Analytics

- Create/update `_analytics.ts` co-located with `page.tsx`
- Naming: `PascalCaseEvent` variable name, `snake_case` event name value, JSDoc comment per event
- Define events for: page views, button clicks, link clicks, form submissions, dialog opens/closes, tab switches

```typescript
import type { TrackEvent } from "~/clients/analytics/client";

/** Tracked when user views the tools page */
export const ToolsPageViewEvent: TrackEvent = {
  name: "tools_page_viewed",
};
```

### Q6: Prefetching

For every query consumed by a client component, plan server-side prefetching in `page.tsx`:

```typescript
import { trpcServer } from "~/clients/trpc/server";
void trpcServer.api.<router>.<procedure>.prefetch(input);
return <trpcServer.HydrateClient>{children}</trpcServer.HydrateClient>;
```

---

## Plan Document Template

Save to `{STATE_DIR}/plan.md`:

```markdown
# Implementation Plan: {Feature Name}

## Q1: Route Placement

{answer}

## Q2: Endpoints

{table of endpoints}

## Q3: Frontend Components

{list of components with details}

## Q4: Responsive Layout

{layout strategy per component}

## Q5: Analytics

{list of events}

## Q6: Prefetching

{prefetch plan}

## File Creation Order

1. `_analytics.ts` — all events
2. Schema files (if forms)
3. External SDK clients (if needed)
4. tRPC procedures (if new)
5. Skeleton components
6. Client components
7. Page (server component)
```

---

## Deliverable

Write the completed plan to: `{STATE_DIR}/plan.md`

The document MUST end with a `## Status` section:

```markdown
## Status

PASS
```
