// W6A stub — no-op default Preact wrapper.
//
// When the designTokenPanel feature is enabled, the feature template
// overwrites this file with the real wrapper that side-effect-imports
// `@/lib/design-token-panel-bootstrap` (which calls configurePanel and
// mounts zdtp). Generated projects without the feature ship the no-op
// so the unconditional `pages/lib/_body-end-islands` import resolves.
import type { JSX } from "preact";

function DesignTokenPanelBootstrap(): JSX.Element | null {
  return null;
}
DesignTokenPanelBootstrap.displayName = "DesignTokenPanelBootstrap";

export default DesignTokenPanelBootstrap;
