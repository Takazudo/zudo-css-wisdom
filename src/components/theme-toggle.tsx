"use client";

// Scanner-visible ThemeToggle shim. zfb's island scanner does not register
// "use client" modules located under node_modules (Takazudo/zudo-front-builder#999),
// so importing the package ThemeToggle straight into the server-rendered header
// emits an island marker with no matching registry entry — the toggle renders
// but never hydrates, on every page (zudolab/zudo-doc#2048). This thin
// project-source wrapper gives the scanner a local binding to register; it
// re-wraps the bare (non-island-wrapped) package component unchanged.
import type { JSX } from "preact";
import {
  ThemeToggle as ZudoDocThemeToggle,
  type ThemeToggleProps,
} from "@takazudo/zudo-doc/theme-toggle";

export function ThemeToggle(props: ThemeToggleProps): JSX.Element {
  return <ZudoDocThemeToggle {...props} />;
}
ThemeToggle.displayName = "ThemeToggle";

export type { ThemeToggleProps };

export default ThemeToggle;
