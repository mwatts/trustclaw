import chalk from "chalk";
import { detectAuth } from "./auth.js";

export async function deploy(): Promise<void> {
  console.log(chalk.bold("\nDeploying trustclaw to Vercel\n"));
  const auth = await detectAuth();
  console.log(chalk.gray(`(stub — auth detected, more steps in next task)`));
  void auth;
}
