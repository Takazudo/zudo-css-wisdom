// W6A stub — no-op default export.
//
// The host installs a tiny client-side router bootstrap that re-runs
// island lifecycle code across zfb navigations. Generated projects ship
// the no-op so unconditional page imports (`pages/lib/_body-end-islands`)
// resolve without dragging the routing bridge into every scaffold.
import type { JSX } from "preact";

function ClientRouterBootstrap(): JSX.Element | null {
  return null;
}
ClientRouterBootstrap.displayName = "ClientRouterBootstrap";

export default ClientRouterBootstrap;
