#!/usr/bin/env bash
# ============================================================================
# teardown-summit.sh -- Remove Summit HOL artifacts from a lab laptop.
#
# Designed for lab laptops (HOL_INSTRUCTOR=false) being repurposed,
# decommissioned, or handed off between events (e.g., Summit -> DAIS).
#
# What it removes (after --confirm):
#   1. Cortex Code VS Code extension
#   2. ~/.claude/skills/fivetran-snowflake-hol-sfsummit2026-v2/
#   3. ~/.fivetran-code/config.json   (lab-laptop wipe)
#   4. ~/.snowflake/connections.toml
#   5. Lab MCP entries (fivetran-code + se-demo) from ~/.snowflake/cortex/mcp.json
#      Other MCP entries (mcp-cloud, etc.) are PRESERVED via JSON merge.
#   6. mcp-servers/se-demo/.env
#   7. setup/creds/labuser*.env
#
# What it does NOT remove (intentional -- shared dev tooling):
#   - VS Code itself, Node, Python, gh, 1Password CLI, Xcode CLT, Chrome
#   - ~/.local/bin/cortex (Cortex Code CLI binary -- next event reuses)
#   - ~/.zshrc PATH modification
#   - The cloned repo at ~/Documents/GitHub/snowflake-summit-2026/
#   - Built artifacts in repo (dist/, node_modules/, .venv/)
#
# Safety rails:
#   - Default mode is DRY RUN. --confirm required to actually remove anything.
#   - On instructor laptops (HOL_INSTRUCTOR=true), refuses to run unless
#     --instructor-mode-confirmed is also passed. Use restore-instructor-backup.sh
#     instead for the surgical instructor-laptop revert.
#   - JSON merge for mcp.json (not blanket delete) so personal MCP servers
#     registered on the laptop survive.
#
# Usage:
#   ./teardown-summit.sh                      # dry-run preview (default)
#   ./teardown-summit.sh --dry-run            # explicit dry-run
#   ./teardown-summit.sh --confirm            # apply removal
#   ./teardown-summit.sh --instructor-mode-confirmed --confirm
#                                             # rare: full wipe of instructor laptop
#   ./teardown-summit.sh --help               # this message
#
# Exits 0 on success, non-zero on failure. Idempotent -- safe to re-run.
# ============================================================================
set -euo pipefail

DRY_RUN=1
INSTRUCTOR_OK=0
UNKNOWN_OK=0
SCRIPT_NAME="$(basename "$0")"
TOOLKIT_DIR="$(cd "$(dirname "$0")" && pwd)"

GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
RED=$'\033[0;31m'
BOLD=$'\033[1m'
NC=$'\033[0m'

info()  { echo -e "${GREEN}[OK]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

usage() {
  cat <<EOF
${BOLD}${SCRIPT_NAME}${NC} -- Remove Summit HOL artifacts from a lab laptop.

Usage:
  ./${SCRIPT_NAME}                              Dry-run (preview, no changes)
  ./${SCRIPT_NAME} --dry-run                    Explicit dry-run
  ./${SCRIPT_NAME} --confirm                    Apply removal
  ./${SCRIPT_NAME} --instructor-mode-confirmed --confirm
                                                Override instructor-laptop guardrail
                                                (rare; usually use restore-instructor-backup.sh)
  ./${SCRIPT_NAME} --confirm-unknown-laptop --confirm
                                                Override the unknown-laptop guardrail
                                                (when mcp-servers/se-demo/.env is missing,
                                                 e.g., partial install)
  ./${SCRIPT_NAME} --help                       This message

Removes:
  - Cortex Code VS Code extension (fivetran-kkohlleffel.cortex-code-for-vscode)
  - ~/.claude/skills/fivetran-snowflake-hol-sfsummit2026-v2/
  - ~/.fivetran-code/config.json
  - ~/.snowflake/connections.toml
  - Lab MCP entries (fivetran-code + se-demo) from ~/.snowflake/cortex/mcp.json
    (other MCP entries preserved via JSON merge)
  - mcp-servers/se-demo/.env
  - setup/creds/labuser*.env (in this repo)

Preserves:
  VS Code itself, Node, Python, gh, 1Password CLI, Xcode CLT, Chrome,
  ~/.local/bin/cortex, ~/.zshrc PATH entries, this cloned repo, build artifacts.
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --confirm)                   DRY_RUN=0; shift ;;
    --dry-run)                   DRY_RUN=1; shift ;;
    --instructor-mode-confirmed) INSTRUCTOR_OK=1; shift ;;
    --confirm-unknown-laptop)    UNKNOWN_OK=1; shift ;;
    -h|--help)                   usage; exit 0 ;;
    *) error "Unknown arg: $1"; usage; exit 1 ;;
  esac
