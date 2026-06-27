// Thin re-export shim. The canonical slug rules moved into the package
// (`@takazudo/zudo-doc/slug`) as part of the package-first migration (#2344,
// S1a). Host code keeps importing from `@/utils/slug`; the implementation —
// including the canonical-root rule (#1891 / #1873) — lives once in the package.
export {
  toRouteSlug,
  toHistorySlug,
  toSlugParams,
  toTitleCase,
} from "@takazudo/zudo-doc/slug";
