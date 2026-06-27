package api

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	"vaultke-backend/internal/models"
	"vaultke-backend/internal/services"

	"github.com/gin-gonic/gin"
)

// Chama handlers
func GetChamas(c *gin.Context) {
	// Get query parameters
	limitStr := c.DefaultQuery("limit", "20")
	offsetStr := c.DefaultQuery("offset", "0")

	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 {
		limit = 20
	}

	offset, err := strconv.Atoi(offsetStr)
	if err != nil || offset < 0 {
		offset = 0
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
	database := db.(*sql.DB)

	// Create chama service
	chamaService := services.NewChamaService(database)

	// Get all public chamas
	chamas, err := chamaService.GetChamas(limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to get chamas: " + err.Error(),
		})
		return
	}

	// Return chamas
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    chamas,
		"count":   len(chamas),
	})
}

// GetAllChamasForAdmin - Admin endpoint to get all chamas (no filters)
func GetAllChamasForAdmin(c *gin.Context) {
	// Check if user is admin
	userRole := c.GetString("userRole")
	if userRole != "admin" {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "Only admins can access this endpoint",
		})
		return
	}

	// Get query parameters
	limitStr := c.DefaultQuery("limit", "100")
	offsetStr := c.DefaultQuery("offset", "0")

	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 {
		limit = 100
	}

	offset, err := strconv.Atoi(offsetStr)
	if err != nil || offset < 0 {
		offset = 0
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
	database := db.(*sql.DB)

	// Create chama service
	chamaService := services.NewChamaService(database)

	// Get all chamas for admin
	chamas, err := chamaService.GetAllChamasForAdmin(limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to get chamas for admin: " + err.Error(),
		})
		return
	}

	// Return chamas
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    chamas,
		"count":   len(chamas),
	})
}

func GetUserChamas(c *gin.Context) {
	// Get user ID from context (set by auth middleware)
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	// Get query parameters
	limitStr := c.DefaultQuery("limit", "20")
	offsetStr := c.DefaultQuery("offset", "0")

	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 {
		limit = 20
	}

	offset, err := strconv.Atoi(offsetStr)
	if err != nil || offset < 0 {
		offset = 0
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
	database := db.(*sql.DB)

	// Create chama service
	chamaService := services.NewChamaService(database)

	// Get user's chamas
	chamas, err := chamaService.GetChamasByUser(userID.(string), limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to get user chamas: " + err.Error(),
		})
		return
	}

	// Return chamas
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    chamas,
		"count":   len(chamas),
	})
}

