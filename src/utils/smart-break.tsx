// Thin re-export shim. The smart-break helpers moved into the package
// (`@takazudo/zudo-doc/smart-break`) as part of the package-first migration
// (#2344, S1a) — consolidating with the former toc-local copy. Host code keeps
// importing from `@/utils/smart-break`; the implementation lives once in the
// package.
export {
  isPathLike,
  smartBreak,
  SmartBreak,
  escapeAndInjectWbr,
  smartBreakToHtml,
} from "@takazudo/zudo-doc/smart-break";
