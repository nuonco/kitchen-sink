package main

import (
	"fmt"

	"github.com/pulumi/pulumi-aws/sdk/v6/go/aws/s3"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi/config"
)

func main() {
	pulumi.Run(func(ctx *pulumi.Context) error {
		cfg := config.New(ctx, "relay")
		installID := cfg.Require("install_id")

		bucketName := fmt.Sprintf("relay-%s", installID)

		// Private S3 bucket for archived delivery logs
		bucket, err := s3.NewBucket(ctx, "app-bucket", &s3.BucketArgs{
			Bucket: pulumi.String(bucketName),
			Tags: pulumi.StringMap{
				"install.nuon.co/id": pulumi.String(installID),
				"app":                pulumi.String("relay"),
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

		// Export outputs
		ctx.Export("bucket_name", bucket.Bucket)
		ctx.Export("bucket_arn", bucket.Arn)
		ctx.Export("bucket_region", bucket.Region)

		return nil
	})
}
