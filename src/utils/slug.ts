// Canonical root-slug rule (zudolab/zudo-doc#1891, closes #1873).
//
// A doc collection's bare root `index.mdx` must resolve to the canonical
// URL `/docs/` — i.e. an EMPTY route slug `""` — NOT `/docs/index/`.
// Five independent index-stripping sites historically disagreed on what a
// bare root `index` becomes; this helper is the single source of truth they
// all route through (the standalone doc-history-server package duplicates the
// one-liner with a pointer comment back here — it cannot import across the
// package boundary; see its CLAUDE.md).
//
// Rule:
//   - bare root  "index"      → ""   (URL /docs/)
//   - nested     "x/index"    → "x"  (URL /docs/x/)
//   - everything else         → unchanged
//
// doc-history storage uses the OPPOSITE convention: the per-page JSON and the
// build-time meta manifest key the root entry under "index" (an empty path
// segment is unroutable — the server regex /^\/doc-history\/(.+)\.json$/ and
// the `<locale>/<slug>.json` composition both reject ""). `toHistorySlug`
// applies the `"" -> "index"` sentinel so the doc-history client fetch path
// and the meta-manifest lookup land on the stored key. See `toHistorySlug`.
export function toRouteSlug(id: string): string {
  if (id === "index") return "";
  return id.replace(/\/index$/, "");
}

// Doc-history storage sentinel — the inverse of the bare-root case of
// `toRouteSlug`. The canonical route slug for a root index is "" (→ /docs/),
// but doc-history JSON is stored/served under "index" (an empty path segment
// is unroutable). Apply this to the route slug BEFORE composing the
// doc-history fetch path and the meta-manifest key so root pages resolve to
// e.g. /doc-history/index.json and /doc-history/<locale>/index.json.
// Non-empty slugs pass through unchanged.
export function toHistorySlug(routeSlug: string): string {
  return routeSlug === "" ? "index" : routeSlug;
}

// Convert a canonical route slug into the `params.slug` array zfb's
// optional-catchall route (`[[...slug]]`) expects. The bare root ("") maps to
// `[]` (zero segments → /docs/); a naive `"".split("/")` yields `[""]`, which
// zfb's catchall router REJECTS (empty array element), silently dropping the
// entire route. Every `.split("/")` at a docs route's paths() site must go
// through this helper.
export function toSlugParams(routeSlug: string): string[] {
  return routeSlug === "" ? [] : routeSlug.split("/");
}

export function toTitleCase(str: string): string {
  return str
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
