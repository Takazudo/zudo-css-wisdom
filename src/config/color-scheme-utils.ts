/**
 * Project-side color-scheme helpers.
 *
 * The MECHANISM (ramp→CSS injection logic) now lives in the package:
 * `@takazudo/zudo-doc/color-scheme-utils`. This file re-exports those
 * mechanism symbols and adds project-specific thin wrappers that read from
 * this project's `colorSchemes` map and `settings`. The DATA (ramp values,
 * scheme names) stays in `./color-schemes` and `./settings`.
 *
 * S9a package-first migration — zudolab/zudo-doc#2333.
 * Ramp-native rewrite — zudolab/zudo-doc#2585/#2586.
 */

export {
  type OKLCH,
  type StateRole,
  type SemanticKey,
  type RampRef,
  type Ramps,
  type ModeMap,
  type ColorScheme,
  type CssEmitScope,
  STATE_ROLES,
  SEMANTIC_KEYS,
  SEMANTIC_RAMP_DEFAULTS,
  SEMANTIC_CSS_NAMES,
  resolveRampRef,
  resolveSemanticColors,
  schemeToCssPairs,
  generateCssCustomProperties as generateCssCustomPropertiesFromScheme,
  generateLightDarkCssProperties as generateLightDarkCssPropertiesFromSchemes,
} from "@takazudo/zudo-doc/color-scheme-utils";
import {
  generateCssCustomProperties as _generateCssCustomProperties,
  generateLightDarkCssProperties as _generateLightDarkCssProperties,
} from "@takazudo/zudo-doc/color-scheme-utils";

import { colorSchemes } from "./color-schemes";
import { settings } from "./settings";

export const lightDarkPairings = [
  { light: "Default Light", dark: "Default Dark", label: "Default" },
];

export function getActiveScheme() {
  const scheme = colorSchemes[settings.colorScheme];
  if (!scheme) {
    throw new Error(`Unknown color scheme: "${settings.colorScheme}". Available: ${Object.keys(colorSchemes).join(", ")}`);
  }
  return scheme;
}

/** Generate `:root { --zd-* }` CSS for the project's active single scheme. */
export function generateCssCustomProperties(): string {
  return _generateCssCustomProperties(getActiveScheme());
}

/** Generate `:root { --zd-*: light-dark(…) }` CSS for the project's configured light/dark pair. */
export function generateLightDarkCssProperties(): string {
  if (!settings.colorMode) {
    throw new Error("colorMode is not configured");
  }
  const { lightScheme, darkScheme } = settings.colorMode;
  const light = colorSchemes[lightScheme];
  const dark = colorSchemes[darkScheme];
  if (!light) throw new Error(`Unknown light scheme: "${lightScheme}"`);
  if (!dark) throw new Error(`Unknown dark scheme: "${darkScheme}"`);
  return _generateLightDarkCssProperties(light, dark);
}
