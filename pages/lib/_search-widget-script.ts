// Client-side script for the SiteSearch custom element.
//
// Implemented as a plain JavaScript IIFE (no ES-module `import` statements)
// so it can be emitted via `dangerouslySetInnerHTML` without requiring bundler
// support for inline scripts.
//
// Key differences from the bundled module approach:
//   - MiniSearch is NOT imported; a lightweight built-in search (fetch
//     index + simple word-match scoring) is used instead. This avoids the
//     inline-script bundling limitation. Full MiniSearch integration can be
//     added in a follow-up topic once the bundle pipeline is in place.
//   - The post-navigation rebinder pulls its event name from
//     `AFTER_NAVIGATE_EVENT` in
//     `@takazudo/zudo-doc/transitions` (today: `zfb:after-swap`)
//     rather than a hard-coded `astro:*` literal. See
//     zudolab/zudo-doc#1335 (E2 task 2 half B) for the vocabulary
//     introduction and zudolab/zudo-doc#1523 for the W6B flip from
//     `DOMContentLoaded` to the Strategy B SPA event name.

import { AFTER_NAVIGATE_EVENT } from "@takazudo/zudo-doc/transitions";

export const SEARCH_WIDGET_SCRIPT = /* javascript */ `(function () {
  if (customElements.get("site-search")) return; // guard double-registration

  var PAGE_SIZE = 10;

  // Allowlist-based href sanitizer: only relative paths and http(s) URLs are
  // permitted. Anything else (e.g. javascript:, data:) falls back to "#" so a
  // malicious entry in search-index.json cannot turn a result link into a
  // script-injection vector.
  function safeHref(url) {
    if (!url) return "#";
    var s = String(url);
    if (s.startsWith("/") || s.startsWith("http://") || s.startsWith("https://")) {
      return s;
    }
    return "#";
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeRegExp(text) {
    return text.replace(/[.*+?^\${}()|[\\]\\\\]/g, "\\\\$&");
  }

  function parseTerms(query) {
    return query.trim().split(/\\s+/).filter(Boolean);
  }

  // scoreEntry reads pre-lowercased fields (_titleLc, _descLc, _bodyLc)
  // set by prepareLc() at index-load time. Terms arrive already lowercased
  // from search() so no per-call toLowerCase() is needed.
  function scoreEntry(entry, terms) {
    var score = 0;
    var titleLc = entry._titleLc;
    var descLc  = entry._descLc;
    var bodyLc  = entry._bodyLc;
    for (var i = 0; i < terms.length; i++) {
      var t = terms[i];
      if (titleLc.indexOf(t) !== -1) score += 3;
      if (descLc.indexOf(t) !== -1)  score += 2;
      if (bodyLc.indexOf(t) !== -1)  score += 1;
    }
    return score;
  }

  // Pre-lowercase the searched fields on each entry once at load time so that
  // scoreEntry() does not re-lowercase the entire ~162 KB index on every
  // debounced keystroke.  Original-case fields are preserved for display.
  function prepareLc(entries) {
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      e._titleLc = (e.title       || "").toLowerCase();
      e._descLc  = (e.description || "").toLowerCase();
      e._bodyLc  = (e.body        || "").toLowerCase();
    }
  }

  function highlightTerms(text, terms) {
    if (!terms.length) return escapeHtml(text);
    var escaped = terms.map(function(t) { return escapeRegExp(t); });
    var pattern = new RegExp("(" + escaped.join("|") + ")", "gi");
    return text.split(pattern).map(function(seg, i) {
      return i % 2 === 1
        ? "<mark>" + escapeHtml(seg) + "</mark>"
        : escapeHtml(seg);
    }).join("");
  }

  function truncate(text, query, max) {
    max = max || 200;
    if (text.length <= max) return text;
    var terms = parseTerms(query);
    var lower = text.toLowerCase();
    var best = -1;
    for (var i = 0; i < terms.length; i++) {
      var idx = lower.indexOf(terms[i].toLowerCase());
      if (idx !== -1 && (best === -1 || idx < best)) best = idx;
    }
    if (best === -1) return text.slice(0, max) + "\\u2026";
    var half = Math.floor(max / 2);
    var start = Math.max(0, best - half);
    var end = start + max;
    if (end > text.length) { end = text.length; start = Math.max(0, end - max); }
    var result = text.slice(start, end);
    if (start > 0) result = "\\u2026" + result;
    if (end < text.length) result += "\\u2026";
    return result;
  }

  customElements.define("site-search", class SiteSearch extends HTMLElement {
    constructor() {
      super();
      this._dialog = null;
      this._openBtn = null;
      this._closeBtn = null;
      this._input = null;
      this._results = null;
      this._countWide = null;
      this._countNarrow = null;
      this._entries = null;
      this._loading = false;
      this._indexUnavailable = false;
      this._debounce = null;
      this._currentQuery = "";
      this._allResults = [];
      this._shownCount = 0;
      this._shortcut = "";
      this._resultCountTemplate = "";
      this._keydownHandler = null;
      // Delegated click handler on the results container: closing the dialog
      // when a result link is activated (epic #2148). Held so disconnectedCallback
      // can detach it on body swap.
      this._resultsClickHandler = null;
      this._observer = null;
      this._sentinel = null;
      this._isLoadingBatch = false;
      // Snapshot of the initial results-area HTML (includes SSR placeholder).
      // Captured in connectedCallback so we can restore it on input-clear
      // without re-querying the DOM (the placeholder node is replaced once
      // search results are rendered).
      this._placeholderHtml = "";
      // Held so we can remove the document-level after-navigate listener
      // in disconnectedCallback. zudolab/zudo-doc#1523 — under Strategy B
      // SPA navigation a non-persisted <site-search> element would leak
      // one document listener per nav without this hook.
      this._afterNavHandler = null;
    }

    connectedCallback() {
      this._dialog = this.querySelector("[data-search-dialog]");
      this._openBtn = this.querySelector("[data-open-search]");
      this._closeBtn = this.querySelector("[data-close-search]");
      this._input = this.querySelector("[data-search-input]");
      this._results = this.querySelector("[data-search-results]");
      this._countWide = this.querySelector("[data-search-count]");
      this._countNarrow = this.querySelector("[data-search-count-narrow]");
      this._resultCountTemplate = this.dataset.resultCountTemplate || "{count} results";
      // Snapshot the placeholder HTML before any search renders overwrite it.
      this._placeholderHtml = this._results ? this._results.innerHTML : "";

      // Platform keyboard-shortcut label — injected into [data-kbd-shortcut]
      var nav = navigator;
      var isMac = /Mac|iPhone|iPad|iPod/.test(
        (nav.userAgentData && nav.userAgentData.platform) || nav.userAgent
      );
      this._shortcut = isMac ? "\\u2318K" : "Ctrl+K";
      var kbdEl = this.querySelector("[data-kbd-shortcut]");
      if (kbdEl) kbdEl.textContent = this._shortcut;

      // Wire open/close handlers
      var self = this;
      if (this._openBtn) {
        this._openBtn.addEventListener("click", function() { self.openDialog(); });
      }
      if (this._closeBtn) {
        this._closeBtn.addEventListener("click", function() { self.closeDialog(); });
      }
      if (this._dialog) {
        this._dialog.addEventListener("close", function() {
          document.documentElement.style.overflow = "";
        });
        this._dialog.addEventListener("click", function(e) {
          if (e.target === self._dialog) self.closeDialog();
        });
      }
      if (this._input) {
        this._input.addEventListener("input", function() { self.handleInput(); });
      }

      // Close-on-result-click (epic #2148): result links are created dynamically
      // in renderResult(), so use one delegated listener on the results container
      // instead of per-link handlers. We do NOT preventDefault — the link's own
      // navigation (zfb Strategy-B SPA swap or a plain load) must still proceed;
      // we only close the <dialog> so it does not linger over the swapped page.
      // closeDialog() runs synchronously before navigation; the dialog's close
      // restores documentElement overflow via the existing "close" listener.
      if (this._results) {
        this._resultsClickHandler = function(e) {
          var t = e.target;
          while (t && t !== self._results) {
            if (t.tagName === "A") { self.closeDialog(); return; }
            t = t.parentNode;
          }
        };
        this._results.addEventListener("click", this._resultsClickHandler);
      }

      // Global keyboard shortcut (⌘K / Ctrl+K to open)
      this._keydownHandler = function(e) {
        if ((e.metaKey || e.ctrlKey) && e.key === "k") {
          e.preventDefault();
          self.openDialog();
        }
      };
      document.addEventListener("keydown", this._keydownHandler);

      // View-Transitions compat: re-run on the v2 after-navigate event.
      // Stored on the instance so disconnectedCallback can detach it on
      // body swap when this element is NOT persisted via
      // data-zfb-transition-persist (zudolab/zudo-doc#1523).
      this._afterNavHandler = function() {
        // Backstop for the original bug (epic #2148): if the dialog is somehow
        // still open after an SPA body swap (e.g. a nav path that bypassed the
        // result-click handler), close it so it does not linger / flash over the
        // newly-swapped page. Safe no-op when already closed.
        if (self._dialog && self._dialog.open) self.closeDialog();
        var kbdEl2 = self.querySelector("[data-kbd-shortcut]");
        if (kbdEl2) kbdEl2.textContent = self._shortcut;
      };
      document.addEventListener(${JSON.stringify(AFTER_NAVIGATE_EVENT)}, this._afterNavHandler);
    }

    disconnectedCallback() {
      if (this._keydownHandler) {
        document.removeEventListener("keydown", this._keydownHandler);
        this._keydownHandler = null;
      }
      if (this._afterNavHandler) {
        document.removeEventListener(${JSON.stringify(AFTER_NAVIGATE_EVENT)}, this._afterNavHandler);
        this._afterNavHandler = null;
      }
      if (this._resultsClickHandler && this._results) {
        this._results.removeEventListener("click", this._resultsClickHandler);
        this._resultsClickHandler = null;
      }
      this.teardownSentinel();
    }

    openDialog() {
      if (!this._dialog) return;
      document.documentElement.style.overflow = "hidden";
      this._dialog.showModal();
      if (this._input) {
        this._input.focus();
        this._input.select();
      }
      if (!this._entries && !this._loading) {
        this.loadIndex();
      }
    }

    closeDialog() {
      if (!this._dialog) return;
      this._dialog.close();
      document.documentElement.style.overflow = "";
    }

    handleInput() {
      var self = this;
      if (this._debounce) clearTimeout(this._debounce);
      this._debounce = setTimeout(function() { self.search(); }, 150);
    }

    loadIndex() {
      if (this._loading) return;
      this._loading = true;
      var self = this;
      var base = this.dataset.base || "/";
      fetch(base + "search-index.json")
        .then(function(r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        })
        .then(function(data) {
          self._entries = Array.isArray(data) ? data : (data.entries || []);
          prepareLc(self._entries);
          self._loading = false;
          // Clear the unavailable flag BEFORE re-running search so a successful
          // retry (e.g. via the openDialog() reload path) fully recovers (#2062).
          self._indexUnavailable = false;
          // If user already typed, search now
          if (self._input && self._input.value.trim()) {
            self.search();
          }
        })
        .catch(function() {
          self._loading = false;
          self._indexUnavailable = true;
          if (self._results) {
            self._results.innerHTML = "<p class=\\"text-small text-muted\\">Search unavailable</p>";
          }
        });
    }

    search() {
      var query = this._input ? this._input.value.trim() : "";
      this._currentQuery = query;

      if (!query) {
        this.teardownSentinel();
        this._allResults = [];
        this._shownCount = 0;
        if (this._results) this._results.innerHTML = this.placeholderHtml();
        this.updateCount();
        return;
      }

      if (!this._entries) {
        // Index failed to load: show the terminal "Search unavailable" state and
        // stop — do NOT show "Loading search index…" or refetch on every
        // keystroke (#2062). The openDialog() reload path is the intended retry
        // trigger. Clear any stale result state/count/sentinel first.
        if (this._indexUnavailable) {
          this.teardownSentinel();
          this._allResults = [];
          this._shownCount = 0;
          if (this._results) {
            this._results.innerHTML = "<p class=\\"text-small text-muted\\">Search unavailable</p>";
          }
          this.updateCount();
          return;
        }
        if (this._results) {
          this._results.innerHTML = "<p class=\\"text-small text-muted\\">Loading search index\\u2026</p>";
        }
        if (!this._loading) this.loadIndex();
        return;
      }

      // Lowercase the query terms once here so scoreEntry() can do plain
      // indexOf() against pre-lowercased entry fields without repeating
      // toLowerCase() across the entire index on every keystroke.
      var terms = parseTerms(query).map(function(t) { return t.toLowerCase(); });
      var scored = [];
      for (var i = 0; i < this._entries.length; i++) {
        var s = scoreEntry(this._entries[i], terms);
        if (s > 0) scored.push({ entry: this._entries[i], score: s });
      }
      scored.sort(function(a, b) { return b.score - a.score; });
      this._allResults = scored;
      this._shownCount = 0;
      this.teardownSentinel();
      this.updateCount();

      if (!scored.length) {
        if (this._results) {
          this._results.innerHTML = "<p class=\\"text-small text-muted\\">No results found.</p>";
        }
        return;
      }

      if (this._results) this._results.innerHTML = "";
      this.loadMore();
      if (this._shownCount < this._allResults.length) {
        this.setupSentinel();
      }
    }

    loadMore() {
      if (this._isLoadingBatch) return;
      if (this._shownCount >= this._allResults.length) return;
      this._isLoadingBatch = true;
      try {
        var batch = this._allResults.slice(this._shownCount, this._shownCount + PAGE_SIZE);
        var self = this;
        for (var i = 0; i < batch.length; i++) {
          var article = self.renderResult(batch[i].entry);
          if (self._sentinel && self._sentinel.parentNode === self._results) {
            self._results.insertBefore(article, self._sentinel);
          } else if (self._results) {
            self._results.appendChild(article);
          }
        }
        this._shownCount += batch.length;
        if (this._shownCount >= this._allResults.length) {
          this.teardownSentinel();
        }
      } finally {
        this._isLoadingBatch = false;
      }
    }

    setupSentinel() {
      this.teardownSentinel();
      if (!this._results) return;
      var sentinel = document.createElement("div");
      sentinel.setAttribute("data-search-sentinel", "");
      sentinel.setAttribute("aria-hidden", "true");
      sentinel.style.height = "1px";
      sentinel.style.width = "100%";
      this._results.appendChild(sentinel);
      this._sentinel = sentinel;
      var self = this;
      this._observer = new IntersectionObserver(function(entries) {
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting) self.loadMore();
        }
      }, { root: this._results, rootMargin: "200px 0px" });
      this._observer.observe(sentinel);
    }

    teardownSentinel() {
      if (this._observer) { this._observer.disconnect(); this._observer = null; }
      if (this._sentinel) { this._sentinel.remove(); this._sentinel = null; }
    }

    updateCount() {
      var count = this._allResults.length;
      var template = this._resultCountTemplate;
      var text = count > 0 ? template.replace("{count}", String(count)) : "";
      var show = !!text;
      if (this._countWide) {
        this._countWide.textContent = text;
        this._countWide.classList.toggle("hidden", !show);
      }
      if (this._countNarrow) {
        this._countNarrow.textContent = text;
        this._countNarrow.classList.toggle("hidden", !show);
      }
    }

    placeholderHtml() {
      return this._placeholderHtml;
    }

    renderResult(entry) {
      var article = document.createElement("article");
      article.className = "-mx-hsp-lg border-b border-muted";
      var link = document.createElement("a");
      link.href = safeHref(entry.url);
      link.className =
        "group block px-hsp-lg py-vsp-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
      var title = document.createElement("span");
      title.className =
        "font-semibold text-fg group-hover:text-accent group-hover:underline group-focus-visible:underline";
      var terms = parseTerms(this._currentQuery);
      title.innerHTML = highlightTerms(entry.title || "", terms);
      link.appendChild(title);
      var text = entry.description || entry.body;
      if (text) {
        var excerpt = document.createElement("p");
        excerpt.className =
          "mt-vsp-2xs text-caption text-muted leading-relaxed group-hover:underline group-focus-visible:underline decoration-muted";
        var truncated = truncate(text, this._currentQuery, 200);
        excerpt.innerHTML = highlightTerms(truncated, terms);
        link.appendChild(excerpt);
      }
      article.appendChild(link);
      return article;
    }
  });
})();`;
