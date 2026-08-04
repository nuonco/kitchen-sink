terraform {
  required_version = ">= 1.9.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    external = {
      source  = "hashicorp/external"
      version = "~> 2.3"
    }
  }
}

# WORKAROUND (temporary): Nuon's component terraform pipeline re-passes
# `-var-file` on the `apply-plan` step against the saved plan, which Terraform
# rejects ("Can't set variables when applying a saved plan"). Fix in flight:
# nuonco/nuon#2080. Until that ships to the runner, this module takes NO
# Terraform variables — every input is derived from a data source or a
# Nuon-injected env var (env vars are not `-var-file`, so they don't trip the
# saved-plan apply). Revert to plain `[vars]` once the runner fix is released.
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# install_id is injected via the component's [env_vars] as NUON_INSTALL_ID
# (a non-reserved, non-TF_* name, so it's allowed and isn't a var file). The
# external data source surfaces it into Terraform at plan time.
data "external" "nuon" {
  program = ["sh", "-c", "printf '{\"install_id\":\"%s\"}' \"$NUON_INSTALL_ID\""]
}

locals {
  install_id  = data.external.nuon.result.install_id
  app_name    = "kitchen-sink"
  region      = data.aws_region.current.name
  environment = "production"
}

resource "aws_ssm_parameter" "app_metadata" {
  name = "/nuon/${local.app_name}/${local.install_id}/metadata"
  type = "String"
  value = jsonencode({
    install_id = local.install_id
    app_name   = local.app_name
    region     = local.region
    account_id = data.aws_caller_identity.current.account_id
  })

  tags = {
    "nuon:install-id" = local.install_id
    "nuon:app"        = local.app_name
    "environment"     = local.environment
  }
}

resource "aws_s3_bucket" "test_bucket" {
  bucket = "nuon-kitchen-sink-${local.install_id}"

  tags = {
    "nuon:install-id" = local.install_id
    "nuon:app"        = local.app_name
  }
}

resource "aws_s3_object" "test_object" {
  bucket  = aws_s3_bucket.test_bucket.id
  key     = "test/${local.install_id}/canary.txt"
  content = "kitchen-sink failure mode test"

  tags = {
    "nuon:install-id" = local.install_id
    "nuon:app"        = local.app_name
  }
}

output "metadata_parameter_name" {
  value = aws_ssm_parameter.app_metadata.name
}

output "account_id" {
  value = data.aws_caller_identity.current.account_id
}
