package main

import (
	"fmt"
	"os"

	"github.com/pulumi/pulumi-gcp/sdk/v8/go/gcp/storage"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi/config"
)

func main() {
	pulumi.Run(func(ctx *pulumi.Context) error {
		installID := os.Getenv("INSTALL_ID")
		region := config.New(ctx, "gcp").Require("region")

		bucket, err := storage.NewBucket(ctx, "nuon-bucket", &storage.BucketArgs{
			Name:                     pulumi.Sprintf("nuon-kitchen-sink-%s", installID),
			Location:                 pulumi.String(region),
			ForceDestroy:             pulumi.Bool(true),
			PublicAccessPrevention:   pulumi.String("enforced"),
			UniformBucketLevelAccess: pulumi.Bool(true),
			Versioning: &storage.BucketVersioningArgs{
				Enabled: pulumi.Bool(true),
			},
			Labels: pulumi.StringMap{
				"managed-by": pulumi.String("nuon"),
				"install-id": pulumi.String(installID),
			},
		})
		if err != nil {
			return fmt.Errorf("error creating bucket: %w", err)
		}

		ctx.Export("bucket_name", bucket.Name)
		ctx.Export("bucket_url", bucket.Url)

		return nil
	})
}
