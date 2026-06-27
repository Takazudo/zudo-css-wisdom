// Host-side filter helper that turns a doc entry's `data` (frontmatter)
// into the `entries` array expected by `<FrontmatterPreview>`.
//
// The v2 component (packages/zudo-doc/src/metainfo/frontmatter-preview.tsx)
// is a pure renderer — the caller is responsible for:
//
//  1. Honouring `settings.frontmatterPreview === false` (block hidden everywhere).
//  2. Removing schema-managed system keys (DEFAULT_FRONTMATTER_IGNORE_KEYS).
//  3. Applying the host's `ignoreKeys` (replaces the default list) or
//     `extraIgnoreKeys` (adds to the default).
//  4. Skipping null/undefined values.
//
// Returning an empty array suppresses the block — the v2 component
// short-circuits with `null` when `entries` is empty.
//
// Custom per-key renderers (from `src/config/frontmatter-preview-renderers.tsx`)
// are wired by the page template directly on the `<FrontmatterPreview>` call site
// via the `renderers` prop. This helper only produces the filtered entries array.

import { createBuildFrontmatterPreviewEntries } from "@takazudo/zudo-doc/frontmatter-preview-data";
import { settings } from "@/config/settings";
import { DEFAULT_FRONTMATTER_IGNORE_KEYS } from "@/config/frontmatter-preview-defaults";

export const buildFrontmatterPreviewEntries = createBuildFrontmatterPreviewEntries({
  frontmatterPreview: settings.frontmatterPreview,
  defaultIgnoreKeys: DEFAULT_FRONTMATTER_IGNORE_KEYS,
});
