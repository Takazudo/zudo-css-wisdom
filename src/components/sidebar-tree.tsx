// Thin re-export shim. SidebarTree moved into the package
// (`@takazudo/zudo-doc/sidebar-tree-island`) as part of the package-first
// migration (#2344, S2). Host code using `@/components/sidebar-tree`
// still resolves correctly; the implementation lives in the package.
export { SidebarTree } from "@takazudo/zudo-doc/sidebar-tree-island";
export type { SidebarTreeProps } from "@takazudo/zudo-doc/sidebar-tree-island";
