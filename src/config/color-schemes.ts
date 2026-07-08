/**
 * Ramp-native color schemes for the non-test wisdom sites.
 *
 * These repos shared one legacy 16-slot palette before the zudo-doc 3.1
 * migration. zudo-test-wisdom already had a separate, newer AA-tuned palette,
 * so do not copy its warm ramp here: this file preserves the target-family
 * colors while using the v3 `{ ramps, map }` contract.
 */

import type { ColorScheme, Ramps, ModeMap } from "./color-scheme-utils";

export type { ColorScheme } from "./color-scheme-utils";

const ramps: Ramps = {
  base: [
    "#ece9e9", // 0 - light surface / pale foreground
    "#b8b8b8", // 1 - dark foreground
    "#888888", // 2 - dark muted text
    "#383838", // 3 - dark selection / code background
    "#181818", // 4 - dark background
  ],
  accent: [
    "#a7c0e3", // 0 - dark hover accent
    "#d69a66", // 1 - dark accent
    "#7d470b", // 2 - light accent
  ],
  state: {
    danger: "#da6871",
    success: "#93bb77",
    warning: "#dfbb77",
    info: "#5caae9",
  },
};

const lightMap: ModeMap = {
  bg: "#e2ddda",
  fg: "#303030",
  selectionBg: "#303030",
  selectionFg: { base: 0 },
  semantic: {
    surface: { base: 0 },
    muted: "#6b6b6b",
    accent: { accent: 2 },
    accentHover: "#8590a0",
    codeBg: { base: 0 },
    codeFg: "#303030",
    success: "#1f5429",
    danger: "#a01515",
    warning: "#903030",
    info: "#174fa0",
    mermaidNodeBg: { base: 0 },
    mermaidText: "#303030",
    mermaidLine: "#6b6b6b",
    mermaidLabelBg: { base: 0 },
    mermaidNoteBg: "#e2ddda",
    chatUserBg: { accent: 2 },
    chatUserText: { base: 0 },
    chatAssistantBg: { base: 0 },
    chatAssistantText: "#303030",
    imageOverlayBg: "#303030",
    imageOverlayFg: { base: 0 },
    matchedKeywordBg: "#fff59d",
    matchedKeywordFg: "#000000",
  },
};

const darkMap: ModeMap = {
  bg: { base: 4 },
  fg: { base: 1 },
  selectionBg: { base: 3 },
  selectionFg: "#e0e0e0",
  semantic: {
    surface: "#1c1c1c",
    muted: { base: 2 },
    accent: { accent: 1 },
    accentHover: { accent: 0 },
    codeBg: { base: 3 },
    codeFg: "#e0e0e0",
    success: { state: "success" },
    danger: { state: "danger" },
    warning: { state: "warning" },
    info: { state: "info" },
    mermaidNodeBg: { base: 3 },
    mermaidText: "#e0e0e0",
    mermaidLine: { base: 2 },
    mermaidLabelBg: { base: 3 },
    mermaidNoteBg: { base: 3 },
    chatUserBg: { accent: 1 },
    chatUserText: { base: 4 },
    chatAssistantBg: "#1c1c1c",
    chatAssistantText: "#e0e0e0",
    imageOverlayBg: "#1c1c1c",
    imageOverlayFg: "#e0e0e0",
    matchedKeywordBg: "#fff59d",
    matchedKeywordFg: "#000000",
  },
};

export const colorSchemes: Record<string, ColorScheme> = {
  "Default Light": { ramps, map: lightMap },
  "Default Dark": { ramps, map: darkMap },
};
