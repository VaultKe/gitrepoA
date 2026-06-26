package api

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"vaultke-backend/config"
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
		Name                  string  `json:"name" binding:"required" validate:"required,min=3,max=100,safe_text,no_sql_injection,no_xss"`
		Description           string  `json:"description" binding:"required" validate:"required,min=10,max=500,safe_text,no_sql_injection,no_xss"`
		Category              string  `json:"category" binding:"required" validate:"required,oneof=chama contribution"`
		Type                  string  `json:"type" binding:"required" validate:"required,alphanumeric"`
		County                string  `json:"county" binding:"required" validate:"required,min=2,max=50,alpha,no_sql_injection,no_xss"`
		Town                  string  `json:"town" binding:"required" validate:"required,min=2,max=50,alpha,no_sql_injection,no_xss"`
		ContributionAmount    float64 `json:"contribution_amount,omitempty"`
		ContributionFrequency string  `json:"contribution_frequency,omitempty"`
		TargetAmount          float64 `json:"target_amount,omitempty"`
		TargetDeadline        string  `json:"target_deadline,omitempty"`
		PaymentMethod         string  `json:"payment_method,omitempty" validate:"omitempty,oneof=till paybill"`
		TillNumber            string  `json:"till_number,omitempty"`
		PaybillBusinessNumber string  `json:"paybill_business_number,omitempty"`
		PaybillAccountNumber  string  `json:"paybill_account_number,omitempty"`
		PaymentRecipientName  string  `json:"payment_recipient_name,omitempty"`
		MaxMembers            int     `json:"max_members" binding:"required" validate:"required,min=2,max=1000"`
		IsPublic              bool    `json:"is_public"`
		RequiresApproval      bool    `json:"requires_approval"`
		Rules                 string  `json:"rules" validate:"max=1000,safe_text,no_sql_injection,no_xss"`
		MeetingSchedule       string  `json:"meeting_schedule" validate:"max=200,safe_text,no_sql_injection,no_xss"`
		RegistrationFeePaid   bool    `json:"registration_fee_paid"`
		MonthlySubscriptionFee float64 `json:"monthly_subscription_fee"`
		Members               []struct {
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
	log.Printf("🔍 Received chama creation request: %+v", req)
	log.Printf("📋 Members count: %d", len(req.Members))

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
		Name:                  req.Name,
		Description:           description,
		Category:              models.ChamaCategory(req.Category),
		Type:                  models.ChamaType(req.Type),
		County:                req.County,
		Town:                  req.Town,
		ContributionAmount:    req.ContributionAmount,
		ContributionFrequency: models.ContributionFrequency(req.ContributionFrequency),
		TargetAmount:          targetAmount,
		TargetDeadline:        targetDeadline,
		PaymentMethod:         paymentMethod,
		TillNumber:            tillNumber,
		PaybillBusinessNumber: paybillBusinessNumber,
		PaybillAccountNumber:  paybillAccountNumber,
		PaymentRecipientName:  paymentRecipientName,
		MaxMembers:            maxMembers,
		IsPublic:              req.IsPublic,
		RequiresApproval:      req.RequiresApproval,
		Rules:                 rules,
		MeetingSchedule:       meetingSchedule,
		RegistrationFeePaid:   req.RegistrationFeePaid,
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
			"id":                     chama.ID,
			"name":                   chama.Name,
			"description":            chama.Description,
			"category":               chama.Category,
			"type":                   chama.Type,
			"status":                 chama.Status,
			"county":                 chama.County,
			"town":                   chama.Town,
			"contribution_amount":    chama.ContributionAmount,
			"contribution_frequency":    chama.ContributionFrequency,
			"target_amount":             chama.TargetAmount,
			"target_deadline":           chama.TargetDeadline,
			"payment_method":            chama.PaymentMethod,
			"till_number":               chama.TillNumber,
			"paybill_business_number":   chama.PaybillBusinessNumber,
			"paybill_account_number":    chama.PaybillAccountNumber,
			"payment_recipient_name":    chama.PaymentRecipientName,
			"max_members":               chama.MaxMembers,
			"current_members":        chama.CurrentMembers,
			"is_public":              chama.IsPublic,
			"requires_approval":      chama.RequiresApproval,
			"registration_fee_paid":  chama.RegistrationFeePaid,
			"monthly_subscription_fee": chama.MonthlySubscriptionFee,
			"created_by":             chama.CreatedBy,
			"created_at":             chama.CreatedAt,
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

func GetChamaMembers(c *gin.Context) {
	chamaID := c.Param("id")
	if chamaID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Chama ID is required",
		})
		return
	}

	// Get database connection
	dbInterface, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}
	db := dbInterface.(*sql.DB)

	// Get real chama members from database with comprehensive information
	query := `
				SELECT
					cm.id, cm.chama_id, cm.user_id, cm.role, cm.joined_at, cm.is_active,
					cm.total_contributions, cm.last_contribution, cm.rating, cm.total_ratings,
					u.first_name, u.last_name, u.email, u.phone, u.avatar, u.status,
					u.is_email_verified, u.is_phone_verified, u.business_type, u.county, u.town,
					u.bio, u.occupation, u.created_at as user_created_at,
					COALESCE(w.balance, 0) as savings_balance,
					COALESCE(loan_balance.balance, 0) as loan_balance,
					COALESCE(contrib_stats.monthly_average, 0) as monthly_average,
					COALESCE(contrib_stats.consistency_rate, 0) as consistency_rate,
					COALESCE(meeting_stats.meetings_attended, 0) as meetings_attended,
					COALESCE(meeting_stats.total_meetings, 0) as total_meetings,
					COALESCE(contrib_stats.contributions_made, 0) as contributions_made,
					(SELECT COUNT(*) FROM loans WHERE borrower_id = u.id AND chama_id = $1) as loans_taken,
					(SELECT COUNT(*) FROM guarantors g INNER JOIN loans l ON g.loan_id = l.id WHERE g.user_id = u.id AND l.chama_id = $1) as guarantor_requests
				FROM chama_members cm
				INNER JOIN users u ON cm.user_id = u.id
				LEFT JOIN wallets w ON u.id = w.owner_id AND w.type = 'personal'
				LEFT JOIN (
					SELECT
						borrower_id,
						SUM(CASE WHEN status IN ('approved', 'disbursed', 'active') THEN remaining_amount ELSE 0 END) as balance
					FROM loans
					WHERE chama_id = $1
					GROUP BY borrower_id
				) loan_balance ON u.id = loan_balance.borrower_id
				LEFT JOIN (
					SELECT
						t.initiated_by,
						AVG(t.amount) as monthly_average,
						(COUNT(*) * 100.0 / 12) as consistency_rate,
						COUNT(*) as contributions_made
					FROM transactions t
					WHERE t.type = 'contribution'
					AND t.created_at >= NOW() - INTERVAL '12 months'
					GROUP BY t.initiated_by
				) contrib_stats ON u.id = contrib_stats.initiated_by
				LEFT JOIN (
					SELECT
						cm.user_id,
						COUNT(*) as meetings_attended,
						(SELECT COUNT(*) FROM meetings WHERE chama_id = $2) as total_meetings
					FROM chama_members cm
					WHERE cm.chama_id = $3
					GROUP BY cm.user_id
				) meeting_stats ON u.id = meeting_stats.user_id
				WHERE cm.chama_id = $4 AND cm.is_active = true
				ORDER BY cm.joined_at ASC
			`

			rows, err := db.Query(query, chamaID, chamaID, chamaID, chamaID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to fetch chama members: " + err.Error(),
		})
		return
	}
	defer rows.Close()

	var members []map[string]interface{}
	activeMembers := 0
	pendingMembers := 0

	for rows.Next() {
		var (
			id, chamaID, userID, role, firstName, lastName, email, phone, userStatus                        string
			joinedAt, userCreatedAt                                                                         string
			isActive, isEmailVerified, isPhoneVerified                                                      bool
			totalContributions, rating, savingsBalance, loanBalance, monthlyAverage, consistencyRate        float64
			totalRatings, meetingsAttended, totalMeetings, contributionsMade, loansTaken, guarantorRequests int
			avatar, lastContribution, businessType, county, town, bio, occupation                           *string
		)

		err := rows.Scan(
			&id, &chamaID, &userID, &role, &joinedAt, &isActive,
			&totalContributions, &lastContribution, &rating, &totalRatings,
			&firstName, &lastName, &email, &phone, &avatar, &userStatus,
			&isEmailVerified, &isPhoneVerified, &businessType, &county, &town,
			&bio, &occupation, &userCreatedAt,
			&savingsBalance, &loanBalance, &monthlyAverage, &consistencyRate,
			&meetingsAttended, &totalMeetings, &contributionsMade, &loansTaken, &guarantorRequests,
		)
		if err != nil {
			continue // Skip invalid rows
		}

		// Calculate attendance rate
		attendanceRate := 0.0
		if totalMeetings > 0 {
			attendanceRate = (float64(meetingsAttended) / float64(totalMeetings)) * 100
		}

		// Determine online status (mock for now - would need real-time tracking)
		isOnline := userStatus == "active" && (id == "user-1" || id == "user-3" || id == "user-4")

		// Calculate last contribution amount (mock for now)
		lastContributionAmount := 5000.0
		if totalContributions > 0 {
			lastContributionAmount = monthlyAverage
		}

		// Build member object with real data
		member := map[string]interface{}{
			"id":                       id,
			"user_id":                  userID,
			"chama_id":                 chamaID,
			"role":                     role,
			"joined_at":                joinedAt,
			"status":                   userStatus,
			"total_contributions":      totalContributions,
			"last_contribution_date":   lastContribution,
			"last_contribution_amount": lastContributionAmount,
			"attendance_rate":          attendanceRate,
			"loan_balance":             loanBalance,
			"savings_balance":          savingsBalance,
			"reputation_score":         rating,
			"business_type":            businessType,
			"location":                 fmt.Sprintf("%s, %s", getStringValue(town), getStringValue(county)),
			"phone_verified":           isPhoneVerified,
			"email_verified":           isEmailVerified,
			"user": map[string]interface{}{
				"id":         userID,
				"first_name": firstName,
				"last_name":  lastName,
				"email":      email,
				"phone":      phone,
				"avatar_url": avatar,
				"bio":        bio,
				"occupation": occupation,
				"created_at": userCreatedAt,
				"last_seen":  joinedAt, // Mock - would need real tracking
				"is_online":  isOnline,
			},
			"contributions_summary": map[string]interface{}{
				"total_amount":     totalContributions,
				"monthly_average":  monthlyAverage,
				"consistency_rate": consistencyRate,
				"last_12_months":   generateMockMonthlyData(monthlyAverage), // Mock historical data
			},
			"activity_summary": map[string]interface{}{
				"meetings_attended":  meetingsAttended,
				"total_meetings":     totalMeetings,
				"last_activity":      joinedAt,
				"contributions_made": contributionsMade,
				"loans_taken":        loansTaken,
				"guarantor_requests": guarantorRequests,
			},
		}

		members = append(members, member)

		// Count member statuses
		if userStatus == "active" {
			activeMembers++
		} else {
			pendingMembers++
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    members,
		"message": "Chama members retrieved successfully",
		"meta": map[string]interface{}{
			"total_members":   len(members),
			"active_members":  activeMembers,
			"pending_members": pendingMembers,
			"last_updated":    time.Now().Format(time.RFC3339),
		},
	})
}

