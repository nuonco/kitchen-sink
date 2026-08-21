package main

import (
	"fmt"

	"github.com/pulumi/pulumi-aws/sdk/v6/go/aws/iam"
	"github.com/pulumi/pulumi-aws/sdk/v6/go/aws/s3"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi/config"
)

func main() {
	pulumi.Run(func(ctx *pulumi.Context) error {
		cfg := config.New(ctx, "conduit")
		installID := cfg.Require("install_id")
		// The sandbox's EKS OIDC provider, passed in via nuon.toml [config].
		// oidcProviderARN is the IAM OIDC provider ARN; oidcProvider is the
		// issuer in condition-key form (host/path, no scheme).
		oidcProviderARN := cfg.Require("oidc_provider_arn")
		oidcProvider := cfg.Require("oidc_provider")

		bucketName := fmt.Sprintf("conduit-%s", installID)

		// The destination bucket. Every pipeline run writes its objects here,
		// inside the install's own account — data never leaves it.
		bucket, err := s3.NewBucket(ctx, "destination-bucket", &s3.BucketArgs{
			Bucket: pulumi.String(bucketName),
			Tags: pulumi.StringMap{
				"install.nuon.co/id": pulumi.String(installID),
				"app":                pulumi.String("conduit"),
				"managed-by":         pulumi.String("pulumi"),
			},
		})
		if err != nil {
			return err
		}

		// Block all public access
		_, err = s3.NewBucketPublicAccessBlock(ctx, "destination-bucket-public-access-block", &s3.BucketPublicAccessBlockArgs{
			Bucket:                bucket.ID(),
			BlockPublicAcls:       pulumi.Bool(true),
			BlockPublicPolicy:     pulumi.Bool(true),
			IgnorePublicAcls:      pulumi.Bool(true),
			RestrictPublicBuckets: pulumi.Bool(true),
		})
		if err != nil {
			return err
		}

		// Enable versioning
		_, err = s3.NewBucketVersioningV2(ctx, "destination-bucket-versioning", &s3.BucketVersioningV2Args{
			Bucket: bucket.ID(),
			VersioningConfiguration: &s3.BucketVersioningV2VersioningConfigurationArgs{
				Status: pulumi.String("Enabled"),
			},
		})
		if err != nil {
			return err
		}

		// Enable server-side encryption (AWS-managed aws/s3 KMS key; its key
		// policy admits same-account principals via kms:ViaService, so the
		// sync role below needs no KMS statement of its own).
		_, err = s3.NewBucketServerSideEncryptionConfigurationV2(ctx, "destination-bucket-encryption", &s3.BucketServerSideEncryptionConfigurationV2Args{
			Bucket: bucket.ID(),
			Rules: s3.BucketServerSideEncryptionConfigurationV2RuleArray{
				&s3.BucketServerSideEncryptionConfigurationV2RuleArgs{
					ApplyServerSideEncryptionByDefault: &s3.BucketServerSideEncryptionConfigurationV2RuleApplyServerSideEncryptionByDefaultArgs{
						SseAlgorithm: pulumi.String("aws:kms"),
					},
					BucketKeyEnabled: pulumi.Bool(true),
				},
			},
		})
		if err != nil {
			return err
		}

		// IRSA role for the sync engine: only the conduit-worker ServiceAccount
		// in the conduit namespace can assume it, via the cluster's OIDC
		// provider. This is how pipeline writes reach the bucket without any
		// AWS credentials in the api/ui pods.
		trustPolicy := fmt.Sprintf(`{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {"Federated": %q},
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          %q: "system:serviceaccount:conduit:conduit-worker",
          %q: "sts.amazonaws.com"
        }
      }
    }
  ]
}`, oidcProviderARN, oidcProvider+":sub", oidcProvider+":aud")

		syncRole, err := iam.NewRole(ctx, "sync-role", &iam.RoleArgs{
			Name:             pulumi.String(fmt.Sprintf("conduit-sync-%s", installID)),
			AssumeRolePolicy: pulumi.String(trustPolicy),
			Tags: pulumi.StringMap{
				"install.nuon.co/id": pulumi.String(installID),
				"app":                pulumi.String("conduit"),
				"managed-by":         pulumi.String("pulumi"),
			},
		})
		if err != nil {
			return err
		}

		// Inline write policy, scoped to the destination bucket.
		syncPolicy := pulumi.Sprintf(`{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:AbortMultipartUpload", "s3:GetObject"],
      "Resource": "%s/*"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket", "s3:GetBucketLocation"],
      "Resource": "%s"
    }
  ]
}`, bucket.Arn, bucket.Arn)

		_, err = iam.NewRolePolicy(ctx, "sync-role-s3-write", &iam.RolePolicyArgs{
			Role:   syncRole.Name,
			Policy: syncPolicy,
		})
		if err != nil {
			return err
		}

		// Export outputs
		ctx.Export("bucket_name", bucket.Bucket)
		ctx.Export("bucket_arn", bucket.Arn)
		ctx.Export("bucket_region", bucket.Region)
		ctx.Export("sync_role_arn", syncRole.Arn)

		return nil
	})
}
