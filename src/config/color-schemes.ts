/**
 * Ramp-native color schemes (Color Ramp Restructure — zudolab/zudo-doc#2584;
 * minimize pass #2601 / #2602).
 *
 * A `ColorScheme` is `{ ramps, map }` (the MECHANISM types live in the package
 * and are re-exported by `./color-scheme-utils`):
 *   - `ramps` — the shared Tier-1 source of truth: a warm-neutral `base` ramp
 *     (5 stops, index 0 = lightest), an `accent` ramp (3 stops), and 4 `state`
 *     colors. Light and dark modes SHARE these values.
 *   - `map` — the per-mode Tier-2 wiring: which ramp stop (or literal OKLCH)
 *     each UI role points at.
 *
 * The palette was minimized from base=12 / accent=7 to **base=5 / accent=3**
 * (#2602): the ramp-native engine is length-agnostic, so this is a DATA change.
 * Semantic roles are aggressively merged onto shared stops to keep the number of
 * distinct tones small — most notably `surface`, `codeBg`(light) and
 * `chatAssistantBg` collapse onto `bg`, so header Version boxes and doc cards
 * render as page-bg + border only (no gray fill). 5 stops leave no subtle
 * near-white, so light-mode elevated fills are border-only by design.
 *
 * `ColorScheme` is re-exported here so the many sites that still
 * `import { ColorScheme } from "./color-schemes"` (contrast tooling,
 * zfb.config.ts, …) keep resolving until their own waves port them.
 */

import type { ColorScheme, Ramps, ModeMap } from "./color-scheme-utils";

export type { ColorScheme } from "./color-scheme-utils";

/**
 * Shared Tier-1 ramps — identical across Default Light and Default Dark.
 * Minimized to 5 base / 3 accent (#2602). The warm-neutral spine keeps hue 65;
 * the accent stops are the three tuned orange stops carried over from the 7-stop
 * ramp (old accent2/3/6, re-indexed). Index 0 = lightest.
 */
const ramps: Ramps = {
  base: [
    "oklch(.965 .004 65)", // 0 — lightest (light bg / dark fg)
    "oklch(.705 .008 65)", // 1 — dark muted / light selection & mermaid fill
    "oklch(.480 .008 65)", // 2 — light muted / dark selection & mermaid note
    "oklch(.300 .006 65)", // 3 — dark codeBg / mermaid fill
    "oklch(.185 .005 65)", // 4 — darkest (dark bg / light fg)
  ],
  accent: [
    "oklch(.755 .130 64)", // 0 — dark hover (was accent2)
    "oklch(.700 .158 62)", // 1 — dark accent (was accent3)
    "oklch(.470 .120 56)", // 2 — light accent (was accent6)
  ],
  state: {
    danger: "oklch(.640 .170 25)",
    success: "oklch(.680 .145 145)",
    warning: "oklch(.760 .135 82)",
    info: "oklch(.680 .130 245)",
  },
};

/**
 * Default Dark — the authored reference scheme (epic #2584; minimized #2602).
 * bg = darkest base stop, fg = lightest. Roles merged onto shared stops:
 * `surface`, `chatAssistantBg`, `imageOverlayBg` all = `bg` (b4) so elevated
 * panels are bg + border only. Per-mode AA-tuned literals: `danger`,
 * `matchedKeyword*` (carried from #2593). Full WCAG matrix passes at
 * threshold+0.1.
 */
