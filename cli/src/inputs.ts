import { text, password, confirm, isCancel, cancel } from "@clack/prompts";

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

  const composioApiKey = ensure(
    await password({
      message: "Composio API key (free at https://app.composio.dev — Settings → API keys)",
      validate: (v) => (v && v.length > 10 ? undefined : "Looks too short — should start with 'comp_'"),
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
