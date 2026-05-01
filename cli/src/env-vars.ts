import { spinner } from "@clack/prompts";
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

  const s = spinner();
  s.start("Setting environment variables");

  for (const spec of vars) {
    const url = args.teamId
      ? `https://api.vercel.com/v10/projects/${args.projectId}/env?teamId=${args.teamId}&upsert=true`
      : `https://api.vercel.com/v10/projects/${args.projectId}/env?upsert=true`;

    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${args.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(spec),
    });

    if (!res.ok) {
      const body = await res.text();
      s.stop(`Failed to set ${spec.key}`);
      throw new Error(`Failed to set ${spec.key}: ${res.status} ${body}`);
    }
  }

  s.stop("Environment variables set");
  return { betterAuthSecret };
}
