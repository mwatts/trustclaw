import chalk from "chalk";

const VERCEL_API = "https://api.vercel.com";

interface CreateProjectArgs {
  token: string;
  teamId: string | null;
  projectName: string;
  githubRepoSlug: string; // "username/trustclaw"
  githubToken: string;
}

interface VercelProject {
  id: string;
  name: string;
}

async function getRepoId(githubToken: string, slug: string): Promise<number> {
  const res = await fetch(`https://api.github.com/repos/${slug}`, {
    headers: { Authorization: `Bearer ${githubToken}`, Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`Failed to read repo ${slug}: ${res.status}`);
  const data = (await res.json()) as { id: number };
  return data.id;
}

export async function createVercelProject(args: CreateProjectArgs): Promise<VercelProject> {
  const { token, teamId, projectName, githubRepoSlug, githubToken } = args;
  void (await getRepoId(githubToken, githubRepoSlug)); // sanity check the repo is accessible

  const url = teamId
    ? `${VERCEL_API}/v9/projects?teamId=${teamId}`
    : `${VERCEL_API}/v9/projects`;

  console.log(chalk.gray(`  Creating Vercel project "${projectName}"...`));

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: projectName,
      framework: "nextjs",
      gitRepository: {
        type: "github",
        repo: githubRepoSlug,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Vercel project creation failed: ${res.status} ${body}`);
  }

  const project = (await res.json()) as VercelProject;
  console.log(chalk.green(`  ✓ Project created: ${project.name} (${project.id})`));
  return project;
}
