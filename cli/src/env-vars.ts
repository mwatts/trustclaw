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
