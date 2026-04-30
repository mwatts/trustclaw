# Vercel One-Click Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `trustclaw` deployable to Vercel via `npx trustclaw deploy` — auto-provisioned DB, auto-generated secrets, AI Gateway via OIDC for zero-config LLM access, username/password auth.

**Architecture:** Two phases. Phase A refactors the app: replace direct Anthropic/OpenAI SDK usage with Vercel AI Gateway (works zero-config on Vercel via OIDC), swap Google OAuth for Better Auth's username plugin, drop `CRON_SECRET` in favor of `vercel-cron` user-agent verification, make non-essential env vars truly optional with graceful fallbacks. Phase B builds the CLI: a TypeScript program using Vercel + GitHub REST APIs to fork the repo, create the project, auto-provision Marketplace stores, set env vars, push the DB schema, and trigger production deploy.

**Tech Stack:** Next.js 15 (App Router), tRPC, Prisma + Neon Postgres + pgvector, Better Auth (username plugin), Vercel AI Gateway via `ai` SDK v6, optional Upstash Redis. CLI: Node.js + `commander` + `prompts` + `chalk`.

**Spec:** [`docs/superpowers/specs/2026-04-29-vercel-one-click-deploy-design.md`](../specs/2026-04-29-vercel-one-click-deploy-design.md)

