import { text, password, confirm, isCancel, cancel, note } from "@clack/prompts";
import open from "open";

const COMPOSIO_DASHBOARD_URL =
  "https://dashboard.composio.dev/login?flow=developer";

export interface UserInputs {
  composioApiKey: string;
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

export async function gatherInputs(githubUsername: string): Promise<UserInputs> {
  void githubUsername;

  const projectName = ensure(
    await text({
      message: "Vercel project name",
      initialValue: "trustclaw",
      validate: (v) =>
        v && /^[a-z0-9-]+$/.test(v) ? undefined : "Lowercase letters, numbers, and dashes only",
    }),
  );

  note(
    `Opening ${COMPOSIO_DASHBOARD_URL} — sign in (free), then grab your API key from Settings → API keys.`,
    "Composio",
  );
  await open(COMPOSIO_DASHBOARD_URL).catch(() => {
    // If the browser fails to open (e.g. headless env), the user can still copy the URL above.
  });

  const composioApiKey = ensure(
    await password({
      message: "Composio API key",
      validate: (v) =>
        v && v.length > 10 ? undefined : "Looks too short — should start with 'comp_'",
    }),
  );

  const enableRedis = ensure(
    await confirm({
      message: "Add Upstash Redis for resumable streams? (recommended)",
      initialValue: true,
    }),
  );

  return { projectName, composioApiKey, enableRedis };
}
