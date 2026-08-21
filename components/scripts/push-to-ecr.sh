#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<EOF
Usage: $0 [OPTIONS]

Push the Relay API image to a private ECR repository (repo: kitchen-sink-app).
Creates the ECR repository and Nuon pull access IAM role if they don't exist.

Options:
  --region REGION       AWS region (default: us-west-2)
  --profile PROFILE     AWS CLI profile to use
  --tag TAG             Image tag (default: latest)
  --repo-name NAME      ECR repository name (default: kitchen-sink-app)
  --role-name NAME      IAM role name for Nuon access (default: nuon-ecr-access)
  -h, --help            Show this help message
EOF
  exit 0
}

REGION="us-west-2"
PROFILE=""
TAG="latest"
REPO_NAME="kitchen-sink-app"
ROLE_NAME="nuon-ecr-access"

while [[ $# -gt 0 ]]; do
  case $1 in
    --region)   REGION="$2"; shift 2 ;;
    --profile)  PROFILE="$2"; shift 2 ;;
    --tag)      TAG="$2"; shift 2 ;;
    --repo-name) REPO_NAME="$2"; shift 2 ;;
    --role-name) ROLE_NAME="$2"; shift 2 ;;
    -h|--help)  usage ;;
    *)          echo "Unknown option: $1"; usage ;;
  esac
done

AWS_OPTS=("--region" "$REGION")
if [[ -n "$PROFILE" ]]; then
  AWS_OPTS+=("--profile" "$PROFILE")
fi

ACCOUNT_ID=$(aws sts get-caller-identity "${AWS_OPTS[@]}" --query Account --output text)
REGISTRY="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"
FULL_REPO="${REGISTRY}/${REPO_NAME}"

echo "Account: ${ACCOUNT_ID}"
echo "Region:  ${REGION}"
echo "Repo:    ${FULL_REPO}"

# --- Ensure ECR repository exists ---
if aws ecr describe-repositories "${AWS_OPTS[@]}" --repository-names "$REPO_NAME" > /dev/null 2>&1; then
  echo "ECR repository '${REPO_NAME}' already exists."
else
  echo "Creating ECR repository '${REPO_NAME}'..."
  aws ecr create-repository "${AWS_OPTS[@]}" \
    --repository-name "$REPO_NAME" \
    --image-scanning-configuration scanOnPush=true \
    --encryption-configuration encryptionType=AES256
  echo "Created ECR repository '${REPO_NAME}'."
fi

REPO_ARN=$(aws ecr describe-repositories "${AWS_OPTS[@]}" \
  --repository-names "$REPO_NAME" \
  --query 'repositories[0].repositoryArn' --output text)

# --- Ensure Nuon ECR access IAM role exists ---
# Nuon production account that needs to pull images
NUON_ACCOUNT_ID="814326426574"

if aws iam get-role "${AWS_OPTS[@]}" --role-name "$ROLE_NAME" > /dev/null 2>&1; then
  echo "IAM role '${ROLE_NAME}' already exists."
else
  echo "Creating IAM role '${ROLE_NAME}' for Nuon ECR pull access..."

  # Trust policy: allow Nuon production account to assume this role
  TRUST_POLICY=$(cat <<TRUST
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::${NUON_ACCOUNT_ID}:root"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
TRUST
)

  aws iam create-role "${AWS_OPTS[@]}" \
    --role-name "$ROLE_NAME" \
    --assume-role-policy-document "$TRUST_POLICY" \
    --description "Grants Nuon read-only access to pull container images from ECR"

  echo "Created IAM role '${ROLE_NAME}'."
fi

# Ensure the ECR pull policy is attached
POLICY_NAME="${ROLE_NAME}-ecr-pull"
POLICY_ARN="arn:aws:iam::${ACCOUNT_ID}:policy/${POLICY_NAME}"

ECR_POLICY=$(cat <<POLICY
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ecr:BatchGetImage",
        "ecr:ListImages",
        "ecr:ListTagsForResource",
        "ecr:GetDownloadUrlForLayer",
        "ecr:DescribeImageReplicationStatus",
        "ecr:DescribeImageScanFindings",
        "ecr:DescribeImages",
        "ecr:DescribePullThroughCacheRules",
        "ecr:DescribeRegistry",
        "ecr:DescribeRepositories"
      ],
      "Resource": "${REPO_ARN}"
    }
  ]
}
POLICY
)

if aws iam get-policy "${AWS_OPTS[@]}" --policy-arn "$POLICY_ARN" > /dev/null 2>&1; then
  echo "IAM policy '${POLICY_NAME}' already exists, updating..."
  # Create a new policy version and set it as default
  aws iam create-policy-version "${AWS_OPTS[@]}" \
    --policy-arn "$POLICY_ARN" \
    --policy-document "$ECR_POLICY" \
    --set-as-default
else
  echo "Creating IAM policy '${POLICY_NAME}'..."
  aws iam create-policy "${AWS_OPTS[@]}" \
    --policy-name "$POLICY_NAME" \
    --policy-document "$ECR_POLICY" \
    --description "ECR read-only access for Nuon to pull kitchen-sink-app images"
fi

# Attach the policy to the role
aws iam attach-role-policy "${AWS_OPTS[@]}" \
  --role-name "$ROLE_NAME" \
  --policy-arn "$POLICY_ARN" 2>/dev/null || true

ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"
echo ""
echo "Nuon ECR access role ARN: ${ROLE_ARN}"
echo "Use this in your component config:"
echo ""
echo "  [aws_ecr]"
echo "  image_url    = \"${FULL_REPO}\""
echo "  tag          = \"${TAG}\""
echo "  region       = \"${REGION}\""
echo "  iam_role_arn = \"${ROLE_ARN}\""
echo ""

# --- Authenticate and push ---
echo "Authenticating to ECR..."
aws ecr get-login-password "${AWS_OPTS[@]}" | \
  docker login --username AWS --password-stdin "$REGISTRY"

echo "Tagging and pushing image..."
docker tag "kitchen-sink-api:${TAG}" "${FULL_REPO}:${TAG}"
docker push "${FULL_REPO}:${TAG}"

echo ""
echo "Pushed ${FULL_REPO}:${TAG}"
