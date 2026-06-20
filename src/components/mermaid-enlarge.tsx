"use client";

// Mermaid-enlarge island — adds an "enlarge" affordance to client-rendered
// mermaid diagrams plus a Google-Maps-style zoom/pan dialog.
//
// Unlike images (which the MDX paragraph override SSR-wraps in
// `<figure class="zd-enlargeable">` with the enlarge button already in the
// markup — see pages/_mdx-components.ts), mermaid diagrams render CLIENT-SIDE:
// the mermaid init script (packages/zudo-doc/src/code-syntax/mermaid-init-script.ts)
// imports mermaid from a CDN, runs `mermaid.run()`, then sets
// `data-mermaid-rendered` on each `.mermaid` container and injects the `<svg>`.
// So there is no server markup to wrap — this island must INJECT the enlarge
// button into each diagram container after it renders.
//
// Lifecycle coupling with the mermaid init script:
//   * Primary trigger: a MutationObserver on the content scope watching for the
//     `data-mermaid-rendered` attribute appearing (and the `<svg>` child).
//   * SPA hops: AFTER_NAVIGATE_EVENT re-scans the (swapped) content body.
//   * Theme/tweak re-render: the init script's `reinitMermaid` REMOVES and
//     regenerates the `<svg>` (debounced 300ms). The button lives on the
//     `.mermaid` CONTAINER (which persists), and the dedupe guard is keyed by
//     the container — so the button is neither dropped nor duplicated when the
//     svg is regenerated. If the dialog is open during a re-render, the open
//     diagram's fresh `<svg>` is re-cloned.

// Use `preact/compat` so the bundle resolves to Preact's React-shim at runtime
// (zfb's esbuild step doesn't alias bare `react` to `preact/compat`). Mirrors
// image-enlarge.tsx.
import type { JSX } from "preact";
import { useState, useEffect, useRef, useCallback } from "preact/compat";
import { AFTER_NAVIGATE_EVENT } from "@takazudo/zudo-doc/transitions";

// ---------------------------------------------------------------------------
// Shared dialog shell constants
//
// The hydrated component and the SSR fallback below render into the same Island
// container, so they MUST agree on class string and inline style — otherwise
// the dist HTML and the post-hydration DOM disagree and the first interaction
// flashes. Sourcing both from the same constants closes that drift gap.
//
// The dialog itself is intentionally transform-FREE (centered via
// position:fixed; inset:0; margin:auto). The zoom/pan transform lives on an
// INNER wrapper — a transform on the `<dialog>` would establish a containing
// block for its `position: fixed` descendants, re-anchoring the fixed close
// button to the dialog corner instead of the viewport. Mirrors image-enlarge.
//
// z-modal / backdrop:z-modal-backdrop are defense-in-depth for the SPA-swap
// window: a still-open showModal() dialog can lose top-layer promotion when the
// page body is swapped, so the explicit modal-tier z-index keeps it above all
// chrome. Intentionally redundant in the normal top-layer case.
// ---------------------------------------------------------------------------
const DIALOG_CLASS =
  "zd-mermaid-dialog z-modal mx-auto h-[90vh] max-h-[90vh] w-[90vw] max-w-[90vw] overflow-hidden border border-muted bg-surface p-0 backdrop:z-modal-backdrop";
const DIALOG_STYLE = {
  position: "fixed",
  inset: "0",
  margin: "auto",
} as const;

// Selector for the content-scope root. The button injector scans within this
// scope with `.querySelectorAll(".mermaid")` — no deeper constant needed.
const CONTENT_SCOPE_SELECTOR = "main .zd-content";

// The diagram svg is a DIRECT child of the `.mermaid` container; the injected
// enlarge button's own icon svg is a grandchild. Selecting `:scope > svg` (not a
// descendant `svg`) so we never pick up the button icon — which matters during a
// theme/tweak re-render, when the diagram svg is briefly removed and a bare
// `querySelector("svg")` would fall back to the button's icon.
const DIAGRAM_SVG_SELECTOR = ":scope > svg";

// Container-keyed dedupe marker. Set on the `.mermaid` container (which persists
// across theme/tweak re-renders) once its enlarge button is injected, so the
// re-render that regenerates the inner `<svg>` doesn't drop or duplicate it.
const BTN_INJECTED_ATTR = "data-mermaid-enlarge-ready";

// Zoom step + clamps. scale 1 = diagram fits the dialog (contain).
const ZOOM_STEP = 1.25;
const MIN_SCALE = 1;
const MAX_SCALE = 4;

