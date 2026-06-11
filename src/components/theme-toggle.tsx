"use client";

// Island-registry shim for the package ThemeToggle (zudo-doc 0.2.1).
//
// The header (pages/lib/_header-with-defaults.tsx) wraps <ThemeToggle> in
// Island({when:"load"}), which emits a data-zfb-island="ThemeToggle" marker.
// zfb's island scanner only registers "use client" modules from project
// source — it does not walk into node_modules — so rendering the package
// component directly from the header leaves the marker without a registry
// entry and the toggle dead after hydration (works in the zudo-doc monorepo
// where the component source is local; breaks for published-package
// consumers). This local module is the scanner-visible named binding; it
// delegates rendering to the real package component.
//
// Remove once zfb can register node_modules islands (reported upstream via
// the zcss 0.2.1 upgrade report).
import {
  ThemeToggle as ZudoDocThemeToggle,
  type ThemeToggleProps,
} from "@takazudo/zudo-doc/theme-toggle";

export function ThemeToggle(props: ThemeToggleProps) {
  return <ZudoDocThemeToggle {...props} />;
}
// Stable marker name even if a bundler pass rewrites the function name
// (mirrors the ThemeToggle2 esbuild collision guard, zudo-doc#1446).
ThemeToggle.displayName = "ThemeToggle";

export default ThemeToggle;
