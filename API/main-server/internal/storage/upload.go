package storage

import (
	"context"
	"fmt"
	"io"
	"log"
	"path/filepath"
	"time"

	"github.com/minio/minio-go/v7"
)

// UploadFile uploads a file to MinIO under the given object key.
// The objectKey should be a relative path like "avatars/12345_uuid.png".
func (c *Client) UploadFile(ctx context.Context, objectKey string, reader io.Reader, size int64, contentType string) error {
	_, err := c.client.PutObject(ctx, c.bucket, objectKey, reader, size, minio.PutObjectOptions{
		ContentType: contentType,
	})
	if err != nil {
		log.Printf("[STORAGE] Upload failed for %s: %v", objectKey, err)
		return fmt.Errorf("failed to upload file to MinIO: %w", err)
	}
	log.Printf("[STORAGE] Uploaded %s (%d bytes)", objectKey, size)
	return nil
}

// UploadFileFromPath uploads a file from the local filesystem to MinIO.
func (c *Client) UploadFileFromPath(ctx context.Context, objectKey, filePath string) error {
	info, err := c.client.FPutObject(ctx, c.bucket, objectKey, filePath, minio.PutObjectOptions{
		ContentType: filepath.Ext(filePath),
	})
	if err != nil {
		log.Printf("[STORAGE] Upload from path failed for %s: %v", objectKey, err)
		return fmt.Errorf("failed to upload file to MinIO: %w", err)
	}
	log.Printf("[STORAGE] Uploaded %s (%d bytes)", objectKey, info.Size)
	return nil
}

// PresignedURL generates a temporary presigned URL for downloading an object.
// The expiry duration controls how long the URL remains valid.
func (c *Client) PresignedURL(ctx context.Context, objectKey string, expiry time.Duration) (string, error) {
	url, err := c.client.PresignedGetObject(ctx, c.bucket, objectKey, expiry, nil)
	if err != nil {
		log.Printf("[STORAGE] Presigned URL failed for %s: %v", objectKey, err)
		return "", fmt.Errorf("failed to generate presigned URL: %w", err)
	}
	return url.String(), nil
}

// DeleteFile removes an object from MinIO.
func (c *Client) DeleteFile(ctx context.Context, objectKey string) error {
	err := c.client.RemoveObject(ctx, c.bucket, objectKey, minio.RemoveObjectOptions{})
	if err != nil {
		log.Printf("[STORAGE] Delete failed for %s: %v", objectKey, err)
		return fmt.Errorf("failed to delete file from MinIO: %w", err)
	}
	log.Printf("[STORAGE] Deleted %s", objectKey)
	return nil
}

// FileExists checks if an object exists in the bucket.
func (c *Client) FileExists(ctx context.Context, objectKey string) (bool, error) {
	_, err := c.client.StatObject(ctx, c.bucket, objectKey, minio.StatObjectOptions{})
	if err != nil {
		if minio.ToErrorResponse(err).Code == "NoSuchKey" {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

// ListObjects lists all objects under a given prefix.
func (c *Client) ListObjects(ctx context.Context, prefix string) ([]string, error) {
	var keys []string
	for object := range c.client.ListObjects(ctx, c.bucket, minio.ListObjectsOptions{
		Prefix: prefix,
	}) {
		if object.Err != nil {
			log.Printf("[STORAGE] List error for %s: %v", object.Key, object.Err)
			continue
		}
		keys = append(keys, object.Key)
	}
	return keys, nil
}
