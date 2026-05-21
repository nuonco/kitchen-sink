# Sample Release Runbook

This runbook demonstrates a basic release procedure for the kitchen-sink app.

## Steps

1. **Sync API image** - Deploys the latest `img_api` container image.
2. **Deploy Terraform** - Applies the `terraform_tags` Terraform module.
3. **Run healthcheck** - Executes the `healthcheck` action to verify the deployment.
