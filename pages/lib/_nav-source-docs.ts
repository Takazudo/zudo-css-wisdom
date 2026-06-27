// Thin stub — nav-source-docs moved to the package (epic #2344, S6).
// Calls `createNavSourceDocs(ctx)` from @takazudo/zudo-doc/nav-source-docs
// with the host singletons injected, then re-exports the resulting resolver
// functions so all existing call sites continue to work unchanged.

import { createNavSourceDocs } from "@takazudo/zudo-doc/nav-source-docs";
export type { NavSourceDocs, NavSourceOptions } from "@takazudo/zudo-doc/nav-source-docs";
import { defaultLocale, getLocaleConfig } from "@/config/i18n";
import { settings } from "@/config/settings";
import { loadCategoryMeta, isNavVisible } from "@/utils/docs";
import { isDefaultLocaleOnlyPath } from "@/utils/base";
import { stableDocs } from "./_nav-source-cache";

const {
  resolveNavSource,
  resolveVersionedLocaleSource,
  loadNavSourceDocs,
  stableMergeCategoryMeta,
  stableNavDocs,
} = createNavSourceDocs({
  defaultLocale,
  docsDir: settings.docsDir,
  getVersions: () => settings.versions,
  getLocaleConfig,
  loadCategoryMeta,
  isNavVisible,
  isDefaultLocaleOnlyPath,
  stableDocs,
});

export {
  resolveNavSource,
  resolveVersionedLocaleSource,
  loadNavSourceDocs,
  stableMergeCategoryMeta,
  stableNavDocs,
};
