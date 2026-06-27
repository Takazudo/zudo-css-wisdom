/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Host thin-stub — see @takazudo/zudo-doc/search-widget (epic #2344, S5).
// Injects the host's base path and re-exports the package SearchWidget.
import type { JSX } from "preact";
import {
  SearchWidget as PackageSearchWidget,
  type SearchWidgetProps as PackageSearchWidgetProps,
} from "@takazudo/zudo-doc/search-widget";
import { withBase } from "@/utils/base";

export type SearchWidgetProps = Omit<PackageSearchWidgetProps, "base">;

/** Locale-aware search widget — thin host stub that injects the base path. */
export function SearchWidget(props: SearchWidgetProps): JSX.Element {
  return <PackageSearchWidget {...props} base={withBase("/")} />;
}
