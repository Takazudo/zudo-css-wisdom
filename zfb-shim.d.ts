// Local type shim for the bare `zfb/config` specifier.
//
// `@takazudo/zfb` is consumed as a published npm package (version pinned
// in the root `package.json`). The package exposes its real config types
// under the *scoped* subpath `@takazudo/zfb/config` → `dist/config.d.ts`.
// But `zfb.config.ts` imports from the *bare* specifier `zfb/config`,
// which zfb's build tool aliases to a runtime-only stub at parse time
// (`zfb-config-stub.mjs` — `defineConfig` is identity, carrying no types).
// No real file backs `zfb/config` in `node_modules`, so this ambient
// declaration is what supplies the `ZfbConfig` type to `zfb.config.ts`.
//
// IMPORTANT — this block is the source of truth for the type `zfb check`
// (plain `tsc --noEmit`) binds against the config. An ambient `declare
// module` wins over node resolution AND over tsconfig `paths`, so it must
// be kept in sync BY HAND with the published `@takazudo/zfb/config`
// (`dist/config.d.ts`). When it lags the engine, valid config fields fail
// `pnpm check` with TS2353 (see Takazudo/zudo-front-builder#678 +
// zudolab/zudo-doc#1834 — `bundle` was missing here, blocking next.22's
// `bundle.exclude`).

declare module "zfb/config" {
  /** JSX framework runtime. */
  export type Framework = "preact" | "react";

  /** A content collection registered with the zfb engine. */
  export interface CollectionDef {
    /** Identifier used at the call site (e.g. `"docs"`). */
    name: string;
    /** Directory (relative to the project root) holding the entries. */
    path: string;
    /**
     * Optional schema. Reserved for v1.1 — accepted but not enforced
     * today. Authored as zod and converted to JSON Schema via
     * `z.toJSONSchema()` at the boundary.
     */
    schema?: Record<string, unknown>;
  }

  /** Tailwind options; absent = defaults. */
  export interface TailwindConfig {
    enabled?: boolean;
  }

  /** User-supplied plugin configuration entry. */
  export interface PluginConfig {
    name: string;
    options?: Record<string, unknown>;
  }

  /**
   * Bundler options. Mirrors `BundleConfig` in crates/zfb/src/config.rs
   * and the published `@takazudo/zfb/config` (`dist/config.d.ts`). Added
   * in next.22 (`bundle.exclude`, #664) and extended in next.23
   * (`mainFields` / `external`, #676).
   */
  export interface BundleConfig {
    /**
     * Project-relative, gitignore-style globs for source files the bundler
     * must NOT pull into the esbuild graph (e.g. test fixtures or
     * `*.stories.tsx`). Matched files are skipped from the shadow-tree walk
     * and dropped from any eager `import.meta.glob(...)` expansion.
     */
    exclude?: string[];
    /**
     * Explicit esbuild `main-fields` for the `--platform=neutral` page/SSR
     * pass (empty by default under `neutral`), letting CJS-`main`-only deps
     * resolve. Mirrors `BundleConfig::main_fields`.
     */
    mainFields?: string[];
    /**
     * Bare specifiers to mark external in the `--platform=neutral` pass so
     * esbuild leaves them unbundled. Mirrors `BundleConfig::external`.
     */
    external?: string[];
  }

