// Host thin-stub — see @takazudo/zudo-doc/github-helpers (epic #2344, S7).
//
// `buildGitHubRepoUrl` and `buildGitHubSourceUrl` are now parameterized pure
// functions in the package; this module wraps them with the host's
// `settings.githubUrl` singleton.

import { settings } from "@/config/settings";
import {
  buildGitHubRepoUrl as _buildGitHubRepoUrl,
  buildGitHubSourceUrl as _buildGitHubSourceUrl,
} from "@takazudo/zudo-doc/github-helpers";

export function buildGitHubRepoUrl(): string | null {
  return _buildGitHubRepoUrl(settings.githubUrl);
}

export function buildGitHubSourceUrl(
  contentDir: string,
  entryId: string,
): string | null {
  return _buildGitHubSourceUrl(settings.githubUrl, contentDir, entryId);
}
