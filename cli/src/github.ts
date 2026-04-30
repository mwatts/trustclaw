import chalk from "chalk";

const SOURCE_REPO = "sarahsimionescu/trustclaw";

export async function forkRepo(token: string, username: string): Promise<{ repo: string }> {
  const targetRepo = `${username}/trustclaw`;

  // Check if fork already exists
  const checkRes = await fetch(`https://api.github.com/repos/${targetRepo}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
  });

  if (checkRes.ok) {
    console.log(chalk.green(`  ✓ Fork already exists: ${targetRepo}`));
    return { repo: targetRepo };
  }

  console.log(chalk.gray(`  Forking ${SOURCE_REPO} → ${targetRepo}...`));
  const forkRes = await fetch(`https://api.github.com/repos/${SOURCE_REPO}/forks`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
  });

  if (!forkRes.ok) {
    const body = await forkRes.text();
    throw new Error(`GitHub fork failed: ${forkRes.status} ${body}`);
  }

  console.log(chalk.green(`  ✓ Forked: ${targetRepo}`));
  return { repo: targetRepo };
}
