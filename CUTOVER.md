# Production Cutover Runbook — zudo-css-wisdom (Astro/Pages → zfb / Workers)

> **Who runs this:** Takazudo (Cloudflare account access required for steps 1–5).
> **Code merge:** Independent of these steps. The code PR can merge at any time.
> **Half-live state:** Until steps 1–3 are done, the post-merge `main-deploy` **deploy job stays RED** — this is expected, not a code bug. `wrangler deploy` uploads the worker bundle but cannot route traffic until the token has the right scope and the workers.dev subdomain is enabled. The old Cloudflare Pages project (`zudo-css`) keeps serving its last build in the meantime.

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
# CLOUDFLARE_API_TOKEN requires Workers: Edit + Zone: Edit on takazudomodular.com
```

---

## Step 1 — One-time worker subdomain bootstrap

> **CI-AUTOMATED** — the `main-deploy.yml` cutover step runs this after `wrangler deploy` succeeds on the first merge to `main`. Documented here for transparency and manual fallback.

`wrangler deploy` uploads the worker bundle and sets `workers_dev = true` (from `wrangler.toml`), but the **account-level workers.dev subdomain flag** for a brand-new worker is off until explicitly enabled. Until enabled:

- `wrangler deploy` succeeds (the bundle is uploaded)
- Requests to `zudo-css-wisdom.takazudo.workers.dev` return **Cloudflare error 1042** ("preview URLs disabled / subdomain not enabled")
- PR preview URLs in the format `https://pr-<N>-zudo-css-wisdom.takazudo.workers.dev` also return 1042

**Enable the subdomain via the CF REST API (manual fallback):**

```bash
# Account ID from wrangler.toml: 367c7f51801e1f537030f93d5a5e6008
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

## Expected Half-Live State (post-merge, pre-cutover)

| Condition | Behavior |
|---|---|
| Token not yet re-scoped | `main-deploy` deploy job **RED** (auth error). Expected. |
| Subdomain not yet enabled (step 1 pending) | Worker uploaded but `*.workers.dev` URLs return error 1042. PR preview comment says "preview pending". |
| Custom domain not attached (step 2 pending) | Custom domain `zudo-css-wisdom.takazudomodular.com` returns 404/connection refused. Old Pages site still serving. |
| All steps done | New Workers site live at custom domain + workers.dev. Old Pages site can be decommissioned. |

---

## Summary Checklist

- [ ] **BEFORE/AT MERGE** — Re-scope `CLOUDFLARE_API_TOKEN` to Workers: Edit + Zone: Edit (step 0)
- [ ] Run post-merge: Enable workers.dev subdomain via API (step 1 — CI-automated)
- [ ] Attach custom domain `zudo-css-wisdom.takazudomodular.com` (step 2 — CI-automated)
- [ ] Verify production and PR preview routes (step 3)
- [ ] Decommission old `zudo-css` Pages project (step 4)