// SendChamaInvitation sends an invitation to join a chama
func SendChamaInvitation(c *gin.Context) {
	// Add panic recovery
	defer func() {
		if r := recover(); r != nil {
			fmt.Printf("❌ [CHAMA INVITATION] Panic in SendChamaInvitation: %v\n", r)
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Internal server error during invitation sending",
			})
		}
	}()

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

	// Check if the chama exists
	_, err := chamaService.GetChamaByID(chamaID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Chama not found",
		})
		return
	}

	// Check if user has permission to invite (chairperson, secretary, treasurer)
	userRole, err := chamaService.GetUserRoleInChama(chamaID, userID.(string))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "You are not a member of this chama",
		})
		return
	}

	if !isLeadershipRole(userRole) {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "Only chairperson, secretary, and treasurer can send invitations",
		})
		return
	}

	// Parse request body
	var req struct {
		Email           string `json:"email" binding:"required,email"`
		PhoneNumber     string `json:"phone_number,omitempty"`
		Message         string `json:"message,omitempty"`
		Role            string `json:"role,omitempty"`
		RoleName        string `json:"role_name,omitempty"`
		RoleDescription string `json:"role_description,omitempty"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request data: " + err.Error(),
		})
		return
	}

	// Send invitation
	fmt.Printf("🔍 Sending chama invitation:\n")
	fmt.Printf("  - Chama ID: %s\n", chamaID)
	fmt.Printf("  - User ID: %s\n", userID.(string))
	fmt.Printf("  - Email: %s\n", req.Email)
	fmt.Printf("  - Phone: %s\n", req.PhoneNumber)
	fmt.Printf("  - Message: %s\n", req.Message)

	invitationID, err := chamaService.SendInvitation(chamaID, userID.(string), req.Email, req.PhoneNumber, req.Message, req.Role, req.RoleName, req.RoleDescription)
	if err != nil {
		fmt.Printf("❌ Chama invitation failed: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to send invitation: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Invitation sent successfully",
		"data": gin.H{
			"invitation_id": invitationID,
		},
	})
}

// RespondToInvitation handles accepting or rejecting a chama invitation
func RespondToInvitation(c *gin.Context) {
	// Get invitation ID from URL (support both old and new route formats)
	invitationID := c.Param("invitationId")
	if invitationID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invitation ID is required",
		})
		return
	}

	// Get chama ID from URL (using :id parameter to match route pattern)
	chamaID := c.Param("id")
	if chamaID != "" {
		fmt.Printf("📋 RespondToInvitation: Chama ID provided: %s\n", chamaID)
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

	// Parse request body
	var req struct {
		Response string `json:"response" binding:"required"` // "accept" or "reject"
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request data: " + err.Error(),
		})
		return
	}

	if req.Response != "accept" && req.Response != "reject" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Response must be 'accept' or 'reject'",
		})
		return
	}

	// Create chama service
	chamaService := services.NewChamaService(db.(*sql.DB))

	// Respond to invitation
	err := chamaService.RespondToInvitation(invitationID, userID.(string), req.Response)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to respond to invitation: " + err.Error(),
		})
		return
	}

	message := "Invitation rejected"
	if req.Response == "accept" {
		message = "Invitation accepted! You are now a member of the chama"
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": message,
	})
}

// GetUserInvitations gets pending invitations for a user
func GetUserInvitations(c *gin.Context) {
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

	// Get user invitations
	invitations, err := chamaService.GetUserInvitations(userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to get invitations: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    invitations,
		"count":   len(invitations),
	})
}

// GetChamaSentInvitations gets all invitations sent for a specific chama
func GetChamaSentInvitations(c *gin.Context) {
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

	// Check if user has permission to view invitations (chairperson, secretary, treasurer)
	userRole, err := chamaService.GetUserRoleInChama(chamaID, userID.(string))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "You are not a member of this chama",
		})
		return
	}

	if !isLeadershipRole(userRole) {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "Only chairperson, secretary, and treasurer can view sent invitations",
		})
		return
	}

	// Get sent invitations for this chama
	invitations, err := chamaService.GetChamaSentInvitations(chamaID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to get sent invitations: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    invitations,
		"count":   len(invitations),
	})
}

// CancelInvitation cancels a pending invitation
func CancelInvitation(c *gin.Context) {
	// Get invitation ID from URL
	invitationID := c.Param("invitationId")
	if invitationID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invitation ID is required",
		})
		return
	}

	// Get chama ID from URL (using :id parameter to match route pattern)
	chamaID := c.Param("id")
	if chamaID != "" {
		fmt.Printf("📋 CancelInvitation: Chama ID provided: %s\n", chamaID)
	}

	// Get user ID from context
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

	// Update invitation status to cancelled
	result, err := db.(*sql.DB).Exec(`
		UPDATE chama_invitations
		SET status = 'cancelled', responded_at = $1
		WHERE id = $2 AND inviter_id = $3 AND status = 'pending'
	`, time.Now(), invitationID, userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to cancel invitation: " + err.Error(),
		})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Invitation not found or cannot be cancelled",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Invitation cancelled successfully",
	})
}

// ResendInvitation resends a pending invitation
func ResendInvitation(c *gin.Context) {
	fmt.Printf("🔄 [RESEND INVITATION] ResendInvitation handler called\n")
	fmt.Printf("📝 [RESEND INVITATION] Request method: %s, URL: %s\n", c.Request.Method, c.Request.URL.Path)

	// Add panic recovery
	defer func() {
		if r := recover(); r != nil {
			fmt.Printf("❌ [RESEND INVITATION] Panic in ResendInvitation: %v\n", r)
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Internal server error during invitation resending",
			})
		}
	}()

	// Get invitation ID from URL
	invitationID := c.Param("invitationId")
	fmt.Printf("📋 [RESEND INVITATION] Invitation ID: %s\n", invitationID)
	if invitationID == "" {
		fmt.Printf("❌ [RESEND INVITATION] Invitation ID is missing\n")
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invitation ID is required",
		})
		return
	}

	// Get chama ID from URL (using :id parameter to match route pattern)
	chamaID := c.Param("id")
	if chamaID != "" {
		fmt.Printf("📋 [RESEND INVITATION] Chama ID provided: %s\n", chamaID)
	}

	// Get user ID from context
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

	// Get invitation details first
	var invitation struct {
		Email           string
		ChamaID         string
		Message         string
		InvitationToken string
	}

	err := db.(*sql.DB).QueryRow(`
			SELECT email, chama_id, message, invitation_token
			FROM chama_invitations
			WHERE id = $1 AND inviter_id = $2 AND status = 'pending'
		`, invitationID, userID.(string)).Scan(&invitation.Email, &invitation.ChamaID, &invitation.Message, &invitation.InvitationToken)

	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"error":   "Invitation not found or cannot be resent",
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to get invitation details: " + err.Error(),
			})
		}
		return
	}

	// Update invitation with new expiry date
	result, err := db.(*sql.DB).Exec(`
		UPDATE chama_invitations
		SET expires_at = $1
		WHERE id = $2 AND inviter_id = $3 AND status = 'pending'
	`, time.Now().Add(7*24*time.Hour), invitationID, userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to resend invitation: " + err.Error(),
		})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Invitation not found or cannot be resent",
		})
		return
	}

	// Create chama service and resend the email
	chamaService := services.NewChamaService(db.(*sql.DB))

	// Get chama and inviter details for email
	var chamaName, inviterFirstName, inviterLastName string
	err = db.(*sql.DB).QueryRow(`
		SELECT c.name, u.first_name, u.last_name
		FROM chamas c
		INNER JOIN users u ON u.id = $1
		WHERE c.id = $2
	`, userID.(string), invitation.ChamaID).Scan(&chamaName, &inviterFirstName, &inviterLastName)

	if err != nil {
		fmt.Printf("❌ Failed to get chama/inviter details for resend: %v\n", err)
		// Continue anyway, email sending is not critical
	} else {
		// Resend the email
		fmt.Printf("📧 Resending chama invitation email to: %s\n", invitation.Email)
		inviterFullName := fmt.Sprintf("%s %s", inviterFirstName, inviterLastName)

		// Safely attempt to send email
		func() {
			defer func() {
				if r := recover(); r != nil {
					fmt.Printf("❌ Panic during email resend: %v\n", r)
				}
			}()

			emailService := chamaService.GetEmailService()
			if emailService != nil {
				err = emailService.SendChamaInvitationEmail(
					invitation.Email,
					chamaName,
					inviterFullName,
					invitation.Message,
					invitation.InvitationToken,
				)
				if err != nil {
					fmt.Printf("❌ Failed to resend invitation email: %v\n", err)
					// Don't fail the API call if email fails
				} else {
					fmt.Printf("✅ Invitation email resent successfully to: %s\n", invitation.Email)
				}
			} else {
				fmt.Printf("❌ Email service not available for resend\n")
			}
		}()
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Invitation resent successfully",
	})
}

// GetMemberRole gets a member's role in a chama
func GetMemberRole(c *gin.Context) {
	chamaID := c.Param("id")
	memberID := c.Param("memberId")

	if chamaID == "" || memberID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Chama ID and Member ID are required",
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

	// Query member role
	query := `SELECT role FROM chama_members WHERE chama_id = $1 AND user_id = $2 AND is_active = TRUE`
	var role string
	err := db.(*sql.DB).QueryRow(query, chamaID, memberID).Scan(&role)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"error":   "Member not found in this chama",
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to get member role",
			})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"role": role,
		},
	})
}

// GetChamaMemberStatistics returns statistics for a specific chama member
func GetChamaMemberStatistics(c *gin.Context) {
	chamaID := c.Param("id")
	memberID := c.Param("memberId")

	if chamaID == "" || memberID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Chama ID and Member ID are required",
		})
		return
	}

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

	chamaService := services.NewChamaService(db.(*sql.DB))

	_, err := chamaService.GetUserRoleInChama(chamaID, userID.(string))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "You are not a member of this chama",
		})
		return
	}

	memberStats, err := chamaService.GetMemberStatistics(chamaID, memberID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to get member statistics: " + err.Error(),
		})
		return
	}

	if role, ok := memberStats["role"].(string); !ok || role == "not_member" {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Member not found in this chama",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    memberStats,
	})
}

// Helper function to check if role can send invitations
func isLeadershipRole(role string) bool {
	return role == "chairperson" || role == "secretary" || role == "treasurer"
}

// InviteToChama is an alias for SendChamaInvitation for test compatibility
func InviteToChama(c *gin.Context) {
	SendChamaInvitation(c)
}

// UpdateChamaMember updates a chama member's role or status
func UpdateChamaMember(c *gin.Context) {
	// Get chama ID and member ID from URL
	chamaID := c.Param("id")
	memberID := c.Param("memberId")
	if chamaID == "" || memberID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Chama ID and Member ID are required",
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

	// Parse request body
	var req struct {
		Role   string `json:"role"`
		Status string `json:"status"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request data: " + err.Error(),
		})
		return
	}

	// Create chama service
	chamaService := services.NewChamaService(db.(*sql.DB))

	// Check if user has permission to update members (chairperson only)
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
			"error":   "Only chairperson can update member details",
		})
		return
	}

	// Update member role if provided
	if req.Role != "" {
		err = chamaService.UpdateMemberRoleSimple(chamaID, memberID, req.Role)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to update member role: " + err.Error(),
			})
			return
		}
	}

	// Update member status if provided
	if req.Status != "" {
		err = chamaService.UpdateMemberStatus(chamaID, memberID, req.Status)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to update member status: " + err.Error(),
			})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Member updated successfully",
	})
}

