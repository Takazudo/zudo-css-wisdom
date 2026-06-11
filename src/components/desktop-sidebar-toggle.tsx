"use client";

import { useState, useEffect, useRef } from 'preact/hooks';
import { BEFORE_NAVIGATE_EVENT, AFTER_NAVIGATE_EVENT } from '@takazudo/zudo-doc/transitions';

export const SIDEBAR_STORAGE_KEY = 'zudo-doc-sidebar-visible';

function readState(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

function setDataAttribute(isVisible: boolean) {
  if (isVisible) {
    document.documentElement.removeAttribute('data-sidebar-hidden');
  } else {
    document.documentElement.setAttribute('data-sidebar-hidden', '');
  }
}

export default function DesktopSidebarToggle() {
  // Initial state must match server render (always `true`) to avoid a
  // hydration mismatch when the persisted preference is "hidden". The
  // doc-layout's pre-paint inline script applies `data-sidebar-hidden`
  // to <html> from localStorage *before* this island mounts, so the
  // visual state stays correct; we only need to sync this island's
  // React state to the persisted preference after hydration. Same
  // pattern as packages/zudo-doc/src/theme-toggle/index.tsx (commit 9aebd8e).
  const [visible, setVisible] = useState<boolean>(true);
  // Tracks whether the hydration sync (below) has run. The persistence
  // effect below skips the very first mount so we don't overwrite the
  // user's persisted "hidden" preference with the SSR-safe default
  // `true` before the hydration sync gets a chance to fire.
  const hydrated = useRef(false);

  // Persist state changes to localStorage and the <html> data-attribute.
  // The `hydrated.current` guard is the real protection: it is still
  // `false` on the very first effect run (the hydration-sync effect
  // below sets it to `true` only after this one fires, since effects
  // run in declaration order on mount), so the first run bails out
  // and we don't clobber the user's persisted "hidden" preference
  // with the SSR-safe default `true`.
  useEffect(() => {
    if (!hydrated.current) return;
    setDataAttribute(visible);
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(visible));
    } catch {
      // ignore storage errors
    }
  }, [visible]);

  // After mount, read the persisted preference and reconcile state
  // with the SSR default. Sets the ref so subsequent runs of the
  // persistence effect above start syncing normally.
  useEffect(() => {
    hydrated.current = true;
    const actual = readState();
    if (actual !== visible) {
      setVisible(actual);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-apply data-sidebar-hidden to <html> after every SPA nav.
  // zfb's swapRootAttributes wipes all non-preserved <html> attributes on
  // each navigation (data-sidebar-hidden is not in NON_OVERRIDABLE_ZFB_ATTRS),
  // and the pre-paint inline script does not re-run on SPA nav. Since this
  // island is persisted (data-zfb-transition-persist), this listener stays
  // registered across SPA swaps.
  //
  // Strategy: capture the attribute presence just before the swap
  // (BEFORE_NAVIGATE_EVENT fires before swapRootAttributes runs), then
  // restore it once the swap completes (AFTER_NAVIGATE_EVENT). This is
  // authoritative regardless of how the attribute was set (toggle click,
  // localStorage, or external mutation). (#1551, #1552 B10)
  useEffect(() => {
    let wasHidden = false;
    const capture = () => {
      wasHidden = document.documentElement.hasAttribute('data-sidebar-hidden');
    };
    const restore = () => {
      if (wasHidden) {
        document.documentElement.setAttribute('data-sidebar-hidden', '');
      }
      // If not hidden, swapRootAttributes already cleared it — nothing to do.
    };
    document.addEventListener(BEFORE_NAVIGATE_EVENT, capture);
    document.addEventListener(AFTER_NAVIGATE_EVENT, restore);
    return () => {
      document.removeEventListener(BEFORE_NAVIGATE_EVENT, capture);
      document.removeEventListener(AFTER_NAVIGATE_EVENT, restore);
    };
  }, []);

  return (
    <button
      type="button"
      onClick={() => setVisible((v) => !v)}
      className="zd-desktop-sidebar-toggle hidden lg:flex fixed bottom-vsp-xl z-40 items-center justify-center w-[1.5rem] h-[3rem] bg-surface border border-muted border-l-0 rounded-r-DEFAULT text-muted cursor-pointer transition-[left,color] duration-200 ease-in-out hover:text-fg"
      aria-label={visible ? 'Hide sidebar' : 'Show sidebar'}
      aria-pressed={visible}
      data-zfb-transition-persist="desktop-sidebar-toggle"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-icon-sm w-icon-sm"
        aria-hidden="true"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d={visible ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'}
        />
      </svg>
    </button>
  );
}
