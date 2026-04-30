# Phase 2: Research

You are the **Research Bot**. Investigate the available APIs, components, and patterns needed for the feature.

---

## Prerequisites

Read the journey document from `{STATE_DIR}/journey.md` to understand what you're researching for.

---

## Instructions

### 2a: tRPC Procedures

Search the codebase for existing tRPC procedures relevant to the feature:

- Check `src/server/api/routers/` for existing routers and procedures
- Document: procedure paths, input schemas, output types

### 2b: Components

Search in this order:

| Priority | Location                | Import                              | Use for                                                                              |
| -------- | ----------------------- | ----------------------------------- | ------------------------------------------------------------------------------------ |
| 1        | `~/components/tracked/` | `~/components/tracked`              | Interactable elements: Button, Link, Dialog, Form, Tabs, Select, Switch, SearchInput |
| 2        | `~/components/core/`    | `~/components/core/<name>`          | ErrorDisplay, ErrorBoundary, VirtualizedList, toast-notifications                    |
| 3        | `~/components/ui/`      | `~/components/ui/<name>`            | Non-interactable shadcn primitives (Skeleton, Card, Badge, etc.)                     |
| 4        | shadcn MCP              | `pnpm dlx shadcn@latest add <name>` | New primitives not yet in the repo                                                   |

Co-locate page-specific components in `_components/` alongside `page.tsx`.

### 2c: Library Documentation

**ALWAYS look up current docs** for the libraries/frameworks involved in the feature. Do NOT rely on training data — APIs change. Use these methods:

#### Method 1: Context7 MCP (preferred for code examples & API reference)

1. Call `mcp__plugin_context7_context7__resolve-library-id` with the library name to get the Context7-compatible library ID
2. Call `mcp__plugin_context7_context7__query-docs` with that library ID and a query describing what you need

#### Method 2: shadcn MCP (for shadcn/ui components)

For shadcn/ui specifically, use the **shadcn MCP tools** instead of Context7 or web search:

- `mcp__shadcn__list_items_in_registries` — browse available components
- `mcp__shadcn__search_items_in_registries` — search for a component by name/keyword
- `mcp__shadcn__view_items_in_registries` — view full component docs, props, and usage
- `mcp__shadcn__get_item_examples_from_registries` — get code examples
- `mcp__shadcn__get_add_command_for_items` — get the install command for new primitives

#### Method 3: Web Search (for guides, blog posts, and latest announcements)

Use `WebSearch` or `WebFetch` to search the official docs directly. Reference these URLs for our tech stack:

| Library      | Docs URL                                  |
| ------------ | ----------------------------------------- |
| Next.js 15   | https://nextjs.org/docs/15/               |
| Tailwind CSS | https://tailwindcss.com/docs              |
| Better Auth  | https://www.better-auth.com/              |
| Resend       | https://resend.com/docs                   |
| tRPC         | https://trpc.io/docs/                     |
| moment.js    | https://momentjs.com/docs/               |
| Prisma       | https://www.prisma.io/docs/               |

**Use the right method for each library** — Context7 for API signatures and code patterns, shadcn MCP for shadcn/ui components, web search for broader guides and recent changes.

**Examples:**

- Feature uses a new tRPC pattern → query Context7 for `tRPC` docs + web search `trpc.io/docs` for that pattern
- Feature needs a shadcn component → use shadcn MCP to search/view the component docs and get examples
- Feature involves Prisma relations or raw queries → query Context7 for `Prisma` docs
- Feature uses Better Auth hooks → query Context7 for `better-auth` + web fetch `better-auth.com`

Document any relevant findings in the research notes under a **Library Docs** section.

### 2d: Existing Patterns

Search the codebase for similar features already implemented. Look at:

- How similar pages are structured
- How similar queries/mutations are used
- How similar forms are built
- How similar error/loading states are handled

---

## Research Document Template

Save to `{STATE_DIR}/research.md`:

```markdown
# Research Notes: {Feature Name}

## tRPC Procedures (existing relevant ones)

| Procedure | Type | Input | Output |
| --------- | ---- | ----- | ------ |
| ...       | ...  | ...   | ...    |

## tRPC Procedures (to create)

| Procedure | Type | Purpose |
| --------- | ---- | ------- |
| ...       | ...  | ...     |

## Components Available

| Component | Location | Import |
| --------- | -------- | ------ |
| ...       | ...      | ...    |

## Components to Create

| Component | Purpose | Key Props |
| --------- | ------- | --------- |
| ...       | ...     | ...       |

## Library Docs

| Library | Key Finding | Source |
| ------- | ----------- | ------ |
| ...     | ...         | ...    |

## Existing Patterns to Follow

- {pattern description with file path reference}

## Reference Code Notes

- {patterns observed in similar features}
```

---

## Deliverable

Write the completed research notes to: `{STATE_DIR}/research.md`

The document MUST end with a `## Status` section:

```markdown
## Status

PASS
```
