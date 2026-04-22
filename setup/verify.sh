#!/bin/bash
# verify.sh — post-install smoke tests for lab-mode setup.
# Called by setup.sh when run with LABUSER_NUM; can be run standalone.
#
# Exit codes:
#   0 — all checks passed
#   1 — at least one check failed

set +e  # don't bail on first failure — run all checks and report

TOOLKIT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SE_DEMO_ENV="${TOOLKIT_DIR}/mcp-servers/se-demo/.env"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "  ${GREEN}✓${NC} $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; FAILURES=$((FAILURES + 1)); }
warn() { echo -e "  ${YELLOW}!${NC} $1"; }

FAILURES=0

echo "========================================="
echo "  verify.sh — Lab Setup Smoke Tests"
echo "========================================="

# Load .env for access to all lab-mode env vars
if [ ! -f "$SE_DEMO_ENV" ]; then
  echo "ERROR: $SE_DEMO_ENV not found. Run ./setup.sh <1-7> first." >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "$SE_DEMO_ENV"
set +a

# ─── Check 1: Env vars populated ───
echo ""
echo "[1/5] Environment variables"
for var in LABUSER_NUM SNOWFLAKE_ACCOUNT SNOWFLAKE_USER SNOWFLAKE_PAT SNOWFLAKE_ROLE \
           SNOWFLAKE_WAREHOUSE SNOWFLAKE_DATABASE FIVETRAN_API_KEY FIVETRAN_GROUP_ID \
           LAPTOP_ID HOL_INSTRUCTOR DBT_PROFILE_TARGET; do
  if [ -z "${!var}" ]; then
    fail "$var is empty"
  else
    pass "$var is set"
  fi
done

# ─── Check 2: Snowflake auth via PAT ───
echo ""
echo "[2/5] Snowflake PAT auth"
PY="${TOOLKIT_DIR}/mcp-servers/se-demo/.venv/bin/python"
if [ ! -x "$PY" ]; then
  fail "Python venv not found at $PY"
else
  SF_OUT=$("$PY" <<PYEOF 2>&1
import snowflake.connector, os, sys
try:
    c = snowflake.connector.connect(
        account=os.environ['SNOWFLAKE_ACCOUNT'].replace('.snowflakecomputing.com', ''),
        user=os.environ['SNOWFLAKE_USER'],
        password=os.environ['SNOWFLAKE_PAT'],
        role=os.environ['SNOWFLAKE_ROLE'],
        warehouse=os.environ['SNOWFLAKE_WAREHOUSE'],
        database=os.environ['SNOWFLAKE_DATABASE'],
        login_timeout=15,
    )
    r = c.cursor().execute("SELECT CURRENT_USER(), CURRENT_ROLE(), CURRENT_DATABASE()").fetchone()
    assert r[0] == os.environ['SNOWFLAKE_USER'], f"user mismatch: {r[0]}"
    assert r[1] == os.environ['SNOWFLAKE_ROLE'], f"role mismatch: {r[1]}"
    assert r[2] == os.environ['SNOWFLAKE_DATABASE'], f"db mismatch: {r[2]}"
    print(f"OK {r[0]} / {r[1]} / {r[2]}")
    c.close()
except Exception as e:
    print(f"FAIL {e}")
    sys.exit(1)
PYEOF
  )
  if echo "$SF_OUT" | grep -q "^OK "; then
    pass "Snowflake PAT auth: ${SF_OUT#OK }"
  else
    fail "Snowflake PAT auth: ${SF_OUT}"
  fi
fi

# ─── Check 3: Fivetran API + group access ───
echo ""
echo "[3/5] Fivetran API + scoped group access"
FT_OUT=$(curl -sf -u "${FIVETRAN_API_KEY}:${FIVETRAN_API_SECRET}" \
    "https://api.fivetran.com/v1/groups/${FIVETRAN_GROUP_ID}" 2>&1)
if echo "$FT_OUT" | grep -q '"id"'; then
  GROUP_NAME=$(echo "$FT_OUT" | python3 -c "import json, sys; print(json.load(sys.stdin).get('data', {}).get('name', '?'))" 2>/dev/null)
  pass "Fivetran API: group ${FIVETRAN_GROUP_ID} resolves to $GROUP_NAME"
else
  fail "Fivetran API: cannot reach group ${FIVETRAN_GROUP_ID}"
fi

# ─── Check 4: dbt debug ───
echo ""
echo "[4/5] dbt debug (profile target: $DBT_PROFILE_TARGET)"
if [ ! -x "${TOOLKIT_DIR}/mcp-servers/se-demo/.venv/bin/dbt" ]; then
  fail "dbt not found in venv"
else
  DBT_OUT=$(cd "$DBT_PROJECT_DIR" && "${TOOLKIT_DIR}/mcp-servers/se-demo/.venv/bin/dbt" debug \
      --profiles-dir "$DBT_PROFILES_DIR" --target "$DBT_PROFILE_TARGET" 2>&1 | tail -20)
  if echo "$DBT_OUT" | grep -q "All checks passed"; then
    pass "dbt debug: all checks passed"
  else
    fail "dbt debug: see output below"
    echo "$DBT_OUT" | sed 's/^/       /'
  fi
fi

# ─── Check 5: MCP servers registered ───
echo ""
echo "[5/5] MCP servers in ~/.snowflake/cortex/mcp.json"
MCP_CFG="$HOME/.snowflake/cortex/mcp.json"
if [ ! -f "$MCP_CFG" ]; then
  fail "MCP config not found at $MCP_CFG"
else
  if grep -q '"fivetran-code"' "$MCP_CFG" && grep -q '"se-demo"' "$MCP_CFG"; then
    pass "fivetran-code and se-demo registered"
  else
    fail "one or both MCP servers missing from $MCP_CFG"
  fi
fi

echo ""
echo "========================================="
if [ "$FAILURES" -eq 0 ]; then
  echo -e "  ${GREEN}All checks passed — lab laptop is ready.${NC}"
  echo "========================================="
  exit 0
else
  echo -e "  ${RED}$FAILURES check(s) failed — review output above.${NC}"
  echo "========================================="
  exit 1
fi
