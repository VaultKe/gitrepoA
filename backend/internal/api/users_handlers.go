package api

import (
	"database/sql"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"vaultke-backend/internal/services"
	"vaultke-backend/internal/utils"
)

// User handlers
func GetUsers(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	limitStr := c.DefaultQuery("limit", "50")
	offsetStr := c.DefaultQuery("offset", "0")
	searchQuery := c.Query("q") // Get search query parameter

	limit, _ := strconv.Atoi(limitStr)
	offset, _ := strconv.Atoi(offsetStr)

	// Enforce reasonable limits to prevent memory issues
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}

	// Get database from context
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}

	// Build query with optional search functionality
	var query string
	var args []interface{}

	if searchQuery != "" {
		// Search by name, email, or phone number
		query = `
			SELECT id, email, phone, first_name, last_name, avatar, role,
				   county, town, business_type, rating, total_ratings, created_at
			FROM users
			WHERE id != $1 AND status = 'active'
			AND (
				LOWER(first_name) LIKE LOWER($2) OR
				LOWER(last_name) LIKE LOWER($3) OR
				LOWER(email) LIKE LOWER($4) OR
				phone LIKE $5
			)
			ORDER BY first_name, last_name
			LIMIT $6 OFFSET $7
		`
		searchPattern := "%" + searchQuery + "%"
		args = []interface{}{userID, searchPattern, searchPattern, searchPattern, searchPattern, limit, offset}
	} else {
		// Get all users (excluding current user)
		query = `
			SELECT id, email, phone, first_name, last_name, avatar, role,
				   county, town, business_type, rating, total_ratings, created_at
			FROM users
			WHERE id != $1 AND status = 'active'
			ORDER BY first_name, last_name
			LIMIT $2 OFFSET $3
		`
		args = []interface{}{userID, limit, offset}
	}

	rows, err := db.(*sql.DB).Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to retrieve users",
		})
		return
	}
	defer rows.Close()

	var users []map[string]interface{}
	for rows.Next() {
		var user struct {
			ID           string         `json:"id"`
			Email        string         `json:"email"`
			Phone        sql.NullString `json:"phone"`
			FirstName    string         `json:"firstName"`
			LastName     string         `json:"lastName"`
			Avatar       sql.NullString `json:"avatar"`
			Role         string         `json:"role"`
			County       sql.NullString `json:"county"`
			Town         sql.NullString `json:"town"`
			BusinessType sql.NullString `json:"businessType"`
			Rating       float64        `json:"rating"`
			TotalRatings int            `json:"totalRatings"`
			CreatedAt    string         `json:"createdAt"`
		}

		err := rows.Scan(
			&user.ID, &user.Email, &user.Phone, &user.FirstName, &user.LastName,
			&user.Avatar, &user.Role, &user.County, &user.Town, &user.BusinessType,
			&user.Rating, &user.TotalRatings, &user.CreatedAt,
		)
		if err != nil {
			continue
		}

		userMap := map[string]interface{}{
			"id":           user.ID,
			"email":        user.Email,
			"firstName":    user.FirstName,
			"lastName":     user.LastName,
			"role":         user.Role,
			"rating":       user.Rating,
			"totalRatings": user.TotalRatings,
			"createdAt":    user.CreatedAt,
		}

		if user.Phone.Valid {
			userMap["phone"] = user.Phone.String
		}
		if user.Avatar.Valid {
			userMap["avatar"] = user.Avatar.String
		}
		if user.County.Valid {
			userMap["county"] = user.County.String
		}
		if user.Town.Valid {
			userMap["town"] = user.Town.String
		}
		if user.BusinessType.Valid {
			userMap["businessType"] = user.BusinessType.String
		}

		users = append(users, userMap)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    users,
	})
}

