package api

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"vaultke-backend/internal/models"
	"vaultke-backend/internal/services"

	"github.com/gin-gonic/gin"
)

// CreateChamaRequest is the request body for creating a chama. It supports both
// JSON and multipart/form-data (for rules file uploads).
type CreateChamaRequest struct {
	Name                   string   `json:"name" binding:"required" validate:"required,min=3,max=100,safe_text,no_sql_injection,no_xss"`
	Description            string   `json:"description" binding:"required" validate:"required,min=10,max=500,safe_text,no_sql_injection,no_xss"`
	Category               string   `json:"category" binding:"required" validate:"required,oneof=chama contribution"`
	Type                   string   `json:"type" binding:"required" validate:"required,alphanumeric"`
	County                 string   `json:"county" binding:"required" validate:"required,min=2,max=50,alpha,no_sql_injection,no_xss"`
	Town                   string   `json:"town" binding:"required" validate:"required,min=2,max=50,alpha,no_sql_injection,no_xss"`
	ContributionAmount     float64  `json:"contribution_amount,omitempty"`
	ContributionFrequency  string   `json:"contribution_frequency,omitempty"`
	TargetAmount           float64  `json:"target_amount,omitempty"`
	TargetDeadline         string   `json:"target_deadline,omitempty"`
	MaxMembers             int      `json:"max_members" binding:"required" validate:"required,min=2,max=1000"`
	IsPublic               bool     `json:"is_public"`
	RequiresApproval       bool     `json:"requires_approval"`
	Rules                  string   `json:"rules" validate:"max=1000,safe_text,no_sql_injection,no_xss"`
	MeetingSchedule        string   `json:"meeting_schedule" validate:"max=200,safe_text,no_sql_injection,no_xss"`
	RegistrationFeePaid    bool     `json:"registration_fee_paid"`
	MonthlySubscriptionFee float64  `json:"monthly_subscription_fee"`
	WalletTypes            []string `json:"wallet_types,omitempty"`
	Members                []struct {
		UserID              string `json:"user_id"`
		Role                string `json:"role"`
		Status              string `json:"status"`
		HasPaidRegistration bool   `json:"has_paid_registration,omitempty"`
		PhoneVerified       bool   `json:"phone_verified,omitempty"`
	} `json:"members,omitempty"`
}

