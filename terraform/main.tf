terraform {
  required_version = ">= 1.9.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

variable "install_id" {
  type        = string
  description = "Nuon install ID"
}

variable "app_name" {
  type        = string
  description = "Application name"
}

variable "region" {
  type        = string
  description = "AWS region"
}

variable "environment" {
  type        = string
  default     = "production"
  description = "Deployment environment tag"
}

data "aws_caller_identity" "current" {}

resource "aws_ssm_parameter" "app_metadata" {
  name = "/nuon/${var.app_name}/${var.install_id}/metadata"
  type = "String"
  value = jsonencode({
    install_id = var.install_id
    app_name   = var.app_name
    region     = var.region
    account_id = data.aws_caller_identity.current.account_id
  })

  tags = {
    "nuon:install-id" = var.install_id
    "nuon:app"        = var.app_name
    "environment"     = var.environment
  }
}

resource "aws_s3_bucket" "test_bucket" {
  bucket = "nuon-kitchen-sink-${var.install_id}"

  tags = {
    "nuon:install-id" = var.install_id
    "nuon:app"        = var.app_name
  }
}

resource "aws_s3_object" "test_object" {
  bucket  = aws_s3_bucket.test_bucket.id
  key     = "test/${var.install_id}/canary.txt"
  content = "kitchen-sink failure mode test"

  tags = {
    "nuon:install-id" = var.install_id
    "nuon:app"        = var.app_name
  }
}

output "metadata_parameter_name" {
  value = aws_ssm_parameter.app_metadata.name
}

output "account_id" {
  value = data.aws_caller_identity.current.account_id
}
