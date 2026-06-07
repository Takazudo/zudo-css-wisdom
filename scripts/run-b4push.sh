#!/usr/bin/env bash
set -euo pipefail

# b4push — local quality gate run before pushing.
#
# Step order (cheap → expensive):
#   1. Type checking (zfb check)
#   2. Build (zfb build)
#   3. HTML validation (html-validate dist/**/*.html)
#   4. Manual interactive smoke (operator-driven)
#
# Env overrides for non-interactive use:
#   B4PUSH_SKIP_HTML_VALIDATE=1  — skip HTML validation (step 3)
#   B4PUSH_SKIP_MANUAL_SMOKE=1   — skip the manual interactive smoke

START_TIME=$(date +%s)
FAILURES=()
TOTAL_STEPS=4
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

# ── Step 1: Type checking ─────────────────────────────
step "Type checking (zfb check)"
if (cd "$ROOT_DIR" && pnpm check); then
  pass "Type checking passed"
else
  fail "Type checking"
fi

# ── Step 2: Build ─────────────────────────────────────
step "Build (zfb build)"
if (cd "$ROOT_DIR" && pnpm build); then
  pass "Build passed"
else
  fail "Build"
fi

# ── Step 3: HTML validation ───────────────────────────
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

# ── Step 4: Manual interactive smoke ─────────────────
step "Manual interactive smoke"
if [[ "${B4PUSH_SKIP_MANUAL_SMOKE:-}" == "1" ]]; then
  skip "Manual smoke (B4PUSH_SKIP_MANUAL_SMOKE=1)"
else
  cat <<'MANUAL'
Run `pnpm preview` in another terminal and exercise:
  • theme toggle (light/dark)
  • mobile menu (narrow viewport)
  • search dropdown (header search)
  • code-block syntax highlighting

Press [Enter] when all flows look healthy, or Ctrl-C to abort.
MANUAL
  if read -r _; then
    pass "Manual smoke acknowledged"
  else
    fail "Manual smoke (aborted)"
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