// RemoveChamaMember removes a member from a chama
func RemoveChamaMember(c *gin.Context) {
	// Get chama ID and member ID from URL
	chamaID := c.Param("id")
	memberID := c.Param("memberId")
	if chamaID == "" || memberID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Chama ID and Member ID are required",
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

	// Check if user has permission to remove members (chairperson only)
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
			"error":   "Only chairperson can remove members",
		})
		return
	}

	// Remove member from chama
	err = chamaService.RemoveUserFromChama(chamaID, memberID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to remove member: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Member removed successfully",
	})
}

// GetChamaStatistics returns statistics for a chama
func GetChamaStatistics(c *gin.Context) {
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
	_, err := chamaService.GetUserRoleInChama(chamaID, userID.(string))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "You are not a member of this chama",
		})
		return
	}

	// Get chama statistics with user-specific data
	stats, err := chamaService.GetChamaStatistics(chamaID, userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to get chama statistics: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    stats,
	})
}

// GetChamaTransactions retrieves all transactions for a chama
func GetChamaTransactions(c *gin.Context) {
	// Get chama ID from URL parameter
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

	// Get query parameters
	limitStr := c.DefaultQuery("limit", "50")
	offsetStr := c.DefaultQuery("offset", "0")

	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 {
		limit = 50
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

	// Check if user is a member of this chama
	_, err = chamaService.GetUserRoleInChama(chamaID, userID.(string))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "You are not a member of this chama",
		})
		return
	}

	// Get chama transactions
	transactions, err := chamaService.GetChamaTransactions(chamaID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to get chama transactions: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    transactions,
		"count":   len(transactions),
	})
}

