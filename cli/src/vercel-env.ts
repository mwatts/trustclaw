interface VercelEnvVar {
  id: string;
  key: string;
  target: string[];
}

export interface ProjectEnvLookupArgs {
  token: string;
  teamId: string | null;
  projectId: string;
}

/**
 * List the names of all env vars set on a Vercel project.
 * Cheap — no decryption required since we only need to know which keys exist.
 */
export async function listProjectEnvKeys(
  args: ProjectEnvLookupArgs,
): Promise<Set<string>> {
  const url = args.teamId
    ? `https://api.vercel.com/v10/projects/${args.projectId}/env?teamId=${args.teamId}`
    : `https://api.vercel.com/v10/projects/${args.projectId}/env`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${args.token}` },
  });
  if (!res.ok) return new Set();
  const data = (await res.json()) as { envs: VercelEnvVar[] };
  return new Set(data.envs.map((e) => e.key));
}

/**
 * Look up a project by name to see if it already exists.
 * Returns the project id if found, null otherwise.
 */
export async function lookupExistingProject(args: {
  token: string;
  teamId: string | null;
  projectName: string;
}): Promise<{ id: string } | null> {
  const url = args.teamId
    ? `https://api.vercel.com/v9/projects/${args.projectName}?teamId=${args.teamId}`
    : `https://api.vercel.com/v9/projects/${args.projectName}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${args.token}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { id: string };
  return { id: data.id };
}
