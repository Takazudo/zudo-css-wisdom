/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Host thin-stub — see @takazudo/zudo-doc/doc-metainfo-area (epic #2344, S7).
import { settings } from "@/config/settings";
import { defaultLocale, t } from "@/config/i18n";
import { toHistorySlug } from "@/utils/slug";
import { createDocMetainfoArea } from "@takazudo/zudo-doc/doc-metainfo-area";
// SSR author + date metadata comes from `.zfb/doc-history-meta.json`, a
// build-time manifest emitted by `scripts/zfb-prebuild.mjs` (step 2:
// doc-history-meta) before `zfb build` runs. esbuild inlines the JSON
// statically so no Node-only `fs` code reaches the client bundle.
// The `#doc-history-meta` alias is defined in tsconfig.json and resolves
// to the absolute path of `.zfb/doc-history-meta.json` — this is needed
// because the zfb bundler builds pages from a shadow tree; relative paths
// across the shadow boundary would resolve to the wrong location.
import docHistoryMeta from "#doc-history-meta";

export type { DocMetainfoAreaProps } from "@takazudo/zudo-doc/doc-metainfo-area";

export const DocMetainfoArea = createDocMetainfoArea({
  settings,
  defaultLocale,
  docHistoryMeta: docHistoryMeta as Record<string, { author: string; createdDate: string; updatedDate: string }>,
  t,
  toHistorySlug,
});