// GetEligibleLoanMembers retrieves members eligible for loan disbursements
func GetEligibleLoanMembers(c *gin.Context) {
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

	// Query eligible loan members (approved but not yet disbursed)
	query := `
		SELECT DISTINCT cm.user_id, u.first_name, u.last_name,
			   l.amount as approved_amount, l.status, l.created_at
		FROM chama_members cm
		INNER JOIN users u ON cm.user_id = u.id
		INNER JOIN loans l ON cm.user_id = l.borrower_id AND l.chama_id = cm.chama_id
			WHERE cm.chama_id = $1 AND cm.is_active = true
			AND l.status = 'approved'
		AND NOT EXISTS (
			SELECT 1 FROM disbursements d
			WHERE d.chama_id = cm.chama_id AND d.member_id = cm.user_id
			AND d.disbursement_type = 'loan_disbursement' AND d.status IN ('completed', 'processing')
		)
		ORDER BY l.created_at ASC
	`

	rows, err := db.(*sql.DB).Query(query, chamaID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to fetch eligible loan members",
		})
		return
	}
	defer rows.Close()

	var members []map[string]interface{}
	for rows.Next() {
		var userID, firstName, lastName, status string
		var approvedAmount float64
		var createdAt string

		err := rows.Scan(&userID, &firstName, &lastName, &approvedAmount, &status, &createdAt)
		if err != nil {
			continue
		}

		member := map[string]interface{}{
			"id":             userID,
			"name":           firstName + " " + lastName,
			"approvedAmount": approvedAmount,
			"status":         status,
			"applicationDate": createdAt,
		}
		members = append(members, member)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    members,
	})
}

// GetEligibleWelfareMembers retrieves members eligible for welfare disbursements
func GetEligibleWelfareMembers(c *gin.Context) {
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

	// Query eligible welfare members (completed contribution period)
	query := `
		SELECT DISTINCT cm.user_id, u.first_name, u.last_name,
			   COALESCE(SUM(t.amount), 0) as contribution_amount,
			   COUNT(t.id) as contribution_count,
			   MAX(t.created_at) as last_contribution
		FROM chama_members cm
		INNER JOIN users u ON cm.user_id = u.id
		LEFT JOIN transactions t ON cm.user_id = t.initiated_by AND t.type = 'contribution'
		WHERE cm.chama_id = $1 AND cm.is_active = true
		GROUP BY cm.user_id, u.first_name, u.last_name
		HAVING contribution_count >= 6  -- At least 6 months of contributions
		ORDER BY contribution_amount DESC
	`

	rows, err := db.(*sql.DB).Query(query, chamaID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to fetch eligible welfare members",
		})
		return
	}
	defer rows.Close()

	var members []map[string]interface{}
	for rows.Next() {
		var userID, firstName, lastName string
		var contributionAmount float64
		var contributionCount int
		var lastContribution sql.NullString

		err := rows.Scan(&userID, &firstName, &lastName, &contributionAmount, &contributionCount, &lastContribution)
		if err != nil {
			continue
		}

		member := map[string]interface{}{
			"id":                  userID,
			"name":                firstName + " " + lastName,
			"contributionAmount": contributionAmount,
			"contributionCount":  contributionCount,
		}
		if lastContribution.Valid {
			member["lastContribution"] = lastContribution.String
		}
		members = append(members, member)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    members,
	})
}

// GetEligibleDividendMembers retrieves members eligible for dividend disbursements
func GetEligibleDividendMembers(c *gin.Context) {
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

	// Query eligible dividend members (shareholders)
	query := `
		SELECT DISTINCT cm.user_id, u.first_name, u.last_name,
			   COALESCE(SUM(s.shares_owned), 0) as shares_owned,
			   COALESCE(SUM(s.total_value), 0) as total_value
		FROM chama_members cm
		INNER JOIN users u ON cm.user_id = u.id
		LEFT JOIN shares s ON cm.user_id = s.member_id AND s.chama_id = cm.chama_id AND s.status = 'active'
		WHERE cm.chama_id = $1 AND cm.is_active = true
		GROUP BY cm.user_id, u.first_name, u.last_name
		HAVING shares_owned > 0
		ORDER BY shares_owned DESC
	`

	rows, err := db.(*sql.DB).Query(query, chamaID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to fetch eligible dividend members",
		})
		return
	}
	defer rows.Close()

	var members []map[string]interface{}
	for rows.Next() {
		var userID, firstName, lastName string
		var sharesOwned int
		var totalValue float64

		err := rows.Scan(&userID, &firstName, &lastName, &sharesOwned, &totalValue)
		if err != nil {
			continue
		}

		member := map[string]interface{}{
			"id":           userID,
			"name":         firstName + " " + lastName,
			"sharesOwned":  sharesOwned,
			"totalValue":   totalValue,
		}
		members = append(members, member)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    members,
	})
}



