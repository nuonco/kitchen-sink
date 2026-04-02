#!/usr/bin/env bash
set -euo pipefail

ACCOUNT_ID="${AWS_ACCOUNT_ID:-431927561584}"
REGION="${AWS_REGION:-us-west-2}"
REPO="kitchen-sink/api"
TAG="${IMAGE_TAG:-latest}"
ROLE_ARN="${IAM_ROLE_ARN:-arn:aws:iam::${ACCOUNT_ID}:role/nuon-ecr-access}"

echo "Assuming IAM role: ${ROLE_ARN}"
CREDS=$(aws sts assume-role --role-arn "$ROLE_ARN" --role-session-name "ecr-push" --output json)
export AWS_ACCESS_KEY_ID=$(echo "$CREDS" | jq -r '.Credentials.AccessKeyId')
export AWS_SECRET_ACCESS_KEY=$(echo "$CREDS" | jq -r '.Credentials.SecretAccessKey')
export AWS_SESSION_TOKEN=$(echo "$CREDS" | jq -r '.Credentials.SessionToken')

echo "Authenticating to ECR: ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"
aws ecr get-login-password --region "$REGION" | \
  docker login --username AWS --password-stdin "${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

echo "Tagging and pushing image..."
docker tag "kitchen-sink-api:${TAG}" "${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${REPO}:${TAG}"
docker push "${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${REPO}:${TAG}"

echo "Pushed ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${REPO}:${TAG}"
