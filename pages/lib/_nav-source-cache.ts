// Snapshot-anchored memoization for nav-source arrays.
//
// WHY THIS EXISTS — build-time array-identity stabilization
// --------------------------------------------------------
// zfb's `getCollection(name)` returns a FRESH array of FRESH entry objects on
// every call (it `.map()`s over the underlying snapshot — see
// `node_modules/@takazudo/zfb/dist/content.js`). The doc-route `paths()`
// functions are re-invoked once per built page (e.g. ~123× for the EN docs
// route), and the per-page sidebar + header each re-derive their nav source
// independently. The net effect: `buildNavTree` is called ~2× the page count
// (~900 calls for 251 pages), and every call recomputed an O(n log n)
// stringify+sort cache key over the entire docs collection.
//
// The fix anchors identity on the ONE thing stable across the whole build:
// `getContentSnapshot().collections[name]` — the readonly snapshot array zfb
// installs once at worker boot (verified INSTALLED during `pnpm build`,
// collections `[docs, docs-ja, docs-v-*]`). We memoize the bridged +
// draft-filtered arrays on that anchor (WeakMap) so every repeat caller
// receives the SAME array instance. `buildNavTree`'s WeakMap fast-path
// (`src/utils/docs.ts`) then short-circuits the key computation on identity,
// collapsing ~900 key computations to the handful of distinct
// (snapshot, locale, version, options) inputs.
//
// FALLBACK (no snapshot): unit tests and direct Node invocations run the
// filesystem path with no installed snapshot. There is no stable anchor array
// to key on, AND the underlying `getCollection(name)` result can legitimately
// change between calls in that mode (e.g. a test swapping its mock for the same
// collection name). So we DELIBERATELY do not memoize the no-snapshot path —
// it computes fresh each call. The perf win targets the real build, where the
// snapshot is always installed; correctness wins in the fallback path.
//
// HMR intent preserved: a content edit produces a NEW snapshot object (new
// `collections[name]` array identity), so every memo here misses and
// recomputes — matching the old content-keyed cache's change detection.

import { getCollection, getContentSnapshot } from "zfb/content";
import { bridgeDocsEntries, type ZfbDocsData } from "../_data";
import type { DocPageEntry } from "./doc-page-props";

// ---------------------------------------------------------------------------
// Snapshot anchor → stable bridged arrays
// ---------------------------------------------------------------------------

/**
 * The stable per-build anchor array for a collection: the raw readonly
 * snapshot array zfb installed once. Returns `undefined` when no snapshot is
 * installed (filesystem-fallback path) so callers take the fresh, unmemoized
 * branch.
 */
function snapshotAnchor(name: string): readonly unknown[] | undefined {
  return getContentSnapshot()?.collections[name];
}

// Per-anchor-array memo of the bridged + draft-filtered entries. Keyed on the
// snapshot array identity so a new build snapshot invalidates automatically.
const bridgedByAnchor = new WeakMap<object, DocPageEntry[]>();

function buildBridged(collectionName: string): DocPageEntry[] {
  const raw = getCollection<ZfbDocsData>(collectionName);
  return bridgeDocsEntries(raw, collectionName).filter(
    (d) => !d.data.draft,
  );
}

/**
 * Identity-stable, draft-filtered `DocPageEntry[]` for a collection.
 *
 * Returns the SAME array instance on every call within one build (anchored on
 * the snapshot array), so downstream derived arrays — and ultimately
 * `buildNavTree` — can rely on reference equality. The entries carry the full
 * `DocPageEntry` shape (Content, body, module_specifier, id, collection) the
 * route `paths()` props need.
 */
export function stableDocs(collectionName: string): DocPageEntry[] {
  const anchor = snapshotAnchor(collectionName);

  // No snapshot (fs-fallback / unit tests): compute fresh, do not memoize —
  // see the no-snapshot rationale in the module header.
  if (anchor === undefined) {
    return buildBridged(collectionName);
  }

  const cached = bridgedByAnchor.get(anchor);
  if (cached) return cached;
  const built = buildBridged(collectionName);
  bridgedByAnchor.set(anchor, built);
  return built;
}

// ---------------------------------------------------------------------------
// Generic derived-array memo (merge / filter results)
// ---------------------------------------------------------------------------

// Two-level memo: a WeakMap on the FIRST stable input array (so a new snapshot
// drops the whole sub-map), then a string key combining the remaining stable
// inputs' identities and the option signature.
const derivedMemo = new WeakMap<object, Map<string, unknown>>();
// Per-build incrementing ids for stable arrays, so a multi-array key can be a
// cheap string. Lives in a WeakMap so it does not retain arrays past their
// snapshot.
const arrayId = new WeakMap<object, number>();
let nextArrayId = 1;
function idOf(arr: object): number {
  let id = arrayId.get(arr);
  if (id === undefined) {
    id = nextArrayId++;
    arrayId.set(arr, id);
  }
  return id;
}

// Anchor object for the rare case of an empty `inputs` array (e.g. an absent
// locale collection). Lets the WeakMap still key the derived memo.
const EMPTY_INPUT_ANCHOR: object = {};

/**
 * Memoize a derived array (e.g. a locale merge or an `isNavVisible` filter)
 * on the identity of its stable inputs plus a caller-supplied option
 * signature.
 *
 * `inputs` MUST be the stable arrays returned by {@link stableDocs} (or arrays
 * derived from them through this same helper) — passing a fresh array defeats
 * the memo. `optionSig` distinguishes call sites that differ only in filter
 * options (e.g. `applyDefaultLocaleOnlyFilter`, `keepUnlisted`), so they never
 * collide on the same key.
 */
export function memoizeDerived<T>(
  inputs: readonly object[],
  optionSig: string,
  compute: () => T,
): T {
  const primary = inputs[0] ?? EMPTY_INPUT_ANCHOR;
  let sub = derivedMemo.get(primary);
  if (!sub) {
    sub = new Map();
    derivedMemo.set(primary, sub);
  }
  const key = `${inputs.map((a) => idOf(a)).join("/")}::${optionSig}`;
  // Use has(): a legitimately-`undefined` computed result must still register
  // as a cache hit, otherwise it recomputes every call.
  if (sub.has(key)) return sub.get(key) as T;
  const computed = compute();
  sub.set(key, computed);
  return computed;
}
