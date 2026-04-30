# TrustClaw

A self-hostable personal AI agent. Talks to you on the web or Telegram, remembers what matters via pgvector memory, and uses [Composio](https://composio.dev/) tools to act on your connected accounts (Gmail, Slack, GitHub, Linear, etc.).

## Quick deploy to Vercel

```bash
git clone https://github.com/sarahsimionescu/trustclaw && cd trustclaw
pnpm install
pnpm dlx trustclaw deploy
```

The CLI prompts for a Composio API key (free at https://app.composio.dev), auto-generates secrets, provisions Postgres (and optionally Redis) via Vercel Marketplace, and deploys. You'll need:
- A [Vercel account](https://vercel.com) (run `pnpm dlx vercel login` once)
- A [GitHub account](https://github.com) (run `gh auth login` once)
- A free [Composio API key](https://app.composio.dev) (~30 sec signup)

## What it is

- Chat with Claude in a Next.js dashboard or via a Telegram bot
- Long-term memory backed by Postgres + pgvector (embeddings via Vercel AI Gateway)
- 3-layer context management (pruning, memory flush, summarization compaction) so conversations can run indefinitely
- Composio integrations gated by the user's connected accounts
- Cron-scheduled agent runs for recurring tasks
- Username/password login via Better Auth

## Architecture

```
┌──────────────┐    ┌──────────────────────────────────────────┐
│  Web (Next)  │───▶│             Next.js App                  │
│   Telegram   │───▶│  ┌────────────────────────────────────┐  │
│     Cron     │───▶│  │  tRPC API + agent runtime          │  │
└──────────────┘    │  │  (prepareAgentRun → ToolLoopAgent) │  │
                    │  └─────────┬──────────────────────────┘  │
                    │            │                              │
                    │   ┌────────┼─────────┬──────────┐        │
                    │   ▼        ▼         ▼          ▼        │
                    │ Postgres  Redis  AI Gateway  Composio    │
                    │ (pgvector)      (LLM + emb.)             │
                    └──────────────────────────────────────────┘
```

## Manual setup (local dev)

1. `pnpm install`
2. Copy `.env.example` to `.env` and fill in every value
3. Provision a Postgres database with the `pgvector` extension
4. `pnpm prisma db push` to apply the schema
5. `pnpm dev` to start the dev server on http://localhost:3000

For local AI Gateway access, run `vercel link` + `vercel env pull` to get an OIDC token, or set `AI_GATEWAY_API_KEY` manually.

For Telegram, point your bot's webhook at `<NEXT_PUBLIC_APP_URL>/api/telegram-webhook` with the `TELEGRAM_WEBHOOK_SECRET` as the secret token.

## Environment variables

See `.env.example` for the full list. At minimum you need: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `COMPOSIO_API_KEY`, and optionally the Telegram trio and `REDIS_URL`.

LLM and embedding calls route through Vercel AI Gateway — no Anthropic or OpenAI API keys required when deployed to Vercel.

## Tech stack

- Next.js 15 (App Router) + React 19
- tRPC for all backend logic
- Better Auth (username/password)
- Prisma + Postgres + pgvector
- Vercel AI SDK + AI Gateway (LLM + embeddings)
- Composio SDK for tool integrations
- Tailwind CSS + shadcn/ui
- Redis (resumable streams, optional)

## License

MIT — see [LICENSE](./LICENSE).
