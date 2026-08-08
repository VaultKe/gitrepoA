package api

import (
	"database/sql"
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
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"vaultke-backend/internal/services"
	"vaultke-backend/internal/utils"
)

func UpdateProfile(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	var request struct {
		FirstName    string `json:"firstName"`
		LastName     string `json:"lastName"`
		Phone        string `json:"phone"`
		County       string `json:"county"`
		Town         string `json:"town"`
		Bio          string `json:"bio"`
		Occupation   string `json:"occupation"`
		DateOfBirth  string `json:"dateOfBirth"`
		Gender       string `json:"gender"`
		ProfileImage string `json:"profile_image"`
		Avatar       string `json:"avatar"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request body",
		})
		return
	}

	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}

	setParts := []string{}
	args := []interface{}{}

	if request.FirstName != "" {
		setParts = append(setParts, "first_name = $1")
		args = append(args, request.FirstName)
	}
	if request.LastName != "" {
		setParts = append(setParts, "last_name = $2")
		args = append(args, request.LastName)
	}
	if request.Phone != "" {
		setParts = append(setParts, "phone = $3")
		args = append(args, utils.FormatPhoneNumber(request.Phone))
	}
	if request.County != "" {
		setParts = append(setParts, "county = $4")
		args = append(args, request.County)
	}
	if request.Town != "" {
		setParts = append(setParts, "town = $5")
		args = append(args, request.Town)
	}
	if request.Bio != "" {
		setParts = append(setParts, "bio = $6")
		args = append(args, request.Bio)
	}
	if request.Occupation != "" {
		setParts = append(setParts, "occupation = $7")
		args = append(args, request.Occupation)
	}
	if request.DateOfBirth != "" {
		setParts = append(setParts, "date_of_birth = $8")
		args = append(args, request.DateOfBirth)
	}
	if request.Gender != "" {
		setParts = append(setParts, "gender = $9")
		args = append(args, request.Gender)
	}
	if request.ProfileImage != "" || request.Avatar != "" {
		avatarValue := request.ProfileImage
		if avatarValue == "" {
			avatarValue = request.Avatar
		}
		setParts = append(setParts, "avatar = $10")
		args = append(args, avatarValue)
	}

	if len(setParts) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "No fields to update",
		})
		return
	}

	setParts = append(setParts, "updated_at = CURRENT_TIMESTAMP")
	args = append(args, userID)

	query := "UPDATE users SET " + strings.Join(setParts, ", ") + " WHERE id = $1"

	result, err := db.(*sql.DB).Exec(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to update profile",
		})
		return
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil || rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "User not found",
		})
		return
	}

	GetProfile(c)
}

// UploadAvatar uploads an avatar to MinIO storage.
func (h *AuthHandlers) UploadAvatar(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	contentType := c.GetHeader("Content-Type")
	if !strings.Contains(contentType, "multipart/form-data") {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Content-Type must be multipart/form-data",
		})
		return
	}

	if err := c.Request.ParseMultipartForm(10 << 20); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Failed to parse multipart form: " + err.Error(),
		})
		return
	}

	form := c.Request.MultipartForm
	var fileHeader *multipart.FileHeader
	for _, headers := range form.File {
		if len(headers) > 0 {
			fileHeader = headers[0]
			break
		}
	}

	if fileHeader == nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "No file uploaded",
		})
		return
	}

	allowedTypes := map[string]bool{
		"image/jpeg": true,
		"image/jpg":  true,
		"image/png":  true,
	}

	fileType := fileHeader.Header.Get("Content-Type")
	if !allowedTypes[fileType] {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid file type. Only JPEG and PNG images are allowed",
		})
		return
	}

	if fileHeader.Size > 5*1024*1024 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "File too large. Maximum size is 5MB",
		})
		return
	}

	ext := strings.ToLower(filepath.Ext(fileHeader.Filename))
	allowedExtensions := map[string]bool{".jpg": true, ".jpeg": true, ".png": true}
	if !allowedExtensions[ext] {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid file extension. Only .jpg and .png are allowed",
		})
		return
	}

	// Delete old avatar file if it exists
	if h.storage != nil {
		if err := h.storage.DeleteAvatar("avatars/" + userID + ext); err != nil {
			log.Printf("[WARN] Failed to delete old avatar for user %s: %v", userID, err)
		}
	}

	// Open and scan the file
	src, err := fileHeader.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to open uploaded file",
		})
		return
	}
	defer src.Close()

	tmpFile, err := os.CreateTemp("", "avatar_upload_*"+ext)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create temp file",
		})
		return
	}
	tmpFilePath := tmpFile.Name()

	if _, err := io.Copy(tmpFile, src); err != nil {
		os.Remove(tmpFilePath)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to save uploaded file",
		})
		return
	}
	tmpFile.Close()

	scanResult := services.ScanFileWithClamAV(tmpFilePath)
	if services.IsClamAVAvailable() {
		if scanResult.ScanError != nil {
			os.Remove(tmpFilePath)
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Virus scan failed: " + scanResult.ScanError.Error(),
			})
			return
		}
		if scanResult.Infected || !scanResult.IsClean {
			os.Remove(tmpFilePath)
			c.JSON(http.StatusForbidden, gin.H{
				"success": false,
				"error":   "File rejected by security policy: malware detected",
			})
			return
		}
	} else {
		log.Printf("⚠️ ClamAV not installed; skipping scan for %s", tmpFilePath)
	}

	// Upload to MinIO
	objectKey := fmt.Sprintf("avatars/%d_%s%s", time.Now().Unix(), userID, ext)
	file, err := os.Open(tmpFilePath)
	if err != nil {
		os.Remove(tmpFilePath)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to open temp file for upload",
		})
		return
	}
	defer file.Close()

	fileInfo, _ := file.Stat()
	if h.storage != nil {
		err = h.storage.UploadObject(c.Request.Context(), objectKey, file, fileInfo.Size(), fileType)
	} else {
		// Fallback to local storage if MinIO is not configured
		log.Printf("[STORAGE][WARN] MinIO not connected; avatar %s saved to local disk instead of object storage", objectKey)
		uploadDir := filepath.Join(h.uploadPath, "avatars")
		os.MkdirAll(uploadDir, 0o755)
		dstPath := filepath.Join(uploadDir, filepath.Base(objectKey))
		err = copyFile(tmpFilePath, dstPath)
	}
	os.Remove(tmpFilePath)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to upload avatar: " + err.Error(),
		})
		return
	}

	avatarURL := "/uploads/avatars/" + filepath.Base(objectKey)

	var db interface{}
	if val, exists := c.Get("db"); exists {
		db = val
	}

	if db == nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}

	database, ok := db.(*sql.DB)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Invalid database connection",
		})
		return
	}

	_, err = database.Exec(
		"UPDATE users SET avatar = $1, updated_at = NOW() WHERE id = $2",
		avatarURL, userID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to update avatar in database: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Avatar uploaded successfully",
		"data": map[string]interface{}{
			"user": map[string]interface{}{
				"id":     userID,
				"avatar": avatarURL,
			},
		},
	})
		c.Abort()
}

func OnboardUser(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	var req struct {
		FirstName string  `json:"firstName" validate:"required,min=2,max=50,alpha,no_sql_injection,no_xss"`
		LastName  string  `json:"lastName" validate:"required,min=2,max=50,alpha,no_sql_injection,no_xss"`
		Email     *string `json:"email,omitempty" validate:"omitempty,email,max=100,no_sql_injection,no_xss"`
		Phone     string  `json:"phone" validate:"required,phone,no_sql_injection,no_xss"`
		IDNumber  string  `json:"idNumber" validate:"required,numeric,min=6,max=9,no_sql_injection,no_xss"`
		Gender    *string `json:"gender,omitempty" validate:"omitempty,oneof=male female other prefer_not_to_say"`
		Password  *string `json:"password,omitempty"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request data: " + err.Error(),
		})
		return
	}

	if err := utils.ValidateStruct(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Validation error: " + err.Error(),
		})
		return
	}

	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}
	database := db.(*sql.DB)

	var emailStr sql.NullString
	if req.Email != nil && *req.Email != "" {
		emailStr = sql.NullString{String: *req.Email, Valid: true}
	}

	var genderStr sql.NullString
	if req.Gender != nil && *req.Gender != "" {
		genderStr = sql.NullString{String: *req.Gender, Valid: true}
	}

	if !emailStr.Valid {
		emailStr = sql.NullString{
			String: uuid.New().String() + "@noemail.local",
			Valid:  true,
		}
	}

	if emailStr.Valid {
		var existingEmail string
		err := database.QueryRow("SELECT id FROM users WHERE email = $1", emailStr.String).Scan(&existingEmail)
		if err == nil {
			c.JSON(http.StatusConflict, gin.H{
				"success": false,
				"error":   "Email already exists",
			})
			return
		}
	}

	var existingPhone string
	formattedPhone := utils.FormatPhoneNumber(req.Phone)
	err := database.QueryRow("SELECT id FROM users WHERE phone = $1", formattedPhone).Scan(&existingPhone)
	if err == nil {
		c.JSON(http.StatusConflict, gin.H{
			"success": false,
			"error":   "Phone number already exists",
		})
		return
	}

	var existingID string
	err = database.QueryRow("SELECT id FROM users WHERE id_number = $1", req.IDNumber).Scan(&existingID)
	if err == nil {
		c.JSON(http.StatusConflict, gin.H{
			"success": false,
			"error":   "National ID already exists",
		})
		return
	}

	var passwordHash string
	if req.Password != nil && *req.Password != "" {
		hashedPassword, err := hashPassword(*req.Password)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to process password",
			})
			return
		}
		passwordHash = hashedPassword
	} else {
		randomPassword := generateRandomPassword()
		hashedPassword, err := hashPassword(randomPassword)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to process password",
			})
			return
		}
		passwordHash = hashedPassword
	}

	query := `
		INSERT INTO users (id, email, phone, first_name, last_name, password_hash, id_number, gender, role, status, is_email_verified, is_phone_verified, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'user', 'pending', false, false, NOW(), NOW())
		RETURNING id, email, phone, first_name, last_name, created_at
	`

	newUserID := uuid.New().String()

	var newUser struct {
		ID        string
		Email     sql.NullString
		Phone     string
		FirstName string
		LastName  string
		CreatedAt string
	}

	err = database.QueryRow(query, newUserID, emailStr, formattedPhone, req.FirstName, req.LastName, passwordHash, req.IDNumber, genderStr).Scan(
		&newUser.ID, &newUser.Email, &newUser.Phone, &newUser.FirstName, &newUser.LastName, &newUser.CreatedAt,
	)

	if err != nil {
		log.Printf("Failed to create onboarded user: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create user account: " + err.Error(),
		})
		return
	}

	log.Printf("✅ Onboarded new user: %s %s (ID: %s)", req.FirstName, req.LastName, newUser.ID)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "User onboarded successfully",
		"data": gin.H{
			"id":        newUser.ID,
			"email":     newUser.Email.String,
			"phone":     newUser.Phone,
			"firstName": newUser.FirstName,
			"lastName":  newUser.LastName,
			"createdAt": newUser.CreatedAt,
		},
	})
		c.Abort()
}

