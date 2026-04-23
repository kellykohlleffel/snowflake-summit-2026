#!/bin/bash
set -e

# Snowflake Summit 2026 HOL -- Bootstrap Script
# Run this after cloning the repo. Safe to re-run -- picks up where it left off.
#
# Usage:
#   ./setup.sh              # Dev flow (Kelly's laptop) -- placeholder credential files
#   ./setup.sh <1-7>        # Lab-laptop flow -- pulls per-labuser creds from 1Password
#
# When invoked with a LABUSER_NUM argument, setup.sh additionally:
#   - Pulls credentials from the "Snowflake Summit and BDL 2026 Lab Users" 1P item
#   - Backs up any existing ~/.fivetran-code/config.json, ~/.snowflake/connections.toml,
#     and mcp-servers/se-demo/.env to *.backup-{timestamp} before overwriting
#   - Sets HOL_INSTRUCTOR=true iff LABUSER_NUM=7
#   - Sets DBT_PROFILE_TARGET=lab so dbt uses the `lab` target from profiles.yml
#   - Sets LAPTOP_ID=laptop{N} for activation app per-laptop namespacing

TOOLKIT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Ensure ~/.local/bin is on PATH for this shell -- the Cortex Code CLI installer
# and our VSCode `code` symlink write there; without this, subsequent steps in
# this same script wouldn't find the newly-installed binaries.
export PATH="$HOME/.local/bin:$PATH"

# --- Parse args (LABUSER_NUM positional + optional --dry-run flag) ---
LABUSER_NUM=""
DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    [1-7])     LABUSER_NUM="$arg" ;;
    *)
      echo "Error: Unknown argument '$arg'" >&2
      echo "Usage: ./setup.sh [1-7] [--dry-run]" >&2
      echo "  [1-7]      Lab-laptop mode, uses setup/creds/labuser{N}.env" >&2
      echo "  --dry-run  Preview prereq installs without executing (no state changes)" >&2
      exit 1
      ;;
  esac
done

if [ -n "$LABUSER_NUM" ]; then
  LAB_MODE=1
  if [ "$DRY_RUN" = "1" ]; then
    echo "[setup.sh] Running in LAB MODE as labuser ${LABUSER_NUM} (DRY RUN -- no state changes)"
  else
    echo "[setup.sh] Running in LAB MODE as labuser ${LABUSER_NUM}"
  fi
else
  LAB_MODE=0
  [ "$DRY_RUN" = "1" ] && echo "[setup.sh] Running in DRY RUN mode -- no state changes"
fi

# Per-laptop credential file location. Lab mode expects this file to exist on
# the laptop before setup.sh runs — staged once via scp/USB from Kelly's laptop.
# Not committed (setup/creds/ is in .gitignore).
LAB_CREDS_DIR="${TOOLKIT_DIR}/setup/creds"
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m' # No Color

