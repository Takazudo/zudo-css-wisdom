/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Host thin-stub — see @takazudo/zudo-doc/doc-history-area (epic #2344, S7).
//
// The DocHistory import is kept here so zfb's island scanner walks the chain:
// page → stub → DocHistory. The factory receives the constructor via deps.
import { settings } from "@/config/settings";
import { defaultLocale, t } from "@/config/i18n";
import { toHistorySlug } from "@/utils/slug";
import { buildGitHubSourceUrl as _buildGitHubSourceUrl } from "@/utils/github";
import { createDocHistoryArea } from "@takazudo/zudo-doc/doc-history-area";
import { DocHistory } from "@takazudo/zudo-doc/doc-history";
// SSR author + date metadata comes from `.zfb/doc-history-meta.json`, a
// build-time manifest emitted by `scripts/zfb-prebuild.mjs` (step 2:
// doc-history-meta) before `zfb build` runs. esbuild inlines the JSON
// statically so no Node-only `fs` code reaches the client bundle.
// The `#doc-history-meta` alias is defined in tsconfig.json and resolves
// to the absolute path of `.zfb/doc-history-meta.json` — this is needed
// because the zfb bundler builds pages from a shadow tree; relative paths
// across the shadow boundary would resolve to the wrong location.
import docHistoryMeta from "#doc-history-meta";
import type { DocHistoryAreaProps } from "@takazudo/zudo-doc/doc-history-area";

export type { DocHistoryAreaProps };

export const DocHistoryArea = createDocHistoryArea({
  settings,
  defaultLocale,
  docHistoryMeta: docHistoryMeta as Record<string, { author: string; createdDate: string; updatedDate: string; ext?: string }>,
  t,
  toHistorySlug,
  buildGitHubSourceUrl: (contentDir: string, entryId: string) => _buildGitHubSourceUrl(contentDir, entryId),
  DocHistory,
});
