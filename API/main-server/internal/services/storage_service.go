package services

import (
	"context"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"vaultke-backend/internal/storage"
)

// StorageService wraps the MinIO client for file operations.
type StorageService struct {
	client   *storage.Client
	bucket   string
	endpoint string
}

// NewStorageService creates a new StorageService from a MinIO client.
func NewStorageService(client *storage.Client) *StorageService {
	return &StorageService{
		client:   client,
		bucket:   client.Bucket(),
		endpoint: client.Endpoint(),
	}
}

// UploadAvatar uploads an avatar file to MinIO and returns the object key.
// The object key format is: avatars/{timestamp}_{userID}{ext}
func (s *StorageService) UploadAvatar(file multipart.File, userID, ext string) (string, error) {
	objectKey := fmt.Sprintf("avatars/%d_%s%s", time.Now().Unix(), userID, ext)

	// Read file content to determine size
	content, err := io.ReadAll(file)
	if err != nil {
		return "", fmt.Errorf("failed to read avatar file: %w", err)
	}

	contentType := "image/png"
	if strings.ToLower(ext) == ".jpg" || strings.ToLower(ext) == ".jpeg" {
		contentType = "image/jpeg"
	}

	err = s.client.UploadFile(context.Background(), objectKey, strings.NewReader(string(content)), int64(len(content)), contentType)
	if err != nil {
		return "", err
	}

	return objectKey, nil
}

// UploadFile uploads any file to MinIO under the given prefix.
// The object key format is: {prefix}/{timestamp}_{originalName}
func (s *StorageService) UploadFile(file multipart.File, originalName, prefix string) (string, error) {
	ext := strings.ToLower(filepath.Ext(originalName))
	objectKey := fmt.Sprintf("%s/%d_%s%s", prefix, time.Now().Unix(), originalName, ext)

	content, err := io.ReadAll(file)
	if err != nil {
		return "", fmt.Errorf("failed to read file: %w", err)
	}

	contentType := http.DetectContentType(content)
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	err = s.client.UploadFile(context.Background(), objectKey, strings.NewReader(string(content)), int64(len(content)), contentType)
	if err != nil {
		return "", err
	}

	return objectKey, nil
}

// UploadObject uploads raw bytes to MinIO with a specific object key.
func (s *StorageService) UploadObject(ctx context.Context, objectKey string, reader io.Reader, size int64, contentType string) error {
	return s.client.UploadFile(ctx, objectKey, reader, size, contentType)
}

// DeleteAvatar removes an avatar file from MinIO.
// The objectKey is the full path relative to the bucket (e.g., "avatars/12345_uuid.png").
func (s *StorageService) DeleteAvatar(objectKey string) error {
	if objectKey == "" {
		return nil
	}
	return s.client.DeleteFile(context.Background(), objectKey)
}

// AvatarURL returns the full URL for an avatar object key.
// For MinIO, this returns the S3-style URL that can be used for presigned access.
func (s *StorageService) AvatarURL(objectKey string) string {
	return "/uploads/avatars/" + filepath.Base(objectKey)
}

// EnsureAvatarBucket ensures the avatar directory structure exists in MinIO.
// MinIO doesn't require explicit directory creation, but this logs the intent.
func (s *StorageService) EnsureAvatarBucket() error {
	log.Printf("[STORAGE] Avatar storage ready in bucket %s at %s", s.bucket, s.endpoint)
	return nil
}

// ServeAvatar handles serving an avatar file from MinIO or falling back to local storage.
// This is used as a Gin handler for the /uploads/avatars/:filename route.
func (s *StorageService) ServeAvatar(c *gin.Context) {
	filename := c.Param("filename")
	s.serveAvatarByFilename(c, filename)
}

// ServeAvatarByFilename serves an avatar by explicit filename, independent of Gin param names.
func (s *StorageService) ServeAvatarByFilename(c *gin.Context, filename string) {
	s.serveAvatarByFilename(c, filename)
}

func (s *StorageService) serveAvatarByFilename(c *gin.Context, filename string) {
	objectKey := "avatars/" + filename

	ctx := c.Request.Context()

	// Check if the file exists in MinIO
	exists, err := s.client.FileExists(ctx, objectKey)
	if err != nil {
		log.Printf("[STORAGE] Error checking file %s: %v", objectKey, err)
		c.Status(http.StatusInternalServerError)
		return
	}

	if exists {
		// Generate a presigned URL for temporary access
		url, err := s.client.PresignedURL(ctx, objectKey, 15*time.Minute)
		if err != nil {
			log.Printf("[STORAGE] Failed to generate presigned URL for %s: %v", objectKey, err)
			c.Status(http.StatusInternalServerError)
			return
		}
		c.Redirect(http.StatusFound, url)
		return
	}

	// Fallback: try local filesystem
	localPath := filepath.Join("uploads", "avatars", filename)
	if _, err := os.Stat(localPath); err == nil {
		c.File(localPath)
		return
	}

	// Fallback: serve default avatar
	defaultPath := filepath.Join("uploads", "avatars", "default-avatar.png")
	if _, err := os.Stat(defaultPath); err == nil {
		c.File(defaultPath)
		return
	}

	c.Status(http.StatusNotFound)
}
