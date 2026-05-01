import { exec as _exec } from "child_process";
import { promisify } from "util";
import { readFile } from "fs/promises";
import { homedir } from "os";
import { join } from "path";
import { log, spinner } from "@clack/prompts";

const exec = promisify(_exec);

export interface AuthResult {
  vercelToken: string;
  vercelTeamId: string | null;
  vercelOwnerSlug: string;
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

  throw new Error("No Vercel auth found. Run: pnpm dlx vercel login");
}

async function getGitHubToken(): Promise<{ token: string; username: string }> {
  try {
    const { stdout: token } = await exec("gh auth token");
    const { stdout: userJson } = await exec("gh api user --jq '.login'");
    return { token: token.trim(), username: userJson.trim() };
  } catch {
    throw new Error("No GitHub auth found. Run: gh auth login");
  }
}

export async function detectAuth(): Promise<AuthResult> {
  const s = spinner();
  s.start("Detecting authentication");

  let vercelToken: string;
  let githubToken: string;
  let githubUsername: string;
  try {
    vercelToken = await getVercelToken();
    const gh = await getGitHubToken();
    githubToken = gh.token;
    githubUsername = gh.username;
  } catch (err) {
    s.stop("Authentication detection failed");
    throw err;
  }

  const userRes = await fetch("https://api.vercel.com/v2/user", {
    headers: { Authorization: `Bearer ${vercelToken}` },
  });
  if (!userRes.ok) {
    s.stop("Vercel token invalid");
    throw new Error(`Vercel token invalid: ${userRes.status}`);
  }
  const userData = (await userRes.json()) as {
    user: { email: string; username: string; defaultTeamId?: string };
  };

  const teamId = userData.user.defaultTeamId ?? null;

  // The dashboard URL is scoped by team slug (or username for personal accounts).
  // Personal/Hobby accounts have a default team like "<username>-projects".
  let ownerSlug = userData.user.username;
  if (teamId) {
    try {
      const teamRes = await fetch(`https://api.vercel.com/v2/teams/${teamId}`, {
        headers: { Authorization: `Bearer ${vercelToken}` },
      });
      if (teamRes.ok) {
        const teamData = (await teamRes.json()) as { slug?: string };
        if (teamData.slug) ownerSlug = teamData.slug;
      }
    } catch {
      // fall back to username
    }
  }

  s.stop(`Authenticated as ${userData.user.email}`);
  log.success(`GitHub: ${githubUsername}`);

  return {
    vercelToken,
    vercelTeamId: teamId,
    vercelOwnerSlug: ownerSlug,
    githubToken,
    githubUsername,
  };
}
