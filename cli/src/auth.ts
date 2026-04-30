import { exec as _exec } from "child_process";
import { promisify } from "util";
import { readFile } from "fs/promises";
import { homedir } from "os";
import { join } from "path";
import chalk from "chalk";

const exec = promisify(_exec);

export interface AuthResult {
  vercelToken: string;
  vercelTeamId: string | null;
  githubToken: string;
  githubUsername: string;
}

async function getVercelToken(): Promise<string> {
  const home = homedir();
  const candidates =
    process.platform === "darwin"
      ? [
          join(home, "Library", "Application Support", "com.vercel.cli", "auth.json"),
          join(home, ".local", "share", "com.vercel.cli", "auth.json"),
        ]
      : [
          join(home, ".local", "share", "com.vercel.cli", "auth.json"),
          join(home, "Library", "Application Support", "com.vercel.cli", "auth.json"),
        ];

  for (const authPath of candidates) {
    try {
      const raw = await readFile(authPath, "utf-8");
      const parsed = JSON.parse(raw) as { token: string };
      if (parsed.token) return parsed.token;
    } catch {
      // try next candidate
    }
  }

  console.log(chalk.yellow("\nNo Vercel auth found. Run:\n  pnpm dlx vercel login\n"));
  throw new Error("Vercel CLI not authenticated");
}

async function getGitHubToken(): Promise<{ token: string; username: string }> {
  try {
    const { stdout: token } = await exec("gh auth token");
    const { stdout: userJson } = await exec("gh api user --jq '.login'");
    return { token: token.trim(), username: userJson.trim() };
  } catch {
    console.log(chalk.yellow("\nNo GitHub auth found. Run:\n  gh auth login\n"));
    throw new Error("GitHub CLI not authenticated");
  }
}

export async function detectAuth(): Promise<AuthResult> {
  console.log(chalk.bold("Detecting authentication..."));

  const vercelToken = await getVercelToken();
  const { token: githubToken, username: githubUsername } = await getGitHubToken();

  const userRes = await fetch("https://api.vercel.com/v2/user", {
    headers: { Authorization: `Bearer ${vercelToken}` },
  });
  if (!userRes.ok) {
    throw new Error(`Vercel token invalid: ${userRes.status}`);
  }
  const userData = (await userRes.json()) as { user: { email: string; defaultTeamId?: string } };

  console.log(chalk.green(`  ✓ Vercel: ${userData.user.email}`));
  console.log(chalk.green(`  ✓ GitHub: ${githubUsername}\n`));

  return {
    vercelToken,
    vercelTeamId: userData.user.defaultTeamId ?? null,
    githubToken,
    githubUsername,
  };
}