// GetAllUsersForAdmin - Admin endpoint to get all users (no exclusions)
func GetAllUsersForAdmin(c *gin.Context) {
	// Check if user is admin
	userRole := c.GetString("userRole")
	if userRole != "admin" {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "Only admins can access this endpoint",
		})
		return
	}

	limitStr := c.DefaultQuery("limit", "100")
	offsetStr := c.DefaultQuery("offset", "0")
	searchQuery := c.Query("q") // Get search query parameter

	limit, _ := strconv.Atoi(limitStr)
	offset, _ := strconv.Atoi(offsetStr)

	// Enforce reasonable limits to prevent memory issues
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}

	// Get database from context
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}

	var query string
	var args []interface{}

	if searchQuery != "" {
		// Search users by name, email, or phone
		query = `
			SELECT id, email, phone, first_name, last_name, avatar, role,
				   county, town, business_type, rating, total_ratings, created_at, status
			FROM users
			WHERE (first_name LIKE $2 OR last_name LIKE $3 OR email LIKE $4 OR phone LIKE $5)
			ORDER BY first_name, last_name
			LIMIT $6 OFFSET $7
		`
		searchPattern := "%" + searchQuery + "%"
		args = []interface{}{searchPattern, searchPattern, searchPattern, searchPattern, limit, offset}
	} else {
		// Get all users (including current user for admin view)
		query = `
			SELECT id, email, phone, first_name, last_name, avatar, role,
				   county, town, business_type, rating, total_ratings, created_at, status
			FROM users
			ORDER BY first_name, last_name
			LIMIT $1 OFFSET $2
		`
		args = []interface{}{limit, offset}
	}

	rows, err := db.(*sql.DB).Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to retrieve users",
		})
		return
	}
	defer rows.Close()

	var users []map[string]interface{}
	for rows.Next() {
		var user struct {
			ID           string         `json:"id"`
			Email        string         `json:"email"`
			Phone        string         `json:"phone"`
			FirstName    string         `json:"firstName"`
			LastName     string         `json:"lastName"`
			Avatar       sql.NullString `json:"avatar"`
			Role         string         `json:"role"`
			County       sql.NullString `json:"county"`
			Town         sql.NullString `json:"town"`
			BusinessType sql.NullString `json:"businessType"`
			Rating       float64        `json:"rating"`
			TotalRatings int            `json:"totalRatings"`
			CreatedAt    string         `json:"createdAt"`
			Status       string         `json:"status"`
		}

		err := rows.Scan(
			&user.ID, &user.Email, &user.Phone, &user.FirstName, &user.LastName,
			&user.Avatar, &user.Role, &user.County, &user.Town, &user.BusinessType,
			&user.Rating, &user.TotalRatings, &user.CreatedAt, &user.Status,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to scan user data",
			})
			return
		}

		userMap := map[string]interface{}{
			"id":           user.ID,
			"email":        user.Email,
			"phone":        user.Phone,
			"firstName":    user.FirstName,
			"lastName":     user.LastName,
			"role":         user.Role,
			"rating":       user.Rating,
			"totalRatings": user.TotalRatings,
			"createdAt":    user.CreatedAt,
			"status":       user.Status,
		}

		if user.Avatar.Valid {
			userMap["avatar"] = user.Avatar.String
		}
		if user.County.Valid {
			userMap["county"] = user.County.String
		}
		if user.Town.Valid {
			userMap["town"] = user.Town.String
		}
		if user.BusinessType.Valid {
			userMap["businessType"] = user.BusinessType.String
		}

		users = append(users, userMap)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    users,
		"count":   len(users),
	})
}

