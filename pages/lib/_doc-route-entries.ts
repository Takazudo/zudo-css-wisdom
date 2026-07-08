// Thin shim — the memoized doc-route-entry builder rides on the unified
// ChromeContext now (epic Collapse Wiring Shells #2420, FACTORIES #2424).
// `createRouteContext` (in _route-context.ts) assembles `buildDocRouteEntries`
// as part of the route context; this module just re-exports it so the doc-route
// page files keep importing it from here unchanged.

export type { DocRouteEntry, BuildDocRouteEntriesArgs } from "@takazudo/zudo-doc/doc-route-entries";
import { routeContext } from "./_route-context";

export const { buildDocRouteEntries } = routeContext;
