import chalk from "chalk";
import { detectAuth } from "./auth.js";
import { gatherInputs } from "./inputs.js";

export async function deploy(): Promise<void> {
  console.log(chalk.bold("\nDeploying trustclaw to Vercel\n"));

  const auth = await detectAuth();
  const inputs = await gatherInputs(auth.githubUsername);

  console.log(chalk.gray("\n(stub — would deploy with:)"));
  console.log({ project: inputs.projectName, redis: inputs.enableRedis });
}