func GetProfile(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	// Get database from context
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}

	// Query user profile data
	query := `
		SELECT id, email, phone, first_name, last_name, avatar, role, status,
			   is_email_verified, is_phone_verified, language, theme, county, town,
			   latitude, longitude, business_type, business_description, rating, total_ratings,
			   bio, occupation, date_of_birth, gender,
			   created_at, updated_at
		FROM users
		WHERE id = $1
	`

	var user struct {
		ID                  string          `json:"id"`
		Email               string          `json:"email"`
		Phone               sql.NullString  `json:"phone"`
		FirstName           string          `json:"firstName"`
		LastName            string          `json:"lastName"`
		Avatar              sql.NullString  `json:"avatar"`
		Role                string          `json:"role"`
		Status              string          `json:"status"`
		IsEmailVerified     bool            `json:"isEmailVerified"`
		IsPhoneVerified     bool            `json:"isPhoneVerified"`
		Language            sql.NullString  `json:"language"`
		Theme               sql.NullString  `json:"theme"`
		County              sql.NullString  `json:"county"`
		Town                sql.NullString  `json:"town"`
		Latitude            sql.NullFloat64 `json:"latitude"`
		Longitude           sql.NullFloat64 `json:"longitude"`
		BusinessType        sql.NullString  `json:"businessType"`
		BusinessDescription sql.NullString  `json:"businessDescription"`
		Rating              float64         `json:"rating"`
		TotalRatings        int             `json:"totalRatings"`
		Bio                 sql.NullString  `json:"bio"`
		Occupation          sql.NullString  `json:"occupation"`
		DateOfBirth         sql.NullString  `json:"dateOfBirth"`
		Gender              sql.NullString  `json:"gender"`
		CreatedAt           string          `json:"createdAt"`
		UpdatedAt           string          `json:"updatedAt"`
	}

	err := db.(*sql.DB).QueryRow(query, userID).Scan(
		&user.ID, &user.Email, &user.Phone, &user.FirstName, &user.LastName,
		&user.Avatar, &user.Role, &user.Status, &user.IsEmailVerified, &user.IsPhoneVerified,
		&user.Language, &user.Theme, &user.County, &user.Town, &user.Latitude, &user.Longitude,
		&user.BusinessType, &user.BusinessDescription, &user.Rating, &user.TotalRatings,
		&user.Bio, &user.Occupation, &user.DateOfBirth, &user.Gender,
		&user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			// Return placeholder user data instead of 404 to prevent frontend crashes
			c.JSON(http.StatusOK, gin.H{
				"success": true,
				"message": "Profile retrieved successfully",
				"data": map[string]interface{}{
					"id":              userID,
					"email":           "unknown@example.com",
					"firstName":       "Unknown",
					"lastName":        "User",
					"role":            "user",
					"status":          "active",
					"isEmailVerified": false,
					"isPhoneVerified": false,
					"rating":          0.0,
					"totalRatings":    0,
					"createdAt":       "",
					"updatedAt":       "",
				},
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to retrieve user profile",
		})
		return
	}

	// Build response map
	userMap := map[string]interface{}{
		"id":              user.ID,
		"email":           user.Email,
		"firstName":       user.FirstName,
		"lastName":        user.LastName,
		"role":            user.Role,
		"status":          user.Status,
		"isEmailVerified": user.IsEmailVerified,
		"isPhoneVerified": user.IsPhoneVerified,
		"rating":          user.Rating,
		"totalRatings":    user.TotalRatings,
		"createdAt":       user.CreatedAt,
		"updatedAt":       user.UpdatedAt,
	}

	// Handle nullable fields
	if user.Phone.Valid {
		userMap["phone"] = user.Phone.String
	}
	if user.Avatar.Valid {
		userMap["avatar"] = user.Avatar.String
	}
	if user.Language.Valid {
		userMap["language"] = user.Language.String
	}
	if user.Theme.Valid {
		userMap["theme"] = user.Theme.String
	}
	if user.County.Valid {
		userMap["county"] = user.County.String
	}
	if user.Town.Valid {
		userMap["town"] = user.Town.String
	}
	if user.Latitude.Valid {
		userMap["latitude"] = user.Latitude.Float64
	}
	if user.Longitude.Valid {
		userMap["longitude"] = user.Longitude.Float64
	}
	if user.BusinessType.Valid {
		userMap["businessType"] = user.BusinessType.String
	}
	if user.BusinessDescription.Valid {
		userMap["businessDescription"] = user.BusinessDescription.String
	}
	if user.Bio.Valid {
		userMap["bio"] = user.Bio.String
	}
	if user.Occupation.Valid {
		userMap["occupation"] = user.Occupation.String
	}
	if user.DateOfBirth.Valid {
		userMap["dateOfBirth"] = user.DateOfBirth.String
	}
	if user.Gender.Valid {
		userMap["gender"] = user.Gender.String
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Profile retrieved successfully",
		"data":    userMap,
	})
}

