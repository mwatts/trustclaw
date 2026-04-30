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