func hashPassword(password string) (string, error) {
	hashedBytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hashedBytes), nil
}

func generateRandomPassword() string {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, 12)
	for i := range b {
		b[i] = charset[int(time.Now().UnixNano())%len(charset)]
	}
	return string(b)
}

// deleteOldAvatar removes the user's previous avatar file from disk
// before uploading a new one, preventing orphaned files from accumulating.
func deleteOldAvatar(c *gin.Context, userID string) error {
	db, exists := c.Get("db")
	if !exists {
		return nil
	}

	database, ok := db.(*sql.DB)
	if !ok {
		return nil
	}

	var currentAvatar *string
	err := database.QueryRow(
		"SELECT avatar FROM users WHERE id = $1", userID,
	).Scan(&currentAvatar)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil
		}
		return err
	}

	if currentAvatar == nil || *currentAvatar == "" {
		return nil
	}

	// Extract the filename from the avatar URL (e.g., "/uploads/avatars/12345_uuid.png" -> "12345_uuid.png")
	avatarURL := *currentAvatar
	filename := filepath.Base(avatarURL)
	if filename == "" || filename == "." {
		return nil
	}

	uploadDir := filepath.Join(".", "uploads", "avatars")
	oldFilePath := filepath.Join(uploadDir, filename)
	if err := os.Remove(oldFilePath); err != nil && !os.IsNotExist(err) {
		return err
	}

	return nil
}