// GetEligibleSavingsMembers retrieves members eligible for savings withdrawals
func GetEligibleSavingsMembers(c *gin.Context) {
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

	// Query eligible savings members (members with savings balance)
	query := `
		SELECT DISTINCT cm.user_id, u.first_name, u.last_name,
			   COALESCE(w.balance, 0) as available_savings,
			   COALESCE(SUM(t.amount), 0) as total_deposits
		FROM chama_members cm
		INNER JOIN users u ON cm.user_id = u.id
		LEFT JOIN wallets w ON u.id = w.owner_id AND w.type = 'personal'
		LEFT JOIN transactions t ON cm.user_id = t.initiated_by AND t.type = 'savings_deposit'
		WHERE cm.chama_id = $1 AND cm.is_active = true
		GROUP BY cm.user_id, u.first_name, u.last_name, w.balance
		HAVING available_savings > 0
		ORDER BY available_savings DESC
	`

	rows, err := db.(*sql.DB).Query(query, chamaID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to fetch eligible savings members",
		})
		return
	}
	defer rows.Close()

	var members []map[string]interface{}
	for rows.Next() {
		var userID, firstName, lastName string
		var availableSavings, totalDeposits float64

		err := rows.Scan(&userID, &firstName, &lastName, &availableSavings, &totalDeposits)
		if err != nil {
			continue
		}

		member := map[string]interface{}{
			"id":               userID,
			"name":             firstName + " " + lastName,
			"availableSavings": availableSavings,
			"totalDeposits":    totalDeposits,
		}
		members = append(members, member)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    members,
	})
}

// GetEligibleOtherMembers retrieves members eligible for other disbursements
func GetEligibleOtherMembers(c *gin.Context) {
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

	// Query eligible other members (active members in good standing)
	query := `
		SELECT DISTINCT cm.user_id, u.first_name, u.last_name,
			   COALESCE(SUM(t.amount), 0) as total_contributions,
			   COUNT(t.id) as contribution_count,
			   cm.joined_at
		FROM chama_members cm
		INNER JOIN users u ON cm.user_id = u.id
		LEFT JOIN transactions t ON cm.user_id = t.initiated_by AND t.type = 'contribution'
		WHERE cm.chama_id = $1 AND cm.is_active = true
		GROUP BY cm.user_id, u.first_name, u.last_name, cm.joined_at
		HAVING contribution_count >= 1  -- At least 1 contribution
		ORDER BY total_contributions DESC
	`

	rows, err := db.(*sql.DB).Query(query, chamaID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to fetch eligible other members",
		})
		return
	}
	defer rows.Close()

	var members []map[string]interface{}
	for rows.Next() {
		var userID, firstName, lastName, joinedAt string
		var totalContributions float64
		var contributionCount int

		err := rows.Scan(&userID, &firstName, &lastName, &totalContributions, &contributionCount, &joinedAt)
		if err != nil {
			continue
		}

		// Calculate eligible amount (10% of total contributions)
		eligibleAmount := totalContributions * 0.1

		member := map[string]interface{}{
			"id":                  userID,
			"name":                firstName + " " + lastName,
			"eligibleAmount":      eligibleAmount,
			"totalContributions":  totalContributions,
			"contributionCount":   contributionCount,
			"joinedAt":            joinedAt,
		}
		members = append(members, member)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    members,
	})
}

// CreateIndividualDisbursement creates an individual disbursement
func CreateIndividualDisbursement(c *gin.Context) {
	chamaID := c.Param("id")
	if chamaID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Chama ID is required",
		})
		return
	}

	// Parse request body
	var req struct {
		Type            string  `json:"type" binding:"required"`
		Category        string  `json:"category" binding:"required"`
		MemberID        string  `json:"memberId" binding:"required"`
		MemberName      string  `json:"memberName" binding:"required"`
		Amount          float64 `json:"amount" binding:"required"`
		Purpose         string  `json:"purpose" binding:"required"`
		PrivateNote     string  `json:"privateNote"`
		FromAccount     string  `json:"fromAccount" binding:"required"`
		ToAccount       string  `json:"toAccount" binding:"required"`
		RecipientID     string  `json:"recipientId" binding:"required"`
		InitiatedBy     string  `json:"initiatedBy" binding:"required"`
		InitiatedByID   string  `json:"initiatedById" binding:"required"`
		Timestamp       string  `json:"timestamp" binding:"required"`
		Status          string  `json:"status" binding:"required"`
		TransactionID   string  `json:"transactionId" binding:"required"`
		SecurityHash    string  `json:"securityHash" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request data: " + err.Error(),
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

	// Start transaction
	tx, err := db.(*sql.DB).Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to start transaction: " + err.Error(),
		})
		return
	}
	defer tx.Rollback()

	query := `
		INSERT INTO disbursements (
			id, chama_id, type, category, member_id, member_name, amount, purpose,
			private_note, from_account, to_account, initiated_by, initiated_by_id,
			timestamp, status, transaction_id, security_hash, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
	`

	disburseID := fmt.Sprintf("DISB_%d", time.Now().UnixNano())
	now := time.Now()

	recipientWalletID := fmt.Sprintf("wallet-personal-%s", req.RecipientID)

	_, err = tx.Exec(query,
		disburseID, chamaID, req.Type, req.Category, req.MemberID, req.MemberName,
		req.Amount, req.Purpose, req.PrivateNote, req.FromAccount, req.ToAccount,
		req.InitiatedBy, req.InitiatedByID, req.Timestamp, req.Status,
		req.TransactionID, req.SecurityHash, now, now,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create disbursement: " + err.Error(),
		})
		return
	}

	var currentBalance float64
	err = tx.QueryRow("SELECT balance FROM wallets WHERE id = $1", recipientWalletID).Scan(&currentBalance)
	if err == sql.ErrNoRows {
		_, err = tx.Exec(
			"INSERT INTO wallets (id, type, owner_id, balance, currency, is_active, is_locked, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
			recipientWalletID, models.WalletTypePersonal, req.RecipientID, req.Amount, "KES", true, false, now, now,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to create recipient wallet: " + err.Error(),
			})
			return
		}
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to check recipient wallet: " + err.Error(),
		})
		return
	} else {
		_, err = tx.Exec("UPDATE wallets SET balance = $1, updated_at = $2 WHERE id = $3", currentBalance+req.Amount, now, recipientWalletID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to credit recipient wallet: " + err.Error(),
			})
			return
		}
	}

	err = tx.Commit()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to commit transaction: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"message": "Individual disbursement created successfully",
		"data": gin.H{
			"id":             disburseID,
			"recipientId":    req.RecipientID,
			"creditedAmount": req.Amount,
			"walletId":       recipientWalletID,
		},
	})
}

// CreateBulkDisbursement creates a bulk disbursement (dividends)
func CreateBulkDisbursement(c *gin.Context) {
	chamaID := c.Param("id")
	if chamaID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Chama ID is required",
		})
		return
	}

	// Parse request body
	var req struct {
		Type             string                   `json:"type" binding:"required"`
		Category         string                   `json:"category" binding:"required"`
		DividendPerShare float64                  `json:"dividendPerShare" binding:"required"`
		TotalAmount      float64                  `json:"totalAmount" binding:"required"`
		Description      string                   `json:"description"`
		EligibleMembers  []map[string]interface{} `json:"eligibleMembers" binding:"required"`
		FromAccount      string                   `json:"fromAccount" binding:"required"`
		InitiatedBy      string                   `json:"initiatedBy" binding:"required"`
		InitiatedByID    string                   `json:"initiatedById" binding:"required"`
		Timestamp        string                   `json:"timestamp" binding:"required"`
		Status           string                   `json:"status" binding:"required"`
		TransactionID    string                   `json:"transactionId" binding:"required"`
		SecurityHash     string                   `json:"securityHash" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request data: " + err.Error(),
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

	// Start transaction
	tx, err := db.(*sql.DB).Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to start transaction",
		})
		return
	}
	defer tx.Rollback()

	// Insert bulk disbursement record
	bulkID := fmt.Sprintf("BULK_%d", time.Now().Unix())
	now := time.Now()

	bulkQuery := `
		INSERT INTO bulk_disbursements (
			id, chama_id, type, category, dividend_per_share, total_amount, description,
			from_account, initiated_by, initiated_by_id, timestamp, status,
			transaction_id, security_hash, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
	`

	_, err = tx.Exec(
		bulkQuery,
		bulkID, chamaID, req.Type, req.Category, req.DividendPerShare, req.TotalAmount,
		req.Description, req.FromAccount, req.InitiatedBy, req.InitiatedByID,
		req.Timestamp, req.Status, req.TransactionID, req.SecurityHash, now, now,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create bulk disbursement: " + err.Error(),
		})
		return
	}

	// Insert individual dividend records
	dividendQuery := `
		INSERT INTO dividends (
			id, bulk_disbursement_id, chama_id, member_id, member_name, shares_owned,
			dividend_per_share, amount, status, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`

	for _, member := range req.EligibleMembers {
		memberID, ok := member["id"].(string)
		if !ok {
			continue
		}
		memberName, _ := member["name"].(string)
		sharesOwned, _ := member["sharesOwned"].(float64)

	dividendID := fmt.Sprintf("DIV_%d_%s", time.Now().UnixNano(), memberID)
		amount := sharesOwned * req.DividendPerShare

		_, err = tx.Exec(
			dividendQuery,
			dividendID, bulkID, chamaID, memberID, memberName, int(sharesOwned),
			req.DividendPerShare, amount, "pending", now, now,
		)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to create dividend record: " + err.Error(),
			})
			return
		}
	}

	// Commit transaction
	err = tx.Commit()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to commit transaction",
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"message": "Bulk disbursement created successfully",
		"data": gin.H{
			"id": bulkID,
		},
	})
}