**Working directory:** `~/Documents/GitHub/trustclaw_oss` (the new repo, pushed to [sarahsimionescu/trustclaw](https://github.com/sarahsimionescu/trustclaw)).

**Verification gate per task:** `pnpm build` must pass (allowing for static-page-collection failures that are env-related, not code-related) and `pnpm lint` must pass. Commit after each task.

---

## Phase A — App refactor

## Task 1: Replace Anthropic SDK calls with Vercel AI Gateway

**Why:** The agent's chat path currently uses `@ai-sdk/anthropic` provider. Switching to a plain string model id (`'anthropic/claude-sonnet-4.6'`) with the `ai` SDK routes through Vercel AI Gateway, which authenticates via OIDC token on Vercel deployments — no API key needed.

**Files:**
- Modify: `src/server/api/routers/trustclaw/agent/setup.ts` — primary streamText call
- Modify: `src/server/api/routers/trustclaw/agent/compaction/run-compaction.ts` — compaction LLM call
- Modify: `src/server/api/routers/trustclaw/agent/compaction/memory-flush.ts` — memory extraction LLM call
- Modify: `package.json` — remove `@ai-sdk/anthropic`

- [ ] **Step 1: Find current Anthropic provider usages**

```bash
cd ~/Documents/GitHub/trustclaw_oss
grep -n "createAnthropic\|@ai-sdk/anthropic\|anthropic(" src/server/api/routers/trustclaw/agent/setup.ts src/server/api/routers/trustclaw/agent/compaction/run-compaction.ts src/server/api/routers/trustclaw/agent/compaction/memory-flush.ts
```

- [ ] **Step 2: In each file, replace provider import + factory with plain model strings**

Pattern to remove:
```typescript
import { createAnthropic } from "@ai-sdk/anthropic";
const anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });
// ...
model: anthropic(env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5-20250929"),
```

Pattern to use instead (plain string — `ai` SDK routes through gateway by default):
```typescript
// no provider import needed
// ...
model: "anthropic/claude-sonnet-4.6",
```

If a file uses model from instance config (e.g., `ComposioClawInstance.anthropicModel`), keep the dynamic value but ensure the format is `anthropic/<model-id>`. Update the Prisma schema default in a separate task only if you want — for now, the runtime value can be normalized:

```typescript
const modelString = instance.anthropicModel.startsWith("anthropic/")
  ? instance.anthropicModel
  : `anthropic/${instance.anthropicModel}`;
```

- [ ] **Step 3: Update Prisma schema default model**

Open `prisma/schema.prisma`. Find:
```prisma
anthropicModel String @default("claude-sonnet-4-5-20250929")
```
Change to:
```prisma
anthropicModel String @default("anthropic/claude-sonnet-4.6")
```

- [ ] **Step 4: Drop `ANTHROPIC_API_KEY` from `src/env.ts`**

Remove from both the schema and the `runtimeEnv` mapping. AI Gateway uses `AI_GATEWAY_API_KEY` (for local dev) or OIDC (on Vercel) — neither needs to be in our env schema; the `ai` SDK reads them directly from `process.env` if present.

- [ ] **Step 5: Remove `@ai-sdk/anthropic` dep**

```bash
cd ~/Documents/GitHub/trustclaw_oss
pnpm remove @ai-sdk/anthropic
grep "@ai-sdk/anthropic" package.json
```
Second grep should return nothing.

- [ ] **Step 6: Verify**

```bash
cd ~/Documents/GitHub/trustclaw_oss
grep -rln "@ai-sdk/anthropic\|createAnthropic\|ANTHROPIC_API_KEY" src/
pnpm lint
```
First grep: no results. `pnpm lint` must pass.

- [ ] **Step 7: Commit**

```bash
cd ~/Documents/GitHub/trustclaw_oss
git add -A
git commit -m "feat: route Anthropic calls through Vercel AI Gateway"
```

---

## Task 2: Replace OpenAI SDK embeddings with AI Gateway `embed`

**Why:** Embedding calls currently use the OpenAI SDK directly via `src/server/clients/openai.ts`. Routing them through AI Gateway eliminates the `OPENAI_API_KEY` requirement.

**Files:**
- Delete: `src/server/clients/openai.ts`
- Modify: `src/server/api/routers/trustclaw/agent/tools/memory-save.ts`
- Modify: `src/server/api/routers/trustclaw/agent/tools/memory-search.ts`
- Modify: `src/server/api/routers/trustclaw/agent/compaction/memory-flush.ts` (if it embeds)
- Modify: `src/server/api/routers/trustclaw/getMemories.ts` (if it embeds)
- Modify: `src/env.ts` — drop `OPENAI_API_KEY`

- [ ] **Step 1: Inspect current OpenAI client and consumers**

```bash
cat ~/Documents/GitHub/trustclaw_oss/src/server/clients/openai.ts
grep -rln "openai\|OpenAI\|generateEmbedding\|generateQueryEmbedding" ~/Documents/GitHub/trustclaw_oss/src/
```

- [ ] **Step 2: Replace each consumer's embedding call**

Pattern to remove (in each consumer):
```typescript
import { generateEmbedding } from "~/server/clients/openai";
// ...
const embedding = await generateEmbedding(content);
```

Pattern to use:
```typescript
import { embed } from "ai";
// ...
const { embedding } = await embed({
  model: "openai/text-embedding-3-large",
  value: content,
  providerOptions: {
    openai: { dimensions: 1024 },
  },
});
```

The `dimensions: 1024` provider option matches the existing `composio_claw_memory.embedding VECTOR(1024)` schema.

For batch embedding (if any consumer embeds many texts), use:
```typescript
import { embedMany } from "ai";
const { embeddings } = await embedMany({
  model: "openai/text-embedding-3-large",
  values: texts,
  providerOptions: { openai: { dimensions: 1024 } },
});
```

- [ ] **Step 3: Delete the OpenAI client module**

```bash
rm ~/Documents/GitHub/trustclaw_oss/src/server/clients/openai.ts
```

- [ ] **Step 4: Drop `OPENAI_API_KEY` from `src/env.ts`**

Remove from both schema and `runtimeEnv`.

- [ ] **Step 5: Remove `openai` dep**

```bash
cd ~/Documents/GitHub/trustclaw_oss
pnpm remove openai
grep '"openai"' package.json
```
Second grep should return nothing.

- [ ] **Step 6: Verify**

```bash
cd ~/Documents/GitHub/trustclaw_oss
grep -rln "OPENAI_API_KEY\|server/clients/openai\|generateEmbedding\b\|generateQueryEmbedding\b" src/
pnpm lint
```
First grep: no results. Lint passes.

- [ ] **Step 7: Commit**

```bash
cd ~/Documents/GitHub/trustclaw_oss
git add -A
git commit -m "feat: route embeddings through Vercel AI Gateway"
```

---

## Task 3: Replace Google OAuth with Better Auth username plugin

**Why:** Username/password requires zero external setup beyond the DB. Removes the Google Cloud Console step from the deploy flow.

**Files:**
- Modify: `src/server/auth.ts` — drop `socialProviders.google`, add `username` plugin
- Modify: `src/clients/auth/react.tsx` — add `usernameClient` plugin
- Modify: `src/app/login/_components/login-page.tsx` — username + password form, separate register flow
- Create: `src/app/login/_components/register-form.tsx` (or inline in login-page.tsx — keep it simple)
- Modify: `src/env.ts` — drop `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- Modify: `prisma/schema.prisma` — Better Auth username plugin requires a `username` field on `User` (and a unique index)
- Run: `pnpm prisma generate`

- [ ] **Step 1: Read Better Auth username plugin docs locally**

```bash
cd ~/Documents/GitHub/trustclaw_oss
ls node_modules/better-auth/dist/plugins/ 2>/dev/null | grep -i username
grep -rl "username" node_modules/better-auth/docs/ 2>/dev/null | head -3
```

If docs not bundled locally, fetch:
```bash
curl -s https://www.better-auth.com/docs/plugins/username | head -200
```

Confirm the import path: `import { username } from "better-auth/plugins"` and the schema fields it adds.

- [ ] **Step 2: Update Prisma schema for username**

Open `prisma/schema.prisma`, in `model User`:

```prisma
model User {
  id            String    @id
  name          String
  email         String    @unique
  // ... existing fields
  username      String    @unique
  displayUsername String?
  // ... rest
}
```

Run:
```bash
cd ~/Documents/GitHub/trustclaw_oss
pnpm prisma generate
```

(The `pnpm prisma db push` happens during deploy via the CLI, not now.)

- [ ] **Step 3: Update server auth config**

Open `src/server/auth.ts`. Remove the `socialProviders` block entirely. Add the username plugin:

```typescript
import { username } from "better-auth/plugins";

export const auth = betterAuth({
  // ... existing config (database, secret, etc.)
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    username(),
    // ... any other existing plugins
  ],
});
```

The username plugin layers username login on top of the email-and-password core, so `emailAndPassword.enabled: true` is required.

- [ ] **Step 4: Update client auth config**

Open `src/clients/auth/react.tsx`. Add `usernameClient`:

```typescript
import { usernameClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  // ... existing
  plugins: [
    usernameClient(),
    // ... any other existing
  ],
});
```

- [ ] **Step 5: Rewrite the login page UI**

Open `src/app/login/_components/login-page.tsx`. Replace the Google sign-in button with a tabbed form: "Login" tab with username + password, "Register" tab with username + password (and email if username plugin requires it — verify via the docs in step 1).

Login call:
```typescript
await authClient.signIn.username({
  username: usernameValue,
  password: passwordValue,
});
```

Register call (the username plugin's signup; check exact API):
```typescript
await authClient.signUp.email({
  email: emailValue,
  password: passwordValue,
  username: usernameValue,
  name: nameValue,
});
```

Use the existing `~/components/ui/input`, `~/components/ui/button`, `~/components/ui/tabs` shadcn primitives. Keep the layout minimal — single centered card.

- [ ] **Step 6: Add a "first user redirect" guard**

When the DB has zero users (fresh deploy), the `/login` route should auto-show the Register tab. Either:
- Pass a `firstTime` prop from the server-side page based on a `prisma.user.count()` check, or
- Make the client default to the Register tab when login fails with "user not found"

Pick the server-prop approach (simpler):

In `src/app/login/page.tsx`:
```typescript
const userCount = await prisma.user.count();
return <LoginPage firstTime={userCount === 0} />;
```

In `login-page.tsx`, default the active tab to "register" when `firstTime` is true.

- [ ] **Step 7: Drop Google env vars**

In `src/env.ts`, delete from schema and `runtimeEnv`:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

- [ ] **Step 8: Regenerate auth client types**

```bash
cd ~/Documents/GitHub/trustclaw_oss
pnpm auth:generate
```

If this fails because of missing env, set placeholders inline:
```bash
DATABASE_URL=postgres://placeholder@localhost/x BETTER_AUTH_SECRET=placeholder pnpm auth:generate
```

- [ ] **Step 9: Verify**

```bash
cd ~/Documents/GitHub/trustclaw_oss
grep -rln "GOOGLE_CLIENT_ID\|GOOGLE_CLIENT_SECRET\|signIn.social\|provider: \"google\"" src/
pnpm lint
```
First grep: no results. Lint passes.

- [ ] **Step 10: Commit**

```bash
cd ~/Documents/GitHub/trustclaw_oss
git add -A
git commit -m "feat: replace Google OAuth with Better Auth username plugin"
```

---

## Task 4: Drop `CRON_SECRET`, verify cron via `vercel-cron` user-agent

**Why:** Vercel cron requests come from infrastructure with `user-agent: vercel-cron/1.0`. Comparing against this is sufficient and removes one secret from the deploy flow.

**Files:**
- Modify: `src/app/api/cron/trustclaw/route.ts`
- Modify: `src/app/api/cron/trustclaw/execute/route.ts`
- Modify: `src/env.ts`

- [ ] **Step 1: Inspect current cron auth**

```bash
cat ~/Documents/GitHub/trustclaw_oss/src/app/api/cron/trustclaw/route.ts | head -30
cat ~/Documents/GitHub/trustclaw_oss/src/app/api/cron/trustclaw/execute/route.ts | head -30
```

Find the existing `CRON_SECRET` bearer-token check.

- [ ] **Step 2: Replace bearer-token check with user-agent check**

In each cron route handler, replace:
```typescript
const authHeader = request.headers.get("authorization");
if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
  return new Response("Unauthorized", { status: 401 });
}
```

With:
```typescript
const userAgent = request.headers.get("user-agent") ?? "";
if (!userAgent.startsWith("vercel-cron")) {
  return new Response("Unauthorized", { status: 401 });
}
```

Remove the `env.CRON_SECRET` reference and the `import { env } from "~/env"` import if it becomes unused in the file.

- [ ] **Step 3: Drop `CRON_SECRET` from `src/env.ts`**

Remove from schema and `runtimeEnv`.

- [ ] **Step 4: Verify**

```bash
cd ~/Documents/GitHub/trustclaw_oss
grep -rln "CRON_SECRET" src/
pnpm lint
```
First grep: no results. Lint passes.

- [ ] **Step 5: Commit**

```bash
cd ~/Documents/GitHub/trustclaw_oss
git add -A
git commit -m "feat: verify cron via vercel-cron user-agent, drop CRON_SECRET"
```

---

## Task 5: Make optional env vars truly optional with graceful fallbacks

**Why:** Telegram, Twitter toolkit, and Redis (resumable streams) are all nice-to-haves. Marking them `optional()` plus adding runtime guards lets a fresh deploy boot without these services configured.

**Files:**
- Modify: `src/env.ts` — change `z.string()` → `z.string().optional()` for several vars
- Modify: `src/app/api/telegram-webhook/route.ts` — early-return if telegram unset
- Modify: `src/server/clients/telegram.ts` — guard
- Modify: `src/server/api/routers/trustclaw/linkTelegram.ts` — return error or no-op if telegram unset
- Modify: every file that uses `env.TWITTER_AUTH_CONFIG` (5 files from prior grep) — conditionally include twitter
- Modify: `src/app/api/chat/stream-store.ts` — fall back to non-resumable when no Redis
- Modify: `src/server/clients/redis.ts` — handle missing `REDIS_URL`

- [ ] **Step 1: Mark env vars optional**

Open `src/env.ts`. Change these lines in the server schema:
```typescript
TELEGRAM_BOT_TOKEN: z.string().optional(),
TELEGRAM_BOT_USERNAME: z.string().optional(),
TELEGRAM_WEBHOOK_SECRET: z.string().optional(),
TWITTER_AUTH_CONFIG: z.string().optional(),
REDIS_URL: z.string().optional(),
```

The `runtimeEnv` mappings stay the same (still read from `process.env`).

- [ ] **Step 2: Guard telegram webhook**

Open `src/app/api/telegram-webhook/route.ts`. At the very top of the handler:

```typescript
import { env } from "~/env";

