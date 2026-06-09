#!/usr/bin/env bash
set -euo pipefail

# b4push — local quality gate run before pushing.
#
# Step order (cheap → expensive):
#   1. Format check (mdx)  (mdx-formatter --check; config in .mdx-formatter.json)
#   2. Pin parity check    (pure-Node, reads package.json only)
#   3. Template drift check (needs node_modules — create-zudo-doc devDep)
#   4. Unit tests          (vitest run scripts/ — pure, no dist needed)
#   5. Type checking       (zfb check)
#   6. Build               (zfb build)
#   7. HTML validation     (html-validate dist/**/*.html)
#   8. Link check          (check:links --strict-broken --strict-absolute)
#
# Env overrides for non-interactive use:
#   B4PUSH_SKIP_HTML_VALIDATE=1  — skip HTML validation (step 6)
#   B4PUSH_SKIP_LINK_CHECK=1     — skip link check (step 7)

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
# mdx-formatter --check; config (.mdx-formatter.json) ignores CssPreview /
# TailwindPreview demo blocks and excludes the generated claude* docs.
# Run `pnpm format:md` to auto-fix.
step "Format check (format:md:check)"
if (cd "$ROOT_DIR" && pnpm format:md:check); then
  pass "Format check passed"
else
  fail "Format check (run 'pnpm format:md' to fix)"
fi

# ── Step 2: Pin parity check ──────────────────────────
# Pure-Node: reads package.json only, no install needed. Catches the zfb /
# zudo-doc package groups drifting out of lockstep on a `pnpm up`.
step "Pin parity check (check:pin-parity)"
if (cd "$ROOT_DIR" && pnpm check:pin-parity); then
  pass "Pin parity check passed"
else
  fail "Pin parity check"
fi

# ── Step 3: Template drift check ──────────────────────
# Requires node_modules (reads create-zudo-doc devDep templates). Run
# `pnpm install` first if this fails with "not found". Intentional
# divergences are listed in .template-drift-allowlist.
step "Template drift check (check:template-drift)"
if (cd "$ROOT_DIR" && pnpm check:template-drift); then
  pass "Template drift check passed"
else
  fail "Template drift check"
fi

# ── Step 4: Unit tests ────────────────────────────────
# Pure vitest unit tests under scripts/__tests__/ (no dist/ needed). Guards the
# port-rotation helper (incl. its WSL2 connect-timeout behavior) and check-links.
step "Unit tests (test:unit)"
if (cd "$ROOT_DIR" && pnpm test:unit); then
  pass "Unit tests passed"
else
  fail "Unit tests"
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

# ── Step 8: Link check ────────────────────────────────
#
# Strict on broken links + absolute MDX-source warnings.
# Allowlist file at `.check-links-allowlist` carries known exceptions.
step "Link check (check:links --strict-broken --strict-absolute)"
if [[ "${B4PUSH_SKIP_LINK_CHECK:-}" == "1" ]]; then
  skip "Link check (B4PUSH_SKIP_LINK_CHECK=1)"
else
  if (cd "$ROOT_DIR" && pnpm run check:links -- --strict-broken --strict-absolute --allowlist=.check-links-allowlist); then
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
