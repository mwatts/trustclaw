import {
  confirm,
  text,
  password,
  isCancel,
  cancel,
  log,
  note,
  spinner,
} from "@clack/prompts";
import open from "open";
import crypto from "crypto";

interface TelegramSetupArgs {
  vercelToken: string;
  vercelTeamId: string | null;
  projectId: string;
  deploymentUrl: string;
}

export async function maybeSetupTelegram(args: TelegramSetupArgs): Promise<boolean> {
  const wantsTelegram = await confirm({
    message: "Set up Telegram bot? (chat with your agent from your phone)",
    initialValue: false,
  });
  if (isCancel(wantsTelegram)) {
    cancel("Cancelled.");
    process.exit(0);
  }
  if (!wantsTelegram) {
    return false;
  }

  note(
    "1. Open Telegram and message @BotFather\n" +
      "2. Send /newbot and follow the prompts\n" +
      "3. @BotFather will give you a bot token (looks like: 1234:ABC...) and a username\n" +
      "4. Come back here with both",
    "Create a bot with @BotFather",
  );

  const openBotFather = await confirm({
    message: "Open @BotFather in your browser?",
    initialValue: true,
  });
  if (isCancel(openBotFather)) {
    cancel("Cancelled.");
    process.exit(0);
  }
  if (openBotFather) {
    await open("https://t.me/BotFather");
  }

  const botToken = await password({
    message: "Bot token from @BotFather",
    validate: (v) =>
      v && /^\d+:[A-Za-z0-9_-]+$/.test(v)
        ? undefined
        : "Should look like 1234567:ABC-DEF...",
  });
  if (isCancel(botToken)) {
    cancel("Cancelled.");
    process.exit(0);
  }

  const botUsername = await text({
    message: "Bot username (without the @)",
    validate: (v) =>
      v && /^[A-Za-z0-9_]{5,}$/.test(v) ? undefined : "Lowercase letters, numbers, underscores",
  });
  if (isCancel(botUsername)) {
    cancel("Cancelled.");
    process.exit(0);
  }

  const webhookSecret = crypto.randomBytes(24).toString("hex");

  const s1 = spinner();
  s1.start("Setting Telegram env vars on Vercel");
  await setVercelEnv(args, "TELEGRAM_BOT_TOKEN", botToken);
  await setVercelEnv(args, "TELEGRAM_BOT_USERNAME", botUsername);
  await setVercelEnv(args, "TELEGRAM_WEBHOOK_SECRET", webhookSecret);
  s1.stop("Telegram env vars set");

  const s2 = spinner();
  s2.start("Registering webhook with Telegram");
  const webhookUrl = `https://${args.deploymentUrl}/api/telegram-webhook`;
  const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: webhookSecret,
      allowed_updates: ["message", "edited_message"],
    }),
  });
  if (!tgRes.ok) {
    s2.stop("Webhook registration failed");
    const body = await tgRes.text();
    log.error(`Telegram API: ${body}`);
    log.warn(
      "You can register manually later with: " +
        `curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" -d "url=${webhookUrl}&secret_token=<SECRET>"`,
    );
    return true;
  }
  const tgData = (await tgRes.json()) as { ok: boolean; description?: string };
  if (!tgData.ok) {
    s2.stop("Webhook registration failed");
    log.error(tgData.description ?? "Unknown error from Telegram");
    return true;
  }
  s2.stop("Telegram webhook registered");

  log.info(
    "Note: env vars are set, but the running deployment may not have them yet. " +
      "Vercel will use them on the NEXT deploy. To force a redeploy now, push any commit or " +
      "use the Vercel dashboard's Redeploy button.",
  );

  return true;
}

async function setVercelEnv(
  args: TelegramSetupArgs,
  key: string,
  value: string,
): Promise<void> {
  const url = args.vercelTeamId
    ? `https://api.vercel.com/v10/projects/${args.projectId}/env?teamId=${args.vercelTeamId}`
    : `https://api.vercel.com/v10/projects/${args.projectId}/env`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.vercelToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      key,
      value,
      target: ["production", "preview", "development"],
      type: "encrypted",
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to set ${key}: ${res.status} ${body}`);
  }
}