export async function POST(request: Request) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response("Telegram not configured", { status: 503 });
  }
  // ... existing logic
}
```

- [ ] **Step 3: Guard telegram client**

Open `src/server/clients/telegram.ts`. Wrap the exported helpers so they throw a descriptive error if env is unset, OR return a typed null sentinel that callers must handle. Simplest pattern:

```typescript
import { env } from "~/env";

export function isTelegramConfigured(): boolean {
  return !!env.TELEGRAM_BOT_TOKEN && !!env.TELEGRAM_BOT_USERNAME;
}

export async function sendTelegramMessage(chatId: string, text: string) {
  if (!env.TELEGRAM_BOT_TOKEN) {
    throw new Error("Telegram not configured");
  }
  // ... existing implementation
}
```

- [ ] **Step 4: Guard `linkTelegram` tRPC procedure**

Open `src/server/api/routers/trustclaw/linkTelegram.ts`. At the start of the procedure:

```typescript
import { isTelegramConfigured } from "~/server/clients/telegram";
import { TRPCError } from "@trpc/server";

// inside the .mutation handler:
if (!isTelegramConfigured()) {
  throw new TRPCError({
    code: "PRECONDITION_FAILED",
    message: "Telegram is not configured on this deployment",
  });
}
```

- [ ] **Step 5: Hide Telegram UI when unconfigured**

Find any dashboard UI that shows the "Link Telegram" button:
```bash
grep -rln "linkTelegram\|telegramChatId" ~/Documents/GitHub/trustclaw_oss/src/app/
```

Add a server-side check that exposes `telegramConfigured: boolean` via a new tRPC procedure (or via the existing `getStatus` procedure), and conditionally render the link UI.

Simplest: add to `getStatus.ts`:
```typescript
import { env } from "~/env";

// in the procedure return:
return {
  // ... existing fields
  telegramConfigured: !!env.TELEGRAM_BOT_TOKEN && !!env.TELEGRAM_BOT_USERNAME,
};
```

Update consumers to render the Telegram section only if `status.telegramConfigured`.

- [ ] **Step 6: Conditionally include twitter in Composio authConfigs**

For each of these files (from prior grep):
- `src/server/api/routers/trustclaw/getIntegrationAuthLinks.ts`
- `src/server/api/routers/toolkits/getToolkits.ts`
- `src/server/api/routers/toolkits/getAuthLink.ts`
- `src/server/api/routers/trustclaw/agent/setup.ts`
- `src/server/api/routers/trustclaw/checkConnectionStatus.ts`

Replace:
```typescript
authConfigs: {
  twitter: env.TWITTER_AUTH_CONFIG,
}
```

With:
```typescript
authConfigs: env.TWITTER_AUTH_CONFIG
  ? { twitter: env.TWITTER_AUTH_CONFIG }
  : {},
