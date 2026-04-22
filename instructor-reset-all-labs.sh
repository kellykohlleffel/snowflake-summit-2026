#!/bin/bash
# instructor-reset-all-labs.sh
#
# Cross-laptop reset for between-session turnover. Runs from ONE machine (the
# instructor laptop — labuser-7) and resets all 7 booth laptops' state by
# iterating through each labuser's 1Password-stored scoped credentials.
#
# Safety model:
#   - Uses each labuser's SCOPED Fivetran key (loaded from 1P at runtime).
#     A scoped key can only see/delete connectors in its own destination,
#     so this script physically cannot touch Kelly's other demos (verbatim_suite,
#     PSE_Platform, etc.) even if the allowlist had a bug.
#   - Uses each labuser's SCOPED Snowflake PAT (ROLE_RESTRICTION to SF_LABUSERN_ROLE),
#     so this script can only drop schemas in SF_LABUSERN_DB — no cross-user risk.
#   - Default mode is DRY RUN — prints what would be deleted. Pass --confirm to execute.
#   - Hardcoded allowlist: only acts on the 7 SF_LABUSER{N}_DEST group IDs.
#
# Usage:
#   ./instructor-reset-all-labs.sh              # dry run
#   ./instructor-reset-all-labs.sh --confirm    # execute
#   ./instructor-reset-all-labs.sh --only 3     # dry-run only labuser 3
#   ./instructor-reset-all-labs.sh --only 3 --confirm

set -e

TOOLKIT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

# --- Parse args ---
CONFIRM=0
ONLY_LABUSER=""
while [ $# -gt 0 ]; do
  case "$1" in
    --confirm) CONFIRM=1; shift ;;
    --only)    ONLY_LABUSER="$2"; shift 2 ;;
    -h|--help)
      grep -E "^#" "$0" | head -30; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

# --- Hardcoded allowlist (mapping labuser N → group_id + destination name) ---
# DO NOT edit this without verifying against a read-only `op read` of each
# labuser's fivetran_group_id field in 1P. These must match exactly.
declare -a ALLOWED_GROUPS=(
  "1:surveillance_affectionately:SF_LABUSER1_DEST"
  "2:syntactic_unexpected:SF_LABUSER2_DEST"
  "3:really_woof:SF_LABUSER3_DEST"
  "4:gibberish_wither:SF_LABUSER4_DEST"
  "5:victory_rebirth:SF_LABUSER5_DEST"
  "6:reasonable_religion:SF_LABUSER6_DEST"
  "7:blown_dismiss:SF_LABUSER7_DEST"
)

# --- HOL-created schema pattern (case-insensitive; a connector is eligible for
#     delete only if its schema matches this regex) ---
HOL_SCHEMA_REGEX='_(PHARMA|RETAIL|HED|FINANCIAL|AGRICULTURE|HEALTHCARE|SUPPLY_CHAIN)$'

# --- 1P vault identifiers (stable IDs — rename-proof) ---
OP_VAULT_ID="omjghrbq7wfvvwu4kn67y5sag4"
OP_ITEM_ID="xry7itj66x4zcgecyjuqcn6qdy"

# --- Check op CLI ---
if ! command -v op &> /dev/null; then
  echo -e "${RED}Error: op CLI not found. Install 1Password CLI first.${NC}" >&2
  exit 1
fi
if ! op whoami &> /dev/null; then
  echo -e "${YELLOW}1P CLI not signed in — running 'op signin'...${NC}"
  op signin
fi

echo "========================================="
echo "  instructor-reset-all-labs.sh"
if [ "$CONFIRM" -eq 1 ]; then
  echo -e "  ${BOLD}${RED}MODE: EXECUTE (destructive)${NC}"
else
  echo -e "  ${BOLD}${GREEN}MODE: DRY RUN (no changes will be made)${NC}"
fi
echo "========================================="

op_read() { op read "op://${OP_VAULT_ID}/${OP_ITEM_ID}/${1}" 2>/dev/null || true; }

