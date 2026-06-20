// W6A stub — no-op default export.
//
// The host (zudo-doc showcase) ships an interactive preset-generator
// island used by its onboarding pages. Generated downstream projects
// ship the no-op so unconditional page imports (`pages/lib/_preset-generator`)
// resolve. Wire a real implementation by replacing this file.
import type { JSX } from "preact";

function PresetGenerator(): JSX.Element | null {
  return null;
}
PresetGenerator.displayName = "PresetGenerator";

export default PresetGenerator;
