// Thin shim — nav-source resolvers ride on the unified ChromeContext now
// (epic Collapse Wiring Shells #2420, FACTORIES #2424). The reconstructed
// `createRouteContext` (in _route-context.ts) builds the identity-stable
// nav-source API as part of the route context; this module just re-exports the
// bindings so the existing call sites (route files, nav wrappers, _nav-data-prep,
// route-enumerators) keep importing them from here unchanged.

export type { NavSourceDocs, NavSourceOptions } from "@takazudo/zudo-doc/nav-source-docs";
import { routeContext } from "./_route-context";

export const {
  resolveNavSource,
  resolveVersionedLocaleSource,
  loadNavSourceDocs,
  stableMergeCategoryMeta,
  stableNavDocs,
} = routeContext;