done

echo "${BOLD}${SCRIPT_NAME}${NC} -- $([ "$DRY_RUN" = "1" ] && echo "${GREEN}DRY RUN${NC} (no changes will be made)" || echo "${RED}EXECUTE${NC} (will modify state)")"
echo ""

# --- Detect laptop role from se-demo .env (instructor vs lab) ---
SE_DEMO_ENV="$TOOLKIT_DIR/mcp-servers/se-demo/.env"
LABUSER_NUM_DETECTED=""
HOL_INSTRUCTOR_DETECTED="unknown"

if [ -f "$SE_DEMO_ENV" ]; then
  LABUSER_NUM_DETECTED="$(grep -E '^LABUSER_NUM=' "$SE_DEMO_ENV" | cut -d= -f2 | tr -d '"' || true)"
  HOL_INSTRUCTOR_DETECTED="$(grep -E '^HOL_INSTRUCTOR=' "$SE_DEMO_ENV" | cut -d= -f2 | tr -d '"' || true)"
  HOL_INSTRUCTOR_DETECTED="${HOL_INSTRUCTOR_DETECTED:-unknown}"
fi

echo "Detected:  LABUSER_NUM=${LABUSER_NUM_DETECTED:-(unknown)}  HOL_INSTRUCTOR=${HOL_INSTRUCTOR_DETECTED}"
echo ""

if [ "$HOL_INSTRUCTOR_DETECTED" = "true" ] && [ "$INSTRUCTOR_OK" = "0" ]; then
  error "This appears to be an INSTRUCTOR laptop (HOL_INSTRUCTOR=true)."
  echo "  Full teardown wipes instructor's personal Fivetran/Snowflake creds."
  echo "  For surgical revert (skill only), use:"
  echo "      ./restore-instructor-backup.sh --confirm"
  echo ""
  echo "  If you really want a full wipe of an instructor laptop, re-run with:"
  echo "      ./${SCRIPT_NAME} --instructor-mode-confirmed --confirm"
  exit 1
fi

# Unknown-laptop guardrail: when no se-demo .env exists we can't tell whether
# this is a fresh lab laptop or someone's dev machine. Refuse --confirm in that
# case unless explicitly acknowledged.
if [ "$HOL_INSTRUCTOR_DETECTED" = "unknown" ] && [ "$DRY_RUN" = "0" ] && [ "$UNKNOWN_OK" = "0" ]; then
  error "Cannot confirm this is a lab laptop -- mcp-servers/se-demo/.env is missing."
  echo "  HOL_INSTRUCTOR couldn't be detected. Refusing destructive run to protect"
  echo "  dev machines from accidental wipe (e.g., if you cd'd into this repo on"
  echo "  your personal laptop and pasted --confirm)."
  echo ""
  echo "  If you've verified this IS the laptop you want to wipe, re-run with:"
  echo "      ./${SCRIPT_NAME} --confirm-unknown-laptop --confirm"
  echo ""
  echo "  Or run plain dry-run first to see the plan: ./${SCRIPT_NAME}"
  exit 1
fi

# --- Inventory ---
SKILL_DIR="$HOME/.claude/skills/fivetran-snowflake-hol-sfsummit2026-v2"
FT_CODE_CONFIG="$HOME/.fivetran-code/config.json"
SF_CONN="$HOME/.snowflake/connections.toml"
MCP_JSON="$HOME/.snowflake/cortex/mcp.json"
EXT_ID="fivetran-kkohlleffel.cortex-code-for-vscode"

# Portable to bash 3.2 (macOS default) -- avoid `mapfile`
LAB_CRED_FILES=()
while IFS= read -r f; do
  [ -n "$f" ] && LAB_CRED_FILES+=("$f")
done < <(ls "$TOOLKIT_DIR"/setup/creds/labuser*.env 2>/dev/null || true)

echo "${BOLD}── Plan ──${NC}"

# 1. VS Code extension
if command -v code >/dev/null 2>&1 && code --list-extensions 2>/dev/null | grep -qi "$EXT_ID"; then
  echo "  ${RED}-${NC} VS Code extension: $EXT_ID"
  REMOVE_EXT=1
else
  echo "  ${YELLOW}.${NC} VS Code extension: $EXT_ID (not installed -- skip)"
  REMOVE_EXT=0
fi

# 2. Skill
if [ -d "$SKILL_DIR" ]; then
  echo "  ${RED}-${NC} Skill directory: $SKILL_DIR"
  REMOVE_SKILL=1