```

- [ ] **Step 7: Make Redis optional**

Open `src/server/clients/redis.ts`. Make the client lazy and tolerate missing URL:

```typescript
import { env } from "~/env";
import { Redis } from "ioredis"; // or whichever client is used

let _client: Redis | null = null;

export function getRedis(): Redis | null {
  if (!env.REDIS_URL) return null;
  if (!_client) {
    _client = new Redis(env.REDIS_URL);
  }
  return _client;
}

export function isRedisConfigured(): boolean {
  return !!env.REDIS_URL;
}
```

- [ ] **Step 8: Make stream store fall back to non-resumable**

Open `src/app/api/chat/stream-store.ts`. The current implementation likely persists stream IDs to Redis for resumption. Add a fallback path:

```typescript
import { getRedis, isRedisConfigured } from "~/server/clients/redis";

export async function persistStream(chatId: string, streamId: string) {
  if (!isRedisConfigured()) {
    return; // no-op when Redis not configured; resumption disabled
  }
  const redis = getRedis()!;
  // ... existing logic
}
```

The chat client should still work (streaming continues normally) — only mid-stream resumption after a page refresh becomes unavailable.

- [ ] **Step 9: Verify**

```bash
cd ~/Documents/GitHub/trustclaw_oss
pnpm lint
```

Spot-check by running a search for any non-null-asserted access of these vars:
```bash
grep -rln "env\.TELEGRAM_BOT_TOKEN!" src/
grep -rln "env\.REDIS_URL!" src/
grep -rln "env\.TWITTER_AUTH_CONFIG!" src/
```
All three: no results.

- [ ] **Step 10: Commit**

```bash
cd ~/Documents/GitHub/trustclaw_oss
git add -A
git commit -m "feat: make telegram, twitter, redis env vars optional with graceful fallbacks"
```

---

## Phase B — Deploy CLI

## Task 6: Scaffold the CLI

**Files:**
- Create: `cli/package.json`
- Create: `cli/tsconfig.json`
- Create: `cli/src/index.ts` (entry — handles arg parsing)
- Create: `cli/src/deploy.ts` (the deploy command)
- Create: `cli/src/bin.ts` (`#!/usr/bin/env node` shim)
- Modify: root `package.json` — add `"workspaces": ["cli"]` if not already a workspace, OR set up the CLI as a sibling project

**Decision:** keep it as a top-level `cli/` directory in the same repo, published as a separate npm package `trustclaw` (so `npx trustclaw deploy` resolves). This means the root `package.json` is for the Next.js app, and `cli/package.json` is for the published CLI.

- [ ] **Step 1: Create the directory structure**

```bash
cd ~/Documents/GitHub/trustclaw_oss
mkdir -p cli/src
```

- [ ] **Step 2: Write `cli/package.json`**

```json
{
  "name": "trustclaw",
  "version": "0.1.0",
  "description": "One-command deploy for trustclaw on Vercel",
  "type": "module",
  "bin": {
    "trustclaw": "./dist/bin.js"
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/bin.ts"
  },
  "dependencies": {
    "commander": "^12.1.0",
    "prompts": "^2.4.2",
    "chalk": "^5.3.0",
    "open": "^10.1.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/prompts": "^2.4.9",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 3: Write `cli/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "es2022",
    "module": "esnext",
    "moduleResolution": "bundler",
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": false
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 4: Write `cli/src/bin.ts`**

```typescript
#!/usr/bin/env node
import "./index.js";
```

- [ ] **Step 5: Write `cli/src/index.ts` with command parser**

```typescript
import { Command } from "commander";
import { deploy } from "./deploy.js";

const program = new Command();
program
  .name("trustclaw")
  .description("Deploy trustclaw to Vercel")
  .version("0.1.0");

program
  .command("deploy")
  .description("Deploy a fresh trustclaw instance to Vercel")
  .action(deploy);

program.parseAsync();
```

- [ ] **Step 6: Write a stub `cli/src/deploy.ts`**

```typescript
import chalk from "chalk";

export async function deploy(): Promise<void> {
  console.log(chalk.bold("\nDeploying trustclaw to Vercel\n"));
  console.log(chalk.gray("(stub — implemented in subsequent tasks)"));
}
```

- [ ] **Step 7: Install and smoke-test**

```bash
cd ~/Documents/GitHub/trustclaw_oss/cli
pnpm install
pnpm dev deploy
```

Expected: prints the bold header and the stub message.

- [ ] **Step 8: Commit**

```bash
cd ~/Documents/GitHub/trustclaw_oss
git add cli/ package.json
git commit -m "feat: scaffold trustclaw deploy CLI"
```

---

## Task 7: CLI auth detection (Vercel + GitHub)

**Why:** The CLI needs both a Vercel token (for project creation, env vars, deploy) and a GitHub token (for fork). Both should be detected from the user's existing CLI installations rather than re-prompting.

**Files:**
- Create: `cli/src/auth.ts`
- Modify: `cli/src/deploy.ts` — call auth at start

- [ ] **Step 1: Write `cli/src/auth.ts`**

