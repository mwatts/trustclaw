import { randomBytes } from "crypto";
import { TRPCError } from "@trpc/server";
import { protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/clients/db";
import { env } from "~/env";

const LINK_TOKEN_TTL_MS = 15 * 60 * 1000;

export const linkTelegram = protectedProcedure.mutation(async ({ ctx }) => {
  const userId = ctx.session.user.id;

  return db.$transaction(async (tx) => {
    const instance = await tx.composioClawInstance.findUnique({
      where: { userId },
      select: {
        id: true,
        telegramLinkToken: true,
        telegramLinkTokenExpiresAt: true,
        telegramChatId: true,
      },
    });

    if (!instance) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No TrustClaw by Composio instance found. Create one first.",
      });
    }

    if (instance.telegramChatId) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Telegram is already linked",
      });
    }

    const hasValidToken =
      instance.telegramLinkToken &&
      instance.telegramLinkTokenExpiresAt &&
      instance.telegramLinkTokenExpiresAt > new Date();

    if (hasValidToken) {
      return {
        token: instance.telegramLinkToken,
        botUsername: env.TELEGRAM_BOT_USERNAME,
        expiresAt: instance.telegramLinkTokenExpiresAt,
      };
    }

    const token = randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + LINK_TOKEN_TTL_MS);

    await tx.composioClawInstance.update({
      where: { id: instance.id },
      data: {
        telegramLinkToken: token,
        telegramLinkTokenExpiresAt: expiresAt,
      },
    });

    return {
      token,
      botUsername: env.TELEGRAM_BOT_USERNAME,
      expiresAt,
    };
  });
});
