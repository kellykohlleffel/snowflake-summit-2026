#!/bin/bash
set -e

# Snowflake Summit 2026 HOL -- Bootstrap Script
# Run this after cloning the repo. Safe to re-run -- picks up where it left off.

TOOLKIT_DIR="$(cd "$(dirname "$0")" && pwd)"
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
# Step 1: Check core prerequisites
# -------------------------------------------
step "1" "Checking prerequisites..."

MISSING=0

# Git
if ! command -v git &> /dev/null; then
  error "Git not found."
  if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "      Run:  xcode-select --install"
  else
    echo "      Install git for your platform: https://git-scm.com/downloads"
  fi
  MISSING=1
else
  info "Git $(git --version | awk '{print $3}')"
fi

# Node.js
if ! command -v node &> /dev/null; then
  error "Node.js not found. Install from https://nodejs.org/ (v18+ required, download the LTS .pkg)"
  MISSING=1
else
  NODE_VERSION=$(node --version | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_VERSION" -lt 18 ]; then
    error "Node.js v$NODE_VERSION found, but v18+ required. Update from https://nodejs.org/"
    MISSING=1
  else
    info "Node.js $(node --version)"
  fi
fi

# Python 3.12+
if ! command -v python3 &> /dev/null; then
  error "Python 3 not found. Install from https://python.org/downloads/ (3.12+ required, download the .pkg)"
  MISSING=1
else
  PY_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
  PY_MINOR=$(echo "$PY_VERSION" | cut -d. -f2)
  if [ "$PY_MINOR" -lt 12 ]; then
    error "Python $PY_VERSION found, but 3.12+ required. Update from https://python.org/downloads/"
    MISSING=1
  else
    info "Python $PY_VERSION"
  fi
fi

# VSCode
if ! command -v code &> /dev/null; then
  error "VSCode 'code' command not found."
  echo "      1. Install VSCode from https://code.visualstudio.com/ if needed"
  echo "      2. Open VSCode"
  echo "      3. Cmd+Shift+P > 'Shell Command: Install code command in PATH'"
  MISSING=1
else
  info "VSCode $(code --version 2>/dev/null | head -1)"
fi

if [ "$MISSING" -eq 1 ]; then
  pause_and_exit
fi

# -------------------------------------------
# Step 2: Check Cortex Code CLI
# -------------------------------------------
step "2" "Checking Cortex Code CLI..."

# Check common locations
CORTEX_BIN=""
if command -v cortex &> /dev/null; then
  CORTEX_BIN="$(which cortex)"
elif [ -f "$HOME/.local/bin/cortex" ]; then
  CORTEX_BIN="$HOME/.local/bin/cortex"
fi

if [ -z "$CORTEX_BIN" ]; then
  error "Cortex Code CLI not found."
  echo ""
  echo "      Install Cortex Code from Snowflake:"
  echo "      https://docs.snowflake.com/en/user-guide/cortex-code/cortex-code-cli"
  echo ""
  echo "      After installation, verify with:  cortex --version"
  echo "      If installed to ~/.local/bin, add to PATH:"
  echo "        export PATH=\"\$HOME/.local/bin:\$PATH\""
  echo "      (Add that line to your ~/.zshrc or ~/.bashrc to make it permanent)"
  pause_and_exit
else
  CORTEX_VERSION=$("$CORTEX_BIN" --version 2>&1 | head -1)
  info "Cortex Code CLI: $CORTEX_VERSION (at $CORTEX_BIN)"
fi

# -------------------------------------------
# Step 3: Check GitHub authentication
# -------------------------------------------
step "3" "Checking GitHub authentication..."

if ! command -v gh &> /dev/null; then
  warn "GitHub CLI (gh) not installed. Installing now..."

  if [[ "$OSTYPE" == "darwin"* ]]; then
    GH_VERSION="2.67.0"
    GH_PKG="/tmp/gh_installer.pkg"
    echo "      Downloading GitHub CLI v${GH_VERSION}..."
    curl -sL -o "$GH_PKG" "https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_macOS_universal.pkg"

    if ! file "$GH_PKG" | grep -q "xar archive"; then
      error "Download failed. Install manually from https://cli.github.com/"
      pause_and_exit
    fi

    echo "      Installing (requires your password)..."
    sudo installer -pkg "$GH_PKG" -target / 2>&1
    rm -f "$GH_PKG"

    if command -v gh &> /dev/null; then
      info "GitHub CLI $(gh --version | head -1 | awk '{print $3}')"
    else
      error "GitHub CLI installation failed. Install manually from https://cli.github.com/"
      pause_and_exit
    fi
  else
    error "Install GitHub CLI from https://cli.github.com/ and re-run this script."
    pause_and_exit
  fi
else
  info "GitHub CLI $(gh --version | head -1 | awk '{print $3}')"
fi

if ! gh auth status &> /dev/null; then
  warn "Not logged in to GitHub. Run these two commands, then re-run setup.sh:"
  echo ""
  echo "      gh auth login"
  echo "        -> Choose: GitHub.com, HTTPS, Login with a web browser"
  echo "        -> Follow the browser prompts"
  echo ""
  echo "      gh auth setup-git"
  echo "        -> Lets git use your GitHub credentials"
  echo ""
  pause_and_exit
else
  GH_USER=$(gh auth status 2>&1 | grep "Logged in" | awk '{print $7}' | tr -d '()')
  info "GitHub authenticated as $GH_USER"
  gh auth setup-git 2>/dev/null || true
fi

# -------------------------------------------
# Step 4: Fix npm cache permissions if needed
# -------------------------------------------
step "4" "Checking npm setup..."

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
# Step 5: Build Cortex Code VSCode extension
# -------------------------------------------
step "5" "Building Cortex Code VSCode extension..."

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
# Step 6: Build Fivetran Code MCP Server
# -------------------------------------------
step "6" "Building Fivetran Code MCP Server..."

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
# Step 7: Set up SE Demo MCP Server
# -------------------------------------------
step "7" "Setting up SE Demo MCP Server..."

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
# Step 8: Install HOL skill files
# -------------------------------------------
step "8" "Installing HOL skill files..."

SKILL_SRC="$TOOLKIT_DIR/skills/fivetran-snowflake-hol-sfsummit2026"
SKILL_DST="$HOME/.claude/skills/fivetran-snowflake-hol-sfsummit2026"

if [ -d "$SKILL_SRC" ]; then
  mkdir -p "$HOME/.claude/skills"
  rm -rf "$SKILL_DST"
  cp -r "$SKILL_SRC" "$HOME/.claude/skills/"
  info "HOL skill installed to ~/.claude/skills/fivetran-snowflake-hol-sfsummit2026/"
else
  error "Skill source not found at $SKILL_SRC"
  exit 1
fi

# -------------------------------------------
# Step 9: Set up credentials and config
# -------------------------------------------
step "9" "Setting up credentials and config..."

# --- ~/.fivetran-code/config.json ---
CONFIG_DIR="$HOME/.fivetran-code"
CONFIG_FILE="$CONFIG_DIR/config.json"

mkdir -p "$CONFIG_DIR"

if [ ! -f "$CONFIG_FILE" ]; then
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
else
  info "Config file already exists at $CONFIG_FILE"
fi

# --- ~/.snowflake/connections.toml ---
SF_DIR="$HOME/.snowflake"
SF_CONN="$SF_DIR/connections.toml"

mkdir -p "$SF_DIR"

if [ ! -f "$SF_CONN" ]; then
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
else
  info "Snowflake connections.toml already exists at $SF_CONN"
fi

# -------------------------------------------
# Step 10: Configure MCP servers for Cortex
# -------------------------------------------
step "10" "Configuring MCP servers for Cortex Code..."

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

# Check for placeholder credentials
NEEDS_CREDS=0

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

echo "Next steps:"
if [ "$NEEDS_CREDS" -eq 1 ]; then
  echo "  1. Fill in credentials (see above)"
  echo "  2. Reload VSCode: Cmd+Shift+P > 'Developer: Reload Window'"
  echo "  3. Click the Snowflake icon in the activity bar"
  echo "  4. Type: list my groups (to verify Fivetran MCP server)"
  echo "  5. Type: /fivetran-snowflake-hol-sfsummit2026 (to run the HOL)"
else
  echo "  1. Reload VSCode: Cmd+Shift+P > 'Developer: Reload Window'"
  echo "  2. Click the Snowflake icon in the activity bar"
  echo "  3. Type: list my groups (to verify Fivetran MCP server)"
  echo "  4. Type: /fivetran-snowflake-hol-sfsummit2026 (to run the HOL)"
fi
echo ""
echo "Docs:"
echo "  HOL concept:  docs/summit_hol_concept_doc.md"
echo "  HOL abstract: docs/summit_hol_abstract.md"
echo ""