else
  echo "  ${YELLOW}.${NC} Skill directory: $SKILL_DIR (not present -- skip)"
  REMOVE_SKILL=0
fi

# 3-4. Cred files
for f in "$FT_CODE_CONFIG" "$SF_CONN" "$SE_DEMO_ENV"; do
  if [ -f "$f" ]; then
    echo "  ${RED}-${NC} Credential file: $f"
  else
    echo "  ${YELLOW}.${NC} Credential file: $f (not present -- skip)"
  fi
done

# 5. mcp.json -- strip lab entries via JSON merge
if [ -f "$MCP_JSON" ]; then
  HAS_LAB_ENTRIES=$(python3 - <<PYEOF 2>/dev/null
import json, sys
try:
    with open("$MCP_JSON") as f: d = json.load(f)
    s = d.get("mcpServers", {})
    print("yes" if ("fivetran-code" in s or "se-demo" in s) else "no")
except Exception:
    print("err")
PYEOF
)
  case "$HAS_LAB_ENTRIES" in
    yes) echo "  ${RED}-${NC} MCP entries 'fivetran-code' + 'se-demo' from $MCP_JSON (other entries preserved)" ;;
    no)  echo "  ${YELLOW}.${NC} MCP entries: none of fivetran-code/se-demo present in $MCP_JSON (skip)" ;;
    *)   echo "  ${RED}!${NC} MCP entries: cannot parse $MCP_JSON (manual review needed)" ;;
  esac
else
  echo "  ${YELLOW}.${NC} MCP config: $MCP_JSON (not present -- skip)"
fi

# 7. setup/creds/labuser*.env
if [ "${#LAB_CRED_FILES[@]}" -gt 0 ]; then
  for f in "${LAB_CRED_FILES[@]}"; do
    echo "  ${RED}-${NC} Lab cred file: $f"
  done
else
  echo "  ${YELLOW}.${NC} Lab cred files: none in $TOOLKIT_DIR/setup/creds/ (skip)"
fi

echo ""

if [ "$DRY_RUN" = "1" ]; then
  warn "Dry run complete. Re-run with --confirm to execute the removals above."
  exit 0
fi

# ============================================================================
# Execute removals
# ============================================================================
echo "${BOLD}── Execute ──${NC}"

# 1. Uninstall VS Code extension
if [ "$REMOVE_EXT" = "1" ]; then
  if code --uninstall-extension "$EXT_ID" 2>&1 | tail -1; then
    info "Uninstalled VS Code extension: $EXT_ID"
  else
    warn "Extension uninstall reported non-zero. Manually verify with: code --list-extensions | grep cortex-code"
  fi
fi

# 2. Skill
if [ "$REMOVE_SKILL" = "1" ]; then
  rm -rf "$SKILL_DIR"
  info "Removed: $SKILL_DIR"
fi

# 3-4. Cred files (delete -- this is a lab laptop wipe)
for f in "$FT_CODE_CONFIG" "$SF_CONN" "$SE_DEMO_ENV"; do
  if [ -f "$f" ]; then
    rm -f "$f"
    info "Removed: $f"
  fi
done

# 5. JSON-merge mcp.json -- strip lab entries, preserve everything else
if [ -f "$MCP_JSON" ]; then
  TMP_MCP="$(mktemp)"
  python3 - <<PYEOF
import json, sys
path = "$MCP_JSON"
with open(path) as f: d = json.load(f)
s = d.get("mcpServers", {})
removed = []
for k in ("fivetran-code", "se-demo"):
    if k in s:
        del s[k]
        removed.append(k)
d["mcpServers"] = s
with open("$TMP_MCP", "w") as f:
    json.dump(d, f, indent=2)
print("removed: " + ", ".join(removed) if removed else "no-op")
PYEOF
  mv "$TMP_MCP" "$MCP_JSON"
  info "Updated $MCP_JSON (removed lab entries; other MCP servers preserved)"
fi

# 6. setup/creds/labuser*.env
if [ "${#LAB_CRED_FILES[@]}" -gt 0 ]; then
  for f in "${LAB_CRED_FILES[@]}"; do
    rm -f "$f"
    info "Removed: $f"
  done
fi

echo ""
info "Teardown complete. Lab laptop is back to baseline (shared dev tools intact)."
echo ""
echo "  Next steps:"
echo "    - Reload VS Code; Cortex Code panel should be absent"
echo "    - To re-setup for a different event: ./setup.sh <N> with the matching .env file"
echo "    - To remove the cloned repo too: rm -rf $TOOLKIT_DIR  (manual)"
