#!/usr/bin/env bash
# ============================================================================
# restore-instructor-backup.sh -- Revert an instructor-mode setup.sh run.
#
# When ./setup.sh 7 runs on a Fivetran-imaged instructor laptop, Step 7 backs
# up any pre-existing ~/.claude/skills/fivetran-snowflake-hol-sfsummit2026-v2/
# to ~/.summit-hol-backups/<timestamp>-labuser7/skills/ before overwriting it
# with the lab's version. This script restores the prior copy.
#
# Usage:
#   ./restore-instructor-backup.sh                    # dry-run (default)
#   ./restore-instructor-backup.sh --dry-run          # explicit dry-run
#   ./restore-instructor-backup.sh --confirm          # apply the restore
#   ./restore-instructor-backup.sh --backup-dir <p>   # use specific backup
#   ./restore-instructor-backup.sh --help             # this message
#
# Exits 0 on success, non-zero on failure. Idempotent -- safe to re-run.
# ============================================================================
set -euo pipefail

DRY_RUN=1
BACKUP_DIR=""
SCRIPT_NAME="$(basename "$0")"

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
${BOLD}${SCRIPT_NAME}${NC} -- Revert an instructor-mode setup.sh run.

Usage:
  ./${SCRIPT_NAME}                    Dry-run (preview, no changes)
  ./${SCRIPT_NAME} --dry-run          Explicit dry-run
  ./${SCRIPT_NAME} --confirm          Apply the restore
  ./${SCRIPT_NAME} --backup-dir PATH  Use a specific backup directory
                                      (default: ~/.summit-hol-backups/.latest)
  ./${SCRIPT_NAME} --help             This message

What it restores:
  ~/.claude/skills/fivetran-snowflake-hol-sfsummit2026-v2/
  from BACKUP_DIR/skills/fivetran-snowflake-hol-sfsummit2026-v2/

Idempotent. Safe to re-run.
EOF
}

# ----- Parse args -----
while [ $# -gt 0 ]; do
  case "$1" in
    --confirm)     DRY_RUN=0; shift ;;
    --dry-run)     DRY_RUN=1; shift ;;
    --backup-dir)  BACKUP_DIR="${2:-}"; shift 2 ;;
    --help|-h)     usage; exit 0 ;;
    *)
      error "Unknown argument: $1"
      echo ""
      usage
      exit 1
      ;;
  esac
done

# ----- Resolve backup directory -----
LATEST_PTR="$HOME/.summit-hol-backups/.latest"
if [ -z "$BACKUP_DIR" ]; then
  if [ -f "$LATEST_PTR" ]; then
    BACKUP_DIR="$(cat "$LATEST_PTR")"
  fi
fi

if [ -z "$BACKUP_DIR" ]; then
  error "No backup found."
  echo "      Expected pointer at: $LATEST_PTR"
  echo "      Or pass --backup-dir <path> explicitly."
  echo ""
  echo "      Available backups in ~/.summit-hol-backups/:"
  ls -1 "$HOME/.summit-hol-backups" 2>/dev/null | grep -v "^\." || echo "        (none)"
  exit 2
fi

if [ ! -d "$BACKUP_DIR" ]; then
  error "Backup directory does not exist: $BACKUP_DIR"
  exit 2
fi

# ----- Show plan -----
echo ""
echo -e "${BOLD}restore-instructor-backup.sh${NC}"
echo "  Source:  $BACKUP_DIR"
if [ "$DRY_RUN" = "1" ]; then
  echo -e "  Mode:    ${YELLOW}DRY-RUN${NC} (re-run with --confirm to apply)"
else
  echo -e "  Mode:    ${BOLD}APPLY${NC}"
fi
echo ""

# ----- 1. Restore skill directory -----
SKILL_BAK="$BACKUP_DIR/skills/fivetran-snowflake-hol-sfsummit2026-v2"
SKILL_DST="$HOME/.claude/skills/fivetran-snowflake-hol-sfsummit2026-v2"

restored=0
skipped=0
failed=0

if [ -d "$SKILL_BAK" ]; then
  echo "Plan: restore HOL skill"
  echo "  from: $SKILL_BAK"
  echo "  to:   $SKILL_DST"
  if [ "$DRY_RUN" = "0" ]; then
    if rm -rf "$SKILL_DST" && mkdir -p "$HOME/.claude/skills" && cp -R "$SKILL_BAK" "$HOME/.claude/skills/"; then
      info "Skill restored"
      restored=$((restored + 1))
    else
      error "Skill restore failed"
      failed=$((failed + 1))
    fi
  fi
else
  warn "No skill backup at $SKILL_BAK -- skipping"
  skipped=$((skipped + 1))
fi

echo ""

# ----- Summary -----
if [ "$DRY_RUN" = "1" ]; then
  echo -e "${YELLOW}DRY-RUN complete -- no changes made.${NC}"
  echo "Re-run with --confirm to apply."
  exit 0
fi

echo "Summary:  $restored restored, $skipped skipped, $failed failed"
if [ "$failed" -gt 0 ]; then
  exit 1
fi
exit 0
