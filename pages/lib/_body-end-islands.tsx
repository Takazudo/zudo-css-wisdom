/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Host-side body-end islands helper.
//
// Wave 8 (Path A — super-epic #1333 / child epic #1355) drops the local
// SSR-skip wrapper functions in `@takazudo/zudo-doc/ssr-skip` and uses
// zfb's native `<Island ssrFallback={...}>` API directly with the real
// component constructors imported by the host.
//
// The previous indirection (page → wrapper → placeholder div) created an
// orphan-component bug: the real components were `"use client"` modules
// that no page module ever imported transitively, so zfb's island scanner
// never walked page → real-component, the manifest never bound the marker
// to the real constructor, and the bundle never contained the real
// component body. PR #150 to zfb fixed the marker-name alignment but the
// orphan problem stayed — see issue zudolab/zudo-doc#1355 Wave 7 report.
//
// This helper is the page → real-component import chain the scanner
// needs. Each island below is composed with zfb's `<Island>` wrapper,
// which emits `<div data-zfb-island-skip-ssr="<ComponentName>">…</div>`
// at SSR (zfb's `captureComponentName` derives the marker from
// `child.displayName ?? child.name`). Because the page imports this
// file, and this file imports the real components, the scanner walks
// page → helper → real component and registers the constructor under
// the SSR marker name.
//
// Pattern mirrors `_header-with-defaults.tsx`: the JSX-shim widens
// `Island`'s return type to `unknown`, so call-sites cast through
// `as unknown as VNode` at the boundary.

import type { VNode, JSX } from "preact";
import { Island } from "@takazudo/zfb";
import { settings } from "@/config/settings";

import AiChatModal from "@/components/ai-chat-modal";
import ClientRouterBootstrap from "@/components/client-router-bootstrap";
import DesignTokenPanelBootstrap from "@/components/design-token-panel-bootstrap";
import ImageEnlarge, { ImageEnlargeSsrFallback } from "@/components/image-enlarge";
import { PageLoadingOverlay } from "@takazudo/zudo-doc/page-loading";

// Set explicit `displayName` on each default-exported island so zfb's
// `captureComponentName` produces a stable marker even after the SSR
// pipeline runs the components through a function-name-rewriting layer.
// The marker must match the third-arg literal that zfb's scanner records
// for the same source-level identifier (zfb PR #150). esbuild preserves
// function names by default, but the explicit assignment is a
// belt-and-braces guard for production minification regressions.
(AiChatModal as { displayName?: string }).displayName = "AiChatModal";
(ClientRouterBootstrap as { displayName?: string }).displayName =
  "ClientRouterBootstrap";
(DesignTokenPanelBootstrap as { displayName?: string }).displayName =
  "DesignTokenPanelBootstrap";
(ImageEnlarge as { displayName?: string }).displayName = "ImageEnlarge";

/**
 * Default sr-only label rendered as the AiChatModal SSR fallback. This
 * mirrors the body-label string the deleted `AiChatModalIsland` wrapper
 * produced verbatim so assistive tech can discover the chat entrypoint
 * in the static HTML before JS hydration. English-only for now — the
 * previous default was also English-only; pass `aiChatBodyLabel` to
 * localise.
 */
const DEFAULT_AI_CHAT_BODY_LABEL = "Ask a question about the documentation.";

/**
 * SSR-emitted inline script that acts as a pre-hydration shim for the
 * `toggle-design-token-panel` window event. Because the
 * DesignTokenPanelBootstrap Island is deferred, zdtp's real
 * `toggle-design-token-panel` listener (registered in index.tsx at
 * module init) is not yet installed when the user clicks the header
 * palette button. This shim:
 *
 *  1. Records the first (and only meaningful) click as a boolean flag.
 *  2. Exposes `window.__zdtpReadyClicks` so the bootstrap Island can
 *     drain the queue and re-dispatch a single event once the real
 *     listener is live.
 *  3. Guards against double-installation across any re-evaluation path
 *     (SPA body swap, HMR, etc.) via `__zdtpToggleShimInstalled`.
 *
 * A single boolean (not an array) is used because the panel is a toggle —
 * any number of pre-hydration clicks should result in at most one open.
 */
const ZDTP_TOGGLE_SHIM_SRC = `(function(){
if(window.__zdtpToggleShimInstalled)return;
window.__zdtpToggleShimInstalled=true;
var pending=false;
function shim(){pending=true;}
window.addEventListener('toggle-design-token-panel',shim);
window.__zdtpReadyClicks=function(){
window.removeEventListener('toggle-design-token-panel',shim);
delete window.__zdtpReadyClicks;
if(pending){pending=false;window.dispatchEvent(new CustomEvent('toggle-design-token-panel'));}
};
})();`;

