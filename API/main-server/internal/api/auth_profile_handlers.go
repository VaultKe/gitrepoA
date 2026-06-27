package api

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"vaultke-backend/internal/models"
	"vaultke-backend/internal/services"
)

// GetProfile handles getting user profile
func (h *AuthHandlers) GetProfile(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, AuthResponse{
			Success: false,
			Error:   "User not authenticated",
		})
		return
	}

	user, err := h.userService.GetUserByID(userID)
	if err != nil {
		c.JSON(http.StatusOK, AuthResponse{
			Success: true,
			Message: "Profile retrieved successfully",
			Data: &AuthData{
				User: &models.User{
					ID:              userID,
					Email:           "unknown@example.com",
					FirstName:       "Unknown",
					LastName:        "User",
					Role:            models.UserRoleUser,
					Status:          models.UserStatusActive,
					IsEmailVerified: false,
					IsPhoneVerified: false,
					Rating:          0.0,
					TotalRatings:    0,
					CreatedAt:       time.Now(),
					UpdatedAt:       time.Now(),
				},
			},
		})
		return
	}

	c.JSON(http.StatusOK, AuthResponse{
		Success: true,
		Message: "Profile retrieved successfully",
		Data: &AuthData{
			User: user,
		},
	})
}

// GetUserByID handles getting a user profile by ID (for loan enrichment)
func (h *AuthHandlers) GetUserByID(c *gin.Context) {
	userID := c.Param("id")
	if userID == "" {
		c.JSON(http.StatusBadRequest, AuthResponse{
			Success: false,
			Error:   "User ID is required",
		})
		return
	}

	user, err := h.userService.GetUserByID(userID)
	if err != nil {
		c.JSON(http.StatusOK, AuthResponse{
			Success: true,
			Message: "Profile retrieved successfully",
			Data: &AuthData{
				User: &models.User{
					ID:              userID,
					Email:           "unknown@example.com",
					FirstName:       "Unknown",
					LastName:        "User",
					Role:            models.UserRoleUser,
					Status:          models.UserStatusActive,
					IsEmailVerified: false,
					IsPhoneVerified: false,
					Rating:          0.0,
					TotalRatings:    0,
					CreatedAt:       time.Now(),
					UpdatedAt:       time.Now(),
				},
			},
		})
		return
	}

	c.JSON(http.StatusOK, AuthResponse{
		Success: true,
		Message: "Profile retrieved successfully",
		Data: &AuthData{
			User: user,
		},
	})
}

// UpdateProfile handles updating user profile (supports both JSON and multipart form data)
func (h *AuthHandlers) UpdateProfile(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, AuthResponse{
			Success: false,
			Error:   "User not authenticated",
		})
		return
	}

	contentType := c.GetHeader("Content-Type")
	var req models.UserProfileUpdate
	var err error

	if strings.Contains(contentType, "multipart/form-data") {
		err = h.handleMultipartProfileUpdate(c, &req, userID)
	} else {
		err = c.ShouldBindJSON(&req)
	}

	if err != nil {
		c.JSON(http.StatusBadRequest, AuthResponse{
			Success: false,
			Error:   "Invalid request data: " + err.Error(),
		})
		return
	}

	user, err := h.userService.UpdateUser(userID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, AuthResponse{
			Success: false,
			Error:   "Failed to update profile: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, AuthResponse{
		Success: true,
		Message: "Profile updated successfully",
		Data: &AuthData{
			User: user,
		},
	})
}

