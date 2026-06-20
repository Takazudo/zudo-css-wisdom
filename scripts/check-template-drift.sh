#!/usr/bin/env bash
set -euo pipefail

if ((BASH_VERSINFO[0] < 4)); then
  echo "Error: bash 4+ is required (found bash $BASH_VERSION)." >&2
  echo "On macOS, install via: brew install bash" >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ALLOWLIST="$ROOT_DIR/.template-drift-allowlist"

# Templates come from create-zudo-doc installed as a devDependency.
# The published package ships templates/base/ and templates/features/ so
# consuming sites can compare their scaffolded files against the generator
# source without needing a monorepo checkout.
BASE_DIR="$ROOT_DIR/node_modules/create-zudo-doc/templates/base"
FEATURES_DIR="$ROOT_DIR/node_modules/create-zudo-doc/templates/features"

if [[ ! -d "$BASE_DIR" ]]; then
  echo "Error: $BASE_DIR not found. Run 'pnpm install' first." >&2
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

# Only check features that were scaffolded for this site.
# Features not scaffolded (e.g. tauri, designTokenPanel, versioning) are
# intentionally absent; their template files would produce spurious
# [MISSING IN PROD] errors if checked.
#
# Feature name -> template directory mapping:
#   i18n            -> i18n           (bilingual EN+JA docs)
#   llms-txt        -> llmsTxt        (LLM-friendly text output)
#   doc-history     -> docHistory     (git-based doc history)
#   body-foot-util  -> bodyFootUtil   (github.ts for footer links)
#   claude-resources -> claudeResources (Claude CLAUDE.md + skills integration)
#   image-enlarge   -> imageEnlarge   (image enlarge on click)
#   sidebar-toggle  -> sidebarToggle  (collapsible sidebar toggle)
#   doc-tags        -> docTags        (tags pages; enabled: docTags: false in settings)
#   tag-governance  -> tagGovernance  (tags-audit / tags-suggest scripts)
for feature in i18n llmsTxt docHistory bodyFootUtil claudeResources imageEnlarge sidebarToggle docTags tagGovernance; do
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
