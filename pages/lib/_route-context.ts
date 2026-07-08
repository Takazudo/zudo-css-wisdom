// Host route context — the reconstructed RouteContext (settings + i18n + URL
// helpers + nav/slug helpers + identity-stable nav-source resolvers + doc-route
// + route enumerators), built ONCE via the public `createRouteContext`
// (epic Collapse Wiring Shells #2420, FACTORIES #2424).
//
// Kept SEPARATE from `_chrome.ts` so the data shells (`_nav-source-docs`
// / `_doc-route-entries` / `route-enumerators`) — and the unit tests that import
// them — depend ONLY on this lightweight module, NOT on the chrome host bindings
// (which pull the build-time `#doc-history-meta` alias + island components that
// don't resolve under vitest).
//
// The host content bridge (`stableDocs`) is injected so the docs read + nav
// enumeration match the project's existing `pages/*` paths() exactly (host
// `bridgeDocsEntries` over the `zfb/content` snapshot), not the package default.

import { createRouteContext } from "@takazudo/zudo-doc/route-context";
import type { ColorScheme } from "@takazudo/zudo-doc/color-scheme-utils";
import { settings } from "@/config/settings";
import { translations } from "@/config/i18n";
import { tagVocabulary } from "@/config/tag-vocabulary";
import { colorSchemes } from "@/config/color-schemes";
import { stableDocs } from "./_nav-source-cache";

export const routeContext = createRouteContext(
  {
    settings,
    translations,
    tagVocabulary,
    colorSchemes: colorSchemes as unknown as Record<string, ColorScheme>,
  },
  { stableDocs },
);
