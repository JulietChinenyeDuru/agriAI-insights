#!/usr/bin/env bash
#
# deploy-backend.sh
# Packages the AgriAI FastAPI backend and deploys it to AWS Lambda
# via CloudFormation (API Gateway HTTP API + Lambda + IAM + CloudWatch).
#
# Steps:
#   1. Install Python dependencies + copy source into a temp directory.
#   2. Zip the package and upload it to a versioned S3 artifact bucket.
#   3. Create or update the CloudFormation stack (infrastructure/lambda.yaml).
#   4. Print the live API Gateway URL.
#
# Environment overrides:
#   AWS_REGION   AWS region to deploy into  (default: eu-west-1)
#   STACK_NAME   CloudFormation stack name  (default: agriai-backend)
#
# Prerequisites:
#   - Python 3.12 + pip3 available on PATH
#   - zip available on PATH
#   - AWS CLI v2 configured (aws configure or AWS_* env vars)
#   - Caller has permissions for: Lambda, API Gateway, IAM, S3, CloudFormation
#
# Author: Juliet Chinenye Duru
set -euo pipefail

AWS_REGION="${AWS_REGION:-eu-west-1}"
STACK_NAME="${STACK_NAME:-agriai-backend}"
ARTIFACT_KEY="agriai-backend.zip"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKEND_DIR="${PROJECT_ROOT}/backend"
TEMPLATE_FILE="${PROJECT_ROOT}/infrastructure/lambda.yaml"

# ── pre-flight checks ─────────────────────────────────────────────────────────
for cmd in aws python3 pip3 zip; do
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    echo "error: '${cmd}' not found on PATH." >&2
    exit 1
  fi
done

if [[ ! -f "${TEMPLATE_FILE}" ]]; then
  echo "error: CloudFormation template not found at ${TEMPLATE_FILE}" >&2
  exit 1
fi
if [[ ! -f "${BACKEND_DIR}/requirements.txt" ]]; then
  echo "error: requirements.txt not found at ${BACKEND_DIR}/requirements.txt" >&2
  exit 1
fi
if [[ ! -f "${BACKEND_DIR}/src/main.py" ]]; then
  echo "error: src/main.py not found at ${BACKEND_DIR}/src/main.py" >&2
  exit 1
fi

AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
# Bucket name derived from account + region so it is unique and deterministic.
ARTIFACT_BUCKET="agriai-deploy-${AWS_ACCOUNT}-${AWS_REGION}"

echo "▶ AWS account : ${AWS_ACCOUNT}"
echo "▶ Region      : ${AWS_REGION}"
echo "▶ Stack       : ${STACK_NAME}"
echo "▶ Artifact    : s3://${ARTIFACT_BUCKET}/${ARTIFACT_KEY}"
echo ""

# ── 1. Build deployment package ───────────────────────────────────────────────
echo "▶ Installing Python dependencies..."
BUILD_DIR=$(mktemp -d)
# Remove the temp dir on exit regardless of success or failure.
trap 'rm -rf "${BUILD_DIR}"' EXIT

pip3 install \
  -r "${BACKEND_DIR}/requirements.txt" \
  -t "${BUILD_DIR}" \
  --quiet \
  --upgrade

echo "▶ Copying application source..."
cp -r "${BACKEND_DIR}/src" "${BUILD_DIR}/"

# Ensure src is importable as a Python package on Lambda (Python 3.12 supports
# namespace packages without __init__.py, but being explicit avoids edge cases).
touch "${BUILD_DIR}/src/__init__.py"

echo "▶ Creating deployment zip..."
ARTIFACT_PATH="${BUILD_DIR}/${ARTIFACT_KEY}"
(
  cd "${BUILD_DIR}"
  # Remove bytecode before zipping — Lambda recompiles on first import.
  find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
  find . -name "*.pyc" -delete 2>/dev/null || true
  zip -r "${ARTIFACT_PATH}" . \
    --exclude "${ARTIFACT_KEY}" \
    -q
)
echo "   Package size: $(du -sh "${ARTIFACT_PATH}" | cut -f1)"

# ── 2. Ensure artifact bucket exists ──────────────────────────────────────────
echo ""
echo "▶ Ensuring artifact bucket: ${ARTIFACT_BUCKET}"
if ! aws s3api head-bucket --bucket "${ARTIFACT_BUCKET}" 2>/dev/null; then
  echo "   Creating bucket..."
  aws s3api create-bucket \
    --bucket "${ARTIFACT_BUCKET}" \
    --region "${AWS_REGION}" \
    --create-bucket-configuration "LocationConstraint=${AWS_REGION}"

  # Block all public access — deployment artifacts must not be public.
  aws s3api put-public-access-block \
    --bucket "${ARTIFACT_BUCKET}" \
    --public-access-block-configuration \
      "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

  # Enable versioning so every upload gets a unique version ID; CloudFormation
  # uses the version ID as a parameter to detect when code has changed.
  aws s3api put-bucket-versioning \
    --bucket "${ARTIFACT_BUCKET}" \
    --versioning-configuration "Status=Enabled"

  echo "   Bucket created with versioning enabled."
else
  echo "   Bucket already exists."
fi

# ── 3. Upload artifact and capture the new S3 version ID ─────────────────────
echo ""
echo "▶ Uploading deployment package..."
aws s3 cp "${ARTIFACT_PATH}" "s3://${ARTIFACT_BUCKET}/${ARTIFACT_KEY}" \
  --region "${AWS_REGION}"

ARTIFACT_VERSION=$(aws s3api head-object \
  --bucket "${ARTIFACT_BUCKET}" \
  --key "${ARTIFACT_KEY}" \
  --query VersionId \
  --output text)
echo "   S3 version  : ${ARTIFACT_VERSION}"

# ── 4. Deploy CloudFormation stack ────────────────────────────────────────────
echo ""
echo "▶ Deploying CloudFormation stack: ${STACK_NAME}..."
aws cloudformation deploy \
  --stack-name "${STACK_NAME}" \
  --template-file "${TEMPLATE_FILE}" \
  --parameter-overrides \
      "ArtifactBucket=${ARTIFACT_BUCKET}" \
      "ArtifactKey=${ARTIFACT_KEY}" \
      "ArtifactVersion=${ARTIFACT_VERSION}" \
  --capabilities CAPABILITY_NAMED_IAM \
  --region "${AWS_REGION}" \
  --no-fail-on-empty-changeset

# ── 5. Print outputs ──────────────────────────────────────────────────────────
API_URL=$(aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" \
  --region "${AWS_REGION}" \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
  --output text)

FUNCTION_NAME=$(aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" \
  --region "${AWS_REGION}" \
  --query "Stacks[0].Outputs[?OutputKey=='FunctionName'].OutputValue" \
  --output text)

echo ""
echo "✓ Deployment complete"
echo "  Function : ${FUNCTION_NAME}"
echo "  API URL  : ${API_URL}"
echo "  Docs     : ${API_URL}/docs"
echo "  Health   : ${API_URL}/"
echo ""
echo "  To update the mobile app, set:"
echo "    EXPO_PUBLIC_AGRIAI_API_URL=${API_URL}"
