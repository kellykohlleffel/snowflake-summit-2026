#!/usr/bin/env bash
# ============================================================================
# deploy.sh -- Build + deploy the Fivetran Activation React app to Firebase.
#
# Usage (from this directory):
#   ./deploy.sh
#
# Companion to api/deploy.sh (which deploys the Cloud Run API). The two are
# separate deployments -- the React app is Firebase-hosted, the API is
# Cloud-Run-hosted -- but both must be redeployed together when their source
# changes, otherwise one half will be running stale code.
#
# Prerequisites:
#   - Node.js + npm
#   - Firebase CLI (npm install -g firebase-tools)
#   - Firebase auth: firebase login
#   - Hosting target configured: hosting:fivetran-activation-demo
# ============================================================================
set -euo pipefail

GREEN=$'\033[0;32m'
BOLD=$'\033[1m'
NC=$'\033[0m'

echo -e "${BOLD}[1/3] Installing dependencies (npm install)${NC}"
npm install

echo -e "${BOLD}[2/3] Building React app (npm run build)${NC}"
npm run build

echo -e "${BOLD}[3/3] Deploying to Firebase hosting (fivetran-activation-demo)${NC}"
firebase deploy --only hosting:fivetran-activation-demo

echo ""
echo -e "${GREEN}Deploy complete.${NC}"
echo "  App URL:  https://fivetran-activation-demo.web.app"
echo "  Per-laptop: https://fivetran-activation-demo.web.app?laptop_id=laptop1"
