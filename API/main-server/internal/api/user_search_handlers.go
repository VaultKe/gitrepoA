package api

import (
	"database/sql"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"vaultke-backend/internal/utils"

	"github.com/gin-gonic/gin"
)

// UserSearchHandlers handles user search API endpoints
type UserSearchHandlers struct {
	db *sql.DB
}

// NewUserSearchHandlers creates a new instance of UserSearchHandlers
func NewUserSearchHandlers(db *sql.DB) *UserSearchHandlers {
	return &UserSearchHandlers{db: db}
}

// buildPhoneSearchPatterns returns PostgreSQL-style LIKE conditions and args for
// flexible phone search against canonical E.164 phones. It matches local formats
// like 0712..., 254712..., and +254712... against stored values like +254712345678.
func buildPhoneSearchPatterns(query string, startIndex int) (string, []interface{}) {
	digits := strings.ReplaceAll(query, " ", "")
	digits = strings.ReplaceAll(digits, "-", "")
	digits = strings.ReplaceAll(digits, "(", "")
	digits = strings.ReplaceAll(digits, ")", "")

	var patterns []string
	var args []interface{}
	idx := startIndex

	patterns = append(patterns, fmt.Sprintf("phone LIKE $%d", idx))
	args = append(args, "%"+query+"%")
	idx++

	if len(digits) >= 2 {
		if strings.HasPrefix(digits, "0") {
			stripped := digits[1:]
			if stripped != "" {
				patterns = append(patterns, fmt.Sprintf("phone LIKE $%d", idx))
				args = append(args, "%"+stripped+"%")
				idx++
			}
		}

		if strings.HasPrefix(digits, "254") {
			patterns = append(patterns, fmt.Sprintf("phone LIKE $%d", idx))
			args = append(args, "%+"+digits+"%")
			idx++
		}

		if strings.HasPrefix(digits, "+254") {
			local := "0" + digits[4:]
			patterns = append(patterns, fmt.Sprintf("phone LIKE $%d", idx))
			args = append(args, "%"+local+"%")
		}
	}

	if len(patterns) == 0 {
		return fmt.Sprintf("phone LIKE $%d", startIndex), []interface{}{"%" + query + "%"}
	}

	return strings.Join(patterns, " OR "), args
}

