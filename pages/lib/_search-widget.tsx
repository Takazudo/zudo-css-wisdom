/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// SSR-friendly search widget for the zfb host header.
//
// SSR search widget for the zfb host header. The key SSR requirement is that
// the placeholder text ("Type to search..." / 「検索したい単語を入力」) and
// the keyboard-shortcut hint ("to open search from anywhere" /
// 「いつでも検索バーを開ける」) appear in the static HTML so no-JS users
// and crawlers can see them.
//
// Architecture:
//   - Pure SSR markup for the dialog structure + placeholder text.
//   - A `<site-search>` custom element wraps everything; the inline script
//     at the bottom of this module registers the element and handles:
//       * Dialog open / close (button click, backdrop click, Escape key)
//       * Platform keyboard-shortcut label (⌘K / Ctrl+K) written into
//         `[data-kbd-shortcut]` on first `connectedCallback`
//       * Search-index loading + MiniSearch query dispatch (lazy-loaded
//         after the user types the first character)
//   - Locale-aware strings are passed as props from the caller so the
//     Japanese placeholder / shortcut-hint copy appears in JA-locale SSR
//     without JS execution.
//
// Coordination note: this file is inserted into the header via
// `_header-with-defaults.tsx`'s `search` slot prop. It is self-contained
// so B-10-2 (version-switcher) can touch the header file without conflict.

import type { JSX } from "preact";
import { withBase } from "@/utils/base";
import { SEARCH_WIDGET_SCRIPT } from "./_search-widget-script.js";

export interface SearchWidgetProps {
  /** Locale-aware placeholder: "Type to search..." / 「検索したい単語を入力」 */
  placeholderText: string;
  /** Locale-aware shortcut hint: "to open search from anywhere" / 「いつでも検索バーを開ける」 */
  shortcutHint: string;
  /** Locale-aware result count template, e.g. "{count} results" */
  resultCountTemplate: string;
  /** Accessible label for the search trigger button */
  searchLabel: string;
}

/**
 * Search trigger button + dialog widget.
 *
 * Pure SSR — renders the full dialog markup including the placeholder text
 * so static HTML contains the required copy even before JS runs.
 * The `<site-search>` custom element registers itself via the inline script
 * and activates interactive behaviour (open/close/keyboard shortcut/MiniSearch)
 * only on the client.
 */
export function SearchWidget(props: SearchWidgetProps): JSX.Element {
  const { placeholderText, shortcutHint, resultCountTemplate, searchLabel } = props;
  const base = withBase("/");

  return (
    <>
      {/* @ts-expect-error site-search is a custom element not in JSX intrinsics */}
      <site-search
        data-base={base}
        data-result-count-template={resultCountTemplate}
      >
        {/* Header trigger button — search magnifier icon */}
        <button
          data-open-search
          type="button"
          class="flex items-center justify-center text-muted transition-colors hover:text-fg"
          aria-label={searchLabel}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </button>

        {/* Search dialog — rendered in SSR so the placeholder text is in
            static HTML for no-JS users and crawlers. The browser treats
            it as a closed <dialog> until the custom element calls
            showModal(). */}
        {/* z-modal / backdrop:z-modal-backdrop are defense-in-depth for the
            SPA-swap window (zfb Strategy-B `zfb:after-swap`): a native
            showModal() dialog normally sits in the top layer, but if it is
            still open while the page body is swapped it can lose top-layer
            promotion and fall back to z-index:auto, flashing behind the
            header/sidebar. The explicit modal-tier z-index keeps it above all
            chrome during that window. Intentionally redundant in the normal
            (top-layer) case — do not remove as "redundant" (epic #2148). */}
        <dialog
          data-search-dialog
          class="z-modal m-0 h-full w-full max-w-none border-none bg-transparent p-0 backdrop:z-modal-backdrop backdrop:bg-overlay/60 sm:mx-auto sm:my-[10vh] sm:h-auto sm:max-h-[80vh] sm:max-w-[52rem] sm:rounded-lg"
        >
          <div class="flex h-full flex-col overflow-hidden bg-surface sm:rounded-lg sm:border sm:border-muted">
            {/* ── Dialog header (input row) ─────────────────────────── */}
            <div class="flex items-center gap-hsp-sm border-b border-muted px-hsp-lg py-vsp-sm">
              {/* Small search icon inside the input area */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="shrink-0 text-muted"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                data-search-input
                type="text"
                placeholder={placeholderText}
                class="w-full bg-transparent text-body text-fg outline-none placeholder:text-muted"
                autocomplete="off"
                spellcheck={false}
              />
              {/* Wide-viewport hit count (hidden until results arrive) */}
              <span
                data-search-count
                class="hidden shrink-0 text-caption text-muted"
                aria-live="polite"
              />
              <button
                data-close-search
                type="button"
                class="shrink-0 text-muted hover:text-fg"
                aria-label="Close search"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            {/* Narrow-viewport hit count (below header, hidden on sm+) */}
            <span
              data-search-count-narrow
              class="hidden border-b border-muted px-hsp-lg py-vsp-xs text-caption text-muted"
              aria-live="polite"
            />

            {/* ── Results area ──────────────────────────────────────── */}
            {/* aria-live="polite" so screen readers announce result changes */}
            <div
              class="flex-1 overflow-y-auto px-hsp-lg pb-vsp-md"
              data-search-results
              aria-live="polite"
            >
              {/* Placeholder text — always in SSR HTML so no-JS users and
                  crawlers see the placeholderText and shortcutHint strings
                  in the static page source. */}
              <div class="text-small text-muted" data-search-placeholder>
                <p>{placeholderText}</p>
                <p class="mt-vsp-md text-caption">
                  {/* data-kbd-shortcut is populated by the custom element on
                      connectedCallback() with the platform shortcut string
                      (⌘K on Mac, Ctrl+K elsewhere). Empty in SSR. */}
                  <kbd
                    class="rounded border border-muted bg-bg px-hsp-2xs py-[2px] font-mono text-caption"
                    data-kbd-shortcut
                  />{" "}
                  {shortcutHint}
                </p>
              </div>
            </div>
          </div>
        </dialog>
      {/* @ts-expect-error closing custom element tag */}
      </site-search>

      {/* Inline script registers the SiteSearch custom element. Emitted once
          per page — the browser deduplicates same-id custom elements
          automatically; the `customElements.define` call below guards against
          double-registration with the `!customElements.get(...)` check. */}
      <script dangerouslySetInnerHTML={{ __html: SEARCH_WIDGET_SCRIPT }} />
    </>
  );
}