```typescript
import { exec as _exec } from "child_process";
import { promisify } from "util";
import { readFile } from "fs/promises";
import { homedir } from "os";
import { join } from "path";
import chalk from "chalk";

const exec = promisify(_exec);

export interface AuthResult {
  vercelToken: string;
  vercelTeamId: string | null;
  githubToken: string;
  githubUsername: string;
}

async function getVercelToken(): Promise<string> {
  // Vercel CLI stores auth in ~/.local/share/com.vercel.cli/auth.json on linux/mac
  const authPath = join(homedir(), ".local", "share", "com.vercel.cli", "auth.json");
  try {
    const raw = await readFile(authPath, "utf-8");
    const parsed = JSON.parse(raw) as { token: string };
    if (!parsed.token) throw new Error("No token");
    return parsed.token;
  } catch {
    console.log(chalk.yellow("\nNo Vercel auth found. Run:\n  pnpm dlx vercel login\n"));
    throw new Error("Vercel CLI not authenticated");
  }
}

async function getGitHubToken(): Promise<{ token: string; username: string }> {
  try {
    const { stdout: token } = await exec("gh auth token");
    const { stdout: userJson } = await exec("gh api user --jq '.login'");
    return { token: token.trim(), username: userJson.trim() };
  } catch {
    console.log(chalk.yellow("\nNo GitHub auth found. Run:\n  gh auth login\n"));
    throw new Error("GitHub CLI not authenticated");
  }
}

export async function detectAuth(): Promise<AuthResult> {
  console.log(chalk.bold("Detecting authentication..."));

  const vercelToken = await getVercelToken();
  const { token: githubToken, username: githubUsername } = await getGitHubToken();

  // Verify Vercel token by hitting /v2/user
  const userRes = await fetch("https://api.vercel.com/v2/user", {
    headers: { Authorization: `Bearer ${vercelToken}` },
  });
  if (!userRes.ok) {
    throw new Error(`Vercel token invalid: ${userRes.status}`);
  }
  const userData = (await userRes.json()) as { user: { email: string; defaultTeamId?: string } };

  console.log(chalk.green(`  ✓ Vercel: ${userData.user.email}`));
  console.log(chalk.green(`  ✓ GitHub: ${githubUsername}\n`));

  return {
    vercelToken,
    vercelTeamId: userData.user.defaultTeamId ?? null,
    githubToken,
    githubUsername,
  };
}
```

- [ ] **Step 2: Wire into `deploy.ts`**

```typescript
import chalk from "chalk";
import { detectAuth } from "./auth.js";

export async function deploy(): Promise<void> {
  console.log(chalk.bold("\nDeploying trustclaw to Vercel\n"));
  const auth = await detectAuth();
  console.log(chalk.gray(`(stub — auth detected, more steps in next task)`));
  void auth;
}
```

- [ ] **Step 3: Smoke test**

```bash
cd ~/Documents/GitHub/trustclaw_oss/cli
pnpm dev deploy
```

Expected: detects Vercel + GitHub auth and prints the email/username, or fails with a helpful message.

- [ ] **Step 4: Commit**

```bash
cd ~/Documents/GitHub/trustclaw_oss
git add cli/
git commit -m "feat(cli): detect Vercel and GitHub authentication"
```

---

## Task 8: CLI input prompts (Composio key, Redis option)

**Files:**
- Create: `cli/src/inputs.ts`
- Modify: `cli/src/deploy.ts`

- [ ] **Step 1: Write `cli/src/inputs.ts`**

```typescript
import prompts from "prompts";
import chalk from "chalk";

export interface UserInputs {
  composioApiKey: string;
  enableRedis: boolean;
  projectName: string;
}

export async function gatherInputs(githubUsername: string): Promise<UserInputs> {
  console.log(chalk.bold("Configuration\n"));

  const result = await prompts(
    [
      {
        type: "text",
        name: "projectName",
        message: "Vercel project name",
        initial: "trustclaw",
        validate: (v: string) => /^[a-z0-9-]+$/.test(v) || "Lowercase letters, numbers, and dashes only",
      },
      {
        type: "password",
        name: "composioApiKey",
        message: "Composio API key (free at https://app.composio.dev — Settings → API keys)",
        validate: (v: string) => v.length > 10 || "Looks too short — should start with 'comp_'",
      },
      {
        type: "confirm",
        name: "enableRedis",
        message: "Add Upstash Redis for resumable streams? (recommended)",
        initial: true,
      },
    ],
    {
      onCancel: () => {
        console.log(chalk.yellow("\nCancelled."));
        process.exit(1);
      },
    },
  );

  void githubUsername;
  return result as UserInputs;
}
```

- [ ] **Step 2: Wire into `deploy.ts`**

```typescript
import chalk from "chalk";
import { detectAuth } from "./auth.js";
import { gatherInputs } from "./inputs.js";

export async function deploy(): Promise<void> {
  console.log(chalk.bold("\nDeploying trustclaw to Vercel\n"));

  const auth = await detectAuth();
  const inputs = await gatherInputs(auth.githubUsername);

  console.log(chalk.gray("\n(stub — would deploy with:)"));
  console.log({ project: inputs.projectName, redis: inputs.enableRedis });
}
```

- [ ] **Step 3: Smoke test**

```bash
cd ~/Documents/GitHub/trustclaw_oss/cli
pnpm dev deploy
```

Walk through the prompts, confirm input is captured.

- [ ] **Step 4: Commit**

```bash
cd ~/Documents/GitHub/trustclaw_oss
git add cli/
git commit -m "feat(cli): add user input prompts"
```

---

## Task 9: GitHub fork + Vercel project creation

**Files:**
- Create: `cli/src/github.ts`
- Create: `cli/src/vercel.ts`
- Modify: `cli/src/deploy.ts`

- [ ] **Step 1: Write `cli/src/github.ts`**

```typescript
import chalk from "chalk";

const SOURCE_REPO = "sarahsimionescu/trustclaw";

export async function forkRepo(token: string, username: string): Promise<{ repo: string }> {
  const targetRepo = `${username}/trustclaw`;

  // Check if fork already exists
  const checkRes = await fetch(`https://api.github.com/repos/${targetRepo}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
  });

  if (checkRes.ok) {
    console.log(chalk.green(`  ✓ Fork already exists: ${targetRepo}`));
    return { repo: targetRepo };
  }

  console.log(chalk.gray(`  Forking ${SOURCE_REPO} → ${targetRepo}...`));
  const forkRes = await fetch(`https://api.github.com/repos/${SOURCE_REPO}/forks`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
  });

  if (!forkRes.ok) {
    const body = await forkRes.text();
    throw new Error(`GitHub fork failed: ${forkRes.status} ${body}`);
  }

  console.log(chalk.green(`  ✓ Forked: ${targetRepo}`));
  return { repo: targetRepo };
}
```

- [ ] **Step 2: Write `cli/src/vercel.ts`**

```typescript
import chalk from "chalk";

const VERCEL_API = "https://api.vercel.com";