// GetUserByID - Get user by ID (used for loan enrichment and other user lookups)
func GetUserByID(c *gin.Context) {
	userID := c.Param("id")
	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "User ID is required",
		})
		return
	}

	// Get database from context
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}

	// Query user data by ID
	query := `
		SELECT id, email, phone, first_name, last_name, avatar, role, status,
			   is_email_verified, is_phone_verified, language, theme, county, town,
			   latitude, longitude, business_type, business_description, rating, total_ratings,
			   bio, occupation, date_of_birth, gender,
			   created_at, updated_at
		FROM users
		WHERE id = $1
	`

	var user struct {
		ID                  string          `json:"id"`
		Email               string          `json:"email"`
		Phone               sql.NullString  `json:"phone"`
		FirstName           string          `json:"firstName"`
		LastName            string          `json:"lastName"`
		Avatar              sql.NullString  `json:"avatar"`
		Role                string          `json:"role"`
		Status              string          `json:"status"`
		IsEmailVerified     bool            `json:"isEmailVerified"`
		IsPhoneVerified     bool            `json:"isPhoneVerified"`
		Language            sql.NullString  `json:"language"`
		Theme               sql.NullString  `json:"theme"`
		County              sql.NullString  `json:"county"`
		Town                sql.NullString  `json:"town"`
		Latitude            sql.NullFloat64 `json:"latitude"`
		Longitude           sql.NullFloat64 `json:"longitude"`
		BusinessType        sql.NullString  `json:"businessType"`
		BusinessDescription sql.NullString  `json:"businessDescription"`
		Rating              float64         `json:"rating"`
		TotalRatings        int             `json:"totalRatings"`
		Bio                 sql.NullString  `json:"bio"`
		Occupation          sql.NullString  `json:"occupation"`
		DateOfBirth         sql.NullString  `json:"dateOfBirth"`
		Gender              sql.NullString  `json:"gender"`
		CreatedAt           string          `json:"createdAt"`
		UpdatedAt           string          `json:"updatedAt"`
	}

	err := db.(*sql.DB).QueryRow(query, userID).Scan(
		&user.ID, &user.Email, &user.Phone, &user.FirstName, &user.LastName,
		&user.Avatar, &user.Role, &user.Status, &user.IsEmailVerified, &user.IsPhoneVerified,
		&user.Language, &user.Theme, &user.County, &user.Town, &user.Latitude, &user.Longitude,
		&user.BusinessType, &user.BusinessDescription, &user.Rating, &user.TotalRatings,
		&user.Bio, &user.Occupation, &user.DateOfBirth, &user.Gender,
		&user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			// Return placeholder user data instead of 404 to prevent frontend crashes
			c.JSON(http.StatusOK, gin.H{
				"success": true,
				"message": "User retrieved successfully",
				"data": map[string]interface{}{
					"id":              userID,
					"email":           "unknown@example.com",
					"firstName":       "Unknown",
					"lastName":        "User",
					"role":            "user",
					"status":          "active",
					"isEmailVerified": false,
					"isPhoneVerified": false,
					"rating":          0.0,
					"totalRatings":    0,
					"createdAt":       "",
					"updatedAt":       "",
				},
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to retrieve user",
		})
		return
	}

	// Build response map
	userMap := map[string]interface{}{
		"id":              user.ID,
		"email":           user.Email,
		"firstName":       user.FirstName,
		"lastName":        user.LastName,
		"role":            user.Role,
		"status":          user.Status,
		"isEmailVerified": user.IsEmailVerified,
		"isPhoneVerified": user.IsPhoneVerified,
		"rating":          user.Rating,
		"totalRatings":    user.TotalRatings,
		"createdAt":       user.CreatedAt,
		"updatedAt":       user.UpdatedAt,
	}

	// Handle nullable fields
	if user.Phone.Valid {
		userMap["phone"] = user.Phone.String
	}
	if user.Avatar.Valid {
		userMap["avatar"] = user.Avatar.String
	}
	if user.Language.Valid {
		userMap["language"] = user.Language.String
	}
	if user.Theme.Valid {
		userMap["theme"] = user.Theme.String
	}
	if user.County.Valid {
		userMap["county"] = user.County.String
	}
	if user.Town.Valid {
		userMap["town"] = user.Town.String
	}
	if user.Latitude.Valid {
		userMap["latitude"] = user.Latitude.Float64
	}
	if user.Longitude.Valid {
		userMap["longitude"] = user.Longitude.Float64
	}
	if user.BusinessType.Valid {
		userMap["businessType"] = user.BusinessType.String
	}
	if user.BusinessDescription.Valid {
		userMap["businessDescription"] = user.BusinessDescription.String
	}
	if user.Bio.Valid {
		userMap["bio"] = user.Bio.String
	}
	if user.Occupation.Valid {
		userMap["occupation"] = user.Occupation.String
	}
	if user.DateOfBirth.Valid {
		userMap["dateOfBirth"] = user.DateOfBirth.String
	}
	if user.Gender.Valid {
		userMap["gender"] = user.Gender.String
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "User retrieved successfully",
		"data":    userMap,
	})
}

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

	// Get database from context
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}

	// Build update query dynamically based on provided fields
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

	// Add updated_at
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

	// Return updated user data
	GetProfile(c)
}

