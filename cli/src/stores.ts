import chalk from "chalk";
import open from "open";
import prompts from "prompts";

interface ProvisionArgs {
  token: string;
  teamId: string | null;
  projectId: string;
}

interface ConnectionStrings {
  databaseUrl: string;
  redisUrl: string | null;
}

async function provisionPostgres(args: ProvisionArgs): Promise<string> {
  console.log(chalk.gray("  Provisioning Neon Postgres via Vercel Marketplace..."));

  const url = args.teamId
    ? `https://api.vercel.com/v1/storage/stores?teamId=${args.teamId}`
    : `https://api.vercel.com/v1/storage/stores`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "postgres",
      name: "trustclaw-postgres",
      projectId: args.projectId,
    }),
  });

  if (!res.ok) {
    console.log(
      chalk.yellow(
        "  Auto-provisioning unavailable; opening Vercel Storage in your browser...",
      ),
    );
    await open("https://vercel.com/dashboard/stores");
    const { connectionString } = await prompts({
      type: "password",
      name: "connectionString",
      message: "Paste the DATABASE_URL from the new Postgres store",
      validate: (v: string) =>
        v.startsWith("postgres") || "Should start with postgres://",
    });
    return connectionString as string;
  }

  const data = (await res.json()) as { connectionString: string };
  console.log(chalk.green("  ✓ Postgres provisioned"));
  return data.connectionString;
}

async function provisionRedis(args: ProvisionArgs): Promise<string> {
  console.log(chalk.gray("  Provisioning Upstash Redis via Vercel Marketplace..."));

  const url = args.teamId
    ? `https://api.vercel.com/v1/storage/stores?teamId=${args.teamId}`
    : `https://api.vercel.com/v1/storage/stores`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "redis",
      name: "trustclaw-redis",
      projectId: args.projectId,
    }),
  });

  if (!res.ok) {
    console.log(
      chalk.yellow(
        "  Auto-provisioning unavailable; opening Vercel Storage in your browser...",
      ),
    );
    await open("https://vercel.com/dashboard/stores");
    const { connectionString } = await prompts({
      type: "password",
      name: "connectionString",
      message: "Paste the REDIS_URL from the new Redis store",
      validate: (v: string) =>
        v.startsWith("redis") ? true : "Should start with redis://",
    });
    return connectionString as string;
  }

  const data = (await res.json()) as { connectionString: string };
  console.log(chalk.green("  ✓ Redis provisioned"));
  return data.connectionString;
}

export async function provisionStores(
  args: ProvisionArgs & { enableRedis: boolean },
): Promise<ConnectionStrings> {
  const databaseUrl = await provisionPostgres(args);
  const redisUrl = args.enableRedis ? await provisionRedis(args) : null;
  return { databaseUrl, redisUrl };
}