// CreateChamaChatRoom creates a chat room for a chama that doesn't have one
func CreateChamaChatRoom(c *gin.Context) {
	chamaID := c.Param("id")
	if chamaID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Chama ID is required",
		})
		return
	}

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

	chamaService := services.NewChamaService(db.(*sql.DB))

	// Check if user is a member of this chama
	userRole, err := chamaService.GetUserRoleInChama(chamaID, userID.(string))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "You are not a member of this chama",
		})
		return
	}

	if userRole != "chairperson" && userRole != "treasurer" && userRole != "secretary" {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "Only chairperson, secretary, and treasurer can create chat room",
		})
		return
	}

	// Check if chama chat room already exists
	chatService := services.NewChatService(db.(*sql.DB))
	existingRoom, _ := chatService.GetChatRoomByChamaID(chamaID)
	if existingRoom != nil {
		updateQuery := `UPDATE chamas SET chat_room_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`
		_, _ = db.(*sql.DB).Exec(updateQuery, existingRoom.ID, chamaID)
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "Chat room already exists for this chama",
			"data": map[string]interface{}{
				"roomId": existingRoom.ID,
			},
		})
		return
	}

	// Create chat room for chama
	chatRoom, err := chatService.CreateChamaChat(chamaID, userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create chat room: " + err.Error(),
		})
		return
	}

	updateQuery := `UPDATE chamas SET chat_room_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`
	_, _ = db.(*sql.DB).Exec(updateQuery, chatRoom.ID, chamaID)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Chat room created successfully",
		"data": map[string]interface{}{
			"roomId": chatRoom.ID,
		},
	})
}

// GetChamaSubscriptionPayments gets subscription payments for a chama
func GetChamaSubscriptionPayments(c *gin.Context) {
	chamaID := c.Param("id")
	log.Printf("[DEBUG BACKEND] GetChamaSubscriptionPayments called with chamaID: %s", chamaID)
	if chamaID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Chama ID is required",
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

	query := `
		SELECT id, chama_id, amount, status, due_date, paid_at, payment_method, transaction_id, month_year, created_at, updated_at
		FROM subscription_payments
		WHERE chama_id = $1
		ORDER BY due_date ASC
	`
	rows, err := database.Query(query, chamaID)
	if err != nil {
		log.Printf("[DEBUG BACKEND] Query error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to get subscription payments",
		})
		return
	}
	defer rows.Close()

	payments := []map[string]interface{}{}
	for rows.Next() {
		var rowID, rowChamaID, status, monthYear, paymentMethod, transactionID string
		var amount float64
		var dueDate, paidAt, createdAt, updatedAt time.Time

		err := rows.Scan(&rowID, &rowChamaID, &amount, &status, &dueDate, &paidAt, &paymentMethod, &transactionID, &monthYear, &createdAt, &updatedAt)
		if err != nil {
			log.Printf("[DEBUG BACKEND] Scan error: %v", err)
			continue
		}

		payment := map[string]interface{}{
			"id":          rowID,
			"chamaId":     rowChamaID,
			"amount":      amount,
			"status":      status,
			"dueDate":     dueDate,
			"paidAt":      paidAt,
			"paymentMethod": paymentMethod,
			"transactionId": transactionID,
			"monthYear":   monthYear,
			"createdAt":   createdAt,
			"updatedAt":   updatedAt,
		}
		payments = append(payments, payment)
	}
	log.Printf("[DEBUG BACKEND] Found %d subscription payments for chama %s", len(payments), chamaID)

	// If no payments exist, create a pending payment for the current/next month
	if len(payments) == 0 {
		var chamaAmount float64
		var monthlyFee *float64
		err = database.QueryRow("SELECT monthly_subscription_fee FROM chamas WHERE id = $1", chamaID).Scan(&monthlyFee)
		if err == nil && monthlyFee != nil && *monthlyFee > 0 {
			chamaAmount = *monthlyFee
		} else {
			chamaAmount = 1000
		}

		now := time.Now()
		dueDate := time.Date(now.Year(), now.Month()+1, 2, 0, 0, 0, 0, now.Location())
		if now.Day() > 2 {
			dueDate = time.Date(now.Year(), now.Month()+2, 2, 0, 0, 0, 0, now.Location())
		}
		monthYear := dueDate.Format("2006-01")
		paymentID := fmt.Sprintf("SUB_%d", time.Now().UnixNano())

		_, err = database.Exec(
			"INSERT INTO subscription_payments (id, chama_id, amount, status, due_date, month_year, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
			paymentID, chamaID, chamaAmount, "pending", dueDate, monthYear, now, now,
		)
		if err == nil {
			payments = append(payments, map[string]interface{}{
				"id":          paymentID,
				"chamaId":     chamaID,
				"amount":      chamaAmount,
				"status":      "pending",
				"dueDate":     dueDate,
				"paidAt":      nil,
				"paymentMethod": "",
				"transactionId": "",
				"monthYear":   monthYear,
				"createdAt":   now,
				"updatedAt":   now,
			})
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    payments,
	})
}