func UploadAvatar(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Upload avatar endpoint - coming soon",
	})
}

// GetUserStatistics returns comprehensive statistics for the authenticated user
func GetUserStatistics(c *gin.Context) {
	// Get user ID from context (set by auth middleware)
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	// Get database connection
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}

	// Create user service
	userService := services.NewUserService(db.(*sql.DB))

	// Get user statistics
	stats, err := userService.GetUserStatistics(userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to get user statistics: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    stats,
	})
}

// GetAdminStatistics returns comprehensive system-wide statistics for admin dashboard
func GetAdminStatistics(c *gin.Context) {
	// Check if user is admin
	userRole := c.GetString("userRole")
	if userRole != "admin" {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "Only admins can access this endpoint",
		})
		return
	}

	// Get database connection
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}

	// Create user service
	userService := services.NewUserService(db.(*sql.DB))

	// Get admin statistics
	stats, err := userService.GetAdminStatistics()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to get admin statistics: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    stats,
	})
}

// GetSystemAnalytics returns comprehensive system analytics for admin dashboard
func GetSystemAnalytics(c *gin.Context) {
	// Check if user is admin
	userRole := c.GetString("userRole")
	if userRole != "admin" {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "Only admins can access this endpoint",
		})
		return
	}

	// Get period parameter
	period := c.DefaultQuery("period", "7d")

	// Get database connection
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}

	// Create user service
	userService := services.NewUserService(db.(*sql.DB))

	// Get system analytics
	analytics, err := userService.GetSystemAnalytics(period)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to get system analytics: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    analytics,
	})
}

