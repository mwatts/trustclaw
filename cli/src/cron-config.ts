import { exec as _exec } from "child_process";
import { promisify } from "util";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import { spinner, log } from "@clack/prompts";

const exec = promisify(_exec);

// Hobby plan only allows daily crons. Pro+ allows arbitrary schedules.
const HOBBY_SCHEDULE = "0 0 * * *";
const PRO_SCHEDULE = "* * * * *";

// Hobby caps function execution at 60s. Pro+ allows up to 300s.
const HOBBY_MAX_DURATION = 60;
const PRO_MAX_DURATION = 300;

const ROUTE_FILES_WITH_MAX_DURATION = [
  "src/app/api/chat/route.ts",
  "src/app/api/cron/trustclaw/execute/route.ts",
  "src/app/api/telegram-webhook/route.ts",
];

interface VercelJson {
  crons?: Array<{ path: string; schedule: string }>;
  [key: string]: unknown;
}

async function rewriteCronSchedule(rootDir: string, schedule: string): Promise<boolean> {
  const vercelJsonPath = join(rootDir, "vercel.json");
  let raw: string;
  try {
    raw = await readFile(vercelJsonPath, "utf-8");
  } catch {
    return false;
  }
  const data = JSON.parse(raw) as VercelJson;
  if (!data.crons || data.crons.length === 0) return false;
  if (data.crons.every((c) => c.schedule === schedule)) return false;

  data.crons = data.crons.map((c) => ({ ...c, schedule }));
  await writeFile(vercelJsonPath, JSON.stringify(data, null, 2) + "\n", "utf-8");
  return true;
}

async function rewriteMaxDuration(rootDir: string, value: number): Promise<boolean> {
  let anyChanged = false;
  const re = /export const maxDuration = \d+;/;
  for (const rel of ROUTE_FILES_WITH_MAX_DURATION) {
    const path = join(rootDir, rel);
    let raw: string;
    try {
      raw = await readFile(path, "utf-8");
    } catch {
      continue;
    }
    const next = raw.replace(re, `export const maxDuration = ${value};`);
    if (next !== raw) {
      await writeFile(path, next, "utf-8");
      anyChanged = true;
    }
  }
  return anyChanged;
}

/**
 * Adjust plan-sensitive config (cron schedule + serverless function maxDuration)
 * to fit the user's Vercel plan, then commit so it lands in the pushed copy.
 * No-op when nothing actually needs to change.
 */
export async function applyPlanConfig(rootDir: string, plan: string): Promise<void> {
  const isHobby = plan === "hobby";
  const schedule = isHobby ? HOBBY_SCHEDULE : PRO_SCHEDULE;
  const maxDuration = isHobby ? HOBBY_MAX_DURATION : PRO_MAX_DURATION;

  const s = spinner();
  s.start(`Tuning config for ${plan} plan`);

  const cronChanged = await rewriteCronSchedule(rootDir, schedule);
  const durationChanged = await rewriteMaxDuration(rootDir, maxDuration);

  if (!cronChanged && !durationChanged) {
    s.stop(`Config already matches ${plan} plan`);
    return;
  }

  await exec("git add vercel.json src/app/api", { cwd: rootDir });
  const { stdout: staged } = await exec("git diff --cached --name-only", {
    cwd: rootDir,
  });
  if (!staged.trim()) {
    s.stop("Nothing to commit");
    return;
  }

  try {
    await exec(
      `git commit -m "chore: tune config for ${plan} plan (cron + maxDuration)"`,
      { cwd: rootDir },
    );
    s.stop(`Committed config for ${plan} plan`);
  } catch (err) {
    s.stop("Failed to commit config");
    log.warn(
      "Make sure git user.name and user.email are configured globally. " +
        "Run: git config --global user.name '...' && git config --global user.email '...'",
    );
    throw err;
  }
}

