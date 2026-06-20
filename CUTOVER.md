# Production Cutover Runbook — zudo-css-wisdom (Astro/Pages → zfb / Workers)

> **Who runs this:** Takazudo (Cloudflare account access required only for the manual fallbacks).
> **Code merge:** Independent of these steps. The code PR can merge at any time.
> **This project automates the cutover in CI.** `main-deploy.yml` enables the workers.dev subdomain **and** attaches the custom domain via the Cloudflare API on every push to `main` (steps 1–2 below). That cutover step is `continue-on-error: true` — on a scope/auth problem it emits a `::warning::` and the deploy job still goes **green**. The only way the deploy job goes **RED** is if `wrangler deploy` itself fails because the token lacks **Workers: Edit** (step 0). The steps below are the residual prerequisites and manual fallbacks; in the happy path, merging to `main` is all that's needed. The old Cloudflare Pages project (`zudo-css`) keeps serving its last build until decommissioned (step 4).

---

## Step 0 — Pre-merge: Re-scope `CLOUDFLARE_API_TOKEN` to Workers: Edit + Zone: Edit

> **PRE-MERGE HUMAN ACTION — do this BEFORE (or at the moment of) merging the root PR.**

The moment the root PR merges to `main`, `main-deploy.yml` triggers automatically and runs `wrangler deploy`. That command requires **Workers: Edit** scope. If the token still has only **Pages: Edit** scope, the deploy job immediately red-fails with an authorization error.

**What to do:**

