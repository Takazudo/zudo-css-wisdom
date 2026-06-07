// Shared discriminated-union props types for all 4 doc-route pages.
//
// Each route file has its own DocPageProps interface that extends one of these
// two branches by merging in route-specific fields (locale, version, etc.).
// Discriminating on `kind` lets TypeScript narrow `entry` / `autoIndex` to
// non-null inside each branch — eliminating all `entry!` assertions.

import type { CollectionEntry } from "zfb/content";
import type { DocsEntry } from "@/types/docs-entry";
import type { NavNode, BreadcrumbItem } from "@/utils/docs";
import type { extractHeadings } from "./_extract-headings";

export interface DocPageEntry extends DocsEntry {
  /** zfb content renderer. */
  Content: CollectionEntry<unknown>["Content"];
  /** zfb module specifier (for Content bridge). */
  module_specifier: string;
}

export interface AutoIndexNode extends NavNode {
  children: NavNode[];
}

/** Shared fields present in every doc-page route. */
interface DocPagePropsBase {
  breadcrumbs: BreadcrumbItem[];
  prev: NavNode | null;
  next: NavNode | null;
  /** Depth-2/3/4 headings extracted from the MDX body, for SSG TOC links. */
  headings: ReturnType<typeof extractHeadings>;
}

/** Branch: a real content entry. `autoIndex` is absent. */
export interface DocPageEntryProps extends DocPagePropsBase {
  kind: "entry";
  entry: DocPageEntry;
  autoIndex?: undefined;
}

/** Branch: an auto-generated category index. `entry` is absent. */
export interface DocPageAutoIndexProps extends DocPagePropsBase {
  kind: "autoIndex";
  autoIndex: AutoIndexNode;
  entry?: undefined;
}

/** Discriminated union for the `kind` prop. Narrow via `props.kind === "entry"`. */
export type DocPageBaseProps = DocPageEntryProps | DocPageAutoIndexProps;