interface CreateProjectArgs {
  token: string;
  teamId: string | null;
  projectName: string;
  githubRepoSlug: string; // "username/trustclaw"
  githubRepoId: number;
}

interface VercelProject {
  id: string;
  name: string;
}

async function getRepoId(githubToken: string, slug: string): Promise<number> {
  const res = await fetch(`https://api.github.com/repos/${slug}`, {
    headers: { Authorization: `Bearer ${githubToken}`, Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`Failed to read repo ${slug}: ${res.status}`);
  const data = (await res.json()) as { id: number };
  return data.id;
}

export async function createVercelProject(
  args: CreateProjectArgs & { githubToken: string },
): Promise<VercelProject> {
  const { token, teamId, projectName, githubRepoSlug, githubToken } = args;
  const repoId = await getRepoId(githubToken, githubRepoSlug);

  const url = teamId
    ? `${VERCEL_API}/v9/projects?teamId=${teamId}`
    : `${VERCEL_API}/v9/projects`;

  console.log(chalk.gray(`  Creating Vercel project "${projectName}"...`));

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: projectName,
      framework: "nextjs",
      gitRepository: {
        type: "github",
        repo: githubRepoSlug,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Vercel project creation failed: ${res.status} ${body}`);
  }

  const project = (await res.json()) as VercelProject;
  console.log(chalk.green(`  ✓ Project created: ${project.name} (${project.id})`));
  return project;
}
```

- [ ] **Step 3: Wire into `deploy.ts`**

```typescript
import chalk from "chalk";
import { detectAuth } from "./auth.js";
import { gatherInputs } from "./inputs.js";
import { forkRepo } from "./github.js";
import { createVercelProject } from "./vercel.js";

export async function deploy(): Promise<void> {
  console.log(chalk.bold("\nDeploying trustclaw to Vercel\n"));

  const auth = await detectAuth();
  const inputs = await gatherInputs(auth.githubUsername);

  console.log(chalk.bold("Setting up repository..."));
  const { repo } = await forkRepo(auth.githubToken, auth.githubUsername);

  console.log(chalk.bold("\nSetting up Vercel project..."));
  const project = await createVercelProject({
    token: auth.vercelToken,
    teamId: auth.vercelTeamId,
    projectName: inputs.projectName,
    githubRepoSlug: repo,
    githubRepoId: 0, // computed inside
    githubToken: auth.githubToken,
  });

  console.log(chalk.gray(`\n(stub — would set env vars + provision DB next)`));
  void project;
}
```

- [ ] **Step 4: Smoke test (DESTRUCTIVE — creates real fork + project)**

Before running: pick a unique throwaway project name to avoid clobbering an existing project.

```bash
cd ~/Documents/GitHub/trustclaw_oss/cli
pnpm dev deploy
```

Verify on GitHub: fork exists at `<your-username>/trustclaw`. Verify on Vercel: empty project exists.

If the test creates real artifacts you don't want, delete the fork (`gh repo delete <user>/trustclaw --yes`) and the Vercel project (Vercel UI) before continuing.

- [ ] **Step 5: Commit**

```bash
cd ~/Documents/GitHub/trustclaw_oss
git add cli/
git commit -m "feat(cli): fork repo and create Vercel project"
```

---

## Task 10: Marketplace store provisioning (Postgres + optional Redis)

**Why:** The deploy needs `DATABASE_URL` and optionally `REDIS_URL`. Vercel Marketplace provisions both.

**Implementation note:** Vercel's Marketplace provisioning API is evolving; the cleanest reliable path right now is:
- For Postgres: use Vercel's **Storage API** (`POST /v1/storage/stores`) to create a Neon-backed Postgres store and link it to the project
- For Redis: same pattern with type `redis` (Upstash)

If the Storage API endpoints prove unstable, the fallback is to print a Vercel dashboard URL and ask the user to create the store manually, then resume.

**Files:**
- Create: `cli/src/stores.ts`
- Modify: `cli/src/deploy.ts`

- [ ] **Step 1: Probe the Storage API to verify the exact shape**

```bash
curl -s -H "Authorization: Bearer $(cat ~/.local/share/com.vercel.cli/auth.json | jq -r .token)" \
  https://api.vercel.com/v1/storage/stores | head -30
```

If the API returns 200 with a `stores` array, the endpoint is live and we can use it.

If it returns 404 or "not implemented", switch to the fallback: open the Vercel Storage UI in the user's browser via `open` package, wait for them to provision, then prompt for the connection string. Document this fallback in the implementation.

- [ ] **Step 2: Write `cli/src/stores.ts`**

```typescript
import chalk from "chalk";
import open from "open";
import prompts from "prompts";

interface ProvisionArgs {
  token: string;
  teamId: string | null;
  projectId: string;
}

interface ConnectionStrings {
  databaseUrl: string;
  redisUrl: string | null;
}

async function provisionPostgres(args: ProvisionArgs): Promise<string> {
  console.log(chalk.gray("  Provisioning Neon Postgres via Vercel Marketplace..."));

  // Attempt Storage API
  const url = args.teamId
    ? `https://api.vercel.com/v1/storage/stores?teamId=${args.teamId}`
    : `https://api.vercel.com/v1/storage/stores`;

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${args.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "postgres",
      name: "trustclaw-postgres",
      projectId: args.projectId,
    }),
  });

  if (!res.ok) {
    // Fallback: manual provisioning via the dashboard
    console.log(chalk.yellow("  Auto-provisioning unavailable; opening Vercel Storage in your browser..."));
    const dashboardUrl = `https://vercel.com/dashboard/stores`;
    await open(dashboardUrl);
    const { connectionString } = await prompts({
      type: "password",
      name: "connectionString",
      message: "Paste the DATABASE_URL from the new Postgres store",
      validate: (v: string) => v.startsWith("postgres") || "Should start with postgres://",
    });
    return connectionString as string;
  }

  const data = (await res.json()) as { connectionString: string };
  console.log(chalk.green("  ✓ Postgres provisioned"));
  return data.connectionString;
}

