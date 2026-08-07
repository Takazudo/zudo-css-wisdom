#!/usr/bin/env bash
set -euo pipefail

if ((BASH_VERSINFO[0] < 4)); then
  echo "Error: bash 4+ is required (found bash $BASH_VERSION)." >&2
  echo "On macOS, install via: brew install bash" >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ALLOWLIST="$ROOT_DIR/.template-drift-allowlist"

# v5 note: the v4-era sibling this script was ported from reads templates
# straight out of `node_modules/create-zudo-doc` because that project keeps
# create-zudo-doc pinned as a devDependency. Here, create-zudo-doc is a
# one-shot scaffolding CLI (`pnpm create zudo-doc`) and is deliberately NOT a
# project dependency post-scaffold (see check-pin-parity.mjs), so there is no
# local copy of its templates to diff against.
#
# Resolve the matching release from the registry instead and cache it under
# node_modules/.cache (already gitignored via the blanket `node_modules`
# rule), so only the first run needs network access. The expected
# create-zudo-doc version is derived from the INSTALLED `@takazudo/zudo-doc`
# version (node_modules, i.e. what the lockfile actually resolved) rather
# than the package.json range specifier — package.json pins zudo-doc with a
# caret (`^5.2.0`), so reading the specifier would silently pin the templates
# to the range's minimum forever, even after a `pnpm up` resolves a newer
# compatible zudo-doc release. The two packages ship in lockstep (same
# release train), so this stays correct across future zudo-doc bumps with no
# edits to this script.
CREATE_ZUDO_DOC_VERSION=$(node -e "
  const fs = require('node:fs');
  const path = require('node:path');
  const pkgPath = path.join('$ROOT_DIR', 'node_modules/@takazudo/zudo-doc/package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  process.stdout.write(pkg.version ?? '');
" 2>/dev/null)

if [[ -z "$CREATE_ZUDO_DOC_VERSION" ]]; then
  echo "Error: could not read the installed @takazudo/zudo-doc version from node_modules." >&2
  echo "  Run 'pnpm install' first." >&2
  exit 1
fi

CACHE_ROOT="$ROOT_DIR/node_modules/.cache/create-zudo-doc-templates"
CACHE_DIR="$CACHE_ROOT/$CREATE_ZUDO_DOC_VERSION"
BASE_DIR="$CACHE_DIR/templates/base"
FEATURES_DIR="$CACHE_DIR/templates/features"

if [[ ! -d "$BASE_DIR" ]]; then
  echo "Fetching create-zudo-doc@$CREATE_ZUDO_DOC_VERSION templates (first run only, cached after)..."
  FETCH_DIR="$(mktemp -d)"
  trap 'rm -rf "$FETCH_DIR"' EXIT

  if ! (cd "$FETCH_DIR" && npm pack "create-zudo-doc@$CREATE_ZUDO_DOC_VERSION" --silent >/dev/null); then
    echo "Error: failed to fetch create-zudo-doc@$CREATE_ZUDO_DOC_VERSION from the registry." >&2
    echo "  (needed to compare host files against their scaffold baseline; check network access)" >&2
    exit 1
  fi

  TARBALL="$(find "$FETCH_DIR" -maxdepth 1 -name '*.tgz' -print -quit)"
  if [[ -z "$TARBALL" ]]; then
    echo "Error: npm pack did not produce a tarball for create-zudo-doc@$CREATE_ZUDO_DOC_VERSION." >&2
    exit 1
  fi
  tar -xzf "$TARBALL" -C "$FETCH_DIR"

  mkdir -p "$CACHE_ROOT"
  rm -rf "$CACHE_DIR"
  mv "$FETCH_DIR/package" "$CACHE_DIR"
  trap - EXIT
  rm -rf "$FETCH_DIR"
fi

if [[ ! -d "$BASE_DIR" ]]; then
  echo "Error: $BASE_DIR not found after fetching create-zudo-doc@$CREATE_ZUDO_DOC_VERSION." >&2
  exit 1
fi

# Load allowlist into an associative array
declare -A ALLOWED
if [[ -f "$ALLOWLIST" ]]; then
  while IFS= read -r line; do
    # Skip blank lines and comments
    [[ -z "$line" || "$line" == \#* ]] && continue
    ALLOWED["$line"]=1
  done < "$ALLOWLIST"
fi

DRIFTED=()

check_pair() {
  local template_file="$1"
  local prod_path="$2" # relative to repo root

  # Skip if in allowlist
  if [[ -n "${ALLOWED[$prod_path]+_}" ]]; then
    return
  fi

  local prod_file="$ROOT_DIR/$prod_path"

  if [[ ! -f "$prod_file" ]]; then
    echo "  [MISSING IN PROD] $prod_path"
    DRIFTED+=("$prod_path")
    return
  fi

  diff -q "$template_file" "$prod_file" >/dev/null 2>&1 && diff_exit=0 || diff_exit=$?
  if [[ $diff_exit -eq 1 ]]; then
    echo "  [DIFF] $prod_path"
    DRIFTED+=("$prod_path")
  elif [[ $diff_exit -ne 0 ]]; then
    echo "  [ERROR] diff failed (exit $diff_exit) for $prod_path" >&2
    DRIFTED+=("$prod_path")
  fi
}

echo "Checking base template files..."

while IFS= read -r -d '' template_file; do
  prod_path="${template_file#"$BASE_DIR/"}"
  check_pair "$template_file" "$prod_path"
done < <(find "$BASE_DIR" -type f -print0 | sort -z)

echo "Checking feature template files..."

# Only check features that were scaffolded for this site (see
# setup-preset.json `features`). create-zudo-doc 5.x ships template-file
# feature dirs for: i18n, claudeSkills, tauri, tauriDev — everything else
# (search, sidebarResizer, docHistory, llmsTxt, claudeResources,
# skillSymlinker, ...) is package-internal and toggled via the `zudoDoc()`
# config, with no host files to track here. This site enables i18n
# (bilingual EN+JA docs) and none of claudeSkills / tauri / tauriDev — the
# skills under .claude/skills/ here are this repo's own hand-written ones, not
# the scaffolded .claude/skills/zudo-doc-* set. Adding an unscaffolded feature
# would produce spurious [MISSING IN PROD] errors.
for feature in i18n; do
  feature_dir="$FEATURES_DIR/$feature"
  files_dir="$feature_dir/files"
  if [[ ! -d "$files_dir" ]]; then
    continue
  fi
  while IFS= read -r -d '' template_file; do
    prod_path="${template_file#"$files_dir/"}"
    check_pair "$template_file" "$prod_path"
  done < <(find "$files_dir" -type f -print0 | sort -z)
done

echo ""
if [[ ${#DRIFTED[@]} -eq 0 ]]; then
  echo "OK — No template drift detected."
  exit 0
else
  echo "FAILED — ${#DRIFTED[@]} file(s) have unexpected drift:"
  for f in "${DRIFTED[@]}"; do
    echo "   - $f"
  done
  exit 1
fi
