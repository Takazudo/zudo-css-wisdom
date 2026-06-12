// TOC section-label resolver for the Toc/MobileToc overrides mounted by
// `_doc-page-shell.tsx`. Hand-mirrors `getTocTitle`, which the zudo-doc
// package exports from "@takazudo/zudo-doc/toc" in versions > 0.2.2. The
// published version this scaffold installs (<= 0.2.2) does not yet export it,
// so the tiny lang→title map is duplicated here. After bumping the
// @takazudo/zudo-doc dependency past 0.2.2 you can replace this whole file
// with: export { getTocTitle } from "@takazudo/zudo-doc/toc";
const TOC_TITLES: Record<string, string> = {
  en: "On this page",
  ja: "目次",
  de: "Auf dieser Seite",
};

const DEFAULT_TOC_TITLE = "On this page";

/** Return the TOC section label for the given BCP-47 language tag. */
export function getTocTitle(lang?: string): string {
  if (!lang) return DEFAULT_TOC_TITLE;
  // "en-US" → try "en" first, then "en-US", then the English default.
  const primary = lang.split("-")[0]!;
  return TOC_TITLES[primary] ?? TOC_TITLES[lang] ?? DEFAULT_TOC_TITLE;
}