/** Props for {@link BodyEndIslands}. */
export interface BodyEndIslandsProps {
  /** Base path the AI chat modal uses to construct API URLs. */
  basePath: string;
  /**
   * Sr-only label rendered as the AiChatModal SSR fallback. Defaults to
   * the English string. Pass a locale-translated string for non-default
   * locales so screen readers announce the chat entrypoint correctly
   * before hydration.
   */
  aiChatBodyLabel?: string;
}

/**
 * The three default body-end islands every doc page mounts: the
 * design-token tweak panel (overlay, fixed-position), the AI chat
 * modal (`<dialog>` overlay), and the image-enlarge dialog (mounted
 * lazily based on viewport scan).
 *
 * Each island is wrapped in `<Island ssrFallback>` so the heavy
 * component is NOT evaluated server-side — they depend on
 * `dialog.showModal()`, `localStorage`, `ResizeObserver`, runtime
 * fetch, etc. The hydration runtime swaps each placeholder on the
 * client.
 *
 * The `<h2 class="sr-only">AI Assistant</h2>` heading is emitted in
 * the SSG output so screen readers and crawlers can discover the chat
 * section landmark before JS hydration.
 */
export function BodyEndIslands({
  basePath,
  aiChatBodyLabel = DEFAULT_AI_CHAT_BODY_LABEL,
}: BodyEndIslandsProps): JSX.Element {
  // Hydrates first (when="load") so the SPA-router click intercept is
  // registered as soon as the islands runtime mounts the marker. The
  // component renders nothing visually — the island bundle's top-level
  // `import "@takazudo/zfb-runtime/client-router"` is what actually
  // wires up the router (zudolab/zudo-doc#1524 W7A fix).
  const clientRouterBootstrap = Island({
    when: "load",
    children: <ClientRouterBootstrap />,
  }) as unknown as VNode;

  // Hydrates on load so configurePanel() runs as early as possible and
  // the `toggle-design-token-panel` window listener is registered before
  // the user can click the header trigger. Renders nothing visually —
  // the zdtp panel self-mounts as a side-effect (zudolab/zudo-doc#1623).
  //
  // The inline <script> emitted alongside the Island is the pre-hydration
  // toggle shim (zudolab/zudo-doc#1627 Part B). It captures the first
  // click as a boolean flag and exposes window.__zdtpReadyClicks so the
  // bootstrap module can drain and re-dispatch once the real zdtp listener
  // is registered. Mirrors the PageLoadingOverlay SSR-script pattern.
  const designTokenPanelBootstrap =
    settings.designTokenPanel
      ? (
          <>
            <script
              dangerouslySetInnerHTML={{ __html: ZDTP_TOGGLE_SHIM_SRC }}
            />
            {Island({
              when: "load",
              children: <DesignTokenPanelBootstrap />,
            }) as unknown as VNode}
          </>
        )
      : null;

  // Use a visually-hidden paragraph as the AiChatModal SSR fallback so
  // the body label is present in static HTML for screen readers before
  // JS hydration. sr-only keeps it invisible to sighted users.
  const aiChat = Island({
    ssrFallback: <p class="sr-only">{aiChatBodyLabel}</p>,
    children: <AiChatModal basePath={basePath} />,
  }) as unknown as VNode;

  // Wave 11 (zudolab/zudo-doc#1355): the SSR fallback is the empty,
  // closed `<dialog class="zd-enlarge-dialog ...">` shell so the dist
  // HTML carries one dialog from the start. Without this the smoke
  // "exactly one zd-enlarge-dialog element" assertion sees zero
  // (skip-ssr placeholders are empty divs) and the no-JS path has no
  // dialog at all. Hydration replaces this shell with the real
  // ImageEnlarge component when the page goes idle.
  const imageEnlarge = Island({
    when: "idle",
    ssrFallback: <ImageEnlargeSsrFallback />,
    children: <ImageEnlarge />,
  }) as unknown as VNode;

  return (
    <>
      {/* Pure SSR — no Island wrap. The component emits its overlay div,
          inline styles, and a small inline script that self-wires
          zfb:before-preparation / zfb:after-swap listeners at runtime. */}
      <PageLoadingOverlay />
      {clientRouterBootstrap}
      {designTokenPanelBootstrap}
      {/* Emits the "AI Assistant" heading in the SSG output so screen
          readers can discover the chat section landmark before JS
          hydration. */}
      <h2 class="sr-only">AI Assistant</h2>
      {aiChat}
      {imageEnlarge}
    </>
  );
}