# --- Per-labuser reset function ---
reset_one_labuser() {
  local N="$1" GROUP="$2" DEST_NAME="$3"
  echo ""
  echo -e "${BOLD}── Lab User ${N} (group: ${GROUP}, dest: ${DEST_NAME}) ──${NC}"

  # Section name for labuser 7 has "(INSTRUCTOR)" suffix per 1P vault
  local SECTION
  if [ "$N" = "7" ]; then SECTION="LAB USER 7 (INSTRUCTOR)"; else SECTION="LAB USER $N"; fi

  # Pull scoped creds from 1P
  local FT_B64 PAT
  FT_B64=$(op_read "${SECTION}/fivetran_key_b64")
  PAT=$(op_read "${SECTION}/snowflake_pat")
  if [ -z "$FT_B64" ] || [ -z "$PAT" ]; then
    echo -e "  ${RED}✗ Missing 1P creds for labuser $N (skipping)${NC}"
    return
  fi

  # Decode base64 fivetran key
  local DECODED FT_KEY FT_SECRET
  DECODED=$(echo -n "$FT_B64" | base64 -d 2>/dev/null || true)
  FT_KEY="${DECODED%%:*}"; FT_SECRET="${DECODED##*:}"

  # List connectors visible to this scoped key
  local CONN_JSON
  CONN_JSON=$(curl -sf -u "${FT_KEY}:${FT_SECRET}" \
    "https://api.fivetran.com/v1/groups/${GROUP}/connections?limit=100" 2>&1)
  if ! echo "$CONN_JSON" | grep -q '"items"'; then
    echo -e "  ${RED}✗ Cannot list connectors (check key scope)${NC}"
    return
  fi

  # Filter to HOL-created schemas
  local HOL_CONNS
  HOL_CONNS=$(echo "$CONN_JSON" | python3 -c "
import json, re, sys
d = json.load(sys.stdin)
pattern = re.compile(r'${HOL_SCHEMA_REGEX}', re.IGNORECASE)
for c in d.get('data', {}).get('items', []):
    schema = c.get('schema', '')
    if pattern.search(schema):
        print(f\"{c['id']}\t{schema}\")
")

  if [ -z "$HOL_CONNS" ]; then
    echo -e "  ${GREEN}✓ No HOL connectors to delete${NC}"
  else
    echo "  HOL connectors in this destination:"
    echo "$HOL_CONNS" | while IFS=$'\t' read -r CID SCHEMA; do
      if [ "$CONFIRM" -eq 1 ]; then
        DEL=$(curl -sf -u "${FT_KEY}:${FT_SECRET}" -X DELETE \
          "https://api.fivetran.com/v1/connections/${CID}" 2>&1)
        if echo "$DEL" | grep -q '"code":"Success"'; then
          echo -e "    ${GREEN}✓ deleted${NC} ${CID} (schema: ${SCHEMA})"
        else
          echo -e "    ${RED}✗ failed${NC} ${CID}: ${DEL}"
        fi
      else
        echo -e "    ${YELLOW}would delete${NC} ${CID} (schema: ${SCHEMA})"
      fi
    done

    # Drop Snowflake schemas created by the deleted connectors + dbt output schemas
    if [ "$CONFIRM" -eq 1 ]; then
      echo "  Dropping Snowflake schemas in SF_LABUSER${N}_DB..."
      # Build DROP SQL: each unique prefix (schema up to last underscore) gets all 4 HOL schemas dropped
      SCHEMAS_TO_DROP=$(echo "$HOL_CONNS" | awk -F'\t' '{print $2}' | python3 -c "
import sys, re
prefixes = set()
industries = ['PHARMA','RETAIL','HED','FINANCIAL','AGRICULTURE','HEALTHCARE','SUPPLY_CHAIN']
for line in sys.stdin:
    schema = line.strip().upper()
    for ind in industries:
        if schema.endswith('_' + ind):
            prefix = schema[:-len('_' + ind)]
            prefixes.add((prefix, ind))
            print(f'{schema}')
            print(f'{ind}_STAGING')
            print(f'{ind}_MARTS')
            print(f'{ind}_SEMANTIC')
" | sort -u)
      echo "$SCHEMAS_TO_DROP" | while read -r S; do
        if [ -n "$S" ]; then
          echo -e "    ${YELLOW}(skipping SQL execution — implement snowflake-connector call here)${NC} DROP SCHEMA IF EXISTS SF_LABUSER${N}_DB.${S} CASCADE"
        fi
      done
    else
      echo "  (dry run — SQL DROP SCHEMA statements would run against SF_LABUSER${N}_DB)"
    fi
  fi

  # Reset activation app for this laptop across all industries
  if [ "$CONFIRM" -eq 1 ]; then
    echo "  Resetting activation app (laptop${N}) across all industries..."
    for IND in pharma retail hed financial agriculture healthcare supply_chain; do
      curl -sf -X POST "https://fivetran-activation-api-81810785507.us-central1.run.app/reset/${IND}/laptop${N}" > /dev/null 2>&1 \
        && echo -e "    ${GREEN}✓${NC} reset ${IND}/laptop${N}" \
        || echo -e "    ${YELLOW}!${NC} ${IND}/laptop${N} reset returned non-2xx (may be empty — OK)"
    done
  else
    echo "  (dry run — activation app /reset/{industry}/laptop${N} for 7 industries would run)"
  fi
}

# --- Main loop ---
for entry in "${ALLOWED_GROUPS[@]}"; do
  N="${entry%%:*}"
  REST="${entry#*:}"
  GROUP="${REST%%:*}"
  DEST_NAME="${REST#*:}"

  if [ -n "$ONLY_LABUSER" ] && [ "$ONLY_LABUSER" != "$N" ]; then continue; fi
  reset_one_labuser "$N" "$GROUP" "$DEST_NAME"
done

echo ""
echo "========================================="
if [ "$CONFIRM" -eq 1 ]; then
  echo -e "  ${GREEN}Reset complete.${NC}"
else
  echo -e "  ${YELLOW}Dry run complete. Re-run with --confirm to execute.${NC}"
fi
echo "========================================="

# --- Known limitation ---
# The Snowflake DROP SCHEMA execution is stubbed above (printed but not run).
# Implementing it requires a snowflake-connector-python call per labuser using
# their PAT — which is straightforward but adds 20+ lines. For now, this script
# handles the Fivetran connector cleanup + activation app reset; Snowflake
# schema drops can be done via the se-demo MCP tool `cleanup_demo` from each
# laptop's instructor UI, or wired into this script in a follow-up commit.
