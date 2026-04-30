import chalk from "chalk";
import { detectAuth } from "./auth.js";
import { gatherInputs } from "./inputs.js";
import { forkRepo } from "./github.js";
import { createVercelProject } from "./vercel.js";

export async function deploy(): Promise<void> {
  console.log(chalk.bold("\nDeploying trustclaw to Vercel\n"));

  const auth = await detectAuth();
  const inputs = await gatherInputs(auth.githubUsername);

  console.log(chalk.bold("Setting up repository..."));
  const { repo } = await forkRepo(auth.githubToken, auth.githubUsername);

  console.log(chalk.bold("\nSetting up Vercel project..."));
  const project = await createVercelProject({
    token: auth.vercelToken,
    teamId: auth.vercelTeamId,
    projectName: inputs.projectName,
    githubRepoSlug: repo,
    githubToken: auth.githubToken,
  });

  console.log(chalk.gray(`\n(stub — would set env vars + provision DB next)`));
  void project;
}
