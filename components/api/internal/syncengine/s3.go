package syncengine

import (
	"bytes"
	"context"
	"fmt"
	"os"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// uploader writes CSV objects into the install's destination bucket. The
// client comes from the SDK's default chain, which is what makes IRSA work:
// the worker pod's service account (conduit-worker) carries the
// eks.amazonaws.com/role-arn annotation, the SDK finds the projected web
// identity token, and no credential is ever configured by hand. Region comes
// from AWS_REGION the same way.
type uploader struct {
	client *s3.Client
	bucket string

	// initErr is carried instead of returned so that a broken AWS setup does
	// not kill the worker: every export fails with this error and the failure
	// is recorded as a failed run, debuggable through the run history.
	initErr error
}

// newUploaderFromEnv builds the uploader. Bucket comes from S3_BUCKET, which
// the chart interpolates from the destination_bucket component's outputs.
func newUploaderFromEnv(ctx context.Context) *uploader {
	up := &uploader{bucket: os.Getenv("S3_BUCKET")}
	cfg, err := awsconfig.LoadDefaultConfig(ctx)
	if err != nil {
		up.initErr = fmt.Errorf("unable to load AWS configuration: %w", err)
		return up
	}
	up.client = s3.NewFromConfig(cfg)
	return up
}

// put writes one object. Errors (missing bucket, denied PutObject, ...) go
// back to the caller so the run records them.
func (u *uploader) put(ctx context.Context, key string, body []byte) error {
	if u.initErr != nil {
		return u.initErr
	}
	if u.bucket == "" {
		return fmt.Errorf("S3_BUCKET is not set: the destination bucket name did not reach this pod")
	}
	_, err := u.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(u.bucket),
		Key:         aws.String(key),
		Body:        bytes.NewReader(body),
		ContentType: aws.String("text/csv"),
	})
	if err != nil {
		return fmt.Errorf("unable to write s3://%s/%s: %w", u.bucket, key, err)
	}
	return nil
}