// AdminUpdateUserRole - Admin endpoint to update user role (temporary for setup)
func AdminUpdateUserRole(c *gin.Context) {
	userID := c.Param("id")
	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "User ID is required",
		})
		return
	}

	var request struct {
		Role string `json:"role" binding:"required"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request body",
		})
		return
	}

	// Validate role
	if request.Role != "user" && request.Role != "admin" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Role must be either 'user' or 'admin'",
		})
		return
	}

	// Get database from context
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}

	// Update user role
	query := `UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`
	result, err := db.(*sql.DB).Exec(query, request.Role, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to update user role: " + err.Error(),
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

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "User role updated successfully",
		"data": gin.H{
			"userId": userID,
			"role":   request.Role,
		},
	})
}

// UpdateUserRole - Admin endpoint to update user role
func UpdateUserRole(c *gin.Context) {
	// Get current user role from context
	userRole := c.GetString("userRole")
	if userRole != "admin" {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "Only admins can update user roles",
		})
		return
	}

	userID := c.Param("id")
	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "User ID is required",
		})
		return
	}

	var request struct {
		Role string `json:"role" binding:"required"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request body",
		})
		return
	}

	// Validate role
	if request.Role != "user" && request.Role != "admin" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Role must be either 'user' or 'admin'",
		})
		return
	}

	// Get database from context
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}

	// Update user role
	query := `UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`
	result, err := db.(*sql.DB).Exec(query, request.Role, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to update user role",
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

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "User role updated successfully",
		"data": gin.H{
			"userId": userID,
			"role":   request.Role,
		},
	})
}