// handleMultipartProfileUpdate processes multipart form data for profile updates
func (h *AuthHandlers) handleMultipartProfileUpdate(c *gin.Context, req *models.UserProfileUpdate, userID string) error {
	err := c.Request.ParseMultipartForm(10 << 20)
	if err != nil {
		return err
	}

	form := c.Request.MultipartForm

	if values, ok := form.Value["firstName"]; ok && len(values) > 0 && values[0] != "" {
		req.FirstName = &values[0]
	}
	if values, ok := form.Value["lastName"]; ok && len(values) > 0 && values[0] != "" {
		req.LastName = &values[0]
	}
	if values, ok := form.Value["phone"]; ok && len(values) > 0 && values[0] != "" {
		req.Phone = &values[0]
	}
	if values, ok := form.Value["county"]; ok && len(values) > 0 && values[0] != "" {
		req.County = &values[0]
	}
	if values, ok := form.Value["town"]; ok && len(values) > 0 && values[0] != "" {
		req.Town = &values[0]
	}
	if values, ok := form.Value["bio"]; ok && len(values) > 0 && values[0] != "" {
		req.Bio = &values[0]
	}
	if values, ok := form.Value["occupation"]; ok && len(values) > 0 && values[0] != "" {
		req.Occupation = &values[0]
	}
	if values, ok := form.Value["language"]; ok && len(values) > 0 && values[0] != "" {
		req.Language = &values[0]
	}
	if values, ok := form.Value["theme"]; ok && len(values) > 0 && values[0] != "" {
		req.Theme = &values[0]
	}
	if values, ok := form.Value["businessType"]; ok && len(values) > 0 && values[0] != "" {
		req.BusinessType = &values[0]
	}
	if values, ok := form.Value["businessDescription"]; ok && len(values) > 0 && values[0] != "" {
		req.BusinessDescription = &values[0]
	}

	if values, ok := form.Value["latitude"]; ok && len(values) > 0 && values[0] != "" {
		if lat, err := strconv.ParseFloat(values[0], 64); err == nil {
			req.Latitude = &lat
		}
	}
	if values, ok := form.Value["longitude"]; ok && len(values) > 0 && values[0] != "" {
		if lng, err := strconv.ParseFloat(values[0], 64); err == nil {
			req.Longitude = &lng
		}
	}

	if values, ok := form.Value["dateOfBirth"]; ok && len(values) > 0 && values[0] != "" {
		if dateOfBirth, err := time.Parse("2006-01-02", values[0]); err == nil {
			flexDate := &models.FlexibleDate{Time: dateOfBirth}
			req.DateOfBirth = flexDate
		}
	}

	if files, ok := form.File["profile_image"]; ok && len(files) > 0 {
		file := files[0]

		allowedTypes := map[string]bool{
			"image/jpeg": true,
			"image/jpg":  true,
			"image/png":  true,
		}

		if !allowedTypes[file.Header.Get("Content-Type")] {
			return fmt.Errorf("invalid file type. Only JPEG and PNG images are allowed")
		}

		if file.Size > 5*1024*1024 {
			return fmt.Errorf("file too large. Maximum size is 5MB")
		}

		ext := strings.ToLower(filepath.Ext(file.Filename))
		allowedExtensions := map[string]bool{".jpg": true, ".jpeg": true, ".png": true}
		if !allowedExtensions[ext] {
			return fmt.Errorf("invalid file extension. Only .jpg and .png are allowed")
		}

		uploadDir := "./uploads/avatars"
		if err := os.MkdirAll(uploadDir, 0o755); err != nil {
			return fmt.Errorf("failed to create upload directory: %w", err)
		}

		filename := fmt.Sprintf("%d_%s%s", time.Now().Unix(), userID, ext)
		dstPath := filepath.Join(uploadDir, filename)

		src, err := file.Open()
		if err != nil {
			return fmt.Errorf("failed to open uploaded file: %w", err)
		}
		defer src.Close()

		tmpFile, err := os.CreateTemp("", "profile_upload_*"+ext)
		if err != nil {
			return fmt.Errorf("failed to create temp file: %w", err)
		}
		tmpFilePath := tmpFile.Name()

		if _, err := io.Copy(tmpFile, src); err != nil {
			os.Remove(tmpFilePath)
			return fmt.Errorf("failed to copy file for scanning: %w", err)
		}
		tmpFile.Close()

		scanResult := services.ScanFileWithClamAV(tmpFilePath)
		if services.IsClamAVAvailable() {
			if scanResult.ScanError != nil {
				os.Remove(tmpFilePath)
				return fmt.Errorf("virus scan failed: %w", scanResult.ScanError)
			}
			if scanResult.Infected || !scanResult.IsClean {
				os.Remove(tmpFilePath)
				reason := "malware detected"
				if scanResult.ScanError != nil {
					reason = scanResult.ScanError.Error()
				}
				return fmt.Errorf("file rejected by security policy: %s", reason)
			}
		} else {
			log.Printf("⚠️ ClamAV not installed; skipping scan for %s", tmpFilePath)
		}

		if err := os.Rename(tmpFilePath, dstPath); err != nil {
			os.Remove(tmpFilePath)
			return fmt.Errorf("failed to move file to storage: %w", err)
		}

		avatarURL := "/uploads/avatars/" + filename
		req.Avatar = &avatarURL
	}

	return nil
}
