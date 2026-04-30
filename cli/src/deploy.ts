import { intro, outro, note, cancel } from "@clack/prompts";
import { detectAuth } from "./auth.js";
import { gatherInputs } from "./inputs.js";
import { forkRepo } from "./github.js";
import { createVercelProject } from "./vercel.js";
import { provisionStores } from "./stores.js";
import { setEnvVars } from "./env-vars.js";
import { runMigration } from "./migrate.js";
import { triggerProductionDeploy } from "./trigger-deploy.js";

export async function deploy(): Promise<void> {
  console.clear();
  intro("trustclaw deploy");

  try {
    const auth = await detectAuth();
    const inputs = await gatherInputs(auth.githubUsername);

    const { repo } = await forkRepo(auth.githubToken, auth.githubUsername);

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

    note(`https://${result.url}`, "Deployment URL");
    outro("Visit the URL above to register your first user.");
  } catch (err) {
    cancel(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