func CreateChama(c *gin.Context) {
	// Get user ID from context (set by auth middleware)
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	// Parse request body with enhanced validation tags
	var req struct {
		Name                   string  `json:"name" binding:"required" validate:"required,min=3,max=100,safe_text,no_sql_injection,no_xss"`
		Description            string  `json:"description" binding:"required" validate:"required,min=10,max=500,safe_text,no_sql_injection,no_xss"`
		Category               string  `json:"category" binding:"required" validate:"required,oneof=chama contribution"`
		Type                   string  `json:"type" binding:"required" validate:"required,alphanumeric"`
		County                 string  `json:"county" binding:"required" validate:"required,min=2,max=50,alpha,no_sql_injection,no_xss"`
		Town                   string  `json:"town" binding:"required" validate:"required,min=2,max=50,alpha,no_sql_injection,no_xss"`
		ContributionAmount     float64 `json:"contribution_amount,omitempty"`
		ContributionFrequency  string  `json:"contribution_frequency,omitempty"`
		TargetAmount           float64 `json:"target_amount,omitempty"`
		TargetDeadline         string  `json:"target_deadline,omitempty"`
		PaymentMethod          string  `json:"payment_method,omitempty" validate:"omitempty,oneof=till paybill"`
		TillNumber             string  `json:"till_number,omitempty"`
		PaybillBusinessNumber  string  `json:"paybill_business_number,omitempty"`
		PaybillAccountNumber   string  `json:"paybill_account_number,omitempty"`
		PaymentRecipientName   string  `json:"payment_recipient_name,omitempty"`
		MaxMembers             int     `json:"max_members" binding:"required" validate:"required,min=2,max=1000"`
		IsPublic               bool    `json:"is_public"`
		RequiresApproval       bool    `json:"requires_approval"`
		Rules                  string  `json:"rules" validate:"max=1000,safe_text,no_sql_injection,no_xss"`
		MeetingSchedule        string  `json:"meeting_schedule" validate:"max=200,safe_text,no_sql_injection,no_xss"`
		RegistrationFeePaid    bool    `json:"registration_fee_paid"`
		MonthlySubscriptionFee float64 `json:"monthly_subscription_fee"`
		Members                []struct {
			UserID              string `json:"user_id"`
			Role                string `json:"role"`
			Status              string `json:"status"`
			HasPaidRegistration bool   `json:"has_paid_registration,omitempty"`
			PhoneVerified       bool   `json:"phone_verified,omitempty"`
		} `json:"members,omitempty"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("❌ JSON binding failed: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request data: " + err.Error(),
		})
		return
	}

	// Debug logging

	// Additional validation - basic security checks
	if len(req.Name) < 3 || len(req.Name) > 100 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Chama name must be between 3 and 100 characters",
		})
		return
	}

	if len(req.Description) < 10 || len(req.Description) > 500 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Description must be between 10 and 500 characters",
		})
		return
	}

	// Validate category
	if req.Category != "chama" && req.Category != "contribution" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Category must be either 'chama' or 'contribution'",
		})
		return
	}

	// Validate type based on category
	chamaTypes := []string{"investment", "savings", "business", "welfare", "merry-go-round"}
	contributionTypes := []string{"emergency", "medical", "education", "community", "personal"}

	if req.Category == "chama" {
		validType := false
		for _, t := range chamaTypes {
			if req.Type == t {
				validType = true
				break
			}
		}
		if !validType {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error":   "Invalid type for chama. Valid types: investment, savings, business, welfare, merry-go-round",
			})
			return
		}
	} else if req.Category == "contribution" {
		validType := false
		for _, t := range contributionTypes {
			if req.Type == t {
				validType = true
				break
			}
		}
		if !validType {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error":   "Invalid type for contribution group. Valid types: emergency, medical, education, community, personal",
			})
			return
		}

		// For contribution groups, target amount is required
		if req.TargetAmount <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error":   "Target amount is required for contribution groups",
			})
			return
		}
	} else if req.Category == "chama" {
		// For chamas, contribution amount and frequency are required
		if req.ContributionAmount <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error":   "Contribution amount is required for chamas",
			})
			return
		}

		validFrequencies := []string{"weekly", "monthly", "quarterly"}
		validFreq := false
		for _, freq := range validFrequencies {
			if req.ContributionFrequency == freq {
				validFreq = true
				break
			}
		}
		if !validFreq {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error":   "Invalid contribution frequency. Valid options: weekly, monthly, quarterly",
			})
			return
		}
	}

	// Validate payment method if provided
	if req.PaymentMethod != "" {
		if req.PaymentMethod != "till" && req.PaymentMethod != "paybill" {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error":   "Payment method must be either 'till' or 'paybill'",
			})
			return
		}

		if req.PaymentMethod == "till" {
			if req.TillNumber == "" {
				c.JSON(http.StatusBadRequest, gin.H{
					"success": false,
					"error":   "Till number is required when payment method is 'till'",
				})
				return
			}
			if req.PaymentRecipientName == "" {
				c.JSON(http.StatusBadRequest, gin.H{
					"success": false,
					"error":   "Payment recipient name is required for till payments",
				})
				return
			}
		}

		if req.PaymentMethod == "paybill" {
			if req.PaybillBusinessNumber == "" {
				c.JSON(http.StatusBadRequest, gin.H{
					"success": false,
					"error":   "Paybill business number is required when payment method is 'paybill'",
				})
				return
			}
			if req.PaybillAccountNumber == "" {
				c.JSON(http.StatusBadRequest, gin.H{
					"success": false,
					"error":   "Paybill account number is required when payment method is 'paybill'",
				})
				return
			}
			if req.PaymentRecipientName == "" {
				c.JSON(http.StatusBadRequest, gin.H{
					"success": false,
					"error":   "Payment recipient name is required for paybill payments",
				})
				return
			}
		}
	}

	if req.MaxMembers < 2 || req.MaxMembers > 1000 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Max members must be between 2 and 1000",
		})
		return
	}

	// Basic sanitization - remove dangerous characters
	req.Name = sanitizeInput(req.Name)
	req.Description = sanitizeInput(req.Description)
	req.Type = sanitizeInput(req.Type)
	req.County = sanitizeInput(req.County)
	req.Town = sanitizeInput(req.Town)
	req.ContributionFrequency = sanitizeInput(req.ContributionFrequency)
	req.Rules = sanitizeInput(req.Rules)
	req.MeetingSchedule = sanitizeInput(req.MeetingSchedule)

	// Get database connection
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}
	database := db.(*sql.DB)

	// Create chama service
	chamaService := services.NewChamaService(database)

	// Convert string fields to proper types
	var description *string
	if req.Description != "" {
		description = &req.Description
	}

	var maxMembers *int
	if req.MaxMembers > 0 {
		maxMembers = &req.MaxMembers
	}

	// Parse rules from string to []string (simple split by newlines)
	var rules []string
	if req.Rules != "" {
		// For now, treat the entire string as one rule
		// In the future, you might want to parse JSON or split by delimiters
		rules = []string{req.Rules}
	}

	// Parse meeting schedule from string (for now, just store as simple schedule)
	var meetingSchedule *models.MeetingSchedule
	if req.MeetingSchedule != "" {
		meetingSchedule = &models.MeetingSchedule{
			Frequency: "monthly", // Default
			Time:      "18:00",   // Default
		}
	}

	// Handle target amount and deadline for contribution groups
	var targetAmount *float64
	var targetDeadline *time.Time

	if req.Category == "contribution" {
		if req.TargetAmount > 0 {
			targetAmount = &req.TargetAmount
		}

		if req.TargetDeadline != "" {
			if deadline, err := time.Parse("2006-01-02", req.TargetDeadline); err == nil {
				targetDeadline = &deadline
			}
		}
	}

	// Handle payment method fields
	var paymentMethod, tillNumber, paybillBusinessNumber, paybillAccountNumber, paymentRecipientName *string

	if req.PaymentMethod != "" {
		paymentMethod = &req.PaymentMethod

		if req.PaymentMethod == "till" && req.TillNumber != "" {
			tillNumber = &req.TillNumber
		}

		if req.PaymentMethod == "paybill" {
			if req.PaybillBusinessNumber != "" {
				paybillBusinessNumber = &req.PaybillBusinessNumber
			}
			if req.PaybillAccountNumber != "" {
				paybillAccountNumber = &req.PaybillAccountNumber
			}
		}

		if req.PaymentRecipientName != "" {
			paymentRecipientName = &req.PaymentRecipientName
		}
	}

	// Create chama creation model
	creation := &models.ChamaCreation{
		Name:                   req.Name,
		Description:            description,
		Category:               models.ChamaCategory(req.Category),
		Type:                   models.ChamaType(req.Type),
		County:                 req.County,
		Town:                   req.Town,
		ContributionAmount:     req.ContributionAmount,
		ContributionFrequency:  models.ContributionFrequency(req.ContributionFrequency),
		TargetAmount:           targetAmount,
		TargetDeadline:         targetDeadline,
		PaymentMethod:          paymentMethod,
		TillNumber:             tillNumber,
		PaybillBusinessNumber:  paybillBusinessNumber,
		PaybillAccountNumber:   paybillAccountNumber,
		PaymentRecipientName:   paymentRecipientName,
		MaxMembers:             maxMembers,
		IsPublic:               req.IsPublic,
		RequiresApproval:       req.RequiresApproval,
		Rules:                  rules,
		MeetingSchedule:        meetingSchedule,
		RegistrationFeePaid:    req.RegistrationFeePaid,
		MonthlySubscriptionFee: req.MonthlySubscriptionFee,
	}

	// Create the chama
	chama, err := chamaService.CreateChama(creation, userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create chama: " + err.Error(),
		})
		return
	}

	// Add additional members to the chama
	if len(req.Members) > 0 {
		for _, member := range req.Members {
			// Skip the creator (already added as chairperson)
			if member.UserID == userID.(string) {
				continue
			}

			// Add member to chama
			err := chamaService.AddMemberToChama(chama.ID, member.UserID, member.Role)
			if err != nil {
				fmt.Printf("Warning: Failed to add member %s to chama %s: %v\n", member.UserID, chama.ID, err)
				continue
			}

			if member.HasPaidRegistration {
				_, _ = database.Exec("UPDATE users SET registration_fee_paid = true, updated_at = NOW() WHERE id = $1", member.UserID)
			}

			// Update current members count
			chama.CurrentMembers++
		}

		// Update the chama's current members count in database
		err = chamaService.UpdateChamaMemberCount(chama.ID, chama.CurrentMembers)
		if err != nil {
			fmt.Printf("Warning: Failed to update member count for chama %s: %v\n", chama.ID, err)
		}
	}

	// Return success response
	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"message": "Chama created successfully",
		"data": map[string]interface{}{
			"id":                       chama.ID,
			"name":                     chama.Name,
			"description":              chama.Description,
			"category":                 chama.Category,
			"type":                     chama.Type,
			"status":                   chama.Status,
			"county":                   chama.County,
			"town":                     chama.Town,
			"contribution_amount":      chama.ContributionAmount,
			"contribution_frequency":   chama.ContributionFrequency,
			"target_amount":            chama.TargetAmount,
			"target_deadline":          chama.TargetDeadline,
			"payment_method":           chama.PaymentMethod,
			"till_number":              chama.TillNumber,
			"paybill_business_number":  chama.PaybillBusinessNumber,
			"paybill_account_number":   chama.PaybillAccountNumber,
			"payment_recipient_name":   chama.PaymentRecipientName,
			"max_members":              chama.MaxMembers,
			"current_members":          chama.CurrentMembers,
			"is_public":                chama.IsPublic,
			"requires_approval":        chama.RequiresApproval,
			"registration_fee_paid":    chama.RegistrationFeePaid,
			"monthly_subscription_fee": chama.MonthlySubscriptionFee,
			"created_by":               chama.CreatedBy,
			"created_at":               chama.CreatedAt,
		},
	})
}

func generateMockMonthlyData(average float64) []float64 {
	data := make([]float64, 12)
	for i := 0; i < 12; i++ {
		// Add some variation around the average
		variation := (float64(i%3) - 1) * 500 // -500, 0, +500 variation
		data[i] = average + variation
		if data[i] < 0 {
			data[i] = 0
		}
	}
	return data
}

func getStringValue(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func GetChama(c *gin.Context) {
	chamaID := c.Param("id")
	if chamaID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Chama ID is required",
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
	database := db.(*sql.DB)

	// Create chama service
	chamaService := services.NewChamaService(database)

	// Get chama details
	chama, err := chamaService.GetChamaByID(chamaID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Chama not found: " + err.Error(),
		})
		return
	}

	// Return chama details
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    chama,
		"message": "Chama details retrieved successfully",
	})
}

func UpdateChama(c *gin.Context) {
	// Get chama ID from URL
	chamaID := c.Param("id")
	if chamaID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Chama ID is required",
		})
		return
	}

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
	database := db.(*sql.DB)

	// Create chama service
	chamaService := services.NewChamaService(database)

	// Check if user is chairperson of this chama
	userRole, err := chamaService.GetUserRoleInChama(chamaID, userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to verify user role: " + err.Error(),
		})
		return
	}

	if userRole != "chairperson" {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "Only chairperson can update chama settings",
		})
		return
	}

	// Parse request body
	var req struct {
		Name                  *string                 `json:"name,omitempty"`
		Description           *string                 `json:"description,omitempty"`
		IsPublic              *bool                   `json:"is_public,omitempty"`
		RequiresApproval      *bool                   `json:"requires_approval,omitempty"`
		MaxMembers            *int                    `json:"max_members,omitempty"`
		ContributionAmount    *float64                `json:"contribution_amount,omitempty"`
		ContributionFrequency *string                 `json:"contribution_frequency,omitempty"`
		Rules                 *[]string               `json:"rules,omitempty"`
		MeetingSchedule       *map[string]interface{} `json:"meeting_schedule,omitempty"`
		Permissions           *map[string]bool        `json:"permissions,omitempty"`
		Notifications         *map[string]bool        `json:"notifications,omitempty"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request data: " + err.Error(),
		})
		return
	}

	// Update chama settings
	err = chamaService.UpdateChamaSettings(chamaID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to update chama settings: " + err.Error(),
		})
		return
	}

	// Get updated chama details
	updatedChama, err := chamaService.GetChamaByID(chamaID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to get updated chama details: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    updatedChama,
		"message": "Chama settings updated successfully",
	})
}