info()  { echo -e "${GREEN}[OK]${NC} $1"; }
warn()  { echo -e "${YELLOW}[ACTION NEEDED]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }
step()  { echo -e "\n${BOLD}Step $1: $2${NC}"; }

pause_and_exit() {
  echo ""
  echo -e "${YELLOW}Fix the above and re-run:${NC}  ./setup.sh"
  echo ""
  exit 1
}

# -------------------------------------------
# Prerequisites status tracking + install helpers
# -------------------------------------------
# PREREQ_STATUS holds pipe-delimited entries: "DisplayName|STATUS|detail"
# Status values: READY (already installed), INSTALLED (we just installed it),
# DRY_RUN (would install in real run), FAILED (error — blocks setup).
PREREQ_STATUS=()

track_prereq() {
  PREREQ_STATUS+=("$1|$2|$3")
}

# install_pkg_if_missing <check_cmd> <pkg_url> <display_name>
# Generic helper for Apple-signed .pkg installers (Node, Python, gh).
install_pkg_if_missing() {
  local check_cmd="$1" pkg_url="$2" display_name="$3"
  if command -v "$check_cmd" >/dev/null 2>&1; then
    local ver
    ver=$("$check_cmd" --version 2>&1 | head -1)
    track_prereq "$display_name" "READY" "$ver"
    info "$display_name: $ver"
    return 0
  fi
  if [ "$DRY_RUN" = "1" ]; then
    warn "$display_name not found"
    echo "      [DRY RUN] Would download:  curl -fsSL -o /tmp/summit-hol-${display_name}.pkg $pkg_url"
    echo "      [DRY RUN] Would install:   sudo installer -pkg /tmp/summit-hol-${display_name}.pkg -target /"
    track_prereq "$display_name" "DRY_RUN" "would install from $pkg_url"
    return 0
  fi
  warn "$display_name not found -- downloading..."
  local tmp="/tmp/summit-hol-${display_name}.pkg"
  if ! curl -fsSL -o "$tmp" "$pkg_url"; then
    error "$display_name: download failed from $pkg_url"
    track_prereq "$display_name" "FAILED" "download failed"
    return 1
  fi
  if ! file "$tmp" | grep -q "xar archive"; then
    error "$display_name: downloaded file is not a valid .pkg"
    rm -f "$tmp"
    track_prereq "$display_name" "FAILED" "invalid .pkg"
    return 1
  fi
  echo "      Installing $display_name (requires your password)..."
  if ! sudo installer -pkg "$tmp" -target /; then
    error "$display_name: installer failed"
    rm -f "$tmp"
    track_prereq "$display_name" "FAILED" "installer error"
    return 1
  fi
  rm -f "$tmp"
  # Re-export PATH in case installer added to /usr/local/bin that wasn't in PATH
  hash -r 2>/dev/null || true
  local ver
  ver=$("$check_cmd" --version 2>&1 | head -1)
  info "$display_name installed: $ver"
  track_prereq "$display_name" "INSTALLED" "$ver"
}

# VSCode ships as a .zip, not a .pkg -- dedicated helper.
# Symlinks the bundled `code` CLI binary to ~/.local/bin/code to avoid the
# GUI-only "Cmd+Shift+P -> Install code command in PATH" step.
ensure_vscode() {
  if command -v code >/dev/null 2>&1; then
    local ver
    ver=$(code --version 2>/dev/null | head -1)
    track_prereq "VS Code" "READY" "$ver"
    info "VS Code: $ver"
    return 0
  fi
  local vscode_zip_url="https://update.code.visualstudio.com/latest/darwin-universal/stable"
  if [ "$DRY_RUN" = "1" ]; then
    warn "VS Code not found"
    echo "      [DRY RUN] Would download:  curl -fsSL -o /tmp/summit-hol-vscode.zip $vscode_zip_url"
    echo "      [DRY RUN] Would unzip to:  /tmp/summit-hol-vscode/"
    echo "      [DRY RUN] Would install:   sudo cp -R '/tmp/summit-hol-vscode/Visual Studio Code.app' /Applications/"
    echo "      [DRY RUN] Would symlink:   /Applications/Visual Studio Code.app/Contents/Resources/app/bin/code -> ~/.local/bin/code"
    track_prereq "VS Code" "DRY_RUN" "would download ~130MB .zip + symlink code CLI"
    return 0
  fi
  warn "VS Code not found -- downloading (~130MB)..."
  local tmp_zip="/tmp/summit-hol-vscode.zip"
  local tmp_dir="/tmp/summit-hol-vscode"
  rm -rf "$tmp_dir" "$tmp_zip"
  if ! curl -fsSL -o "$tmp_zip" "$vscode_zip_url"; then
    error "VS Code: download failed"
    track_prereq "VS Code" "FAILED" "download failed"
    return 1
  fi
  mkdir -p "$tmp_dir"
  if ! unzip -q "$tmp_zip" -d "$tmp_dir"; then
    error "VS Code: unzip failed (archive may be corrupt)"
    rm -rf "$tmp_dir" "$tmp_zip"
    track_prereq "VS Code" "FAILED" "unzip failed"
    return 1
  fi
  if [ ! -d "$tmp_dir/Visual Studio Code.app" ]; then
    error "VS Code: extracted archive does not contain 'Visual Studio Code.app'"
    rm -rf "$tmp_dir" "$tmp_zip"
    track_prereq "VS Code" "FAILED" "missing .app bundle"
    return 1
  fi
  echo "      Installing VS Code to /Applications (requires your password)..."
  if ! sudo cp -R "$tmp_dir/Visual Studio Code.app" /Applications/; then
    error "VS Code: copy to /Applications failed"
    rm -rf "$tmp_dir" "$tmp_zip"
    track_prereq "VS Code" "FAILED" "copy to /Applications failed"
    return 1
  fi
  rm -rf "$tmp_dir" "$tmp_zip"
  mkdir -p "$HOME/.local/bin"
  ln -sf "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code" "$HOME/.local/bin/code"
  export PATH="$HOME/.local/bin:$PATH"
  hash -r 2>/dev/null || true
  if ! command -v code >/dev/null 2>&1; then
    error "VS Code installed but 'code' symlink not working"
    track_prereq "VS Code" "FAILED" "symlink not resolving"
    return 1
  fi
  local ver
  ver=$(code --version 2>/dev/null | head -1)
  info "VS Code installed: $ver (symlinked code CLI)"
  track_prereq "VS Code" "INSTALLED" "$ver (symlinked code CLI)"
}

# Cortex Code CLI uses Snowflake's official install script (curl | sh), not a .pkg.
# Installs to ~/.local/bin/cortex and appends PATH to shell profile.
# We do NOT invoke `cortex` bare after install -- that would launch the
# interactive setup wizard, which is not wanted during automated setup.
ensure_cortex_cli() {
  local cortex_bin=""
  if command -v cortex >/dev/null 2>&1; then
    cortex_bin="$(command -v cortex)"
  elif [ -x "$HOME/.local/bin/cortex" ]; then
    cortex_bin="$HOME/.local/bin/cortex"
    export PATH="$HOME/.local/bin:$PATH"
  fi
  if [ -n "$cortex_bin" ]; then
    local ver
    ver=$("$cortex_bin" --version 2>&1 | head -1)
    track_prereq "Cortex Code CLI" "READY" "$ver (at $cortex_bin)"
    info "Cortex Code CLI: $ver (at $cortex_bin)"
    return 0
  fi
  if [ "$DRY_RUN" = "1" ]; then
    warn "Cortex Code CLI not found"
    echo "      [DRY RUN] Would run official Snowflake installer:"
    echo "                curl -LsS https://ai.snowflake.com/static/cc-scripts/install.sh | sh"
    echo "      [DRY RUN] Installer writes to ~/.local/bin/cortex and appends PATH to shell profile"
    track_prereq "Cortex Code CLI" "DRY_RUN" "would install to ~/.local/bin/cortex"
    return 0
  fi
  warn "Cortex Code CLI not found -- installing via official Snowflake script..."
  warn "The installer will ask about Podman (container runtime for sandbox features)."
  warn "Answer N -- the HOL flow does not need Podman."
  # Note: the Snowflake install script exits non-zero when Podman is skipped,
  # but the Cortex CLI binary is still installed correctly. We check for the
  # binary itself rather than trusting the script's exit code.
  curl -LsS "https://ai.snowflake.com/static/cc-scripts/install.sh" | sh || true
  export PATH="$HOME/.local/bin:$PATH"
  hash -r 2>/dev/null || true
  if ! command -v cortex >/dev/null 2>&1; then
    error "Cortex Code CLI install failed -- 'cortex' binary not found on PATH"
    error "(looked in PATH and at $HOME/.local/bin/cortex)"
    track_prereq "Cortex Code CLI" "FAILED" "binary not found after install"
    return 1
  fi
  local ver
  ver=$(cortex --version 2>&1 | head -1)
  info "Cortex Code CLI installed: $ver"
  track_prereq "Cortex Code CLI" "INSTALLED" "$ver"
}

# Wraps the existing gh install logic into the ensure_* pattern so it tracks
# status alongside the others. Behavior unchanged from the original block.
ensure_gh() {
  if command -v gh >/dev/null 2>&1; then
    local ver
    ver=$(gh --version | head -1 | awk '{print $3}')
    track_prereq "GitHub CLI" "READY" "v$ver"
    info "GitHub CLI v$ver"
    return 0
  fi
  local gh_version="2.67.0"
  local gh_pkg_url="https://github.com/cli/cli/releases/download/v${gh_version}/gh_${gh_version}_macOS_universal.pkg"
  if [ "$DRY_RUN" = "1" ]; then
    warn "GitHub CLI not found"
    echo "      [DRY RUN] Would download:  curl -fsSL -o /tmp/summit-hol-gh.pkg $gh_pkg_url"
    echo "      [DRY RUN] Would install:   sudo installer -pkg /tmp/summit-hol-gh.pkg -target /"
    track_prereq "GitHub CLI" "DRY_RUN" "would install v$gh_version"
    return 0
  fi
  warn "GitHub CLI not found -- downloading v${gh_version}..."
  local tmp="/tmp/summit-hol-gh.pkg"
  if ! curl -fsSL -o "$tmp" "$gh_pkg_url"; then
    error "GitHub CLI: download failed"
    track_prereq "GitHub CLI" "FAILED" "download failed"
    return 1
  fi
  if ! file "$tmp" | grep -q "xar archive"; then
    error "GitHub CLI: downloaded file is not a valid .pkg"
    rm -f "$tmp"
    track_prereq "GitHub CLI" "FAILED" "invalid .pkg"
    return 1
  fi
  echo "      Installing GitHub CLI (requires your password)..."
  if ! sudo installer -pkg "$tmp" -target /; then
    error "GitHub CLI: installer failed"
    rm -f "$tmp"
    track_prereq "GitHub CLI" "FAILED" "installer error"
    return 1
  fi
  rm -f "$tmp"
  hash -r 2>/dev/null || true
  local ver
  ver=$(gh --version | head -1 | awk '{print $3}')
  info "GitHub CLI installed: v$ver"
  track_prereq "GitHub CLI" "INSTALLED" "v$ver"
}

# Safe-merge VSCode user settings.
# Sets three keys, all via Python `setdefault`-style merge (only add if absent;
# never overwrite existing instructor customizations):
#   1. update.mode = "none"              -- no VS Code auto-updates mid-Summit
#   2. extensions.autoUpdate = false     -- no extension auto-updates either
#   3. cortexCodeForVscode.binaryPath    -- absolute path to cortex binary so
#                                          the extension finds it regardless of
#                                          how VS Code was launched (Dock /
#                                          Spotlight / terminal). Without this,
#                                          VS Code launched from Dock inherits
#                                          the launchd PATH -- which doesn't
#                                          include ~/.local/bin on macOS -- and
#                                          the extension fails with "cortex
#                                          binary not found on PATH".
#
# On instructor personal laptops (Class 2), settings.json typically exists with
# custom themes/keybindings -- those survive intact. On bare lab laptops the
# file doesn't exist and we create it with just these three keys.
configure_vscode_auto_update() {
  local settings_dir="$HOME/Library/Application Support/Code/User"
  local settings_file="$settings_dir/settings.json"
  local cortex_path="$HOME/.local/bin/cortex"

  if [ "$DRY_RUN" = "1" ]; then
    if [ -f "$settings_file" ]; then
      echo "      [DRY RUN] Would safe-merge into $settings_file:"
    else
      echo "      [DRY RUN] Would create $settings_file with:"
    fi
    echo "                - update.mode: \"none\""
    echo "                - extensions.autoUpdate: false"
    echo "                - cortexCodeForVscode.binaryPath: \"$cortex_path\""
    return 0
  fi

  mkdir -p "$settings_dir"
  python3 - "$settings_file" "$cortex_path" <<'PYEOF'
import json, os, sys
path, cortex_path = sys.argv[1:3]
existing = {}
if os.path.exists(path):
    try:
        with open(path) as f:
            existing = json.load(f)
    except json.JSONDecodeError:
        print(f"WARNING: {path} is not valid JSON -- leaving untouched")
        sys.exit(0)
changed = False
desired_settings = [
    ("update.mode", "none"),
    ("extensions.autoUpdate", False),
    # Absolute path bypasses macOS launchd's PATH limitations -- VSCode
    # launched from Dock/Spotlight won't have ~/.local/bin, but this
    # setting tells the Cortex Code extension exactly where to find the
    # binary regardless of launch method.
    ("cortexCodeForVscode.binaryPath", cortex_path),
]
for key, desired in desired_settings:
    if key not in existing:
        existing[key] = desired
        changed = True
    elif existing[key] != desired:
        print(f"NOTE: {key} already set to {existing[key]!r} in {path} -- leaving as-is (respects existing preferences)")
if changed:
    with open(path, "w") as f:
        json.dump(existing, f, indent=2)
    print(f"[OK] Merged VS Code settings into {path}")
else:
    print(f"[OK] VS Code settings already configured")
PYEOF
}

# Persist ~/.local/bin to PATH in ~/.zshrc so every new shell (and VS Code
# launched from a terminal) finds the Cortex CLI and the symlinked `code`
# binary. setup.sh exports PATH in its own process, but that doesn't persist
# to future shells. The Cortex CLI installer claims to update shell profile
# but its choice of profile file (.zprofile vs .zshrc) and its heuristic for
# whether stdin is a TTY don't reliably land the update where zsh reads it.
# This helper is idempotent via a marker line.
persist_local_bin_to_zshrc() {
  local zshrc="$HOME/.zshrc"
  local marker="# Summit 2026 HOL lab tooling: ensure ~/.local/bin on PATH"
  if [ -f "$zshrc" ] && grep -qF "$marker" "$zshrc"; then
    info "~/.zshrc already has ~/.local/bin PATH export (no-op)"
    return 0
  fi
  if [ "$DRY_RUN" = "1" ]; then
    echo "      [DRY RUN] Would append to ~/.zshrc:"
    echo "                $marker"
    echo '                export PATH="$HOME/.local/bin:$PATH"'
    return 0
  fi
  {
    echo ""
    echo "$marker"
    echo 'export PATH="$HOME/.local/bin:$PATH"'
  } >> "$zshrc"
  info "Appended ~/.local/bin to PATH in ~/.zshrc (takes effect in new shells)"
}

# Prints the final [READY / NEEDS ACTION] table and go/no-go verdict.
# Matches the TVMAZE prerequisites-doc format adapted for bash.
# Exits non-zero (via pause_and_exit) if anything is FAILED.
print_prereq_summary() {
  echo ""
  echo "═══════════════════════════════════════════════════════════"
  echo "  Prerequisites Status"
  echo "═══════════════════════════════════════════════════════════"
  local failed=()
  local total=${#PREREQ_STATUS[@]}
  local ready_count=0
  for entry in "${PREREQ_STATUS[@]}"; do
    local name="${entry%%|*}"
    local rest="${entry#*|}"
    local status="${rest%%|*}"
    local detail="${rest#*|}"
    printf "  %-20s [%-9s] %s\n" "$name:" "$status" "$detail"
    if [ "$status" = "FAILED" ]; then
      failed+=("$name")
    else
      ready_count=$((ready_count + 1))
    fi
  done
  echo "═══════════════════════════════════════════════════════════"
  if [ ${#failed[@]} -eq 0 ]; then
    if [ "$DRY_RUN" = "1" ]; then
      echo "  Session is GO (dry run) -- ${ready_count}/${total} prerequisites accounted for."
    else
      echo "  Session is GO -- ${ready_count}/${total} prerequisites ready."
    fi
    echo "═══════════════════════════════════════════════════════════"
    echo ""
  else
    echo "  BLOCKED on: ${failed[*]}"
    echo "═══════════════════════════════════════════════════════════"
    pause_and_exit
  fi
}

echo ""
echo "========================================="
echo "  Snowflake Summit 2026 HOL -- Setup"
echo "========================================="

# -------------------------------------------
# Step 0: Xcode Command Line Tools (macOS)
# -------------------------------------------
step "0" "Checking Xcode Command Line Tools..."

if [[ "$OSTYPE" == "darwin"* ]]; then
  if ! xcode-select -p &> /dev/null; then
    warn "Xcode Command Line Tools not installed (required for git)."
    echo "      A system dialog should appear now. Click 'Install' and wait."
    echo "      If no dialog appears, run:  xcode-select --install"
    xcode-select --install 2>/dev/null || true
    echo ""
    echo "      After installation finishes, re-run:  ./setup.sh"
    exit 0
  else
    info "Xcode Command Line Tools installed"
  fi
fi

# -------------------------------------------
# Step 1: Prerequisites walkthrough
# -------------------------------------------
step "1" "Prerequisites walkthrough..."

# Git comes with Xcode CLT (already verified in Step 0), so just report it.
if command -v git >/dev/null 2>&1; then
  GIT_VER=$(git --version | awk '{print $3}')
  track_prereq "Git" "READY" "v$GIT_VER"
  info "Git v$GIT_VER"
else
  error "Git not found even though Xcode CLT reported installed. Re-run: xcode-select --install"
  track_prereq "Git" "FAILED" "missing after Xcode CLT check"
fi

install_pkg_if_missing node         "https://nodejs.org/dist/v20.11.1/node-v20.11.1.pkg"                  "Node"
install_pkg_if_missing python3.12   "https://www.python.org/ftp/python/3.12.2/python-3.12.2-macos11.pkg" "Python"
ensure_vscode
ensure_cortex_cli
ensure_gh
configure_vscode_auto_update
persist_local_bin_to_zshrc

print_prereq_summary

# -------------------------------------------
# Step 2: GitHub authentication (only when actually needed)
# -------------------------------------------
# The repo is public -- git clone/pull don't need auth. gh is only used by
# setup.sh for `gh auth setup-git` (HTTPS credentials helper). On a lab
# laptop (LABUSER_NUM 1-6, attendee-facing), there's no reason to store a
# GitHub token: the laptops don't push to GitHub and don't touch any
# private repos. So we skip gh auth on lab laptops entirely -- no operator
# token ends up on a booth machine that might walk off.
#
# On an instructor laptop (LABUSER_NUM=7) or dev mode (no LABUSER_NUM),
# the operator is an SE working on their own laptop; if they're already
# authenticated we report it, if not we skip silently -- they can run
# `gh auth login` themselves if/when they need it for their dev workflow.
step "2" "Checking GitHub authentication..."

if [ "$LAB_MODE" = "1" ] && [ "$LABUSER_NUM" != "7" ]; then
  info "Skipping GitHub auth (lab-laptop mode: public repo, no token needed on this machine)"
elif gh auth status &> /dev/null; then
  GH_USER=$(gh auth status 2>&1 | grep "Logged in" | awk '{print $7}' | tr -d '()')
  info "GitHub authenticated as $GH_USER (leaving existing credentials untouched)"
  gh auth setup-git 2>/dev/null || true
else
  info "Not logged in to GitHub -- skipping (not required for setup.sh)."
  info "Run 'gh auth login' manually if you want gh CLI access from this laptop."
fi

# -------------------------------------------
# Dry-run short-circuit: skip build/configure steps, nothing below this point
# should run during a preview.
# -------------------------------------------
if [ "$DRY_RUN" = "1" ]; then
  echo ""
  echo "═══════════════════════════════════════════════════════════"
  echo "  DRY RUN complete -- no changes made to this laptop."
  echo "═══════════════════════════════════════════════════════════"
  echo ""
  if [ -n "$LABUSER_NUM" ]; then
    echo "  To run for real on a bare lab laptop:  ./setup.sh $LABUSER_NUM"
  else
    echo "  To run for real:  ./setup.sh [1-7]   (lab laptop / instructor mode)"
    echo "                    ./setup.sh         (dev flow, placeholder creds)"
  fi
  echo ""
  exit 0
fi

# -------------------------------------------
# Step 3: Fix npm cache permissions if needed
# -------------------------------------------
step "3" "Checking npm setup..."

NPM_CACHE_DIR="$HOME/.npm"
if [ -d "$NPM_CACHE_DIR" ]; then
  BAD_PERMS=$(find "$NPM_CACHE_DIR" -not -user "$(whoami)" 2>/dev/null | head -1)
  if [ -n "$BAD_PERMS" ]; then
    warn "Fixing npm cache permissions (files owned by root)..."
    sudo chown -R "$(whoami)" "$NPM_CACHE_DIR"
    info "npm cache permissions fixed"
  else
    info "npm cache permissions OK"
  fi
else
  info "npm cache (clean install)"
fi

# -------------------------------------------
# Step 4: Build Cortex Code VSCode extension
# -------------------------------------------
step "4" "Building Cortex Code VSCode extension..."

cd "$TOOLKIT_DIR/cortex-code"

if [ ! -d "node_modules" ]; then
  echo "  Installing npm dependencies..."
  npm install --silent 2>&1 | tail -1
else
  info "npm dependencies already installed"
fi

echo "  Building extension..."
npm run build --silent 2>&1 | tail -5

if [ -f "dist/extension.cjs" ]; then
  info "Cortex Code extension built successfully"
else
  error "Build failed -- check npm run build output"
  exit 1
fi

# Package and install VSIX
echo "  Packaging VSIX..."
npx @vscode/vsce package --no-dependencies 2>&1 | tail -1

VSIX_FILE=$(ls -t cortex-code-for-vscode-*.vsix 2>/dev/null | head -1)

if [ -z "$VSIX_FILE" ]; then
  error "VSIX packaging failed"
  exit 1
fi

echo "  Installing $VSIX_FILE..."
code --install-extension "$VSIX_FILE" --force 2>&1 | tail -1

info "Cortex Code VSCode extension installed ($VSIX_FILE)"

# -------------------------------------------
# Step 5: Build Fivetran Code MCP Server
# -------------------------------------------
step "5" "Building Fivetran Code MCP Server..."

cd "$TOOLKIT_DIR/fivetran-code"

if [ ! -d "node_modules" ]; then
  echo "  Installing npm dependencies..."
  npm install --silent 2>&1 | tail -1
else
  info "npm dependencies already installed"
fi

echo "  Building MCP server..."
npm run build:mcp --silent 2>&1 | tail -5

if [ -f "dist/mcp-server.js" ]; then
  info "Fivetran Code MCP server built successfully"
else
  error "Build failed -- check npm run build:mcp output"
  exit 1
fi

# -------------------------------------------
# Step 6: Set up SE Demo MCP Server
# -------------------------------------------
step "6" "Setting up SE Demo MCP Server..."

cd "$TOOLKIT_DIR/mcp-servers/se-demo"

if [ ! -d ".venv" ]; then
  echo "  Creating Python virtual environment..."
  python3 -m venv .venv
  info "Python venv created"
else
  info "Python venv already exists"
fi

echo "  Installing Python dependencies..."
.venv/bin/pip install -r requirements.txt --quiet 2>&1 | tail -3

if [ ! -f ".venv/bin/dbt" ]; then
  echo "  Installing dbt-core + dbt-snowflake..."
  .venv/bin/pip install dbt-core dbt-snowflake --quiet 2>&1 | tail -1
  info "dbt installed"
else
  info "dbt already installed"
fi

# Create .env from template if it doesn't exist
if [ ! -f ".env" ]; then
  cp .env.example .env
  DBT_VENV_PATH="$TOOLKIT_DIR/mcp-servers/se-demo/.venv/bin/dbt"
  DBT_PROJECT_PATH="$TOOLKIT_DIR/apps/activation-app/dbt_project"
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|/path/to/venv/bin/dbt|$DBT_VENV_PATH|g" .env
    sed -i '' "s|/path/to/dbt_project|$DBT_PROJECT_PATH|g" .env
  else
    sed -i "s|/path/to/venv/bin/dbt|$DBT_VENV_PATH|g" .env
    sed -i "s|/path/to/dbt_project|$DBT_PROJECT_PATH|g" .env
  fi
  warn ".env created from template -- fill in your Snowflake credentials"
else
  info ".env already exists"
fi

info "SE Demo MCP Server ready"

# -------------------------------------------
# Step 7: Install HOL skill files
# -------------------------------------------
step "7" "Installing HOL skill files..."

SKILL_SRC="$TOOLKIT_DIR/skills/fivetran-snowflake-hol-sfsummit2026-v2"
SKILL_DST="$HOME/.claude/skills/fivetran-snowflake-hol-sfsummit2026-v2"

if [ -d "$SKILL_SRC" ]; then
  mkdir -p "$HOME/.claude/skills"
  rm -rf "$SKILL_DST"
  cp -r "$SKILL_SRC" "$HOME/.claude/skills/"
  info "HOL skill installed to ~/.claude/skills/fivetran-snowflake-hol-sfsummit2026-v2/"
else
  error "Skill source not found at $SKILL_SRC"
  exit 1
fi

# -------------------------------------------
# Step 8: Set up credentials and config
# -------------------------------------------
step "8" "Setting up credentials and config..."

# --- ~/.fivetran-code/config.json ---
CONFIG_DIR="$HOME/.fivetran-code"
CONFIG_FILE="$CONFIG_DIR/config.json"

mkdir -p "$CONFIG_DIR"

# Only seed YOUR_ placeholders in dev mode. In lab mode (LABUSER_NUM set),
# Step 10's safe-merge creates the file fresh from labuser{N}.env with real
# values -- seeding placeholders first would leave stale YOUR_ strings for
# fields Step 10 doesn't set (e.g., anthropicApiKey), which then trips the
# EOF "fill in credentials" check even though everything actually works.
if [ "$LAB_MODE" = "0" ] && [ ! -f "$CONFIG_FILE" ]; then
  cat > "$CONFIG_FILE" << 'CONFIGEOF'
{
  "fivetranApiKey": "YOUR_FIVETRAN_API_KEY",
  "fivetranApiSecret": "YOUR_FIVETRAN_API_SECRET",
  "anthropicApiKey": "YOUR_ANTHROPIC_API_KEY",
  "snowflakeAccount": "YOUR_SNOWFLAKE_ACCOUNT",
  "snowflakePatToken": "YOUR_SNOWFLAKE_PAT_TOKEN"
}
CONFIGEOF
  chmod 600 "$CONFIG_FILE"
  warn "Config created at $CONFIG_FILE -- fill in your credentials"
elif [ -f "$CONFIG_FILE" ]; then
  info "Config file already exists at $CONFIG_FILE"
else
  info "Lab mode: config will be created by Step 10 from labuser${LABUSER_NUM}.env"
fi

# --- ~/.snowflake/connections.toml ---
SF_DIR="$HOME/.snowflake"
SF_CONN="$SF_DIR/connections.toml"

mkdir -p "$SF_DIR"

# Same pattern: seed placeholder TOML only in dev mode. Lab-mode Step 10
# writes the real [summit-lab] section via safe-merge (and preserves any
# pre-existing sections on instructor laptops).
if [ "$LAB_MODE" = "0" ] && [ ! -f "$SF_CONN" ]; then
  cat > "$SF_CONN" << 'SFEOF'
default_connection_name = "summit-hol"

[summit-hol]
account = "YOUR_SNOWFLAKE_ACCOUNT"
user = "YOUR_SNOWFLAKE_USER"
password = "YOUR_SNOWFLAKE_PAT_TOKEN"
warehouse = "HANDS_ON_LAB_WAREHOUSE"
database = "YOUR_SNOWFLAKE_DATABASE"
SFEOF
  chmod 600 "$SF_CONN"
  warn "Snowflake config created at $SF_CONN -- fill in your credentials"
elif [ -f "$SF_CONN" ]; then
  info "Snowflake connections.toml already exists at $SF_CONN"
else
  info "Lab mode: connections.toml will be created by Step 10 from labuser${LABUSER_NUM}.env"
fi

# -------------------------------------------
# Step 9: Configure MCP servers for Cortex
# -------------------------------------------
step "9" "Configuring MCP servers for Cortex Code..."

MCP_CONFIG_DIR="$HOME/.snowflake/cortex"
MCP_CONFIG_FILE="$MCP_CONFIG_DIR/mcp.json"

MCP_SERVER_PATH="$TOOLKIT_DIR/fivetran-code/dist/mcp-server.js"
SE_DEMO_PYTHON="$TOOLKIT_DIR/mcp-servers/se-demo/.venv/bin/python"
SE_DEMO_SERVER="$TOOLKIT_DIR/mcp-servers/se-demo/run_server.py"

mkdir -p "$MCP_CONFIG_DIR"

if [ ! -f "$MCP_CONFIG_FILE" ]; then
  cat > "$MCP_CONFIG_FILE" << MCPEOF
{
  "mcpServers": {
    "fivetran-code": {
      "type": "stdio",
      "command": "node",
      "args": ["$MCP_SERVER_PATH"],
      "env": {}
    },
    "se-demo": {
      "type": "stdio",
      "command": "$SE_DEMO_PYTHON",
      "args": ["$SE_DEMO_SERVER"],
      "env": {}
    }
  }
}
MCPEOF
  info "Cortex MCP config created at $MCP_CONFIG_FILE"
else
  if grep -q "fivetran-code" "$MCP_CONFIG_FILE" && grep -q "se-demo" "$MCP_CONFIG_FILE"; then
    info "MCP servers already configured in $MCP_CONFIG_FILE"
  else
    warn "MCP config exists but may not have fivetran-code and se-demo entries."
    echo "      Add these to the mcpServers object in: $MCP_CONFIG_FILE"
    echo ""
    echo "      \"fivetran-code\": {"
    echo "        \"type\": \"stdio\","
    echo "        \"command\": \"node\","
    echo "        \"args\": [\"$MCP_SERVER_PATH\"],"
    echo "        \"env\": {}"
    echo "      },"
    echo "      \"se-demo\": {"
    echo "        \"type\": \"stdio\","
    echo "        \"command\": \"$SE_DEMO_PYTHON\","
    echo "        \"args\": [\"$SE_DEMO_SERVER\"],"
    echo "        \"env\": {}"
    echo "      }"
  fi
fi

# -------------------------------------------
# Step 10: Lab-mode credential population (LABUSER_NUM only)
# -------------------------------------------
if [ "$LAB_MODE" = "1" ]; then
  step "10" "Lab mode: loading labuser ${LABUSER_NUM} credentials from setup/creds/..."

  # Per-laptop credential file — must be pre-staged on the laptop (scp/USB).
  # NOT committed to the repo (setup/creds/ is in .gitignore).
  CRED_FILE="${LAB_CREDS_DIR}/labuser${LABUSER_NUM}.env"

  if [ ! -f "$CRED_FILE" ]; then
    error "Credential file not found: $CRED_FILE"
    echo ""
    echo "      Lab-mode setup requires a pre-staged .env file for this laptop."
    echo "      Ask Kelly for the labuser${LABUSER_NUM}.env file and drop it at:"
    echo "        $CRED_FILE"
    echo ""
    echo "      Then re-run:  ./setup.sh $LABUSER_NUM"
    pause_and_exit
  fi

  # Tighten perms if loose (may warn on git-checkout that doesn't preserve mode)
  chmod 600 "$CRED_FILE" 2>/dev/null || true

  # Source the credential file. All variables (SNOWFLAKE_ACCOUNT, SNOWFLAKE_PAT,
  # FIVETRAN_KEY_B64, etc.) are loaded into this shell process only — not
  # exported to subshells beyond this script.
  # shellcheck disable=SC1090
  set -a
  source "$CRED_FILE"
  set +a

  info "Loaded credentials from $CRED_FILE"

  # Map .env variable names to the internal variable names used below.
  # This keeps the rest of the lab-mode block unchanged.
  SNOWFLAKE_ACCOUNT_VAL="${SNOWFLAKE_ACCOUNT:-}"
  SNOWFLAKE_WAREHOUSE_VAL="${SNOWFLAKE_WAREHOUSE:-SF_LAB_WH}"
  SNOWFLAKE_PAT_VAL="${SNOWFLAKE_PAT:-}"
  FIVETRAN_KEY_B64="${FIVETRAN_KEY_B64:-}"
  FIVETRAN_GROUP_ID_VAL="${FIVETRAN_GROUP_ID:-}"

  # PG source — shared across all 7 labusers; hardcoded non-secret values,
  # pg_password comes from the .env file.
  PG_HOL_HOST_VAL="${PG_HOL_HOST:-34.94.122.157}"
  PG_HOL_PORT_VAL="${PG_HOL_PORT:-5432}"
  PG_HOL_DATABASE_VAL="${PG_HOL_DATABASE:-industry-se-demo}"
  PG_HOL_USER_VAL="${PG_HOL_USER:-fivetran}"
  PG_HOL_PASSWORD_VAL="${PG_HOL_PASSWORD:-}"

  # Validate required fields
  for var in SNOWFLAKE_ACCOUNT_VAL SNOWFLAKE_WAREHOUSE_VAL SNOWFLAKE_PAT_VAL FIVETRAN_KEY_B64 FIVETRAN_GROUP_ID_VAL; do
    if [ -z "${!var}" ]; then
      error "Missing value in $CRED_FILE: ${var%_VAL} (strip _VAL suffix for the env name)"
      pause_and_exit
    fi
  done

  # Decode base64 Fivetran key to separate key + secret
  DECODED_FT=$(echo -n "$FIVETRAN_KEY_B64" | base64 -d 2>/dev/null || true)
  FIVETRAN_API_KEY_VAL="${DECODED_FT%%:*}"
  FIVETRAN_API_SECRET_VAL="${DECODED_FT##*:}"
  if [ -z "$FIVETRAN_API_KEY_VAL" ] || [ -z "$FIVETRAN_API_SECRET_VAL" ]; then
    error "Failed to decode FIVETRAN_KEY_B64 from $CRED_FILE"
    pause_and_exit
  fi

  # Derive per-labuser values
  SF_LAB_USER="SF_LABUSER${LABUSER_NUM}_USER"
  SF_LAB_ROLE="SF_LABUSER${LABUSER_NUM}_ROLE"
  SF_LAB_DB="SF_LABUSER${LABUSER_NUM}_DB"
  LAPTOP_ID_VAL="laptop${LABUSER_NUM}"
  if [ "$LABUSER_NUM" = "7" ]; then
    HOL_INSTRUCTOR_VAL="true"
  else
    HOL_INSTRUCTOR_VAL="false"
  fi

  info "Resolved identity: user=$SF_LAB_USER role=$SF_LAB_ROLE db=$SF_LAB_DB laptop_id=$LAPTOP_ID_VAL instructor=$HOL_INSTRUCTOR_VAL"

  # Backup existing config files before overwriting
  TS=$(date +%Y%m%d-%H%M%S)
  BACKUP_DIR="$HOME/.summit-hol-backups/${TS}-labuser${LABUSER_NUM}"
  mkdir -p "$BACKUP_DIR"

  for f in "$CONFIG_FILE" "$SF_CONN" "$TOOLKIT_DIR/mcp-servers/se-demo/.env"; do
    if [ -f "$f" ]; then
      cp "$f" "$BACKUP_DIR/$(basename "$f")"
      echo "  Backed up: $f -> $BACKUP_DIR/"
    fi
  done
  info "Config backups in $BACKUP_DIR"

  # ---------------------------------------------------------------
  # Write lab-mode config files with SAFE-MERGE semantics.
  #
  # On bare lab laptops (1-6): these files don't exist yet, so safe-merge
  # is effectively a fresh write.
  #
  # On instructor Fivetran laptops (labuser7): these files already contain
  # the instructor's personal dev state -- Anthropic API key, personal
  # Snowflake connections, dbt RSA key path, custom MCP wiring. Safe-merge
  # adds/updates only the lab-mode fields and preserves everything else.
  #
  # If any merge fails, the backup in $BACKUP_DIR is the recovery path.
  # ---------------------------------------------------------------

  # 1. ~/.fivetran-code/config.json -- JSON safe-merge
  python3 - "$CONFIG_FILE" "$FIVETRAN_API_KEY_VAL" "$FIVETRAN_API_SECRET_VAL" "$SNOWFLAKE_ACCOUNT_VAL" "$SNOWFLAKE_PAT_VAL" <<'PYEOF'
import json, os, sys
path, api_key, api_secret, sf_account, sf_pat = sys.argv[1:6]
existing = {}
if os.path.exists(path):
    try:
        with open(path) as f:
            existing = json.load(f)
    except json.JSONDecodeError as e:
        print(f"[WARN] {path} is not valid JSON ({e}). Leaving untouched -- "
              f"fix manually and re-run, OR restore from backup if it was corrupted.",
              file=sys.stderr)
        sys.exit(0)
lab_fields = {
    "fivetranApiKey": api_key,
    "fivetranApiSecret": api_secret,
    "snowflakeAccount": sf_account,
    "snowflakePatToken": sf_pat,
}
existing.update(lab_fields)
os.makedirs(os.path.dirname(path), exist_ok=True)
with open(path, "w") as f:
    json.dump(existing, f, indent=2)
    f.write("\n")
os.chmod(path, 0o600)
preserved = sorted(k for k in existing if k not in lab_fields)
if preserved:
    print(f"[OK] Safe-merged lab creds into {path} (preserved: {', '.join(preserved)})")
else:
    print(f"[OK] Wrote lab creds to {path}")
PYEOF

  # 2. ~/.snowflake/connections.toml -- TOML sectional safe-merge
  python3 - "$SF_CONN" "$SNOWFLAKE_ACCOUNT_VAL" "$SF_LAB_USER" "$SNOWFLAKE_PAT_VAL" "$SNOWFLAKE_WAREHOUSE_VAL" "$SF_LAB_DB" "$SF_LAB_ROLE" <<'PYEOF'
import os, sys, re
path, account, user, pat, warehouse, database, role = sys.argv[1:8]
existing = ""
if os.path.exists(path):
    with open(path) as f:
        existing = f.read()

new_section = (
    "[summit-lab]\n"
    f'account = "{account}"\n'
    f'user = "{user}"\n'
    f'password = "{pat}"\n'
    f'warehouse = "{warehouse}"\n'
    f'database = "{database}"\n'
    f'role = "{role}"\n'
)

header_re = re.compile(r'^\[summit-lab\]\s*$', re.M)
m = header_re.search(existing)
if m:
    # Replace existing [summit-lab] section: from its header to the next [section] or EOF
    tail = existing[m.end():]
    next_hdr = re.search(r'^\[', tail, re.M)
    end = m.end() + (next_hdr.start() if next_hdr else len(tail))
    new_content = existing[:m.start()] + new_section + existing[end:]
else:
    # Append, ensuring a blank-line separator
    if existing:
        if not existing.endswith("\n"):
            existing += "\n"
        if not existing.endswith("\n\n"):
            existing += "\n"
    new_content = existing + new_section

# Add default_connection_name only if absent (preserve instructor's choice if set)
if not re.search(r'^default_connection_name\s*=', new_content, re.M):
    new_content = 'default_connection_name = "summit-lab"\n\n' + new_content

os.makedirs(os.path.dirname(path), exist_ok=True)
with open(path, "w") as f:
    f.write(new_content)
os.chmod(path, 0o600)

other_sections = sorted(set(re.findall(r'^\[([^\]]+)\]', new_content, re.M)) - {"summit-lab"})
if other_sections:
    print(f"[OK] Safe-merged [summit-lab] into {path} (preserved sections: {', '.join(other_sections)})")
else:
    print(f"[OK] Wrote lab creds to {path}")
PYEOF

  # 3. mcp-servers/se-demo/.env -- dotenv key-level safe-merge
  SE_DEMO_ENV="$TOOLKIT_DIR/mcp-servers/se-demo/.env"
  DBT_VENV_PATH="$TOOLKIT_DIR/mcp-servers/se-demo/.venv/bin/dbt"
  DBT_PROJECT_PATH="$TOOLKIT_DIR/apps/activation-app/dbt_project"
  ACTIVATION_URL_VAL="https://fivetran-activation-api-81810785507.us-central1.run.app"

  # Pass lab-mode keys to Python via LAB_* env vars (scoped to this invocation only)
  LAB_LABUSER_NUM="${LABUSER_NUM}" \
  LAB_HOL_INSTRUCTOR="${HOL_INSTRUCTOR_VAL}" \
  LAB_LAPTOP_ID="${LAPTOP_ID_VAL}" \
  LAB_SNOWFLAKE_ACCOUNT="${SNOWFLAKE_ACCOUNT_VAL}" \
  LAB_SNOWFLAKE_USER="${SF_LAB_USER}" \
  LAB_SNOWFLAKE_PAT="${SNOWFLAKE_PAT_VAL}" \
  LAB_SNOWFLAKE_PASSWORD="${SNOWFLAKE_PAT_VAL}" \
  LAB_SNOWFLAKE_AUTH_TYPE="pat" \
  LAB_SNOWFLAKE_ROLE="${SF_LAB_ROLE}" \
  LAB_SNOWFLAKE_WAREHOUSE="${SNOWFLAKE_WAREHOUSE_VAL}" \
  LAB_SNOWFLAKE_DATABASE="${SF_LAB_DB}" \
  LAB_DBT_PROFILE_TARGET="lab" \
  LAB_DBT_PATH="${DBT_VENV_PATH}" \
  LAB_DBT_PROJECT_DIR="${DBT_PROJECT_PATH}" \
  LAB_DBT_PROFILES_DIR="${DBT_PROJECT_PATH}" \
  LAB_FIVETRAN_API_KEY="${FIVETRAN_API_KEY_VAL}" \
  LAB_FIVETRAN_API_SECRET="${FIVETRAN_API_SECRET_VAL}" \
  LAB_FIVETRAN_GROUP_ID="${FIVETRAN_GROUP_ID_VAL}" \
  LAB_ACTIVATION_API_URL="${ACTIVATION_URL_VAL}" \
  LAB_PG_HOL_HOST="${PG_HOL_HOST_VAL}" \
  LAB_PG_HOL_PORT="${PG_HOL_PORT_VAL}" \
  LAB_PG_HOL_DATABASE="${PG_HOL_DATABASE_VAL}" \
  LAB_PG_HOL_USER="${PG_HOL_USER_VAL}" \
  LAB_PG_HOL_PASSWORD="${PG_HOL_PASSWORD_VAL}" \
  python3 - "$SE_DEMO_ENV" <<'PYEOF'
import os, sys
path = sys.argv[1]

# Collect lab-mode keys (LAB_FOO -> FOO) from env
prefix = "LAB_"
lab_keys = {k[len(prefix):]: v for k, v in os.environ.items() if k.startswith(prefix)}

lines = []
seen = set()
if os.path.exists(path):
    with open(path) as f:
        for line in f:
            stripped = line.strip()
            if stripped and not stripped.startswith("#") and "=" in stripped:
                key = stripped.split("=", 1)[0]
                if key in lab_keys:
                    lines.append(f"{key}={lab_keys[key]}\n")
                    seen.add(key)
                    continue
            lines.append(line)

# Append any lab-mode keys not already in the file
missing = sorted(k for k in lab_keys if k not in seen)
if missing:
    if lines and not lines[-1].endswith("\n"):
        lines.append("\n")
    marker = "# Lab-mode (added by setup.sh)"
    if not any(l.strip() == marker for l in lines):
        lines.append(f"\n{marker}\n")
    for k in missing:
        lines.append(f"{k}={lab_keys[k]}\n")

os.makedirs(os.path.dirname(path), exist_ok=True)
with open(path, "w") as f:
    f.writelines(lines)
os.chmod(path, 0o600)

preserved_keys = [l.split("=", 1)[0] for l in lines
                  if l.strip() and not l.strip().startswith("#") and "=" in l
                  and l.split("=", 1)[0] not in lab_keys]
print(f"[OK] Safe-merged into {path}: {len(seen)} lab keys updated, "
      f"{len(missing)} added, {len(preserved_keys)} existing preserved")
PYEOF
  info "Lab-mode creds written (LAPTOP_ID=$LAPTOP_ID_VAL, HOL_INSTRUCTOR=$HOL_INSTRUCTOR_VAL)"

  # Run verification if verify.sh exists
  if [ -x "$TOOLKIT_DIR/setup/verify.sh" ]; then
    echo ""
    info "Running verify.sh..."
    "$TOOLKIT_DIR/setup/verify.sh" || warn "verify.sh reported issues — review above"
  fi
fi

# -------------------------------------------
# Summary
# -------------------------------------------
echo ""
echo "========================================="
echo "  Setup Complete"
echo "========================================="
echo ""
info "Cortex Code VSCode extension installed"
info "Fivetran Code MCP server built"
info "SE Demo MCP server ready (Python venv + dbt)"
info "HOL skill installed to ~/.claude/skills/"
info "Cortex MCP config written to ~/.snowflake/cortex/mcp.json"
echo ""

# Check for placeholder credentials -- ONLY in dev mode. Lab mode has already
# populated config via Step 10's safe-merge from labuser{N}.env, so any
# leftover YOUR_ strings are in fields the lab flow doesn't need (e.g.,
# anthropicApiKey -- token-counter cosmetic). verify.sh is authoritative
# for lab-mode readiness; no point second-guessing it here.
NEEDS_CREDS=0

if [ "$LAB_MODE" = "0" ]; then
  if grep -q "YOUR_" "$CONFIG_FILE" 2>/dev/null; then
    NEEDS_CREDS=1
    warn "Fill in credentials:"
    echo ""
    echo "  File 1: ~/.fivetran-code/config.json"
    echo "    - fivetranApiKey         (Fivetran Settings > API Key)"
    echo "    - fivetranApiSecret"
    echo "    - anthropicApiKey        (for token counting in footer)"
    echo "    - snowflakeAccount       (e.g., a3209653506471-sales-eng-hands-on-lab)"
    echo "    - snowflakePatToken"
    echo ""
  fi

  if grep -q "YOUR_" "$SF_CONN" 2>/dev/null; then
    NEEDS_CREDS=1
    echo "  File 2: ~/.snowflake/connections.toml"
    echo "    - account                (same Snowflake account locator)"
    echo "    - user                   (e.g., hol_lab_user3)"
    echo "    - password               (PAT token for this user)"
    echo "    - database               (e.g., HOL_DATABASE_3)"
    echo ""
  fi

  if [ -f "$TOOLKIT_DIR/mcp-servers/se-demo/.env" ] && grep -q "your_" "$TOOLKIT_DIR/mcp-servers/se-demo/.env" 2>/dev/null; then
    NEEDS_CREDS=1
    echo "  File 3: mcp-servers/se-demo/.env"
    echo "    - SNOWFLAKE_ACCOUNT"
    echo "    - SNOWFLAKE_USER"
    echo "    - SNOWFLAKE_PASSWORD"
    echo "    - SNOWFLAKE_DATABASE"
    echo "    - FIVETRAN_API_KEY"
    echo "    - FIVETRAN_API_SECRET"
    echo "    - FIVETRAN_GROUP_ID"
    echo ""
  fi
fi

echo "Next steps:"
if [ "$NEEDS_CREDS" -eq 1 ]; then
  echo "  1. Fill in credentials (see above)"
  echo "  2. Reload VSCode: Cmd+Shift+P > 'Developer: Reload Window'"
  echo "  3. Click the Snowflake icon in the activity bar"
  echo "  4. Type: list my groups (to verify Fivetran MCP server)"
  echo "  5. Type: /fivetran-snowflake-hol-sfsummit2026-v2 (to run the HOL)"
else
  echo "  1. Reload VSCode: Cmd+Shift+P > 'Developer: Reload Window'"
  echo "  2. Click the Snowflake icon in the activity bar"
  echo "  3. Type: list my groups (to verify Fivetran MCP server)"
  echo "  4. Type: /fivetran-snowflake-hol-sfsummit2026-v2 (to run the HOL)"
fi
echo ""
echo "Docs:"
echo "  HOL concept:  docs/summit_hol_concept_doc.md"
echo "  HOL abstract: docs/summit_hol_abstract.md"
echo ""
