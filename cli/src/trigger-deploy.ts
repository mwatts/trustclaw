import chalk from "chalk";

interface TriggerArgs {
  token: string;
  teamId: string | null;
  projectId: string;
  githubRepoSlug: string;
}

export async function triggerProductionDeploy(args: TriggerArgs): Promise<{ url: string }> {
  console.log(chalk.bold("\nTriggering production deployment..."));

  const url = args.teamId
    ? `https://api.vercel.com/v13/deployments?teamId=${args.teamId}`
    : `https://api.vercel.com/v13/deployments`;

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${args.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "trustclaw",
      target: "production",
      project: args.projectId,
      gitSource: {
        type: "github",
        repo: args.githubRepoSlug.split("/")[1],
        org: args.githubRepoSlug.split("/")[0],
        ref: "main",
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Deploy trigger failed: ${res.status} ${body}`);
  }

  const data = (await res.json()) as { url: string; readyState: string };
  console.log(chalk.green(`  ✓ Build queued`));
  console.log(chalk.bold(`\nDeployment URL: https://${data.url}\n`));
  return { url: data.url };
}
