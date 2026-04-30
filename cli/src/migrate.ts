import { exec as _exec } from "child_process";
import { promisify } from "util";
import { spinner } from "@clack/prompts";

const exec = promisify(_exec);

export async function runMigration(databaseUrl: string): Promise<void> {
  const s = spinner();
  s.start("Running database migration (prisma db push)");

  // Run prisma db push with the captured DATABASE_URL.
  // Requires the user to invoke `npx trustclaw deploy` from within their local clone
  // of the repo (so prisma is available). README quickstart documents this.

  try {
    await exec("pnpm prisma db push --accept-data-loss", {
      env: { ...process.env, DATABASE_URL: databaseUrl },
    });
    s.stop("Schema applied");
  } catch (err) {
    s.stop("Migration failed");
    throw err;
  }
}