// SearchUsers searches for users by name, email, or phone number
func (h *UserSearchHandlers) SearchUsers(c *gin.Context) {
	userID := c.GetString("userID")

	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	// Get search parameters
	query := strings.TrimSpace(c.Query("query"))
	limitStr := c.DefaultQuery("limit", "20")
	offsetStr := c.DefaultQuery("offset", "0")
	excludeCurrentUser := c.DefaultQuery("excludeCurrentUser", "false")

	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Search query is required",
		})
		return
	}

	if len(query) < 2 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Search query must be at least 2 characters",
		})
		return
	}

	limit, err := strconv.Atoi(limitStr)
	if err != nil {
		limit = 20
	}

	offset, err := strconv.Atoi(offsetStr)
	if err != nil {
		offset = 0
	}

	// Build search query
	searchPattern := "%" + query + "%"

	var sqlQuery string
	var args []interface{}

	if excludeCurrentUser == "true" {
		phonePatterns, phoneArgs := buildPhoneSearchPatterns(query, 5)
		phoneCount := len(phoneArgs)
		orderIndex := 5 + phoneCount
		sqlQuery = `
			SELECT id, first_name, last_name, email, phone, created_at
			FROM users
			WHERE id != $1 AND (
				LOWER(first_name) LIKE LOWER($2) OR
				LOWER(last_name) LIKE LOWER($3) OR
				LOWER(email) LIKE LOWER($4) OR
				` + phonePatterns + `
			)
			ORDER BY
				CASE
					WHEN LOWER(first_name) LIKE LOWER($` + fmt.Sprint(orderIndex) + `) THEN 1
					WHEN LOWER(last_name) LIKE LOWER($` + fmt.Sprint(orderIndex+1) + `) THEN 2
					WHEN LOWER(email) LIKE LOWER($` + fmt.Sprint(orderIndex+2) + `) THEN 3
					ELSE 4
				END,
				first_name, last_name
			LIMIT $` + fmt.Sprint(orderIndex+3) + ` OFFSET $` + fmt.Sprint(orderIndex+4) + `
		`
		args = []interface{}{
			userID, searchPattern, searchPattern, searchPattern,
		}
		args = append(args, phoneArgs...)
		args = append(args, searchPattern, searchPattern, searchPattern, limit, offset)
	} else {
		phonePatterns, phoneArgs := buildPhoneSearchPatterns(query, 4)
		phoneCount := len(phoneArgs)
		orderIndex := 4 + phoneCount
		sqlQuery = `
			SELECT id, first_name, last_name, email, phone, created_at
			FROM users
			WHERE
				LOWER(first_name) LIKE LOWER($1) OR
				LOWER(last_name) LIKE LOWER($2) OR
				LOWER(email) LIKE LOWER($3) OR
				` + phonePatterns + `
			ORDER BY
				CASE
					WHEN LOWER(first_name) LIKE LOWER($` + fmt.Sprint(orderIndex) + `) THEN 1
					WHEN LOWER(last_name) LIKE LOWER($` + fmt.Sprint(orderIndex+1) + `) THEN 2
					WHEN LOWER(email) LIKE LOWER($` + fmt.Sprint(orderIndex+2) + `) THEN 3
					ELSE 4
				END,
				first_name, last_name
			LIMIT $` + fmt.Sprint(orderIndex+3) + ` OFFSET $` + fmt.Sprint(orderIndex+4) + `
		`
		args = []interface{}{
			searchPattern, searchPattern, searchPattern,
		}
		args = append(args, phoneArgs...)
		args = append(args, searchPattern, searchPattern, searchPattern, limit, offset)
	}

	rows, err := h.db.Query(sqlQuery, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to search users",
		})
		return
	}
	defer rows.Close()

	var users []map[string]interface{}
	for rows.Next() {
		var id, firstName, lastName, email, createdAt string
		var phoneNumber sql.NullString

		err := rows.Scan(&id, &firstName, &lastName, &email, &phoneNumber, &createdAt)
		if err != nil {
			continue
		}

		user := map[string]interface{}{
			"id":        id,
			"firstName": firstName,
			"lastName":  lastName,
			"email":     utils.MaskEmail(email),
			"createdAt": createdAt,
		}

		if phoneNumber.Valid {
			user["phoneNumber"] = utils.MaskPhone(phoneNumber.String)
		}

		users = append(users, user)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    users,
		"count":   len(users),
		"query":   query,
	})
		c.Abort()
}

// GetUserProfile gets a user's public profile information
func (h *UserSearchHandlers) GetUserProfile(c *gin.Context) {
	userID := c.GetString("userID")
	targetUserID := c.Param("userId")

	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	if targetUserID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "User ID is required",
		})
		return
	}

	// Get user profile
	query := `
		SELECT id, first_name, last_name, email, phone, created_at
		FROM users
		WHERE id = $1
	`

	var id, firstName, lastName, email, createdAt string
	var phoneNumber sql.NullString

	err := h.db.QueryRow(query, targetUserID).Scan(&id, &firstName, &lastName, &email, &phoneNumber, &createdAt)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"error":   "User not found",
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to get user profile",
			})
		}
		return
	}

	user := map[string]interface{}{
		"id":        id,
		"firstName": firstName,
		"lastName":  lastName,
		"email":     utils.MaskEmail(email),
		"createdAt": createdAt,
	}

	if phoneNumber.Valid {
		user["phoneNumber"] = utils.MaskPhone(phoneNumber.String)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    user,
	})
		c.Abort()
}

