import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { db } from "~/server/clients/db";
import { env } from "~/env";
import { getRedis } from "./clients/redis";
import { z } from "zod";

const rateLimitValueSchema = z.object({
  count: z.coerce.number(),
  lastRequest: z.coerce.number(),
});

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.NEXT_PUBLIC_APP_URL,
  trustedOrigins: [
    "https://trustclaw.app",
    "https://www.trustclaw.app",
    ...(env.NODE_ENV === "development" ? [env.NEXT_PUBLIC_APP_URL] : []),
  ],
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: { enabled: false },

  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },
  plugins: [nextCookies()],
  session: {
    expiresIn: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/social": {
        window: 10,
        max: 5,
      },
    },
    customStorage: {
      get: async (key) => {
        const redis = getRedis();
        const value = await redis.get(key);
        const parsedValue = value
          ? rateLimitValueSchema.parse(JSON.parse(value))
          : null;
        return {
          key,
          count: parsedValue?.count ?? 0,
          lastRequest: parsedValue?.lastRequest ?? 0,
        };
      },
      set: async (key, value) => {
        const redis = getRedis();
        await redis.set(key, JSON.stringify(value), "EX", 60);
      },
    },
  },
  advanced: {
    ipAddress: {
      ipAddressHeaders: ["x-forwarded-for", "x-real-ip"],
    },
  },
});

export type Session = typeof auth.$Infer.Session;
