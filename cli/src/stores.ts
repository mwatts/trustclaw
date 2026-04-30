import { spinner, password, log, isCancel, cancel } from "@clack/prompts";
import open from "open";

interface ProvisionArgs {
  token: string;
  teamId: string | null;
  projectId: string;
}

interface ConnectionStrings {
  databaseUrl: string;
  redisUrl: string | null;
}

function ensure<T>(value: T | symbol): T {
  if (isCancel(value)) {
    cancel("Cancelled.");
    process.exit(0);
  }
  return value as T;
}

async function provisionPostgres(args: ProvisionArgs): Promise<string> {
  const s = spinner();
  s.start("Provisioning Neon Postgres via Vercel Marketplace");

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
    s.stop("Auto-provisioning unavailable; opening Vercel Storage");
    log.info("Click 'Create' on Postgres in your browser, then paste the connection string back here.");
    await open("https://vercel.com/dashboard/stores");

    const connectionString = ensure(
      await password({
        message: "Paste the DATABASE_URL from the new Postgres store",
        validate: (v) => (v && v.startsWith("postgres") ? undefined : "Should start with postgres://"),
      }),
    );
    return connectionString;
  }

  const data = (await res.json()) as { connectionString: string };
  s.stop("Postgres provisioned");
  return data.connectionString;
}

async function provisionRedis(args: ProvisionArgs): Promise<string> {
  const s = spinner();
  s.start("Provisioning Upstash Redis via Vercel Marketplace");

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
    s.stop("Auto-provisioning unavailable; opening Vercel Storage");
    log.info("Click 'Create' on Redis in your browser, then paste the connection string back here.");
    await open("https://vercel.com/dashboard/stores");

    const connectionString = ensure(
      await password({
        message: "Paste the REDIS_URL from the new Redis store",
        validate: (v) => (v && v.startsWith("redis") ? undefined : "Should start with redis://"),
      }),
    );
    return connectionString;
  }

  const data = (await res.json()) as { connectionString: string };
  s.stop("Redis provisioned");
  return data.connectionString;
}

export async function provisionStores(
  args: ProvisionArgs & { enableRedis: boolean },
): Promise<ConnectionStrings> {
  const databaseUrl = await provisionPostgres(args);
  const redisUrl = args.enableRedis ? await provisionRedis(args) : null;
  return { databaseUrl, redisUrl };
}