// PaySubscriptionPayment initiates STK push payment for a subscription
func PaySubscriptionPayment(c *gin.Context) {
	chamaID := c.Param("id")
	if chamaID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Chama ID is required",
		})
		return
	}

	paymentID := c.Param("paymentId")
	if paymentID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Payment ID is required",
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

	// Check user permissions - only Admin or chama members with chairperson/treasurer role can pay
	userID := c.GetString("userID")
	userRole := c.GetString("userRole")

	var memberRole string
	err := database.QueryRow(
		"SELECT role FROM chama_members WHERE chama_id = $1 AND user_id = $2 AND is_active = true",
		chamaID, userID,
	).Scan(&memberRole)

	canPay := strings.ToLower(userRole) == "admin"
	if err == nil && (memberRole == "chairperson" || memberRole == "treasurer") {
		canPay = true
	}

	if !canPay {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "Access denied - only chairperson or treasurer can initiate subscription payments",
		})
		return
	}

	var payment struct {
		Amount float64
		Status string
	}

	err = database.QueryRow(
		"SELECT amount, status FROM subscription_payments WHERE id = $1 AND chama_id = $2",
		paymentID, chamaID,
	).Scan(&payment.Amount, &payment.Status)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Payment not found",
		})
		return
	}

	if payment.Status != "pending" && payment.Status != "overdue" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Payment is not in payable status",
		})
		return
	}

	// Initiate M-Pesa STK push
	cfg, exists := c.Get("config")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Configuration not available",
		})
		return
	}

	mpesaService := services.NewMpesaService(database, cfg.(*config.Config))

	// Get chama creator/owner phone for STK push
	var creatorPhone string
	err = database.QueryRow("SELECT created_by FROM chamas WHERE id = $1", chamaID).Scan(&creatorPhone)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Chama creator not found",
		})
		return
	}

	// Get creator's user phone
	var userPhone string
	err = database.QueryRow("SELECT phone FROM users WHERE id = $1", creatorPhone).Scan(&userPhone)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "User phone number not found",
		})
		return
	}

	phoneNumber := userPhone
	if strings.HasPrefix(phoneNumber, "07") {
		phoneNumber = "254" + phoneNumber[1:]
	} else if strings.HasPrefix(phoneNumber, "+254") {
		phoneNumber = phoneNumber[1:]
	}

	mpesaReq := models.MpesaTransaction{
		PhoneNumber:      phoneNumber,
		Amount:           payment.Amount,
		AccountReference: fmt.Sprintf("SUB-%s", chamaID[:8]),
		TransactionDesc:  "Chama Monthly Subscription",
	}

	stkResponse, err := mpesaService.InitiateSTKPush(&mpesaReq)
	if err != nil {
		log.Printf("STK Push failed for subscription: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to initiate STK push: " + err.Error(),
		})
		return
	}

	updateTransactionCheckoutRequestID(database, paymentID, stkResponse.CheckoutRequestID)

	now := time.Now()
	_, err = database.Exec(
		"UPDATE subscription_payments SET status = 'paid', paid_at = $1, updated_at = $2, transaction_id = $3 WHERE id = $4",
		now, now, stkResponse.CheckoutRequestID, paymentID,
	)
	if err != nil {
		log.Printf("Error updating subscription payment: %v", err)
	}

	_, err = database.Exec(
		"UPDATE chamas SET subscription_fee_paid = true WHERE id = $1",
		chamaID,
	)
	if err != nil {
		log.Printf("Error updating chama subscription status: %v", err)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "STK push initiated successfully",
		"data": gin.H{
			"checkoutRequestId": stkResponse.CheckoutRequestID,
			"customerMessage":   stkResponse.CustomerMessage,
		},
	})
}

// GetMemberServiceFeePayments gets service fee payments for a specific member
func GetMemberServiceFeePayments(c *gin.Context) {
	chamaID := c.Param("id")
	memberID := c.Param("memberId")
	if chamaID == "" || memberID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Chama ID and Member ID are required",
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

	query := `
		SELECT sfp.id, sfp.chama_id, sfp.user_id, u.first_name, u.last_name, u.phone,
			   sfp.amount, sfp.status, sfp.due_date, sfp.paid_at, sfp.payment_method,
			   sfp.transaction_id, sfp.warning_sent, sfp.created_at, sfp.updated_at
		FROM service_fee_payments sfp
		JOIN users u ON sfp.user_id = u.id
		WHERE sfp.chama_id = $1 AND sfp.user_id = $2
		ORDER BY sfp.created_at DESC
	`
	rows, err := database.Query(query, chamaID, memberID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to get service fee payments",
		})
		return
	}
	defer rows.Close()

	var payments []map[string]interface{}
	for rows.Next() {
		var id, chamaID, userID, firstName, lastName, phone, status, paymentMethod, transactionID string
		var amount float64
		var dueDate, paidAt, createdAt, updatedAt time.Time
		var warningSent bool

		err := rows.Scan(&id, &chamaID, &userID, &firstName, &lastName, &phone,
			&amount, &status, &dueDate, &paidAt, &paymentMethod, &transactionID,
			&warningSent, &createdAt, &updatedAt)
		if err != nil {
			continue
		}

		payment := map[string]interface{}{
			"id":          id,
			"chamaId":     chamaID,
			"userId":      userID,
			"userName":    firstName + " " + lastName,
			"userPhone":   phone,
			"amount":      amount,
			"status":      status,
			"dueDate":     dueDate,
			"paidAt":      paidAt,
			"paymentMethod": paymentMethod,
			"transactionId": transactionID,
			"warningSent": warningSent,
			"createdAt":   createdAt,
			"updatedAt":   updatedAt,
		}
		payments = append(payments, payment)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    payments,
	})
}

// GetChamaServiceFeePayments gets service fee payments for members of a chama
func GetChamaServiceFeePayments(c *gin.Context) {
	chamaID := c.Param("id")
	if chamaID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Chama ID is required",
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

	query := `
		SELECT sfp.id, sfp.chama_id, sfp.user_id, u.first_name, u.last_name, u.phone,
			   sfp.amount, sfp.status, sfp.due_date, sfp.paid_at, sfp.payment_method,
			   sfp.transaction_id, sfp.warning_sent, sfp.created_at, sfp.updated_at
		FROM service_fee_payments sfp
		JOIN users u ON sfp.user_id = u.id
		WHERE sfp.chama_id = $1
		ORDER BY sfp.created_at DESC
	`
	rows, err := database.Query(query, chamaID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to get service fee payments",
		})
		return
	}
	defer rows.Close()

	var payments []map[string]interface{}
	for rows.Next() {
		var id, chamaID, userID, firstName, lastName, phone, status, paymentMethod, transactionID string
		var amount float64
		var dueDate, paidAt, createdAt, updatedAt time.Time
		var warningSent bool

		err := rows.Scan(&id, &chamaID, &userID, &firstName, &lastName, &phone,
			&amount, &status, &dueDate, &paidAt, &paymentMethod, &transactionID,
			&warningSent, &createdAt, &updatedAt)
		if err != nil {
			continue
		}

		payment := map[string]interface{}{
			"id":          id,
			"chamaId":     chamaID,
			"userId":      userID,
			"userName":    firstName + " " + lastName,
			"userPhone":   phone,
			"amount":      amount,
			"status":      status,
			"dueDate":     dueDate,
			"paidAt":      paidAt,
			"paymentMethod": paymentMethod,
			"transactionId": transactionID,
			"warningSent": warningSent,
			"createdAt":   createdAt,
			"updatedAt":   updatedAt,
		}
		payments = append(payments, payment)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    payments,
	})
}

