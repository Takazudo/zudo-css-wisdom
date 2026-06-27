/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Thin stub — inline-version-switcher moved to the package (epic #2344, S8).
// Calls `createInlineVersionSwitcher(deps)` from
// @takazudo/zudo-doc/inline-version-switcher with host singletons injected,
// then re-exports the resulting builder so all existing call sites continue
// to work unchanged.

import { createInlineVersionSwitcher } from "@takazudo/zudo-doc/inline-version-switcher";
import { settings } from "@/config/settings";
import { defaultLocale, t } from "@/config/i18n";
import { docsUrl, versionedDocsUrl, withBase } from "@/utils/base";

export { type InlineVersionSwitcherVersionEntry } from "@takazudo/zudo-doc/inline-version-switcher";

export const buildInlineVersionSwitcher = createInlineVersionSwitcher({
  settings,
  defaultLocale,
  t,
  docsUrl,
  versionedDocsUrl,
  withBase,
});
