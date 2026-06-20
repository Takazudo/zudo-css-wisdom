"use client";

import { useState, useEffect, useRef } from "preact/compat";
import type { JSX } from "preact";

interface ImageData {
  src: string;
  currentSrc: string;
  srcset?: string;
  sizes?: string;
  alt: string;
  naturalWidth: number;
  naturalHeight: number;
}

// Shared shell for the enlarge `<dialog>`. The hydrated component and the
// SSR fallback (below) render into the same Island container, so they MUST
// agree on class string and inline style — otherwise the dist HTML and the
// post-hydration DOM disagree on size / position and the first interaction
// flashes. Sourcing both from the same constants closes the drift gap.
//
// z-modal / backdrop:z-modal-backdrop are defense-in-depth for the SPA-swap
// window: if this dialog is still open while the page body is swapped, a native
// showModal() dialog can lose top-layer promotion and fall back to z-index:auto,
// flashing behind the header/sidebar. `backdrop:z-modal-backdrop` targets the
// native `::backdrop` (present for every showModal() dialog even with no backdrop
// tint). The explicit modal-tier z-index keeps it above all chrome during that
// window. Intentionally redundant in the normal (top-layer) case — do not remove
// as "redundant".
const DIALOG_CLASS =
  "zd-enlarge-dialog z-modal mx-auto max-h-[90vh] max-w-[90vw] overflow-hidden border border-muted bg-surface p-0 backdrop:z-modal-backdrop";
// Center the modal with `inset: 0; margin: auto` rather than a transform.
// A `transform` on the dialog would establish a containing block for its
// `position: fixed` descendants, which would trap the `.zd-enlarge-dialog-close`
// button at the dialog's corner instead of the viewport's — see the close
// button's fixed positioning in global.css. Auto-margin centering keeps the
// dialog transform-free so the close button anchors to the page top-right.
const DIALOG_STYLE = {
  position: "fixed",
  inset: "0",
  margin: "auto",
} as const;