  /** Mirrors the Rust `Config` struct one-for-one. */
  export interface ZfbConfig {
    outDir?: string;
    publicDir?: string;
    host?: string;
    port?: number;
    framework?: Framework;
    collections?: CollectionDef[];
    tailwind?: TailwindConfig;
    /**
     * Bundler options. `bundle.exclude` keeps project-relative globs out of
     * the esbuild graph — used here to skip `packages/md-plugins/__fixtures__/**`
     * so the MDX link resolver no longer walks the test fixtures (silences
     * ~15 pre-existing broken-link warnings). Mirrors `Config::bundle`.
     */
    bundle?: BundleConfig;
    plugins?: PluginConfig[];
    adapter?: string;
    /**
     * Strip `.md` / `.mdx` from in-page `<a href>` paths and append a
     * trailing `/` so author-written `[label](other.mdx)` references
     * resolve to the rendered route URL. Mirrors Config::strip_md_ext
     * in crates/zfb/src/config.rs (zudolab/zfb#131).
     */
    stripMdExt?: boolean;
    /**
     * Site base path. Prefixed onto stable HTML asset URLs (CSS / JS
     * `<link>` and `<script>` tags). Normalised to start AND end with
     * `/`; `undefined` / `""` / `"/"` all behave identically (no
     * prefix). Mirrors Config::base in crates/zfb/src/config.rs
     * (Takazudo/zudo-front-builder#154).
     */
    base?: string;
    /**
     * Configures the syntect-based syntax highlighter shipped with zfb.
     * Mirrors `CodeHighlightConfig` / `code_highlight` in crates/zfb/src/config.rs
     * (single-theme: Takazudo/zudo-front-builder#188 / sub #194, commit 339e30f;
     * dual-theme themeLight/themeDark added in the follow-up shipped in
     * zfb 0.1.0-next.45+).
     * When omitted, the engine falls back to the hardcoded default theme `base16-ocean.dark`.
     *
     * Single-theme mode: set `theme` — tokens get inline `style="color:#hex"`.
     * Dual-theme mode: set BOTH `themeLight` and `themeDark` (mutually exclusive
     * with `theme`) — tokens get `--shiki-light`/`--shiki-dark` CSS custom
     * properties and the `<pre>` gains `class="syntect-dual"` + `--shiki-*-bg`.
     * All names are SYNTECT theme names, not Shiki names.
     */
    codeHighlight?: {
      theme?: string;
      themesDir?: string;
      themeLight?: string;
      themeDark?: string;
    };
    /**
     * Markdown link resolver (port of `remarkResolveMarkdownLinks`).
     * Mirrors `Config::resolve_markdown_links` in crates/zfb/src/config.rs
     * (Takazudo/zudo-front-builder PR #234 / zudolab/zudo-doc#1577).
     * When `enabled: true`, the build appends `ResolveLinksPlugin` to the
     * mdast pipeline so author-written `[label](./other.mdx)` links are
     * rewritten to the corresponding rendered route URL — bypassing the
     * file→directory transformation that breaks relative paths in dist
     * HTML when `foo.mdx` becomes `foo/index.html`.
     */
    resolveMarkdownLinks?: {
      enabled?: boolean;
      docsDir?: string;
      dirs?: Array<{ dir: string; routePrefix: string }>;
      onBrokenLinks?: "warn" | "error" | "ignore";
    };
    /**
     * Whether the basePath rewriter should append a trailing `/` to
     * extensionless absolute hrefs. Mirrors `Config::trailing_slash` in
     * crates/zfb/src/config.rs (Takazudo/zudo-front-builder PR #234 /
     * zudolab/zudo-doc#1579). Off by default — preserves byte-for-byte
     * parity with the pre-`trailingSlash` build for projects that
     * haven't opted in.
     */
    trailingSlash?: boolean;
    /**
     * Markdown / MDX pipeline options. Mirrors `Config::markdown` →
     * `MarkdownConfig` in crates/zfb/src/config.rs. zfb next.12 moved the
     * former-Core features under `markdown.features` and next.13 ships the
     * rest as opt-in; zudo-doc uses `markdown.features` to opt back into the
     * former-Core four plus the additional opt-in features (#1804). Each
     * `features` value is per-feature: `true` for boolean-shorthand features,
     * or an options object for object-typed features.
     */
    markdown?: {
      gfm?: boolean | Record<string, boolean>;
      toc?: Record<string, unknown>;
      externalLinks?: Record<string, unknown>;
      cjkFriendly?: boolean;
      features?: Record<string, boolean | Record<string, unknown>>;
    };
  }

  /**
   * Identity helper: returns the supplied config as-is, but typed
   * against `ZfbConfig`. Use as the default export of `zfb.config.ts`.
   */
  export function defineConfig(config: ZfbConfig): ZfbConfig;
}
