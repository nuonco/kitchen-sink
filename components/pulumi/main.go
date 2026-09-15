package main

import (
	"fmt"

	"github.com/pulumi/pulumi-aws/sdk/v6/go/aws/s3"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi/config"
)

func main() {
	pulumi.Run(func(ctx *pulumi.Context) error {
		cfg := config.New(ctx, "kitchen-sink")
		installID := cfg.Require("install_id")

		bucketName := fmt.Sprintf("kitchen-sink-%s", installID)

		// Create a private S3 bucket for the app
		bucket, err := s3.NewBucket(ctx, "app-bucket", &s3.BucketArgs{
			Bucket: pulumi.String(bucketName),
			// The seeded demo object leaves versions behind; without this,
			// deprovision fails on BucketNotEmpty.
			ForceDestroy: pulumi.Bool(true),
			Tags: pulumi.StringMap{
				"install.nuon.co/id": pulumi.String(installID),
				"app":                pulumi.String("kitchen-sink"),
				"managed-by":         pulumi.String("pulumi"),
			},
		})
		if err != nil {
			return err
		}

		// Block all public access
		_, err = s3.NewBucketPublicAccessBlock(ctx, "app-bucket-public-access-block", &s3.BucketPublicAccessBlockArgs{
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
		_, err = s3.NewBucketVersioningV2(ctx, "app-bucket-versioning", &s3.BucketVersioningV2Args{
			Bucket: bucket.ID(),
			VersioningConfiguration: &s3.BucketVersioningV2VersioningConfigurationArgs{
				Status: pulumi.String("Enabled"),
			},
		})
		if err != nil {
			return err
		}

		// Enable server-side encryption
		_, err = s3.NewBucketServerSideEncryptionConfigurationV2(ctx, "app-bucket-encryption", &s3.BucketServerSideEncryptionConfigurationV2Args{
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

		// Seed an object so the break-glass read demo has something to pull
		demoObjectKey := "break-glass/demo.txt"
		_, err = s3.NewBucketObjectv2(ctx, "app-bucket-demo-object", &s3.BucketObjectv2Args{
			Bucket:      bucket.ID(),
			Key:         pulumi.String(demoObjectKey),
			Content:     pulumi.String("If you can read this, the break-glass role fetched it for you.\n"),
			ContentType: pulumi.String("text/plain"),
		})
		if err != nil {
			return err
		}

		// Deny object reads to everyone — the account admin included — except
		// the break-glass role (the demo gate) and the Nuon lifecycle roles
		// that manage this stack. Enabling break glass on the install is the
		// only way to read from this bucket.
		readGate := pulumi.Sprintf(`{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "DenyObjectReadExceptBreakGlass",
            "Effect": "Deny",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "%[1]s/*",
            "Condition": {
                "StringNotLike": {
                    "aws:PrincipalArn": [
                        "arn:aws:iam::*:role/%[2]s-app-break-glass",
                        "arn:aws:sts::*:assumed-role/%[2]s-app-break-glass/*",
                        "arn:aws:iam::*:role/%[2]s-provision",
                        "arn:aws:sts::*:assumed-role/%[2]s-provision/*",
                        "arn:aws:iam::*:role/%[2]s-maintenance",
                        "arn:aws:sts::*:assumed-role/%[2]s-maintenance/*",
                        "arn:aws:iam::*:role/%[2]s-deprovision",
                        "arn:aws:sts::*:assumed-role/%[2]s-deprovision/*",
                        "arn:aws:iam::*:role/%[2]s-setup",
                        "arn:aws:sts::*:assumed-role/%[2]s-setup/*"
                    ]
                }
            }
        }
    ]
}`, bucket.Arn, installID)
		_, err = s3.NewBucketPolicy(ctx, "app-bucket-read-gate", &s3.BucketPolicyArgs{
			Bucket: bucket.ID(),
			Policy: readGate,
		})
		if err != nil {
			return err
		}

		// Export outputs
		ctx.Export("bucket_name", bucket.Bucket)
		ctx.Export("bucket_arn", bucket.Arn)
		ctx.Export("bucket_region", bucket.Region)
		ctx.Export("demo_object_key", pulumi.String(demoObjectKey))

		return nil
	})
}
