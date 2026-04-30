import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),

    // Better Auth
    BETTER_AUTH_SECRET: z.string(),

    // Composio API (global key)
    COMPOSIO_API_KEY: z.string(),

    // Telegram bot
    TELEGRAM_BOT_TOKEN: z.string(),
    TELEGRAM_BOT_USERNAME: z.string(),
    TELEGRAM_WEBHOOK_SECRET: z.string(),

    // Database
    DATABASE_URL: z.string().url(),

    // Vercel cron (optional at build time, guarded at runtime in cron handlers)
    CRON_SECRET: z.string().min(1),

    // Anthropic
    ANTHROPIC_API_KEY: z.string(),

    // OpenAI (used for memory embeddings — text-embedding-3-large, 1024 dims)
    OPENAI_API_KEY: z.string(),

    // Redis (resumable streams, streaming state, abort flags)
    REDIS_URL: z.string(),

    GOOGLE_CLIENT_ID: z.string(),
    GOOGLE_CLIENT_SECRET: z.string(),

    // Composio Twitter toolkit auth config (NOT for sign-in)
    TWITTER_AUTH_CONFIG: z.string(),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url(),
  },
  runtimeEnv: {
    // Server
    NODE_ENV: process.env.NODE_ENV,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    COMPOSIO_API_KEY: process.env.COMPOSIO_API_KEY,
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_BOT_USERNAME: process.env.TELEGRAM_BOT_USERNAME,
    TELEGRAM_WEBHOOK_SECRET: process.env.TELEGRAM_WEBHOOK_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    CRON_SECRET: process.env.CRON_SECRET,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    REDIS_URL: process.env.REDIS_URL,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    TWITTER_AUTH_CONFIG: process.env.TWITTER_AUTH_CONFIG,

    // Client (in dev, derive from PORT so `PORT=3001 pnpm dev` just works)
    NEXT_PUBLIC_APP_URL:
      process.env.NODE_ENV === "development"
        ? `http://localhost:${process.env.PORT ?? "3000"}`
        : process.env.NEXT_PUBLIC_APP_URL,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
