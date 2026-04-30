#!/usr/bin/env bash
# ============================================================================
# deploy.sh -- Build + push + deploy the Fivetran Activation API to Cloud Run.
#
# Usage (from this directory):
#   ./deploy.sh
#
# Why not `gcloud run deploy --source`?
#   The Fivetran GCP org enforces constraints/storage.softDeletePolicySeconds,
#   which blocks gcloud's auto-created source-staging bucket (default 7-day
#   soft-delete violates the constraint). Build-and-push to Artifact Registry
#   bypasses the staging bucket entirely. Same pattern as pse-platform.
#
# Prerequisites:
#   - Docker (rancher-desktop, Docker Desktop, etc.)
#   - gcloud authenticated to the fivetran-fivetran-248-war-mraw project
#   - Artifact Registry write access to cloud-run-source-deploy repo
#   - Cloud Run deployer role on the fivetran-activation-api service
# ============================================================================
set -euo pipefail

PROJECT="fivetran-fivetran-248-war-mraw"
REGION="us-central1"
AR_REPO="cloud-run-source-deploy"
IMAGE_NAME="fivetran-activation-api"
SERVICE_NAME="fivetran-activation-api"
TAG="latest"

IMAGE="us-central1-docker.pkg.dev/${PROJECT}/${AR_REPO}/${IMAGE_NAME}:${TAG}"

GREEN=$'\033[0;32m'
BOLD=$'\033[1m'
NC=$'\033[0m'

echo -e "${BOLD}[1/3] Building image (linux/amd64) -- ${IMAGE}${NC}"
docker build --platform linux/amd64 -t "${IMAGE}" .

echo -e "${BOLD}[2/3] Pushing image to Artifact Registry${NC}"
docker push "${IMAGE}"

echo -e "${BOLD}[3/3] Deploying revision to Cloud Run service ${SERVICE_NAME}${NC}"
gcloud run deploy "${SERVICE_NAME}" \
  --image="${IMAGE}" \
  --region="${REGION}" \
  --project="${PROJECT}" \
  --allow-unauthenticated

echo ""
echo -e "${GREEN}Deploy complete.${NC}"
echo "  Service URL: https://fivetran-activation-api-81810785507.us-central1.run.app"
echo "  Verify routes:"
echo "    curl https://fivetran-activation-api-81810785507.us-central1.run.app/health"
