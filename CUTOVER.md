# zcss → zfb migration: cutover checklist

This branch (`base/zcss-zfb-migration`) migrates zcss from Astro to the new
zfb-based zudo-doc and changes the deploy from **Cloudflare Pages** (sub-path
`/pj/zcss/`) to **Cloudflare Workers static assets** at a dedicated subdomain
**`https://zudo-css.takazudomodular.com/`** (base `/`).

Everything below is **manual / human-run, post-merge**. The CI in this PR builds
and (on `main`) runs `wrangler deploy`, but the one-time domain + DNS + old-stack
teardown steps must be done by a human with Cloudflare access.

## Before merging

- [ ] Confirm the GitHub repo secrets exist (carried over from the old Pages setup):
  - `CLOUDFLARE_API_TOKEN` (needs Workers Scripts + Workers Routes edit + the zone for `takazudomodular.com`)
  - `CLOUDFLARE_ACCOUNT_ID`
  - `IFTTT_PROD_NOTIFY` (optional; the notify step no-ops if unset)
- [ ] Review the PR (root PR into `main`).

## One-time Cloudflare / DNS setup (before / at first deploy)

- [ ] Ensure a DNS record for `zudo-css.takazudomodular.com` exists in the
  `takazudomodular.com` Cloudflare zone (proxied). The `[[routes]] custom_domain = true`
  binding in `wrangler.toml` activates on the first `wrangler deploy`; Cloudflare
  issues the TLS cert automatically.
- [ ] First production deploy happens automatically when this lands on `main`
  (`.github/workflows/main-deploy.yml` → `npx wrangler@4 deploy`). To do it
  manually first: `npx wrangler@4 deploy` from the repo root (Wrangler authenticated).
- [ ] Verify the live site: `https://zudo-css.takazudomodular.com/` loads, the
  desktop sidebar + theme toggle + CssPreview demos work, `/ja/docs/...` resolves.

## Redirect the old URL

- [ ] Add a redirect from the old path `https://takazudomodular.com/pj/zcss/*`
  (and `https://zudo-css.pages.dev/*`) → `https://zudo-css.takazudomodular.com/`.
  Use a Cloudflare Bulk Redirect / Redirect Rule on the zone (preserve the
  per-page path where possible, e.g. `/pj/zcss/docs/...` → `/docs/...`).

## Tear down the old stack (only after the new site is confirmed live + redirect in place)

- [ ] Delete the old `zudo-css` Cloudflare **Pages** project (and its
  `zudo-css.pages.dev` subdomain). Do NOT delete before the redirect is verified.

## Known follow-ups (non-blocking)

- **OGP completeness:** the build emits `og:title`, `og:image` (+ dimensions/alt)
  and the Twitter card, but not `og:type`, `og:url`, or `og:site_name` (the 3
  assertions skipped in `e2e/ogp.test.ts` with `// TODO(zfb-migration)`). Add
  these to the zudo-doc head if full OGP parity is wanted.
- **Sidebar utility safelist:** `src/styles/global.css` carries an
  `@source inline(...)` safelist of the consumed `@takazudo/zudo-doc` package's
  bracket + responsive utilities (the consumer can't `@source` the monorepo
  workspace path, and Tailwind v4's node_modules scan is non-deterministic for
  these). **Regenerate the safelist when bumping `@takazudo/zudo-doc`** — the
  regen command is in the comment above the safelist block.
- **`generated: true` claude docs** are now untracked (gitignored, regenerated at
  build by the claude-resources plugin) — matches the reference zudo-doc.
