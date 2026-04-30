# TrustClaw

A self-hostable personal AI agent. Talks to you on the web or Telegram, remembers what matters via pgvector memory, and uses [Composio](https://composio.dev/) tools to act on your connected accounts (Gmail, Slack, GitHub, Linear, etc.).

## What it is

- Chat with Claude in a Next.js dashboard or via a Telegram bot
- Long-term memory backed by Postgres + pgvector (OpenAI embeddings)
- 3-layer context management (pruning, memory flush, summarization compaction) so conversations can run indefinitely
- Composio integrations gated by the user's connected accounts
- Cron-scheduled agent runs for recurring tasks
- Google OAuth login via Better Auth

## Architecture

```
┌──────────────┐    ┌──────────────────────────────────────────┐
│  Web (Next)  │───▶│             Next.js App                  │
│   Telegram   │───▶│  ┌────────────────────────────────────┐  │
│     Cron     │───▶│  │  tRPC API + agent runtime          │  │
└──────────────┘    │  │  (prepareAgentRun → ToolLoopAgent) │  │
                    │  └─────────┬──────────────────────────┘  │
                    │            │                             │
                    │   ┌────────┼─────────┬──────────┐        │
                    │   ▼        ▼         ▼          ▼        │
                    │ Postgres  Redis  Anthropic   Composio    │
                    │ (pgvector)              + OpenAI emb.    │
                    └──────────────────────────────────────────┘
```

## Setup

1. `pnpm install`
2. Copy `.env.example` to `.env` and fill in every value (see env vars below)
3. Provision a Postgres database with the `pgvector` extension
4. `pnpm prisma db push` to apply the schema
5. `pnpm dev` to start the dev server on http://localhost:3000

For Telegram, point your bot's webhook at `<NEXT_PUBLIC_APP_URL>/api/telegram-webhook` with the `TELEGRAM_WEBHOOK_SECRET` as the secret token.

## Environment variables

See `.env.example` for the full list. At minimum you need: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `COMPOSIO_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `REDIS_URL`, `CRON_SECRET`, and the Telegram trio.

## Tech stack

- Next.js 15 (App Router) + React 19
- tRPC for all backend logic
- Better Auth (Google OAuth only)
- Prisma + Postgres + pgvector
- Vercel AI SDK + Anthropic Claude
- Composio SDK for tool integrations
- Tailwind CSS + shadcn/ui
- Redis (resumable streams)

## License

MIT — see [LICENSE](./LICENSE).
