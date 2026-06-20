#!/bin/bash
# Web-only: load the author's shared Claude config into this web session by
# cloning the public claude-resources mirror and running its web loader.
# No-ops on the local terminal; degrades gracefully if github.com is unreachable.
set -euo pipefail

[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
# --self-only gate: limit loading to YOUR web sessions on a shared repo WITHOUT
# committing any personal identifier. Opt in by setting CLAUDE_WEB_PROFILE_OPT_IN=1
# in your per-user web env (Claude Code on the web -> Environment variables --
# per-account, not tracked in git). Other accounts that never set it no-op; it
# supports multiple accounts (each opts in), survives account switches (set the
# var in the new account's env -- no source change), and fails loudly, not silently.
[ "${CLAUDE_WEB_PROFILE_OPT_IN:-}" = "1" ] || {
  echo "web-bootstrap: CLAUDE_WEB_PROFILE_OPT_IN not set — skipping" >&2
  exit 0
}

SRC="$HOME/.claude-src"
URL="https://github.com/Takazudo/claude-resources"

if [ -d "$SRC/.git" ]; then
  git -C "$SRC" pull --ff-only 2>/dev/null || true
else
  git clone --depth 1 "$URL" "$SRC" 2>/dev/null || {
    echo "claude-resources unreachable (network policy?) — skipping web profile"
    exit 0
  }
fi

bash "$SRC/scripts/setup-web.sh"
