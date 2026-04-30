import chalk from "chalk";
import { detectAuth } from "./auth.js";
import { gatherInputs } from "./inputs.js";
import { forkRepo } from "./github.js";
import { createVercelProject } from "./vercel.js";
import { provisionStores } from "./stores.js";
import { setEnvVars } from "./env-vars.js";
import { runMigration } from "./migrate.js";
import { triggerProductionDeploy } from "./trigger-deploy.js";

export async function deploy(): Promise<void> {
  console.log(chalk.bold("\nDeploying trustclaw to Vercel\n"));

  const auth = await detectAuth();
  const inputs = await gatherInputs(auth.githubUsername);

  console.log(chalk.bold("\nSetting up repository..."));
  const { repo } = await forkRepo(auth.githubToken, auth.githubUsername);

  console.log(chalk.bold("\nSetting up Vercel project..."));
  const project = await createVercelProject({
    token: auth.vercelToken,
    teamId: auth.vercelTeamId,
    projectName: inputs.projectName,
    githubRepoSlug: repo,
    githubToken: auth.githubToken,
  });

  const stores = await provisionStores({
    token: auth.vercelToken,
    teamId: auth.vercelTeamId,
    projectId: project.id,
    enableRedis: inputs.enableRedis,
  });

  await setEnvVars({
    token: auth.vercelToken,
    teamId: auth.vercelTeamId,
    projectId: project.id,
    composioApiKey: inputs.composioApiKey,
  });

  await runMigration(stores.databaseUrl);

  const result = await triggerProductionDeploy({
    token: auth.vercelToken,
    teamId: auth.vercelTeamId,
    projectId: project.id,
    githubRepoSlug: repo,
  });

  console.log(chalk.bold("Done!"));
  console.log(chalk.gray(`Visit https://${result.url} to register your first user.\n`));
}
