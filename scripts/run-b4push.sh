#!/usr/bin/env bash
set -euo pipefail

# b4push — local quality gate run before pushing.
#
# Step order (cheap → expensive):
#   1. Format check (mdx)
#   2. Template drift check (needs node_modules — create-zudo-doc devDep)
#   3. Pin parity check (pure-Node, reads package.json only)
#   4. Wrangler pin check (needs node_modules — reads the zfb platform binary)
#   5. Type checking (zfb check)
#   6. Build (zfb build)
#   7. HTML validation (html-validate dist/**/*.html)
#   8. Link check (check-links)
#
# Env overrides for non-interactive use:
#   B4PUSH_SKIP_HTML_VALIDATE=1  — skip HTML validation (step 7)
#   B4PUSH_SKIP_LINK_CHECK=1     — skip link check (step 8)

START_TIME=$(date +%s)
FAILURES=()
TOTAL_STEPS=8
CURRENT_STEP=0

step() {
  CURRENT_STEP=$((CURRENT_STEP + 1))
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "▶ Step $CURRENT_STEP/$TOTAL_STEPS: $1"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

pass() { echo "✅ $1"; }
fail() { echo "❌ $1"; FAILURES+=("$1"); }
skip() { echo "⏭  $1 (skipped)"; }

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# ── Step 1: Format check (mdx) ────────────────────────
step "Format check (mdx)"
if (cd "$ROOT_DIR" && pnpm format:md:check); then
  pass "Format check passed"
else
  fail "Format check"
fi

# ── Step 2: Template drift check ──────────────────────
# Requires node_modules (reads create-zudo-doc devDep templates).
# Run `pnpm install` first if this fails with "not found".
step "Template drift check"
if (cd "$ROOT_DIR" && pnpm check:template-drift); then
  pass "Template drift check passed"
else
  fail "Template drift check"
fi

# ── Step 3: Pin parity check ──────────────────────────
# Pure-Node: reads package.json only, no install needed.
# Scripts check-pin-parity.mjs + check-wrangler-pin.mjs are provided by
# the pin-guards sub-task (#68). Steps 3–4 will fail until that branch merges.
step "Pin parity check (check:pin-parity)"
if (cd "$ROOT_DIR" && pnpm check:pin-parity); then
  pass "Pin parity check passed"
else
  fail "Pin parity check"
fi

# ── Step 4: Wrangler pin check ────────────────────────
# Requires node_modules (reads the zfb platform binary's embedded
# EXPECTED_WRANGLER_VERSION). Catches a zfb bump that left the wrangler
# pin stale, which would silently break local `zfb dev`/`preview`.
step "Wrangler pin check (check:wrangler-pin)"
if (cd "$ROOT_DIR" && pnpm check:wrangler-pin); then
  pass "Wrangler pin check passed"
else
  fail "Wrangler pin check"
fi

# ── Step 5: Type checking ─────────────────────────────
step "Type checking (zfb check)"
if (cd "$ROOT_DIR" && pnpm check); then
  pass "Type checking passed"
else
  fail "Type checking"
fi

# ── Step 6: Build ─────────────────────────────────────
step "Build (zfb build)"
if (cd "$ROOT_DIR" && pnpm build); then
  pass "Build passed"
else
  fail "Build"
fi

# ── Step 7: HTML validation ───────────────────────────
step "HTML validation (html-validate)"
if [[ "${B4PUSH_SKIP_HTML_VALIDATE:-}" == "1" ]]; then
  skip "HTML validation (B4PUSH_SKIP_HTML_VALIDATE=1)"
else
  if (cd "$ROOT_DIR" && pnpm check:html); then
    pass "HTML validation passed"
  else
    fail "HTML validation"
  fi
fi

# ── Step 8: Link check ───────────────────────────────
step "Link check (check:links)"
if [[ "${B4PUSH_SKIP_LINK_CHECK:-}" == "1" ]]; then
  skip "Link check (B4PUSH_SKIP_LINK_CHECK=1)"
else
  if (cd "$ROOT_DIR" && pnpm check:links); then
    pass "Link check passed"
  else
    fail "Link check"
  fi
fi

# ── Summary ──────────────────────────────────────────
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SUMMARY (${DURATION}s)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ ${#FAILURES[@]} -eq 0 ]; then
  echo "✅ All $TOTAL_STEPS checks passed (or skipped). Safe to push."
  exit 0
else
  echo "❌ ${#FAILURES[@]} check(s) failed:"
  for f in "${FAILURES[@]}"; do
    echo "   - $f"
  done
  exit 1
fi
