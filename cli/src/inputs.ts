import { text, password, confirm, isCancel, cancel, note, log } from "@clack/prompts";
import open from "open";

const COMPOSIO_DASHBOARD_URL =
  "https://dashboard.composio.dev/login?next=%2F~%2Fproject%2Fsettings%2Fapi-keys&flow=developer";

export interface UserInputs {
  // null = reuse the existing key already on the Vercel project.
  composioApiKey: string | null;
  enableRedis: boolean;
  projectName: string;
}

function ensure<T>(value: T | symbol): T {
  if (isCancel(value)) {
    cancel("Cancelled.");
    process.exit(0);
  }
  return value as T;
}

export async function askProjectName(): Promise<string> {
  return ensure(
    await text({
      message: "Vercel project name",
      initialValue: "trustclaw",
      validate: (v) =>
        v && /^[a-z0-9-]+$/.test(v)
          ? undefined
          : "Lowercase letters, numbers, and dashes only",
    }),
  );
}

interface RemainingInputsArgs {
  existingEnvKeys: Set<string>;
}

export async function gatherRemainingInputs(
  args: RemainingInputsArgs,
): Promise<{ composioApiKey: string | null; enableRedis: boolean }> {
  let composioApiKey: string | null = null;
  if (args.existingEnvKeys.has("COMPOSIO_API_KEY")) {
    log.info("COMPOSIO_API_KEY already set on the project — reusing.");
  } else {
    note(
      `Opening Composio — sign in (free), then copy your API key from the page.`,
      "Composio",
    );
    await open(COMPOSIO_DASHBOARD_URL).catch(() => {
      // Headless env — the URL was printed above for manual copy.
    });
    composioApiKey = ensure(
      await password({
        message: "Composio API key",
        validate: (v) =>
          v && v.length > 10 ? undefined : "Looks too short — should start with 'comp_'",
      }),
    );
  }

  let enableRedis: boolean;
  if (
    args.existingEnvKeys.has("REDIS_URL") ||
    args.existingEnvKeys.has("KV_URL")
  ) {
    log.info("Redis already connected to the project — reusing.");
    enableRedis = true;
  } else {
    enableRedis = ensure(
      await confirm({
        message: "Add Upstash Redis for resumable streams? (recommended)",
        initialValue: true,
      }),
    );
  }

  return { composioApiKey, enableRedis };
}
