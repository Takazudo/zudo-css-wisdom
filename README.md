# zudo-css

CSS best practices documentation site for AI coding agents. Curated techniques and patterns with live CssPreview demos.

AIコーディングエージェント向けのCSSベストプラクティスドキュメントサイトです。厳選されたCSS技法とパターンを、ライブCssPreviewデモとともに提供します。

**Live site:** [zudo-css.takazudomodular.com](https://zudo-css.takazudomodular.com/)

## Tech Stack / 技術スタック

- **zfb (zudo-doc)** — framework powering content, routing, and build / コンテンツ・ルーティング・ビルドを担うフレームワーク
- **MDX** — content format with interactive components / インタラクティブコンポーネント対応のコンテンツ形式
- **Tailwind CSS v4** — utility-first styling
- **Preact** — component rendering (SSR + client islands) / コンポーネントレンダリング（SSR + クライアントアイランド）
- **Shiki** — code highlighting with dual-theme support / デュアルテーマ対応のコードハイライト
- **Cloudflare Pages** — deployment via GitHub Actions / GitHub Actionsによるデプロイ

## Project Structure / プロジェクト構成

```
src/content/docs/       # MDX articles by category (English) / カテゴリ別MDX記事（英語）
src/content/docs-ja/    # Japanese locale articles / 日本語ロケール記事
src/components/         # CssPreview, TailwindPreview, and shim components
src/config/             # Settings, color schemes, sidebars, i18n / 設定、カラースキーム、サイドバー、国際化
pages/                  # zfb page routes / zfbページルーティング
plugins/                # Rehype/remark plugins / Rehype/remarkプラグイン
src/styles/             # Global CSS (Tailwind v4 + design tokens) / グローバルCSS
```

### Article Categories / 記事カテゴリ

| Category | Description / 説明 |
| --- | --- |
| Layout | Flexbox, Grid, positioning, centering, spacing / レイアウト全般 |
| Typography | Font sizing, line clamping, vertical rhythm / 文字組み |
| Color | Color systems, oklch, color-mix, theming / カラーシステム |
| Visual | Shadows, gradients, borders, filters / 視覚効果 |
| Responsive | Container queries, fluid design / レスポンシブデザイン |
| Interactive | Hover/focus, transitions, animations / インタラクション |
| Methodology | BEM, CSS Modules, design tokens, cascade layers / 設計手法 |
| Misc | Writing style guides, contribution conventions / 執筆ガイド、規約 |

## Development / 開発

Requires **Node.js >= 20** and **pnpm**.

```bash
pnpm install
pnpm dev              # Dev server (kills port 4321, starts zfb dev)
pnpm build            # Production build → dist/
pnpm preview          # Preview production build
pnpm check            # Type checking (zfb check)
pnpm b4push           # Run all quality checks before pushing
```

## Claude Code Integration / Claude Code連携

This repo includes a `css-wisdom` skill that indexes all CSS articles for AI-assisted development.

このリポジトリには、AI開発支援のためにすべてのCSS記事をインデックスする `css-wisdom` スキルが含まれています。

```bash
pnpm run setup:doc-skill      # Install skill globally / スキルをグローバルにインストール
pnpm run generate:css-wisdom  # Regenerate topic index / トピックインデックスを再生成
```

Once installed, invoke via `/css-wisdom <topic>` in Claude Code to look up CSS best practices.

インストール後、Claude Codeで `/css-wisdom <トピック>` を実行するとCSSベストプラクティスを参照できます。
