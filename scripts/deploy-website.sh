#!/usr/bin/env bash
#
# deploy-website.sh
# Deploys the AgriAI Insights static website to AWS S3.
#
# 1. Applies the CloudFormation template at infrastructure/s3-website.yaml
#    to create or update the S3 bucket + public-read policy.
# 2. Syncs everything under docs/ to the bucket.
# 3. Prints the public website URL emitted by the CloudFormation stack.
#
# Environment overrides:
#   AWS_REGION   AWS region to deploy into (default: eu-west-2)
#   STACK_NAME   CloudFormation stack name (default: agriai-insights-website)
#   BUCKET_NAME  S3 bucket name           (default: agriai-insights-website)
#
# Prerequisites:
#   - AWS CLI v2 configured (`aws configure` or AWS_* env vars)
#   - Caller has CloudFormation + S3 permissions
#
# Author: Juliet Chinenye Duru
set -euo pipefail

AWS_REGION="${AWS_REGION:-eu-west-2}"
STACK_NAME="${STACK_NAME:-agriai-insights-website}"
BUCKET_NAME="${BUCKET_NAME:-agriai-insights-website}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TEMPLATE_FILE="${PROJECT_ROOT}/infrastructure/s3-website.yaml"
WEBSITE_DIR="${PROJECT_ROOT}/docs"

# --- pre-flight checks --------------------------------------------------------
if ! command -v aws >/dev/null 2>&1; then
  echo "error: aws CLI not found on PATH. Install AWS CLI v2 first." >&2
  exit 1
fi
if [[ ! -f "${TEMPLATE_FILE}" ]]; then
  echo "error: CloudFormation template not found at ${TEMPLATE_FILE}" >&2
  exit 1
fi
if [[ ! -d "${WEBSITE_DIR}" ]] || [[ -z "$(ls -A "${WEBSITE_DIR}" 2>/dev/null)" ]]; then
  echo "error: ${WEBSITE_DIR} is missing or empty — nothing to upload." >&2
  exit 1
fi

echo "▶ AWS account: $(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo '<unknown>')"
echo "▶ Region    : ${AWS_REGION}"
echo "▶ Stack     : ${STACK_NAME}"
echo "▶ Bucket    : ${BUCKET_NAME}"
echo ""

# --- 1. CloudFormation deploy -------------------------------------------------
echo "▶ Deploying CloudFormation stack..."
aws cloudformation deploy \
  --stack-name "${STACK_NAME}" \
  --template-file "${TEMPLATE_FILE}" \
  --parameter-overrides "BucketName=${BUCKET_NAME}" \
  --region "${AWS_REGION}" \
  --no-fail-on-empty-changeset

# --- 2. Upload website assets -------------------------------------------------
echo ""
echo "▶ Syncing ${WEBSITE_DIR} → s3://${BUCKET_NAME}..."
aws s3 sync "${WEBSITE_DIR}/" "s3://${BUCKET_NAME}/" \
  --region "${AWS_REGION}" \
  --delete \
  --exclude ".DS_Store" \
  --exclude "*.map" \
  --cache-control "public, max-age=300"

# Override cache-control for index.html so updates propagate quickly.
aws s3 cp "${WEBSITE_DIR}/index.html" "s3://${BUCKET_NAME}/index.html" \
  --region "${AWS_REGION}" \
  --content-type "text/html; charset=utf-8" \
  --cache-control "no-cache, max-age=0" \
  --metadata-directive REPLACE >/dev/null

# --- 3. Print the live URL ----------------------------------------------------
WEBSITE_URL=$(aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" \
  --region "${AWS_REGION}" \
  --query "Stacks[0].Outputs[?OutputKey=='WebsiteURL'].OutputValue" \
  --output text)

echo ""
echo "✓ Deployment complete"
echo "  Live website: ${WEBSITE_URL}"
