import { exec as _exec } from "child_process";
import { promisify } from "util";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import { spinner, log } from "@clack/prompts";

const exec = promisify(_exec);

// Hobby plan only allows daily crons. Pro+ allows arbitrary schedules.
const HOBBY_SCHEDULE = "0 0 * * *"; // once daily at midnight UTC
const PRO_SCHEDULE = "* * * * *"; // every minute

interface VercelJson {
  crons?: Array<{ path: string; schedule: string }>;
  [key: string]: unknown;
}

/**
 * Rewrite vercel.json's cron schedules to match the user's plan and commit
 * the change so it lands in the pushed copy. No-op if the file already matches.
 */
export async function applyCronScheduleForPlan(
  rootDir: string,
  plan: string,
): Promise<void> {
  const targetSchedule = plan === "hobby" ? HOBBY_SCHEDULE : PRO_SCHEDULE;
  const vercelJsonPath = join(rootDir, "vercel.json");

  let raw: string;
  try {
    raw = await readFile(vercelJsonPath, "utf-8");
  } catch {
    return; // no vercel.json — nothing to do
  }

  const data = JSON.parse(raw) as VercelJson;
  if (!data.crons || data.crons.length === 0) return;

  const needsChange = data.crons.some((c) => c.schedule !== targetSchedule);
  if (!needsChange) return;

  const s = spinner();
  s.start(`Setting cron schedule to "${targetSchedule}" (${plan} plan)`);

  data.crons = data.crons.map((c) => ({ ...c, schedule: targetSchedule }));
  await writeFile(vercelJsonPath, JSON.stringify(data, null, 2) + "\n", "utf-8");

  await exec("git add vercel.json", { cwd: rootDir });
  const { stdout: staged } = await exec("git diff --cached --name-only", {
    cwd: rootDir,
  });
  if (!staged.trim()) {
    s.stop("vercel.json already up to date");
    return;
  }

  try {
    await exec(
      `git commit -m "chore(cron): schedule for ${plan} plan"`,
      { cwd: rootDir },
    );
    s.stop(`Committed cron schedule for ${plan} plan`);
  } catch (err) {
    s.stop("Failed to commit cron schedule");
    log.warn(
      "Make sure git user.name and user.email are configured globally. " +
        "Run: git config --global user.name '...' && git config --global user.email '...'",
    );
    throw err;
  }
}