// The enlarge button's 4-corner-arrows icon (same shape as ENLARGE_SVG in
// pages/_mdx-components.ts) is injected as an innerHTML string in injectButton()
// below — the button itself is created via document.createElement because the
// mermaid container is plain DOM, not part of this island's render tree.

// Toolbar icons. currentColor + aria-hidden so they inherit the toolbar button
// color and are skipped by assistive tech (the buttons carry aria-labels).
function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" focusable="false">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" focusable="false">
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function PanIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true" focusable="false">
      <path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M12 11V4.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M15 11V6a1.5 1.5 0 0 1 3 0v6.5a6.5 6.5 0 0 1-6.5 6.5h-1a6 6 0 0 1-4.6-2.16l-2.2-2.86a1.5 1.5 0 0 1 2.3-1.92L9 13" />
      <path d="M9 11V8a1.5 1.5 0 0 0-3 0v5" />
    </svg>
  );
}

interface OpenDiagram {
  /** The live `.mermaid` container being shown — used to re-clone on re-render. */
  container: HTMLElement;
  /** The cloned `<svg>` outerHTML to render inside the pan viewport. */
  svgHtml: string;
}

export default function MermaidEnlarge() {
  const [open, setOpen] = useState<OpenDiagram | null>(null);

  // Zoom/pan state. scale 1 = diagram fits the dialog (contain); translate 0,0.
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [panActive, setPanActive] = useState(false);

  const dialogRef = useRef<HTMLDialogElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  // Pointer-drag bookkeeping (refs so the handlers don't re-create on each move).
  const dragState = useRef<{
    dragging: boolean;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  }>({ dragging: false, startX: 0, startY: 0, originX: 0, originY: 0 });

  // -----------------------------------------------------------------------
  // Button injection: scan the content scope, inject one enlarge button into
  // each RENDERED diagram container, and add `.zd-mermaid-enlargeable` (which
  // makes the container position:relative so the absolutely-positioned button
  // anchors to it).
  // -----------------------------------------------------------------------
  useEffect(() => {
    let mutationObserver: MutationObserver | null = null;

    function injectButton(container: HTMLElement) {
      // Container-keyed guard: the theme/tweak re-render regenerates the inner
      // <svg> but the container (and this marker) persists.
      if (container.hasAttribute(BTN_INJECTED_ATTR)) return;
      // Only inject once the diagram has actually rendered — the button is
      // meaningless before there's an <svg> to enlarge.
      const rendered =
        container.hasAttribute("data-mermaid-rendered") ||
        container.querySelector(DIAGRAM_SVG_SELECTOR) !== null;
      if (!rendered) return;

      container.setAttribute(BTN_INJECTED_ATTR, "");
      container.classList.add("zd-mermaid-enlargeable");

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "zd-enlarge-btn";
      btn.setAttribute("aria-label", "Enlarge diagram");
      // 4-corner-arrows icon (matches ENLARGE_SVG used by image-enlarge).
      btn.innerHTML =
        '<svg viewBox="0 0 38.99 38.99" fill="currentColor" focusable="false" aria-hidden="true">' +
        '<polygon points="16.2 13.74 5.92 3.47 11.2 3.47 11.2 0 3.47 0 0 0 0 3.47 0 11.2 3.47 11.2 3.47 5.92 13.74 16.2 16.2 13.74" />' +
        '<polygon points="25.24 16.2 35.52 5.92 35.52 11.2 38.99 11.2 38.99 3.47 38.99 0 35.52 0 27.79 0 27.79 3.47 33.07 3.47 22.79 13.74 25.24 16.2" />' +
        '<polygon points="22.79 25.24 33.07 35.52 27.79 35.52 27.79 38.99 35.52 38.99 38.99 38.99 38.99 35.52 38.99 27.79 35.52 27.79 35.52 33.07 25.24 22.79 22.79 25.24" />' +
        '<polygon points="13.74 22.79 3.47 33.07 3.47 27.79 0 27.79 0 35.52 0 38.99 3.47 38.99 11.2 38.99 11.2 35.52 5.92 35.52 16.2 25.24 13.74 22.79" />' +
        "</svg>";
      container.appendChild(btn);
    }

    function scan() {
      const scope = document.querySelector(CONTENT_SCOPE_SELECTOR);
      if (!scope) return;
      scope
        .querySelectorAll<HTMLElement>(".mermaid")
        .forEach((el) => injectButton(el));
    }

    function startObserving() {
      const scope = document.querySelector(CONTENT_SCOPE_SELECTOR);
      if (scope) {
        // Watch for: new `.mermaid` containers (childList), the
        // `data-mermaid-rendered` attribute flipping on (attributes), and the
        // svg child appearing (childList subtree). Any of these means a diagram
        // is now eligible for the button.
        mutationObserver = new MutationObserver(() => scan());
        mutationObserver.observe(scope, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["data-mermaid-rendered"],
        });
      }
      scan();
    }

    function handleAfterNavigate() {
      mutationObserver?.disconnect();
      mutationObserver = null;
      startObserving();
    }

    startObserving();
    document.addEventListener(AFTER_NAVIGATE_EVENT, handleAfterNavigate);

    return () => {
      mutationObserver?.disconnect();
      document.removeEventListener(AFTER_NAVIGATE_EVENT, handleAfterNavigate);
    };
  }, []);

  // -----------------------------------------------------------------------
  // Delegated open handler: a click on an injected `.zd-enlarge-btn` inside a
  // `.zd-mermaid-enlargeable` clones that diagram's `<svg>` into the dialog.
  // Mirrors image-enlarge's document-level delegated click.
  // -----------------------------------------------------------------------
  useEffect(() => {
    function handleDocumentClick(e: MouseEvent) {
      const target = e.target as Element;
      const container = target.closest(".zd-mermaid-enlargeable") as HTMLElement | null;
      if (!container) return;
      if (!target.closest(".zd-enlarge-btn")) return;
      const svg = container.querySelector(DIAGRAM_SVG_SELECTOR);
      if (!svg) return;
      // Reset zoom/pan on every open.
      setScale(1);
      setTranslate({ x: 0, y: 0 });
      setPanActive(false);
      setOpen({ container, svgHtml: svg.outerHTML });
    }
    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, []);

  // -----------------------------------------------------------------------
  // Re-clone the fresh `<svg>` if the underlying diagram re-renders while the
  // dialog is open (theme/tweak flip removes & regenerates the svg).
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!open) return;
    const { container } = open;
    const observer = new MutationObserver(() => {
      const svg = container.querySelector(DIAGRAM_SVG_SELECTOR);
      if (svg && svg.outerHTML !== open.svgHtml) {
        setOpen({ container, svgHtml: svg.outerHTML });
      }
    });
    observer.observe(container, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [open]);

  const handleClose = useCallback(() => setOpen(null), []);

  // -----------------------------------------------------------------------
  // Dialog open/close sync (inlined from useModalDialog — template projects
  // do not ship src/hooks/use-modal-dialog.ts, so the hook is not available).
  // -----------------------------------------------------------------------
  const isOpen = open !== null;

  // Sync dialog open/close with state.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  // Fire handleClose when the dialog is closed natively (Escape key).
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    function onDialogClose() {
      if (isOpen) handleClose();
    }
    dialog.addEventListener("close", onDialogClose);
    return () => dialog.removeEventListener("close", onDialogClose);
  }, [isOpen, handleClose]);

  // Close on SPA navigation when dialog is open.
  useEffect(() => {
    function handleNavigation() {
      const dialog = dialogRef.current;
      if (dialog?.open) {
        dialog.close();
        handleClose();
      }
    }
    document.addEventListener(AFTER_NAVIGATE_EVENT, handleNavigation);
    return () => document.removeEventListener(AFTER_NAVIGATE_EVENT, handleNavigation);
  }, [handleClose]);

  // Backdrop-click handler: close when the click target is the dialog itself.
  // Preact-native event type so the template does not depend on @types/react
  // being present in the scaffolded project.
  function handleBackdropClick(e: JSX.TargetedMouseEvent<HTMLDialogElement>): void {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (e.target === dialog) dialog.close();
  }

  // -----------------------------------------------------------------------
  // Zoom controls
  // -----------------------------------------------------------------------
  const zoomIn = useCallback(() => {
    setScale((s) => Math.min(MAX_SCALE, s * ZOOM_STEP));
  }, []);

  const zoomOut = useCallback(() => {
    setScale((s) => {
      const next = Math.max(MIN_SCALE, s / ZOOM_STEP);
      // At full width, recenter (translate has no meaning when not zoomed in)
      // and turn off pan mode.
      if (next <= MIN_SCALE) {
        setTranslate({ x: 0, y: 0 });
        setPanActive(false);
      }
      return next;
    });
  }, []);

  const togglePan = useCallback(() => {
    setPanActive((p) => !p);
  }, []);

  // Clamp a candidate translate so the diagram can't be dragged fully
  // offscreen — keep the scaled content overlapping the viewport. The max
  // offset on each axis is half the overflow (scaled size minus base size).
  const clampTranslate = useCallback(
    (x: number, y: number, s: number) => {
      const inner = innerRef.current;
      if (!inner) return { x, y };
      const rect = inner.getBoundingClientRect();
      // rect already reflects the current transform; derive the un-scaled base
      // from the applied scale so the bound is stable across repeated drags.
      const baseW = rect.width / s;
      const baseH = rect.height / s;
      const maxX = Math.max(0, (baseW * s - baseW) / 2);
      const maxY = Math.max(0, (baseH * s - baseH) / 2);
      return {
        x: Math.max(-maxX, Math.min(maxX, x)),
        y: Math.max(-maxY, Math.min(maxY, y)),
      };
    },
    [],
  );

  // -----------------------------------------------------------------------
  // Pan drag (pointer events) — active only when pan mode is on and zoomed in.
  // -----------------------------------------------------------------------
  const onPointerDown = useCallback(
    (e: PointerEvent) => {
      if (!panActive || scale <= MIN_SCALE) return;
      const d = dragState.current;
      d.dragging = true;
      d.startX = e.clientX;
      d.startY = e.clientY;
      d.originX = translate.x;
      d.originY = translate.y;
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    [panActive, scale, translate],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const d = dragState.current;
      if (!d.dragging) return;
      const nextX = d.originX + (e.clientX - d.startX);
      const nextY = d.originY + (e.clientY - d.startY);
      setTranslate(clampTranslate(nextX, nextY, scale));
    },
    [scale, clampTranslate],
  );

  const onPointerUp = useCallback((e: PointerEvent) => {
    const d = dragState.current;
    if (!d.dragging) return;
    d.dragging = false;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
  }, []);

  const zoomed = scale > MIN_SCALE;
  const atMax = scale >= MAX_SCALE;

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      aria-label="Enlarged diagram"
      className={DIALOG_CLASS}
      style={DIALOG_STYLE}
    >
      {open && (
        <>
          <div
            className="zd-mermaid-viewport"
            // Pointer handlers live on the viewport so a drag started anywhere
            // over the diagram pans it. `touch-action: none` (in CSS) lets the
            // pointer events fire on touch without the browser scrolling.
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            data-pan-active={panActive && zoomed ? "" : undefined}
          >
            <div
              ref={innerRef}
              className="zd-mermaid-transform"
              style={{
                transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
                transformOrigin: "center",
              }}
              // The cloned mermaid svg is trusted markup produced by the local
              // mermaid render; re-cloned here verbatim.
              dangerouslySetInnerHTML={{ __html: open.svgHtml }}
            />
          </div>

          <div className="zd-mermaid-toolbar" role="toolbar" aria-label="Diagram zoom controls">
            <button
              type="button"
              className="zd-mermaid-tool-btn"
              aria-label="Zoom in"
              onClick={zoomIn}
              disabled={atMax}
            >
              <PlusIcon />
            </button>
            <button
              type="button"
              className="zd-mermaid-tool-btn"
              aria-label="Zoom out"
              onClick={zoomOut}
              disabled={!zoomed}
            >
              <MinusIcon />
            </button>
            <button
              type="button"
              className="zd-mermaid-tool-btn"
              aria-label="Toggle pan mode"
              aria-pressed={panActive}
              onClick={togglePan}
              disabled={!zoomed}
            >
              <PanIcon />
            </button>
          </div>

          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="zd-enlarge-dialog-close"
            aria-label="Close enlarged diagram"
          >
            <svg viewBox="0 0 161.03 161.03" fill="currentColor" aria-hidden="true" focusable="false">
              <polygon points="161.03 10.27 150.76 0 80.51 70.24 10.27 0 0 10.27 70.24 80.51 0 150.76 10.27 161.03 80.51 90.78 150.76 161.03 161.03 150.76 90.78 80.51 161.03 10.27" />
            </svg>
          </button>
        </>
      )}
    </dialog>
  );
}

/**
 * Static SSR fallback for the {@link MermaidEnlarge} island.
 *
 * The body-end Island wrapper renders this on the server so the dist HTML
 * carries an empty, closed `<dialog class="zd-mermaid-dialog ...">` even before
 * hydration (a `<dialog>` without `open` is `display:none` per UA stylesheet).
 * The classes and inline style come from the shared `DIALOG_CLASS` /
 * `DIALOG_STYLE` constants so the SSR fallback cannot drift from the hydrated
 * `<dialog>` above. Mirrors `ImageEnlargeSsrFallback`.
 */
export function MermaidEnlargeSsrFallback() {
  return <dialog aria-label="Enlarged diagram" className={DIALOG_CLASS} style={DIALOG_STYLE} />;
}
