export function initSidebarResizer() {
  const sidebar = document.getElementById("desktop-sidebar");
  if (!sidebar || sidebar.querySelector("[data-sidebar-resizer]")) return;
  // Only attach to the real fixed desktop panel. On hide_sidebar pages the
  // aside renders sr-only (position:absolute) purely for the ARIA landmark; a
  // position:fixed handle would escape sr-only's clip and show a stray strip
  // (below lg the panel is display:none but still fixed — handle appended, not rendered). zudolab/zudo-doc#1821
  if (getComputedStyle(sidebar).position !== "fixed") return;

  // Resizer allows a wider range (192–448px) than the CSS default
  // (clamp(14rem, 20vw, 22rem) = 224–352px at 16px base).
  // CSS provides the responsive initial width; the resizer lets users
  // go beyond that range when explicitly dragging or using keyboard arrows.
  const MIN_W = 192;
  const MAX_W = 448;
  const STEP = 10;
  const LS_KEY = "zudo-doc-sidebar-width";
  const CSS_PROP = "--zd-sidebar-w";
  const ACCENT_BG = "var(--zd-accent, rgba(128,128,128,0.3))";
  const ACCENT_OUTLINE = "2px solid var(--zd-accent, rgba(128,128,128,0.5))";
  const ACCENT_GHOST = "var(--zd-accent, rgba(128,128,128,0.5))";

  function readCurrentWidth(): number {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(CSS_PROP);
    return raw ? parseFloat(raw) || MIN_W : MIN_W;
  }

  let cachedWidth = readCurrentWidth();

  const handle = document.createElement("div");
  handle.setAttribute("data-sidebar-resizer", "");
  handle.setAttribute("tabindex", "0");
  handle.setAttribute("role", "separator");
  handle.setAttribute("aria-orientation", "vertical");
  handle.setAttribute("aria-label", "Resize sidebar");
  handle.setAttribute("aria-valuemin", String(MIN_W));
  handle.setAttribute("aria-valuemax", String(MAX_W));
  handle.setAttribute("aria-valuenow", String(Math.round(cachedWidth)));
  // position:fixed (not absolute) pins the handle to the viewport so it spans
  // the sidebar's full height even while #desktop-sidebar scrolls. As an
  // absolute child of the overflow-y:auto sidebar the handle scrolled away with
  // the content and its height:100% only resolved to the visible padding box,
  // so the bottom of the sidebar lost its grab strip once scrolled. zudolab/zudo-doc#1821
  //
  // top:3.5rem + left:calc mirror the doc-layout #desktop-sidebar geometry
  // (top-[3.5rem], left:0, width:var(--zd-sidebar-w)) — those layout constants
  // live in the same package's doc-layout.tsx. 20px is wider than every common
  // native y-scrollbar (~12-17px on Win/Linux classic; 0 on macOS overlay) so a
  // draggable strip always remains visible to the LEFT of the scrollbar when
  // sidebar content overflows. zudolab/zudo-doc#1660
  Object.assign(handle.style, {
    position: "fixed",
    top: "3.5rem",
    bottom: "0",
    left: "calc(var(--zd-sidebar-w) - 20px)",
    width: "20px",
    cursor: "col-resize",
    zIndex: "10",
    transition: "background 0.15s",
  });

  let dragging = false;

  function applyWidth(w: number) {
    cachedWidth = Math.max(MIN_W, Math.min(MAX_W, w));
    document.documentElement.style.setProperty(CSS_PROP, cachedWidth + "px");
    try { localStorage.setItem(LS_KEY, String(Math.round(cachedWidth))); } catch {}
    handle.setAttribute("aria-valuenow", String(Math.round(cachedWidth)));
  }

  let focused = false;

  function updateHandleVisual() {
    if (dragging || focused) {
      handle.style.background = ACCENT_BG;
    } else {
      handle.style.background = "";
    }
    handle.style.outline = focused && !dragging ? ACCENT_OUTLINE : "";
    handle.style.outlineOffset = focused && !dragging ? "1px" : "";
  }

  handle.addEventListener("focus", () => {
    focused = true;
    updateHandleVisual();
  });
  handle.addEventListener("blur", () => {
    focused = false;
    updateHandleVisual();
  });

  handle.addEventListener("keydown", (e: KeyboardEvent) => {
    let w = cachedWidth;
    switch (e.key) {
      case "ArrowLeft":
        w = Math.max(MIN_W, w - STEP);
        break;
      case "ArrowRight":
        w = Math.min(MAX_W, w + STEP);
        break;
      case "Home":
        w = MIN_W;
        break;
      case "End":
        w = MAX_W;
        break;
      default:
        return;
    }
    e.preventDefault();
    applyWidth(w);
  });

  handle.addEventListener("mouseenter", () => {
    if (!dragging && !focused) handle.style.background = ACCENT_BG;
  });
  handle.addEventListener("mouseleave", () => {
    if (!dragging && !focused) handle.style.background = "";
  });

  handle.addEventListener("pointerdown", (e: PointerEvent) => {
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    dragging = true;
    updateHandleVisual();
    document.documentElement.style.cursor = "col-resize";
    document.documentElement.style.userSelect = "none";

    // Ghost line — cheap to move (no reflow), shows target position
    const ghost = document.createElement("div");
    Object.assign(ghost.style, {
      position: "fixed",
      top: "0",
      width: "2px",
      height: "100vh",
      background: ACCENT_GHOST,
      pointerEvents: "none",
      zIndex: "9999",
    });
    const sidebarRect = sidebar.getBoundingClientRect();
    const sidebarLeft = sidebarRect.left;
    ghost.style.left = (sidebarLeft + sidebarRect.width) + "px";
    document.body.appendChild(ghost);
    let targetWidth = 0;
    let cleaned = false;

    const onMove = (ev: PointerEvent) => {
      targetWidth = Math.max(MIN_W, Math.min(MAX_W, ev.clientX - sidebarLeft));
      ghost.style.left = (sidebarLeft + targetWidth) + "px";
    };

    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      dragging = false;
      updateHandleVisual();
      document.documentElement.style.cursor = "";
      document.documentElement.style.userSelect = "";
      ghost.remove();
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onCancel);
      handle.removeEventListener("lostpointercapture", onLost);
    };

    const commit = () => {
      if (targetWidth > 0) applyWidth(targetWidth);
    };

    // pointerup: normal end-of-drag. Commit, then teardown.
    const onUp = () => {
      commit();
      cleanup();
    };

    // lostpointercapture: per spec fires AFTER pointerup, but browsers reorder
    // these in edge cases (cursor near y-scrollbar, fast drags, OS handoff).
    // Commit here too so a real drag still applies if pointerup is dropped.
    // Idempotent with onUp via the `cleaned` guard.
    const onLost = () => {
      commit();
      cleanup();
    };

    // pointercancel: actual user/OS cancellation (touch interrupted, etc.).
    // Do NOT commit — caller intent was to abort.
    const onCancel = () => {
      cleanup();
    };

    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onCancel);
    handle.addEventListener("lostpointercapture", onLost);
  });

  sidebar.appendChild(handle);
}