// PayServiceFeePayment initiates STK push payment for a member's registration fee
func PayServiceFeePayment(c *gin.Context) {
	chamaID := c.Param("id")
	if chamaID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Chama ID is required",
		})
		return
	}

	paymentID := c.Param("paymentId")
	if paymentID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Payment ID is required",
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

	var payment struct {
		Amount float64
		Status string
		UserID string
	}

	err := database.QueryRow(
		"SELECT amount, status, user_id FROM service_fee_payments WHERE id = $1 AND chama_id = $2",
		paymentID, chamaID,
	).Scan(&payment.Amount, &payment.Status, &payment.UserID)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Payment not found",
		})
		return
	}

	if payment.Status != "pending" && payment.Status != "overdue" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Payment is not in payable status",
		})
		return
	}

	// Get member's phone number
	var memberPhone string
	err = database.QueryRow("SELECT phone FROM users WHERE id = $1", payment.UserID).Scan(&memberPhone)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Member phone number not found",
		})
		return
	}

	// Convert phone number to M-Pesa format
	phoneNumber := memberPhone
	if strings.HasPrefix(phoneNumber, "07") {
		phoneNumber = "254" + phoneNumber[1:]
	} else if strings.HasPrefix(phoneNumber, "+254") {
		phoneNumber = phoneNumber[1:]
	}

	// Initiate M-Pesa STK push
	cfg, exists := c.Get("config")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Configuration not available",
		})
		return
	}

	mpesaService := services.NewMpesaService(database, cfg.(*config.Config))

	mpesaReq := models.MpesaTransaction{
		PhoneNumber:      phoneNumber,
		Amount:           payment.Amount,
		AccountReference: fmt.Sprintf("REG-FEE-%s", chamaID[:8]),
		TransactionDesc:  "Chama Registration Fee",
	}

	stkResponse, err := mpesaService.InitiateSTKPush(&mpesaReq)
	if err != nil {
		log.Printf("STK Push failed for registration fee: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to initiate STK push: " + err.Error(),
		})
		return
	}

	// Update checkout request ID on payment record
	updateTransactionCheckoutRequestID(database, paymentID, stkResponse.CheckoutRequestID)

	// Mark as paid immediately (callback will confirm later)
	now := time.Now()
	_, err = database.Exec(
		"UPDATE service_fee_payments SET status = 'paid', paid_at = $1, updated_at = $2, transaction_id = $3 WHERE id = $4",
		now, now, stkResponse.CheckoutRequestID, paymentID,
	)
	if err != nil {
		log.Printf("Error updating service fee payment: %v", err)
	}

	_, err = database.Exec(
		"UPDATE chama_members SET service_fee_paid = true, service_fee_paid_at = $1, service_fee_status = 'paid' WHERE chama_id = $2 AND user_id = $3",
		now, chamaID, payment.UserID,
	)
	if err != nil {
		log.Printf("Error updating member service fee status: %v", err)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "STK push initiated successfully",
		"data": gin.H{
			"checkoutRequestId": stkResponse.CheckoutRequestID,
			"customerMessage":   stkResponse.CustomerMessage,
		},
	})
}

// PayMemberServiceFee creates a service fee record and initiates STK push for a member
func PayMemberServiceFee(c *gin.Context) {
	chamaID := c.Param("id")
	memberID := c.Param("memberId")
	log.Printf("PayMemberServiceFee called: chama=%s member=%s", chamaID, memberID)
	if chamaID == "" || memberID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Chama ID and Member ID are required",
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

	// Get member's phone number and check if already paid
	var memberPhone string
	var alreadyPaid bool
	err := database.QueryRow(
		"SELECT u.phone, cm.service_fee_paid FROM users u JOIN chama_members cm ON u.id = cm.user_id WHERE cm.user_id = $1 AND cm.chama_id = $2",
		memberID, chamaID,
	).Scan(&memberPhone, &alreadyPaid)
	log.Printf("Member query result: phone=%s alreadyPaid=%v err=%v", memberPhone, alreadyPaid, err)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Member not found",
		})
		return
	}

	if alreadyPaid {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Service fee already paid",
		})
		return
	}

	// Convert phone number to M-Pesa format
	phoneNumber := memberPhone
	if strings.HasPrefix(phoneNumber, "07") {
		phoneNumber = "254" + phoneNumber[1:]
	} else if strings.HasPrefix(phoneNumber, "+254") {
		phoneNumber = phoneNumber[1:]
	}

	// Initiate M-Pesa STK push
	cfg, exists := c.Get("config")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Configuration not available",
		})
		return
	}

	mpesaService := services.NewMpesaService(database, cfg.(*config.Config))

	paymentID := fmt.Sprintf("SFP_%d", time.Now().UnixNano())
	mpesaReq := models.MpesaTransaction{
		PhoneNumber:      phoneNumber,
		Amount:           50,
		AccountReference: fmt.Sprintf("REG-FEE-%s", chamaID[:8]),
		TransactionDesc:  "Chama Registration Fee",
	}

	stkResponse, err := mpesaService.InitiateSTKPush(&mpesaReq)
	if err != nil {
		log.Printf("STK Push failed for registration fee: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to initiate STK push: " + err.Error(),
		})
		return
	}
	log.Printf("STK Push success: checkoutRequestId=%s customerMessage=%s", stkResponse.CheckoutRequestID, stkResponse.CustomerMessage)

	now := time.Now()

	// Create service fee payment record
	_, err = database.Exec(
		"INSERT INTO service_fee_payments (id, chama_id, user_id, amount, status, due_date, transaction_id, paid_at, created_at, updated_at) VALUES ($1, $2, $3, $4, 'paid', $5, $6, $7, $8, $9)",
		paymentID, chamaID, memberID, 50, now, stkResponse.CheckoutRequestID, now, now, now,
	)
	if err != nil {
		log.Printf("Error creating service fee payment: %v", err)
	}

	// Update member status
	_, err = database.Exec(
		"UPDATE chama_members SET service_fee_paid = true, service_fee_paid_at = $1, service_fee_status = 'paid' WHERE chama_id = $2 AND user_id = $3",
		now, chamaID, memberID,
	)
	if err != nil {
		log.Printf("Error updating member service fee status: %v", err)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "STK push initiated successfully",
		"data": gin.H{
			"checkoutRequestId": stkResponse.CheckoutRequestID,
			"customerMessage":   stkResponse.CustomerMessage,
		},
	})
}