1. Go to [Cloudflare Dashboard → My Profile → API Tokens](https://dash.cloudflare.com/profile/api-tokens).
2. Find the token currently used as the `CLOUDFLARE_API_TOKEN` GitHub secret.
3. Edit it: remove or replace the **Cloudflare Pages: Edit** permission with:
   - **Workers Scripts: Edit** (also called "Workers: Edit" in the UI)
   - **Zone: Edit** (or at minimum DNS: Edit) for the `takazudomodular.com` zone — required for attaching the custom domain in step 2.
   - If the token is shared with other projects that still use Pages, create a new token with the above scopes and update only the GitHub secret for this repo.
4. Update the GitHub Actions secret at: Settings → Secrets and variables → Actions → `CLOUDFLARE_API_TOKEN`.

Both `main-deploy.yml` and `pr-checks.yml` carry this comment as a reminder:

```
# CLOUDFLARE_API_TOKEN requires Workers: Edit scope (NOT Pages: Edit)
```

(`wrangler deploy` itself only needs **Workers: Edit**. The custom-domain attach in step 2 additionally needs **Zone: Edit** on `takazudomodular.com` — but that step warns rather than fails, so the deploy stays green without it.)

---

## Step 1 — One-time worker subdomain bootstrap

> **CI-AUTOMATED** — the `main-deploy.yml` cutover step runs this after `wrangler deploy` succeeds on the first merge to `main`. Documented here for transparency and manual fallback.

`wrangler deploy` uploads the worker bundle and sets `workers_dev = true` (from `wrangler.toml`), but the **account-level workers.dev subdomain flag** for a brand-new worker is off until explicitly enabled. Until enabled:

- `wrangler deploy` succeeds (the bundle is uploaded)
- Requests to `zudo-css-wisdom.takazudo.workers.dev` return **Cloudflare error 1042** ("preview URLs disabled / subdomain not enabled")
- PR preview URLs in the format `https://pr-<N>-zudo-css-wisdom.takazudo.workers.dev` also return 1042

**Enable the subdomain via the CF REST API (manual fallback):**

```bash
# CLOUDFLARE_ACCOUNT_ID — from the CF dashboard / GitHub secret (not committed to the repo)
# Worker script name (from wrangler.toml `name`): zudo-css-wisdom

curl -s -X POST \
  "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/scripts/zudo-css-wisdom/subdomain" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}' | jq .
```

Expected response:

```json
{
  "result": { "subdomain": "takazudo", "enabled": true, "previews_enabled": true },
  "success": true,
  "errors": [],
  "messages": []
}
```

After this, both the production workers.dev URL and PR preview alias URLs will resolve.

---

## Step 2 — Attach the custom domain

> **CI-AUTOMATED** — the `main-deploy.yml` cutover step runs this after `wrangler deploy` succeeds on the first merge to `main`. Documented here for transparency and manual fallback.

The `wrangler.toml` already declares:

```toml
[[routes]]
pattern = "zudo-css-wisdom.takazudomodular.com"
custom_domain = true
```

And `src/config/settings.ts` sets:

```typescript
siteUrl: "https://zudo-css-wisdom.takazudomodular.com"
```

The domain host in `wrangler.toml` **must** match `settings.siteUrl`'s host — it does.

**Attach the custom domain via the Cloudflare Dashboard (manual fallback):**

1. Go to [Workers & Pages](https://dash.cloudflare.com) → select the `zudo-css-wisdom` worker.
2. Click **Settings** → **Domains & Routes** → **Add Custom Domain**.
3. Enter `zudo-css-wisdom.takazudomodular.com` and click Save.
4. Cloudflare automatically provisions a TLS certificate and adds a DNS CNAME in the `takazudomodular.com` zone.

Alternatively via API:

```bash
curl -s -X POST \
  "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/domains" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"hostname\": \"zudo-css-wisdom.takazudomodular.com\",
    \"service\": \"zudo-css-wisdom\",
    \"environment\": \"production\",
    \"zone_name\": \"takazudomodular.com\"
  }" | jq .
```

**Note:** This step requires the `CLOUDFLARE_API_TOKEN` to also have **Zone: Edit** (or at minimum DNS: Edit) scope for the `takazudomodular.com` zone.

---

## Step 3 — Verify production and PR previews

> **HUMAN VERIFICATION — after steps 0–2 are complete.**

1. **Production site:** Open `https://zudo-css-wisdom.takazudomodular.com/` — confirm the site loads with correct content, navigation, and styles.
2. **workers.dev URL:** Open `https://zudo-css-wisdom.takazudo.workers.dev/` — confirm it routes (should serve the same site).
3. **PR preview:** Open or create a PR targeting `main`. Wait for `pr-checks.yml` to complete. Confirm the bot comment contains a `https://pr-<N>-*.workers.dev` URL and that URL loads.
4. **HTTPS / TLS:** Confirm no browser certificate warnings on the custom domain.
5. **Canonical / noindex check:** Verify the Workers site serves the correct canonical URL (`https://zudo-css-wisdom.takazudomodular.com/`) and no unintended noindex headers.

---

## Step 4 — Decommission the old Cloudflare Pages project

> **HUMAN ACTION — after step 3 confirms production is healthy.**

The old site (`zudo-css` Pages project) must not remain indexable alongside the new Workers site.

**Recommended: Delete the Pages project (cleanest)**

1. Cloudflare Dashboard → Workers & Pages → `zudo-css` → Settings → Delete.
2. This removes all Pages preview URLs and the production Pages URL immediately.

**Alternative: Add noindex headers to the Pages project (gentler transition)**

In the Pages project's settings, add a `_headers` file at the project root:

```
/*
  X-Robots-Tag: noindex, nofollow
```

Redeploy the Pages project, then submit the old Pages URL for removal from Google Search Console.

---

## State table (post-merge)

| Condition | Behavior |
|---|---|
| Token lacks **Workers: Edit** | `wrangler deploy` fails → `main-deploy` deploy job **RED**. The automated cutover never runs. Fix the token (step 0) and re-run. |
| Token has Workers: Edit but **not Zone: Edit** | Deploy job **green**. `wrangler deploy` + the subdomain enable succeed; the custom-domain attach emits a `::warning::` in the Cutover step. Attach the domain once via the dashboard/API (step 2). |
| Subdomain enable not yet effective | `*.workers.dev` URLs return error 1042 until enabled. PR preview comment says "preview pending". The Cutover step enables it automatically on the next deploy. |
| Custom domain not yet attached | `zudo-css-wisdom.takazudomodular.com` returns 404/connection refused. Old Pages site still serving. |
| Token has Workers: Edit + Zone: Edit | Cutover fully automated. New Workers site live at the custom domain + workers.dev after the first `main` deploy. Old Pages site can be decommissioned (step 4). |

---

## Summary Checklist

- [ ] **BEFORE/AT MERGE** — Re-scope `CLOUDFLARE_API_TOKEN` to Workers: Edit + Zone: Edit (step 0)
- [ ] Run post-merge: Enable workers.dev subdomain via API (step 1 — CI-automated)
- [ ] Attach custom domain `zudo-css-wisdom.takazudomodular.com` (step 2 — CI-automated)
- [ ] Verify production and PR preview routes (step 3)
- [ ] Decommission old `zudo-css` Pages project (step 4)
