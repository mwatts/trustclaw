import { exec as _exec } from "child_process";
import { promisify } from "util";
import chalk from "chalk";

const exec = promisify(_exec);

export async function runMigration(databaseUrl: string): Promise<void> {
  console.log(chalk.bold("\nRunning database migration..."));
  console.log(chalk.gray("  Running prisma db push..."));

  // Run prisma db push with the captured DATABASE_URL.
  // Requires the user to invoke `npx trustclaw deploy` from within their local clone
  // of the repo (so prisma is available). README quickstart documents this.

  await exec("pnpm prisma db push --accept-data-loss", {
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });

  console.log(chalk.green("  ✓ Schema applied"));
}