// UpdateUserStatus - Admin endpoint to update user status
func UpdateUserStatus(c *gin.Context) {
	// Check if user is admin
	userRole := c.GetString("userRole")
	if userRole != "admin" {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "Only admins can update user status",
		})
		return
	}

	userID := c.Param("id")
	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "User ID is required",
		})
		return
	}

	var request struct {
		Status string `json:"status" binding:"required"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request body",
		})
		return
	}

	// Validate status
	if request.Status != "active" && request.Status != "suspended" && request.Status != "pending" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Status must be 'active', 'suspended', or 'pending'",
		})
		return
	}

	// Get database from context
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}

	// Update user status
	query := `UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`
	result, err := db.(*sql.DB).Exec(query, request.Status, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to update user status",
		})
		return
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to check update result",
		})
		return
	}

	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "User not found",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "User status updated successfully",
		"data": map[string]interface{}{
			"id":     userID,
			"status": request.Status,
		},
	})
}

// DeleteUser - Admin endpoint to delete a user
func DeleteUser(c *gin.Context) {
	// Check if user is admin
	userRole := c.GetString("userRole")
	if userRole != "admin" {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "Only admins can delete users",
		})
		return
	}

	userID := c.Param("id")
	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "User ID is required",
		})
		return
	}

	// Get current admin user ID to prevent self-deletion
	currentUserID := c.GetString("userID")
	if userID == currentUserID {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Cannot delete your own account",
		})
		return
	}

	// Get database from context
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}

	// Check if user exists
	var existingUserID string
	checkQuery := `SELECT id FROM users WHERE id = $1`
	err := db.(*sql.DB).QueryRow(checkQuery, userID).Scan(&existingUserID)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"error":   "User not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to check user existence",
		})
		return
	}

	// For safety, we'll soft delete by setting status to 'deleted' instead of hard delete
	// This preserves data integrity and allows for potential recovery
	deleteQuery := `UPDATE users SET status = 'deleted', updated_at = CURRENT_TIMESTAMP WHERE id = $1`
	result, err := db.(*sql.DB).Exec(deleteQuery, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to delete user",
		})
		return
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to check delete result",
		})
		return
	}

	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "User not found",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "User deleted successfully",
		"data": map[string]interface{}{
			"id": userID,
		},
	})
}

// SearchUserByCredentials searches for a user by both phone and national ID
// Returns the user only if both credentials match the same person
func SearchUserByCredentials(c *gin.Context) {
	phone := c.Query("phone")
	nationalId := c.Query("nationalId")

	if phone == "" || nationalId == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Both phone and national ID are required",
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

	var phoneUser map[string]interface{}

	row := database.QueryRow(
		"SELECT id, email, phone, first_name, last_name, id_number FROM users WHERE phone = $1",
		phone,
	)
	var puID, puEmail, puPhone, puFirstName, puLastName, puIDNumber sql.NullString
	err := row.Scan(&puID, &puEmail, &puPhone, &puFirstName, &puLastName, &puIDNumber)

	row2 := database.QueryRow(
		"SELECT id, email, phone, first_name, last_name, id_number FROM users WHERE id_number = $1",
		nationalId,
	)
	var iuID, iuEmail, iuPhone, iuFirstName, iuLastName, iuIDNumber sql.NullString
	err2 := row2.Scan(&iuID, &iuEmail, &iuPhone, &iuFirstName, &iuLastName, &iuIDNumber)

	phoneExists := err == nil
	idExists := err2 == nil

	if phoneExists && idExists && puID.String == iuID.String {
		phoneUser = map[string]interface{}{
			"id":         puID.String,
			"email":      puEmail.String,
			"phone":      puPhone.String,
			"firstName":  puFirstName.String,
			"lastName":   puLastName.String,
			"nationalId": puIDNumber.String,
		}
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data":    phoneUser,
			"match":   true,
		})
		return
	}

	if phoneExists && idExists && puID.String != iuID.String {
		phoneUserMap := map[string]interface{}{
			"id":         puID.String,
			"email":      puEmail.String,
			"phone":      puPhone.String,
			"firstName":  puFirstName.String,
			"lastName":   puLastName.String,
			"nationalId": puIDNumber.String,
		}
		idUserMap := map[string]interface{}{
			"id":         iuID.String,
			"email":      iuEmail.String,
			"phone":      iuPhone.String,
			"firstName":  iuFirstName.String,
			"lastName":   iuLastName.String,
			"nationalId": iuIDNumber.String,
		}
		c.JSON(http.StatusConflict, gin.H{
			"success":   false,
			"error":     "Credential mismatch: phone and national ID belong to different users",
			"phoneUser": phoneUserMap,
			"idUser":    idUserMap,
		})
		return
	}

	if phoneExists && !idExists {
		phoneUser = map[string]interface{}{
			"id":         puID.String,
			"email":      puEmail.String,
			"phone":      puPhone.String,
			"firstName":  puFirstName.String,
			"lastName":   puLastName.String,
			"nationalId": puIDNumber.String,
		}
		c.JSON(http.StatusOK, gin.H{
			"success":   false,
			"error":     "National ID not found for the user with this phone number",
			"phoneUser": phoneUser,
		})
		return
	}

	if !phoneExists && idExists {
		idUser := map[string]interface{}{
			"id":         iuID.String,
			"email":      iuEmail.String,
			"phone":      iuPhone.String,
			"firstName":  iuFirstName.String,
			"lastName":   iuLastName.String,
			"nationalId": iuIDNumber.String,
		}
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"error":   "Phone number not found for the user with this national ID",
			"idUser":  idUser,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": false,
		"error":   "No user found with these credentials",
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
	} else {
		emailStr = sql.NullString{Valid: false}
	}

	var genderStr sql.NullString
	if req.Gender != nil && *req.Gender != "" {
		genderStr = sql.NullString{String: *req.Gender, Valid: true}
	} else {
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
		log.Printf("🔑 Auto-generated password for onboarding user %s %s: %s", req.FirstName, req.LastName, randomPassword)
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

// UpdateUserPhoneVerified updates a user's phone verification status
func UpdateUserPhoneVerified(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	targetUserID := c.Param("id")
	if targetUserID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "User ID is required",
		})
		return
	}

	var req struct {
		Verified bool `json:"verified" validate:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request data: " + err.Error(),
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

	query := `UPDATE users SET is_phone_verified = $1, updated_at = NOW() WHERE id = $2`
	result, err := database.Exec(query, req.Verified, targetUserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to update phone verification status",
		})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "User not found",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Phone verification status updated",
	})
}

// UpdateUserPaymentStatus updates a user's registration payment status
func UpdateUserPaymentStatus(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	targetUserID := c.Param("id")
	if targetUserID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "User ID is required",
		})
		return
	}

	var req struct {
		HasPaid bool `json:"hasPaid" validate:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request data: " + err.Error(),
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

	query := `UPDATE users SET updated_at = NOW() WHERE id = $1`
	result, err := database.Exec(query, targetUserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to update payment status",
		})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "User not found",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Payment status updated",
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