export default function ImageEnlarge() {
  const [imgData, setImgData] = useState<ImageData | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Eligibility detection: toggle .zd-enlarge-btn[hidden] per image
  useEffect(() => {
    // Single shared ResizeObserver watching all observed images.
    // One observer for N images is more efficient than N observers.
    // The callback iterates entries so each image's eligibility is
    // re-evaluated independently when its size changes.
    const observedImages = new Set<HTMLImageElement>();
    const sharedResizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        evaluateEligibility(entry.target as HTMLImageElement);
      }
    });
    let mutationObserver: MutationObserver | null = null;
    let resizeTimer = 0;

    function evaluateEligibility(img: HTMLImageElement) {
      const container = img.closest(".zd-enlargeable");
      if (!container) return;
      const btn = container.querySelector(".zd-enlarge-btn") as HTMLElement | null;
      if (!btn) return;
      const eligible = img.naturalWidth > img.clientWidth * window.devicePixelRatio;
      if (eligible) {
        btn.removeAttribute("hidden");
      } else {
        btn.setAttribute("hidden", "");
      }
    }

    function observeImage(img: HTMLImageElement) {
      if (observedImages.has(img)) return;
      observedImages.add(img);
      sharedResizeObserver.observe(img);
      if (img.complete) {
        evaluateEligibility(img);
      } else {
        img.addEventListener("load", () => evaluateEligibility(img), { once: true });
      }
    }

    function scanContent() {
      const scope = document.querySelector("main .zd-content");
      if (!scope) return;
      scope.querySelectorAll<HTMLImageElement>(".zd-enlargeable img").forEach(observeImage);
    }

    function startObserving() {
      const scope = document.querySelector("main .zd-content");
      if (scope) {
        mutationObserver = new MutationObserver((mutations) => {
          for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
              if (!(node instanceof Element)) continue;
              if (node.matches(".zd-enlargeable")) {
                node.querySelectorAll<HTMLImageElement>("img").forEach(observeImage);
              }
              node.querySelectorAll<HTMLImageElement>(".zd-enlargeable img").forEach(observeImage);
            }
          }
        });
        mutationObserver.observe(scope, { childList: true, subtree: true });
      }
      scanContent();
    }

    function handleWindowResize() {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        observedImages.forEach((img) => evaluateEligibility(img));
      }, 150);
    }

    function handleAfterSwap() {
      sharedResizeObserver.disconnect();
      observedImages.clear();
      mutationObserver?.disconnect();
      mutationObserver = null;
      startObserving();
    }

    startObserving();
    window.addEventListener("resize", handleWindowResize);
    document.addEventListener("DOMContentLoaded", handleAfterSwap);

    return () => {
      sharedResizeObserver.disconnect();
      observedImages.clear();
      mutationObserver?.disconnect();
      window.removeEventListener("resize", handleWindowResize);
      document.removeEventListener("DOMContentLoaded", handleAfterSwap);
      clearTimeout(resizeTimer);
    };
  }, []);

  useEffect(() => {
    function handleDocumentClick(e: MouseEvent) {
      const target = e.target as Element;
      const container = target.closest(".zd-enlargeable");
      if (!container) return;
      const btn = container.querySelector(".zd-enlarge-btn") as HTMLElement | null;
      // Eligibility gate: only open when the expand button is visible (image is large enough).
      if (!btn || btn.hasAttribute("hidden")) return;
      const img = container.querySelector("img") as HTMLImageElement | null;
      if (!img) return;
      setImgData({
        src: img.src,
        currentSrc: img.currentSrc,
        srcset: img.srcset || undefined,
        sizes: img.sizes || undefined,
        alt: img.alt,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
      });
    }
    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, []);

  // Open dialog when imgData is set
  useEffect(() => {
    if (!imgData) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
  }, [imgData]);

  // Handle cancel event (ESC key)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    function handleCancel() {
      setImgData(null);
    }
    dialog.addEventListener("cancel", handleCancel);
    return () => dialog.removeEventListener("cancel", handleCancel);
  }, []);

  // Reset state when dialog closes
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    function handleClose() {
      setImgData(null);
    }
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, []);

  // Close and reset on ClientRouter navigation
  useEffect(() => {
    function handleAfterSwap() {
      const dialog = dialogRef.current;
      if (dialog?.open) dialog.close();
      setImgData(null);
    }
    document.addEventListener("DOMContentLoaded", handleAfterSwap);
    return () => document.removeEventListener("DOMContentLoaded", handleAfterSwap);
  }, []);

  function handleBackdropClick(e: JSX.TargetedMouseEvent<HTMLDialogElement>) {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    ) {
      dialog.close();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className={DIALOG_CLASS}
      style={DIALOG_STYLE}
    >
      {imgData && (
        <>
          <div className="relative">
            <img
              src={imgData.currentSrc || imgData.src}
              srcSet={imgData.srcset}
              sizes={imgData.srcset ? "100vw" : undefined}
              alt={imgData.alt}
              className="block max-h-[85vh] max-w-[85vw] object-contain"
            />
          </div>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="zd-enlarge-dialog-close"
            aria-label="Close enlarged image"
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
 * Static SSR fallback for the {@link ImageEnlarge} island.
 *
 * Renders an empty, closed `<dialog class="zd-enlarge-dialog ...">` so the
 * dist HTML carries the dialog shell even before hydration. A `<dialog>`
 * without `open` is `display:none` per UA stylesheet, so screen readers
 * and crawlers see the same shape they would post-hydration. Sources its
 * class and inline style from the shared `DIALOG_CLASS` / `DIALOG_STYLE`
 * constants above so the SSR shell cannot drift from the hydrated
 * dialog (a drift would surface as a cosmetic flash on first interaction).
 */
export function ImageEnlargeSsrFallback() {
  return (
    <dialog
      className={DIALOG_CLASS}
      style={DIALOG_STYLE}
    />
  );
}