func CreateChama(c *gin.Context) {
	userID, ok := requireUserID(c)
	if !ok {
		return
	}

	var req CreateChamaRequest

	if strings.HasPrefix(c.ContentType(), "multipart/form-data") {
		c.Request.ParseMultipartForm(10 << 20) // 10 MB max memory
		req.Name = c.PostForm("name")
		req.Description = c.PostForm("description")
		req.Category = c.PostForm("category")
		req.Type = c.PostForm("type")
		req.County = c.PostForm("county")
		req.Town = c.PostForm("town")
		req.ContributionFrequency = c.PostForm("contribution_frequency")
		req.Rules = c.PostForm("rules")
		req.MeetingSchedule = c.PostForm("meeting_schedule")
		req.RegistrationFeePaid = c.PostForm("registration_fee_paid") == "true"
		req.MonthlySubscriptionFee, _ = strconv.ParseFloat(c.PostForm("monthly_subscription_fee"), 64)
		req.ContributionAmount, _ = strconv.ParseFloat(c.PostForm("contribution_amount"), 64)
		req.TargetAmount, _ = strconv.ParseFloat(c.PostForm("target_amount"), 64)
		req.MaxMembers, _ = strconv.Atoi(c.PostForm("max_members"))
		req.IsPublic = c.PostForm("is_public") == "true"
		req.RequiresApproval = c.PostForm("requires_approval") == "true"
		req.WalletTypes = c.PostFormArray("wallet_types")
		if membersStr := c.PostForm("members"); membersStr != "" {
			json.Unmarshal([]byte(membersStr), &req.Members)
		}
	} else {
		if err := c.ShouldBindJSON(&req); err != nil {
			log.Printf("JSON binding failed: %v", err)
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error":   "Invalid request data: " + err.Error(),
			})
			return
		}
	}

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

	if req.Category != "chama" && req.Category != "contribution" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Category must be either 'chama' or 'contribution'",
		})
		return
	}

	validType := false
	if req.Category == "chama" {
		for _, t := range []string{"investment", "savings", "business", "welfare", "merry-go-round"} {
			if req.Type == t {
				validType = true
				break
			}
		}
	} else {
		for _, t := range []string{"emergency", "medical", "education", "community", "personal"} {
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
	}

	if !validType {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid type for chama. Valid types: investment, savings, business, welfare, merry-go-round",
		})
		return
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

	database := dbFromContext(c)
	if database == nil {
		return
	}

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
		} else {
			log.Printf("Invalid target deadline format: %s", req.TargetDeadline)
		}
	}

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
		MaxMembers:             maxMembers,
		IsPublic:               req.IsPublic,
		RequiresApproval:       req.RequiresApproval,
		Rules:                  rules,
		MeetingSchedule:        meetingSchedule,
		RegistrationFeePaid:    req.RegistrationFeePaid,
		MonthlySubscriptionFee: req.MonthlySubscriptionFee,
		WalletTypes:            req.WalletTypes,
	}

	chama, err := chamaService.CreateChama(creation, userID)
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
			if member.UserID == userID {
				continue
			}

			if err := chamaService.AddMemberToChama(chama.ID, member.UserID, member.Role); err != nil {
				fmt.Printf("Warning: Failed to add member %s to chama %s: %v\n", member.UserID, chama.ID, err)
				continue
			}

			if member.HasPaidRegistration {
				_, _ = database.Exec("UPDATE users SET registration_fee_paid = true, updated_at = NOW() WHERE id = $1", member.UserID)
			}

			chama.CurrentMembers++
		}

		if err := chamaService.UpdateChamaMemberCount(chama.ID, chama.CurrentMembers); err != nil {
			fmt.Printf("Warning: Failed to update member count for chama %s: %v\n", chama.ID, err)
		}
	}

	// Handle rules file upload if present
	var rulesFileURL string
	if strings.HasPrefix(c.ContentType(), "multipart/form-data") {
		file, err := c.FormFile("rules_file")
		if err == nil && file != nil {
			uploadDir := "./uploads/chamas/rules"
			if err := os.MkdirAll(uploadDir, 0o755); err == nil {
				cleanName := strings.NewReplacer(" ", "_", "/", "_", "\\", "_").Replace(file.Filename)
				fileName := fmt.Sprintf("%s_%s", chama.ID, cleanName)
				filePath := filepath.Join(uploadDir, fileName)

				if err := c.SaveUploadedFile(file, filePath); err == nil {
					rulesFileURL = fmt.Sprintf("/uploads/chamas/rules/%s", fileName)
					log.Printf("Rules file uploaded for chama %s -> %s", chama.ID, rulesFileURL)
				} else {
					log.Printf("Failed to save rules file for chama %s: %v", chama.ID, err)
				}
			}
		} else {
			log.Printf("No 'rules_file' part found in multipart request for chama %s (err=%v)", chama.ID, err)
		}
	}

	if rulesFileURL != "" {
		permissions := map[string]interface{}{
			"allowMerryGoRound": true,
			"allowWelfare":      true,
			"activeWalletTypes": req.WalletTypes,
		}
		if len(req.WalletTypes) == 0 {
			switch req.Type {
			case string(models.ChamaTypeMerryGoRound):
				permissions["activeWalletTypes"] = []string{"merry-go-round"}
			case string(models.ChamaTypeWelfare):
				permissions["activeWalletTypes"] = []string{"welfare"}
			case string(models.ChamaTypeSavings):
				permissions["activeWalletTypes"] = []string{"savings"}
			case string(models.ChamaTypeBusiness):
				permissions["activeWalletTypes"] = []string{"savings", "loans"}
			case string(models.ChamaTypeInvestment):
				permissions["activeWalletTypes"] = []string{"savings", "shares", "dividends"}
			}
		}
		permissions["rules_file_path"] = rulesFileURL
		permissions["rules_file_name"] = c.PostForm("rules_file_name")
		permissionsJSON, _ := json.Marshal(permissions)
		_, _ = database.Exec("UPDATE chamas SET permissions = $1, updated_at = NOW() WHERE id = $2", permissionsJSON, chama.ID)

		rulesFileName := c.PostForm("rules_file_name")
		if rulesFileName == "" {
			rulesFileName = filepath.Base(rulesFileURL)
		}
		_, _ = database.Exec("UPDATE chamas SET rules_file_path = $1, rules_file_name = $2, updated_at = NOW() WHERE id = $3", rulesFileURL, rulesFileName, chama.ID)
	}

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
			"max_members":              chama.MaxMembers,
			"current_members":          chama.CurrentMembers,
			"is_public":                chama.IsPublic,
			"requires_approval":        chama.RequiresApproval,
			"registration_fee_paid":    chama.RegistrationFeePaid,
			"monthly_subscription_fee": chama.MonthlySubscriptionFee,
			"created_by":               chama.CreatedBy,
			"created_at":               chama.CreatedAt,
			"rules_file_path":          rulesFileURL,
			"rules_file_name":          c.PostForm("rules_file_name"),
		},
	})
}