func DeleteChama(c *gin.Context) {
	// Get chama ID from URL
	chamaID := c.Param("id")
	if chamaID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Chama ID is required",
		})
		return
	}

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
	database := db.(*sql.DB)

	// Create chama service
	chamaService := services.NewChamaService(database)

	// Check if user is chairperson of this chama
	userRole, err := chamaService.GetUserRoleInChama(chamaID, userID.(string))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "You are not a member of this chama",
		})
		return
	}

	if userRole != "chairperson" {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "Only chairperson can delete the chama",
		})
		return
	}

	// Delete the chama (this will cascade delete all related data)
	err = chamaService.DeleteChama(chamaID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to delete chama: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Chama deleted successfully",
	})
}

func LeaveChama(c *gin.Context) {
	// Get chama ID from URL
	chamaID := c.Param("id")
	if chamaID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Chama ID is required",
		})
		return
	}

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
	database := db.(*sql.DB)

	// Create chama service
	chamaService := services.NewChamaService(database)

	// Check if user is a member of this chama
	userRole, err := chamaService.GetUserRoleInChama(chamaID, userID.(string))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "You are not a member of this chama",
		})
		return
	}

	// Check if user is the chairperson - chairperson cannot leave without transferring role
	if userRole == "chairperson" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Chairperson cannot leave chama. Please transfer chairperson role first or delete the chama.",
		})
		return
	}

	// Remove user from chama
	err = chamaService.RemoveUserFromChama(chamaID, userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to leave chama: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Successfully left the chama",
	})
}
