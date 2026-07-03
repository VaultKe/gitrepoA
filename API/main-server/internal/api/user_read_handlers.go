package api

import (
	"database/sql"
	"net/http"
	"strconv"

	"vaultke-backend/internal/services"
	"vaultke-backend/internal/utils"

	"github.com/gin-gonic/gin"
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
	searchQuery := c.Query("q")

	limit, _ := strconv.Atoi(limitStr)
	offset, _ := strconv.Atoi(offsetStr)

	if limit <= 0 || limit > 100 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}

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
			"email":        utils.MaskEmail(user.Email),
			"firstName":    user.FirstName,
			"lastName":     user.LastName,
			"role":         user.Role,
			"rating":       user.Rating,
			"totalRatings": user.TotalRatings,
			"createdAt":    user.CreatedAt,
		}

	if user.Phone.Valid {
		userMap["phone"] = utils.MaskPhone(user.Phone.String)
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

func GetProfile(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
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

	query := `
		SELECT id, email, phone, first_name, last_name, avatar, role, status,
			   is_email_verified, is_phone_verified, language, theme, county, town,
			   latitude, longitude, business_type, business_description, rating, total_ratings,
			   bio, occupation, date_of_birth, gender, id_number,
			   registration_fee_paid, created_at, updated_at
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
		IDNumber            sql.NullString  `json:"idNumber"`
		RegistrationFeePaid bool            `json:"registrationFeePaid"`
		CreatedAt           string          `json:"createdAt"`
		UpdatedAt           string          `json:"updatedAt"`
	}

	err := db.(*sql.DB).QueryRow(query, userID).Scan(
		&user.ID, &user.Email, &user.Phone, &user.FirstName, &user.LastName,
		&user.Avatar, &user.Role, &user.Status, &user.IsEmailVerified, &user.IsPhoneVerified,
		&user.Language, &user.Theme, &user.County, &user.Town, &user.Latitude, &user.Longitude,
		&user.BusinessType, &user.BusinessDescription, &user.Rating, &user.TotalRatings,
		&user.Bio, &user.Occupation, &user.DateOfBirth, &user.Gender, &user.IDNumber, &user.RegistrationFeePaid,
		&user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
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

	userMap := map[string]interface{}{
		"id":              user.ID,
		"email":           utils.MaskEmail(user.Email),
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

	if user.Phone.Valid {
		userMap["phone"] = utils.MaskPhone(user.Phone.String)
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
	if user.IDNumber.Valid {
		userMap["idNumber"] = utils.MaskID(user.IDNumber.String)
	}
	userMap["registrationFeePaid"] = user.RegistrationFeePaid

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

	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}

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

	userMap := map[string]interface{}{
		"id":              user.ID,
		"email":           utils.MaskEmail(user.Email),
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

	if user.Phone.Valid {
		userMap["phone"] = utils.MaskPhone(user.Phone.String)
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

// GetUserStatistics returns comprehensive statistics for the authenticated user
func GetUserStatistics(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
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

	userService := services.NewUserService(db.(*sql.DB))

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

// SearchUserByCredentials searches for a user by both phone and national ID
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
			"email":      utils.MaskEmail(puEmail.String),
			"phone":      utils.MaskPhone(puPhone.String),
			"firstName":  puFirstName.String,
			"lastName":   puLastName.String,
			"nationalId": utils.MaskID(puIDNumber.String),
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
			"email":      utils.MaskEmail(puEmail.String),
			"phone":      utils.MaskPhone(puPhone.String),
			"firstName":  puFirstName.String,
			"lastName":   puLastName.String,
			"nationalId": utils.MaskID(puIDNumber.String),
		}
		idUserMap := map[string]interface{}{
			"id":         iuID.String,
			"email":      utils.MaskEmail(iuEmail.String),
			"phone":      utils.MaskPhone(iuPhone.String),
			"firstName":  iuFirstName.String,
			"lastName":   iuLastName.String,
			"nationalId": utils.MaskID(iuIDNumber.String),
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
			"email":      utils.MaskEmail(puEmail.String),
			"phone":      utils.MaskPhone(puPhone.String),
			"firstName":  puFirstName.String,
			"lastName":   puLastName.String,
			"nationalId": utils.MaskID(puIDNumber.String),
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
			"email":      utils.MaskEmail(iuEmail.String),
			"phone":      utils.MaskPhone(iuPhone.String),
			"firstName":  iuFirstName.String,
			"lastName":   iuLastName.String,
			"nationalId": utils.MaskID(iuIDNumber.String),
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
