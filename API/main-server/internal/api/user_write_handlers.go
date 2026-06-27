package api

import (
	"database/sql"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
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
		args = append(args, request.Phone)
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

func UploadAvatar(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Upload avatar endpoint - coming soon",
	})
}

// OnboardUser creates a new user during chama member onboarding
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
		emailStr = sql.NullString{Valid: false}
	}

	var genderStr sql.NullString
	if req.Gender != nil && *req.Gender != "" {
		genderStr = sql.NullString{String: *req.Gender, Valid: true}
		genderStr = sql.NullString{Valid: false}
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
	err := database.QueryRow("SELECT id FROM users WHERE phone = $1", req.Phone).Scan(&existingPhone)
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

	err = database.QueryRow(query, newUserID, emailStr, req.Phone, req.FirstName, req.LastName, passwordHash, req.IDNumber, genderStr).Scan(
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
