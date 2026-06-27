// Thin re-export shim. SidebarToggle moved into the package
// (`@takazudo/zudo-doc/sidebar-toggle-island`) as part of the package-first
// migration (#2344, S2). Host code using `@/components/sidebar-toggle`
// still resolves correctly; the implementation lives in the package.
export { SidebarToggle } from "@takazudo/zudo-doc/sidebar-toggle-island";
export type { SidebarToggleProps } from "@takazudo/zudo-doc/sidebar-toggle-island";