// SearchUsersAdvanced provides advanced search with filters
func (h *UserSearchHandlers) SearchUsersAdvanced(c *gin.Context) {
	userID := c.GetString("userID")

	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	// Get search parameters
	query := strings.TrimSpace(c.Query("query"))
	searchType := c.DefaultQuery("type", "all") // all, name, email, phone
	limitStr := c.DefaultQuery("limit", "20")
	offsetStr := c.DefaultQuery("offset", "0")
	excludeCurrentUser := c.DefaultQuery("excludeCurrentUser", "false")

	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Search query is required",
		})
		return
	}

	limit, err := strconv.Atoi(limitStr)
	if err != nil {
		limit = 20
	}

	offset, err := strconv.Atoi(offsetStr)
	if err != nil {
		offset = 0
	}

	// Build search conditions based on type
	var whereConditions []string
	var args []interface{}
	searchPattern := "%" + query + "%"

	switch searchType {
	case "name":
		whereConditions = append(whereConditions, "(LOWER(first_name) LIKE LOWER($2) OR LOWER(last_name) LIKE LOWER($3))")
		args = append(args, searchPattern, searchPattern)
	case "email":
		whereConditions = append(whereConditions, "LOWER(email) LIKE LOWER($4)")
		args = append(args, searchPattern)
	case "phone":
		phonePatterns, phoneArgs := buildPhoneSearchPatterns(query, 2)
		whereConditions = append(whereConditions, phonePatterns)
		args = append(args, phoneArgs...)
	default: // "all"
		phonePatterns, phoneArgs := buildPhoneSearchPatterns(query, 6)
		whereConditions = append(whereConditions, "(LOWER(first_name) LIKE LOWER($2) OR LOWER(last_name) LIKE LOWER($3) OR LOWER(email) LIKE LOWER($4) OR "+phonePatterns+")")
		args = append(args, searchPattern, searchPattern, searchPattern)
		args = append(args, phoneArgs...)
	}

	if excludeCurrentUser == "true" {
		whereConditions = append(whereConditions, "id != $1")
		args = append([]interface{}{userID}, args...)
	}

	// Calculate LIMIT/OFFSET placeholder numbers based on arg count
	argCount := len(args)
	limitIndex := argCount + 1
	offsetIndex := argCount + 2

	sqlQuery := `
		SELECT id, first_name, last_name, email, phone, created_at
		FROM users
		WHERE ` + strings.Join(whereConditions, " AND ") + `
		ORDER BY first_name, last_name
		LIMIT $` + fmt.Sprint(limitIndex) + ` OFFSET $` + fmt.Sprint(offsetIndex) + `
	`

	args = append(args, limit, offset)

	rows, err := h.db.Query(sqlQuery, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to search users",
		})
		return
	}
	defer rows.Close()

	var users []map[string]interface{}
	for rows.Next() {
		var id, firstName, lastName, email, createdAt string
		var phoneNumber sql.NullString

		err := rows.Scan(&id, &firstName, &lastName, &email, &phoneNumber, &createdAt)
		if err != nil {
			continue
		}

		user := map[string]interface{}{
			"id":        id,
			"firstName": firstName,
			"lastName":  lastName,
			"email":     utils.MaskEmail(email),
			"createdAt": createdAt,
		}

		if phoneNumber.Valid {
			user["phoneNumber"] = utils.MaskPhone(phoneNumber.String)
		}

		users = append(users, user)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    users,
		"count":   len(users),
		"query":   query,
		"type":    searchType,
	})
		c.Abort()
}

// CheckMarketplaceRoles checks what marketplace roles a user has
func (h *UserSearchHandlers) CheckMarketplaceRoles(c *gin.Context) {
	userID := c.Param("userId")

	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "User ID is required",
		})
		return
	}

	// Query marketplace roles
	query := `
		SELECT role, auto_detected, is_active, created_at
		FROM marketplace_roles
		WHERE user_id = $1 AND is_active = TRUE
	`

	rows, err := h.db.Query(query, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to check marketplace roles",
		})
		return
	}
	defer rows.Close()

	roles := map[string]bool{
		"buyer":           false,
		"seller":          false,
		"delivery_person": false,
	}

	roleDetails := make(map[string]interface{})

	for rows.Next() {
		var role, createdAt string
		var autoDetected, isActive bool

		err := rows.Scan(&role, &autoDetected, &isActive, &createdAt)
		if err != nil {
			continue
		}

		roles[role] = true
		roleDetails[role] = map[string]interface{}{
			"autoDetected": autoDetected,
			"isActive":     isActive,
			"createdAt":    createdAt,
		}
	}

	// Auto-detect seller role based on products
	if !roles["seller"] {
		var productCount int
		productQuery := `SELECT COUNT(*) FROM products WHERE seller_id = $1`
		err := h.db.QueryRow(productQuery, userID).Scan(&productCount)
		if err == nil && productCount > 0 {
			roles["seller"] = true
			roleDetails["seller"] = map[string]interface{}{
				"autoDetected": true,
				"isActive":     true,
				"productCount": productCount,
				"createdAt":    nil,
			}
		}
	}

	// Auto-detect buyer role for sellers (sellers can also be buyers)
	if roles["seller"] && !roles["buyer"] {
		// Sellers are automatically buyers too (they can buy from other sellers)
		roles["buyer"] = true
		roleDetails["buyer"] = map[string]interface{}{
			"autoDetected": true,
			"isActive":     true,
			"reason":       "seller_auto_buyer",
			"createdAt":    nil,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    roles,
		"details": roleDetails,
	})
		c.Abort()
}
