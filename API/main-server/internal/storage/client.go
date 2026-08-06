package storage

import (
	"context"
	"log"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

// Client wraps the MinIO S3-compatible client.
type Client struct {
	client  *minio.Client
	bucket  string
	endpoint string
}

// NewClient creates a new MinIO client from environment configuration.
func NewClient(endpoint, accessKey, secretKey, bucket string, useSSL bool) (*Client, error) {
	mc, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
		Secure: useSSL,
	})
	if err != nil {
		return nil, err
	}

	ctx := context.Background()
	exists, err := mc.BucketExists(ctx, bucket)
	if err != nil {
		log.Printf("[STORAGE] Failed to check bucket %s: %v", bucket, err)
		return nil, err
	}
	if !exists {
		log.Printf("[STORAGE] Bucket %s does not exist, creating...", bucket)
		if err := mc.MakeBucket(ctx, bucket, minio.MakeBucketOptions{}); err != nil {
			log.Printf("[STORAGE] Failed to create bucket %s: %v", bucket, err)
			return nil, err
		}
		log.Printf("[STORAGE] Created bucket %s", bucket)
	}

	log.Printf("[STORAGE] Connected to MinIO at %s, bucket: %s", endpoint, bucket)
	return &Client{
		client:   mc,
		bucket:   bucket,
		endpoint: endpoint,
	}, nil
}

// Bucket returns the configured bucket name.
func (c *Client) Bucket() string {
	return c.bucket
}

// Endpoint returns the configured MinIO endpoint.
func (c *Client) Endpoint() string {
	return c.endpoint
}
