// Thin re-export shim. DesktopSidebarToggle moved into the package
// (`@takazudo/zudo-doc/desktop-sidebar-toggle-island`) as part of the
// package-first migration (#2344, S2). Host code using
// `@/components/desktop-sidebar-toggle` still resolves correctly;
// the implementation lives in the package.
export { DesktopSidebarToggle, SIDEBAR_STORAGE_KEY } from "@takazudo/zudo-doc/desktop-sidebar-toggle-island";