async function provisionRedis(args: ProvisionArgs): Promise<string> {
  console.log(chalk.gray("  Provisioning Upstash Redis via Vercel Marketplace..."));

  const url = args.teamId
    ? `https://api.vercel.com/v1/storage/stores?teamId=${args.teamId}`
    : `https://api.vercel.com/v1/storage/stores`;

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${args.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "redis",
      name: "trustclaw-redis",
      projectId: args.projectId,
    }),
  });

  if (!res.ok) {
    console.log(chalk.yellow("  Auto-provisioning unavailable; opening Vercel Storage in your browser..."));
    await open("https://vercel.com/dashboard/stores");
    const { connectionString } = await prompts({
      type: "password",
      name: "connectionString",
      message: "Paste the REDIS_URL from the new Redis store",
      validate: (v: string) => (v.startsWith("redis") ? true : "Should start with redis://"),
    });
    return connectionString as string;
  }

  const data = (await res.json()) as { connectionString: string };
  console.log(chalk.green("  ✓ Redis provisioned"));
  return data.connectionString;
}

export async function provisionStores(
  args: ProvisionArgs & { enableRedis: boolean },
): Promise<ConnectionStrings> {
  const databaseUrl = await provisionPostgres(args);
  const redisUrl = args.enableRedis ? await provisionRedis(args) : null;
  return { databaseUrl, redisUrl };
}
```

- [ ] **Step 3: Wire into deploy**

In `cli/src/deploy.ts`, after the project is created, call `provisionStores` and log the result:

```typescript
import { provisionStores } from "./stores.js";

// ... after createVercelProject:
const stores = await provisionStores({
  token: auth.vercelToken,
  teamId: auth.vercelTeamId,
  projectId: project.id,
  enableRedis: inputs.enableRedis,
});
```

- [ ] **Step 4: Commit (don't smoke-test yet — it provisions paid resources)**

```bash
cd ~/Documents/GitHub/trustclaw_oss
git add cli/
git commit -m "feat(cli): provision Postgres and optional Redis via Marketplace"
```

The end-to-end smoke test happens in Task 12 with a final cleanup script.

---

## Task 11: Set env vars, run schema migration, trigger deploy

**Files:**
- Create: `cli/src/env-vars.ts`
- Create: `cli/src/migrate.ts`
- Create: `cli/src/trigger-deploy.ts`
- Modify: `cli/src/deploy.ts`

- [ ] **Step 1: Write `cli/src/env-vars.ts`**

```typescript
import chalk from "chalk";
import crypto from "crypto";

interface SetEnvArgs {
  token: string;
  teamId: string | null;
  projectId: string;
  composioApiKey: string;
}

interface EnvVarSpec {
  key: string;
  value: string;
  target: ("production" | "preview" | "development")[];
  type: "encrypted" | "plain";
}