const darkMap: ModeMap = {
  bg: { base: 4 },
  fg: { base: 0 },
  selectionBg: { base: 2 },
  selectionFg: { base: 0 },
  semantic: {
    // Merged onto bg (b4) — elevated panels read as page-bg + border, no gray fill.
    surface: { base: 4 },
    muted: { base: 1 },
    accent: { accent: 1 },
    accentHover: { accent: 0 },
    codeBg: { base: 3 },
    codeFg: { base: 0 },
    success: { state: "success" },
    // Per-mode AA-tuned literal — shared state.danger oklch(.640 .170 25) is too
    // dark for the danger-admonition title on its 12%-tint dark bg. L .640→.655
    // (H/C fixed) — admonition-danger at threshold+0.1; carried from #2593.
    danger: "oklch(.655 .170 25)",
    warning: { state: "warning" },
    info: { state: "info" },
    mermaidNodeBg: { base: 3 },
    mermaidText: { base: 0 },
    mermaidLine: { base: 1 },
    mermaidLabelBg: { base: 3 },
    mermaidNoteBg: { base: 2 },
    chatUserBg: { accent: 1 },
    chatUserText: { base: 4 },
    // Merged onto bg (b4) — the chat assistant bubble reads as page-bg + border.
    chatAssistantBg: { base: 4 },
    chatAssistantText: { base: 0 },
    imageOverlayBg: { base: 4 },
    imageOverlayFg: { base: 0 },
    // Search-result <mark> highlight: an amber (accent-hue) fill with dark text —
    // the classic highlighter look, identical in both modes. Kept as literals so
    // the amber fill is scheme-stable; matchedKeywordFg dark so text clears AA on
    // the amber bg — matched-keyword at threshold+0.1; carried from #2593.
    matchedKeywordBg: "oklch(.700 .158 62)",
    matchedKeywordFg: "oklch(.300 .003 65)",
  },
};

/**
 * Default Light — the authored light-mode scheme (epic #2584; minimized #2602).
 * Shares `ramps` with Default Dark; the `map` inverts (light bg = lightest base
 * stop, dark fg = darkest). Roles merged onto shared stops: `surface`, `codeBg`,
 * `chatAssistantBg` all = `bg` (b0) so elevated panels are bg + border only
 * (the intended flat, few-tone look — 5 stops leave no subtle near-white fill).
 * The accent/state colors — authored for a dark bg — need darker per-mode
 * literals to clear AA on a near-white bg. Full WCAG matrix passes at
 * threshold+0.1; ramps untouched so Default Dark is unaffected.
 */
const lightMap: ModeMap = {
  bg: { base: 0 },
  fg: { base: 4 },
  selectionBg: { base: 1 },
  selectionFg: { base: 4 },
  semantic: {
    // Merged onto bg (b0) — elevated panels read as page-bg + border, no gray fill.
    surface: { base: 0 },
    muted: { base: 2 },
    accent: { accent: 2 },
    // Light: per-mode literal — the accent ramp has no stop darker than accent2,
    // so the link-hover state darkens further (hover-darkens-on-light
    // convention). L .400, C fitted to the sRGB gamut edge at that L; carried
    // from #2595. accent-hover-vs-bg clears threshold+0.1.
    accentHover: "oklch(.400 .096 56)",
    // Merged onto bg (b0) — inline/code-block fill reads as page-bg + border.
    codeBg: { base: 0 },
    codeFg: { base: 4 },
    // Light: per-mode literals — the shared state colors are authored for a dark
    // bg and are too light on the 12%-tint admonition backgrounds over a light
    // page bg. Each darkened (H fixed; C at gamut max, clipped where noted) to
    // clear its admonition pair at threshold+0.1; carried from #2595.
    success: "oklch(.470 .140 145)",
    danger: "oklch(.505 .170 25)",
    warning: "oklch(.490 .100 82)", // C .135→.100 (gamut-clips at this L)
    info: "oklch(.485 .122 245)",
    mermaidNodeBg: { base: 1 },
    mermaidText: { base: 4 },
    mermaidLine: { base: 2 },
    mermaidLabelBg: { base: 1 },
    mermaidNoteBg: { base: 1 },
    chatUserBg: { accent: 1 },
    // Dark text on the amber user bubble (matches Default Dark).
    chatUserText: { base: 4 },
    // Merged onto bg (b0) — the chat assistant bubble reads as page-bg + border.
    chatAssistantBg: { base: 0 },
    chatAssistantText: { base: 4 },
    imageOverlayBg: { base: 4 },
    imageOverlayFg: { base: 0 },
    // Search-result <mark>: amber highlighter fill with dark text — same look as
    // Default Dark (an amber-on-white highlight reads identically in both modes).
    matchedKeywordBg: "oklch(.700 .158 62)",
    matchedKeywordFg: "oklch(.300 .003 65)",
  },
};

export const colorSchemes: Record<string, ColorScheme> = {
  "Default Light": { ramps, map: lightMap },
  "Default Dark": { ramps, map: darkMap },
};
