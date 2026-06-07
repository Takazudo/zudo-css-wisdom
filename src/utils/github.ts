import { settings } from "@/config/settings";

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

export function buildGitHubRepoUrl(): string | null {
  if (!settings.githubUrl) return null;
  return trimTrailingSlash(settings.githubUrl as string);
}

export function buildGitHubSourceUrl(
  contentDir: string,
  entryId: string,
): string | null {
  const repoUrl = buildGitHubRepoUrl();
  if (!repoUrl) return null;
  return `${repoUrl}/blob/HEAD/${contentDir}/${entryId}`;
}