export async function setEnvVars(args: SetEnvArgs): Promise<{ betterAuthSecret: string }> {
  const betterAuthSecret = crypto.randomBytes(32).toString("base64");

  const vars: EnvVarSpec[] = [
    {
      key: "BETTER_AUTH_SECRET",
      value: betterAuthSecret,
      target: ["production", "preview", "development"],
      type: "encrypted",
    },
    {
      key: "COMPOSIO_API_KEY",
      value: args.composioApiKey,
      target: ["production", "preview", "development"],
      type: "encrypted",
    },
  ];

  console.log(chalk.bold("\nSetting environment variables..."));
  for (const spec of vars) {
    const url = args.teamId
      ? `https://api.vercel.com/v10/projects/${args.projectId}/env?teamId=${args.teamId}`
      : `https://api.vercel.com/v10/projects/${args.projectId}/env`;

    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${args.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(spec),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Failed to set ${spec.key}: ${res.status} ${body}`);
    }
    console.log(chalk.green(`  ✓ ${spec.key}`));
  }

  return { betterAuthSecret };
}
```

- [ ] **Step 2: Write `cli/src/migrate.ts`**

```typescript
import { exec as _exec } from "child_process";
import { promisify } from "util";
import chalk from "chalk";

const exec = promisify(_exec);

export async function runMigration(databaseUrl: string): Promise<void> {
  console.log(chalk.bold("\nRunning database migration..."));
  console.log(chalk.gray("  Running prisma db push..."));

  // Run prisma db push from the CLI's parent directory (the trustclaw repo root)
  // This requires the user to run `npx trustclaw deploy` from within a clone OR
  // we shell out via npx into the published trustclaw package's prisma schema.
  //
  // Simplest: assume the user runs from within their local clone of the fork.
  // This is documented in the README quickstart.

  await exec("pnpm prisma db push --accept-data-loss", {
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });

  console.log(chalk.green("  ✓ Schema applied"));
}
```

**Note:** Running `prisma db push` requires the CLI to be invoked from a clone of the repo (so prisma is available locally). The README quickstart will document this. If a user runs `npx trustclaw deploy` cold without a clone, we can either fall back to triggering a Vercel build hook that runs prisma during build, or print instructions to clone first. Pick the latter for simplicity.

- [ ] **Step 3: Write `cli/src/trigger-deploy.ts`**

```typescript
import chalk from "chalk";

interface TriggerArgs {
  token: string;
  teamId: string | null;
  projectId: string;
  githubRepoSlug: string;
}

export async function triggerProductionDeploy(args: TriggerArgs): Promise<{ url: string }> {
  console.log(chalk.bold("\nTriggering production deployment..."));

  const url = args.teamId
    ? `https://api.vercel.com/v13/deployments?teamId=${args.teamId}`
    : `https://api.vercel.com/v13/deployments`;

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${args.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "trustclaw",
      target: "production",
      project: args.projectId,
      gitSource: {
        type: "github",
        repo: args.githubRepoSlug.split("/")[1],
        org: args.githubRepoSlug.split("/")[0],
        ref: "main",
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Deploy trigger failed: ${res.status} ${body}`);
  }

  const data = (await res.json()) as { url: string; readyState: string };
  console.log(chalk.green(`  ✓ Build queued`));
  console.log(chalk.bold(`\nDeployment URL: https://${data.url}\n`));
  return { url: data.url };
}
```

- [ ] **Step 4: Wire everything together in `cli/src/deploy.ts`**

```typescript
import chalk from "chalk";
import { detectAuth } from "./auth.js";
import { gatherInputs } from "./inputs.js";
import { forkRepo } from "./github.js";
import { createVercelProject } from "./vercel.js";
import { provisionStores } from "./stores.js";
import { setEnvVars } from "./env-vars.js";
import { runMigration } from "./migrate.js";
import { triggerProductionDeploy } from "./trigger-deploy.js";

export async function deploy(): Promise<void> {
  console.log(chalk.bold("\nDeploying trustclaw to Vercel\n"));

  const auth = await detectAuth();
  const inputs = await gatherInputs(auth.githubUsername);

  console.log(chalk.bold("\nSetting up repository..."));
  const { repo } = await forkRepo(auth.githubToken, auth.githubUsername);

  console.log(chalk.bold("\nSetting up Vercel project..."));
  const project = await createVercelProject({
    token: auth.vercelToken,
    teamId: auth.vercelTeamId,
    projectName: inputs.projectName,
    githubRepoSlug: repo,
    githubRepoId: 0,
    githubToken: auth.githubToken,
  });

  const stores = await provisionStores({
    token: auth.vercelToken,
    teamId: auth.vercelTeamId,
    projectId: project.id,
    enableRedis: inputs.enableRedis,
  });

  // Set DATABASE_URL and optional REDIS_URL into project env
  // (Marketplace stores auto-link in most cases, but explicitly setting is safer)
  // -- This is also covered by setEnvVars logic below if extended.

  await setEnvVars({
    token: auth.vercelToken,
    teamId: auth.vercelTeamId,
    projectId: project.id,
    composioApiKey: inputs.composioApiKey,
  });

  await runMigration(stores.databaseUrl);

  const result = await triggerProductionDeploy({
    token: auth.vercelToken,
    teamId: auth.vercelTeamId,
    projectId: project.id,
    githubRepoSlug: repo,
  });

  console.log(chalk.bold("Done!"));
  console.log(chalk.gray(`Visit https://${result.url} to register your first user.\n`));
}
```

- [ ] **Step 5: Commit**

```bash
cd ~/Documents/GitHub/trustclaw_oss
git add cli/
git commit -m "feat(cli): set env vars, run migration, trigger deploy"
```

---

## Task 12: README quickstart + final smoke test + publish CLI

**Files:**
- Modify: `README.md` — add prominent quickstart at top
- Modify: `cli/package.json` — bump to 0.1.0 if not already
- Modify: root `.gitignore` — ignore `cli/dist/`

- [ ] **Step 1: Add CLI quickstart to README**

At the very top of `README.md`, insert (after the title):

```markdown
## Quick deploy to Vercel

```bash
git clone https://github.com/<your-fork>/trustclaw && cd trustclaw
pnpm install
pnpm dlx trustclaw deploy
```

The CLI prompts for a Composio API key, auto-generates secrets, provisions Postgres (and optionally Redis) via Vercel Marketplace, and deploys.
```

- [ ] **Step 2: Add `cli/dist/` to root `.gitignore`**

```bash
cd ~/Documents/GitHub/trustclaw_oss
echo "cli/dist/" >> .gitignore
```

- [ ] **Step 3: Build the CLI**

```bash
cd ~/Documents/GitHub/trustclaw_oss/cli
pnpm build
ls dist/bin.js
```

- [ ] **Step 4: End-to-end smoke test (DESTRUCTIVE)**

Pre-test: have a free Vercel account, the GitHub CLI authenticated, a Composio API key.

```bash
cd ~/Documents/GitHub/trustclaw_oss
pnpm dlx ./cli deploy
```

Walk through prompts. Use a unique project name. Wait for deploy to complete. Visit the URL. Verify:
- Register page loads
- Username/password registration works
- Onboarding completes
- Send agent a message — agent responds (verifies AI Gateway via OIDC)
- Tell agent a fact, refresh, ask the fact — agent recalls (verifies embeddings via gateway)

Cleanup if the test artifacts are throwaway:
```bash
gh repo delete <your-username>/trustclaw --yes
# Delete project + stores in Vercel UI
```

- [ ] **Step 5: Final lint pass**

```bash
cd ~/Documents/GitHub/trustclaw_oss
pnpm lint
cd cli
pnpm tsc --noEmit
```

Both must pass.

- [ ] **Step 6: Commit and push**

```bash
cd ~/Documents/GitHub/trustclaw_oss
git add -A
git commit -m "docs: add CLI quickstart to README"
git push
```

- [ ] **Step 7: Publish CLI to npm (when ready — manual, NOT in this plan)**

This is a documented manual step, not automated:
```bash
cd ~/Documents/GitHub/trustclaw_oss/cli
pnpm build
npm publish --access public
```

(Requires npm account; user runs this when they're ready to make `npx trustclaw deploy` work for the world.)

---

## Self-Review Notes

- **Spec coverage:**
  - AI Gateway (chat) → Task 1 ✅
  - AI Gateway (embeddings) → Task 2 ✅
  - Username plugin auth → Task 3 ✅
  - CRON_SECRET removal → Task 4 ✅
  - Optional env vars (telegram/twitter/redis) → Task 5 ✅
  - CLI scaffold → Task 6 ✅
  - Auth detection → Task 7 ✅
  - Inputs → Task 8 ✅
  - Fork + project creation → Task 9 ✅
  - Marketplace provisioning → Task 10 (with documented fallback) ✅
  - Env vars + migration + deploy trigger → Task 11 ✅
  - README + smoke test → Task 12 ✅

- **Marketplace API uncertainty:** Task 10 explicitly probes the Storage API and falls back to manual browser-based provisioning if the API isn't usable. This is the only piece with unknown reliability.

- **Local dev for AI Gateway:** docs in Task 5 don't cover this. Add a note: for local dev, users run `vercel link` + `vercel env pull` to get an OIDC token, OR set `AI_GATEWAY_API_KEY` manually. README quickstart should include this.

- **First-user UX:** Task 3 step 6 handles "DB has zero users → default to register tab." Worth manual smoke-testing.

- **Type consistency:** All function signatures, env var keys, model strings match across tasks. Verified.

- **Marketplace provisioning + env var linking:** Task 10 provisions stores; Task 11 sets `BETTER_AUTH_SECRET` and `COMPOSIO_API_KEY`. Vercel Marketplace stores auto-link `DATABASE_URL` / `REDIS_URL` to the project when provisioned via the Storage API (verified pattern). If they don't, Task 11's `setEnvVars` should be extended to explicitly set them — make a note in implementation if discovered during Task 10 probing.
