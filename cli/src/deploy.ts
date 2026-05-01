import { intro, outro, note, cancel } from "@clack/prompts";
import { detectAuth } from "./auth.js";
import { gatherInputs } from "./inputs.js";
import { forkRepo } from "./github.js";
import {
  detectLocalRepo,
  confirmLocalPublish,
  publishLocalCopy,
} from "./local-repo.js";
import { applyCronScheduleForPlan } from "./cron-config.js";
import { createVercelProject } from "./vercel.js";
import { provisionStores } from "./stores.js";
import { setEnvVars } from "./env-vars.js";
import { runMigration } from "./migrate.js";
import { triggerProductionDeploy } from "./trigger-deploy.js";
import { maybeSetupTelegram } from "./telegram-setup.js";

export async function deploy(): Promise<void> {
  console.clear();
  intro("trustclaw deploy");

  try {
    const auth = await detectAuth();
    const inputs = await gatherInputs(auth.githubUsername);

    const localRepo = await detectLocalRepo();
    let repo: string;
    if (localRepo) {
      const choice = await confirmLocalPublish(localRepo);
      if (choice) {
        await applyCronScheduleForPlan(localRepo.rootDir, auth.vercelBillingPlan);
        ({ repo } = await publishLocalCopy({
          token: auth.githubToken,
          username: auth.githubUsername,
          repoName: choice.repoName,
          rootDir: localRepo.rootDir,
          currentBranch: localRepo.currentBranch,
        }));
      } else {
        ({ repo } = await forkRepo(auth.githubToken, auth.githubUsername));
      }
    } else {
      ({ repo } = await forkRepo(auth.githubToken, auth.githubUsername));
    }

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
      projectName: project.name,
      ownerSlug: auth.vercelOwnerSlug,
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

    await maybeSetupTelegram({
      vercelToken: auth.vercelToken,
      vercelTeamId: auth.vercelTeamId,
      projectId: project.id,
      deploymentUrl: result.url,
    });

    note(
      "Cron jobs are pre-configured in vercel.json and will run automatically once deploy completes.\n" +
        "View them in your Vercel dashboard under the project's Cron Jobs tab.",
      "Cron",
    );

    outro("Visit the deployment URL above to register your first user.");
  } catch (err) {
    cancel(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
