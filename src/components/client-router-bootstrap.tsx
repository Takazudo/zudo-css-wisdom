"use client";

// Client-side bootstrap for the @takazudo/zfb-runtime ClientRouter.
//
// Why this exists (zudolab/zudo-doc#1524, W7A verification):
// `<ClientRouter />` (mounted in doc-layout.tsx) emits SSR meta tags + CSS
// for the SPA soft-swap router, but the actual click/form intercept
// registration runs as a top-of-module side effect inside
// `@takazudo/zfb-runtime/src/client-router.ts`:
//
//   if (typeof document !== "undefined") { init(); }
//
// The host's existing `import { ClientRouter } from "@takazudo/zfb-runtime"`
// in doc-layout.tsx happens during SSR (where typeof document ===
// "undefined"), so the side effect is silently skipped — the router
// module never reaches the client bundle and every navigation falls
// through to a full page load. W7A's Playwright harness confirmed this:
// pageswap.viewTransition is null, getAnimations() is empty during nav,
// and the sidebar DOM identity is destroyed on every click.
//
// The fix is a minimal "use client" island whose only job is to
// side-effect-import `@takazudo/zfb-runtime/client-router` so the same
// guard fires in the browser. The `init()` is idempotent (guarded by an
// `initialized` flag in router.ts), so even if the import path is
// reached again later the registration runs exactly once.
//
// Bundle cost: the only thing this island ships to the client is the
// client-router subgraph (router.ts + swap-functions.ts + events.ts +
// types.ts + cssesc.ts) plus its single dep on `@takazudo/zfb/runtime`'s
// island manager. The server-only zfb-runtime modules
// (createPageRouter, snapshot, framework adapter) are not transitively
// reachable from the client-router barrel and stay out of the bundle.
//
// Why not call init() in useEffect instead of a side-effect import:
// useEffect fires after Preact mounts, which is after the islands
// runtime fetches and executes the bundle. Module top-level code runs
// as soon as the bundle is parsed by the browser — earlier than mount,
// closer to Astro's <script type="module"> emission timing. The first
// click on a fresh page typically arrives 100ms+ after parse, so this
// timing is what makes the SPA-router actually intercept.

// Side-effect import — running this file's bundle in the browser
// triggers the `if (typeof document !== "undefined") { init(); }` guard
// at the top of `@takazudo/zfb-runtime/src/client-router.ts`.
import "@takazudo/zfb-runtime/client-router";

import type { JSX } from "preact";

/**
 * Renders nothing. The island marker exists only so zfb's island scanner
 * walks page → BodyEndIslands → ClientRouterBootstrap and includes the
 * client-router barrel in the per-island bundle, where the side-effect
 * import above can fire on the client.
 */
function ClientRouterBootstrap(): JSX.Element | null {
  return null;
}

// Stable marker name across SSR / scanner / hydration manifest. Required
// for production minification per the existing pattern in
// `pages/lib/_body-end-islands.tsx` (zfb PR #150 marker-name alignment).
ClientRouterBootstrap.displayName = "ClientRouterBootstrap";

export default ClientRouterBootstrap;
