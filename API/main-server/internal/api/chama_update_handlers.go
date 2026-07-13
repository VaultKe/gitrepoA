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

	"github.com/gin-gonic/gin"
)

// UpdateChamaRequest holds the (all-optional) fields that may be updated.
type UpdateChamaRequest struct {
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
	WalletTypes           []string                `json:"wallet_types,omitempty"`
	RulesFilePath         *string                 `json:"rules_file_path,omitempty"`
	RulesFileName         *string                 `json:"rules_file_name,omitempty"`
	Status                *string                 `json:"status,omitempty"`
}

func UpdateChama(c *gin.Context) {
	chamaID, ok := requireParam(c, "id", "Chama ID is required")
	if !ok {
		return
	}

	userID, ok := requireUserID(c)
	if !ok {
		return
	}

	chamaService := chamaServiceFromContext(c)
	if chamaService == nil {
		return
	}

	// Only the chairperson can update chama settings
	userRole, err := chamaService.GetUserRoleInChama(chamaID, userID)
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

	var req UpdateChamaRequest

	// Handle optional rules file upload via multipart/form-data
	var rulesFileURL string
	if strings.Contains(strings.ToLower(c.ContentType()), "multipart/form-data") {
		if perr := c.Request.ParseMultipartForm(10 << 20); perr != nil {
			log.Printf("Failed to parse multipart form for chama %s: %v", chamaID, perr)
		}
		if file, ferr := c.FormFile("rules_file"); ferr == nil && file != nil {
			uploadDir := "./uploads/chamas/rules"
			if mkErr := os.MkdirAll(uploadDir, 0o755); mkErr == nil {
				cleanName := strings.NewReplacer(" ", "_", "/", "_", "\\", "_").Replace(file.Filename)
				fileName := fmt.Sprintf("%s_%s", chamaID, cleanName)
				filePath := filepath.Join(uploadDir, fileName)
				if saveErr := c.SaveUploadedFile(file, filePath); saveErr == nil {
					rulesFileURL = fmt.Sprintf("/uploads/chamas/rules/%s", fileName)
					log.Printf("Rules file uploaded (update) for chama %s -> %s", chamaID, rulesFileURL)
				} else {
					log.Printf("Failed to save rules file (update) for chama %s: %v", chamaID, saveErr)
				}
			}
		}
		if v := c.PostForm("name"); v != "" {
			req.Name = &v
		}
		if v := c.PostForm("description"); v != "" {
			req.Description = &v
		}
		if v := c.PostForm("is_public"); v != "" {
			b := v == "true"
			req.IsPublic = &b
		}
		if v := c.PostForm("requires_approval"); v != "" {
			b := v == "true"
			req.RequiresApproval = &b
		}
		if v := c.PostForm("max_members"); v != "" {
			if n, aerr := strconv.Atoi(v); aerr == nil {
				req.MaxMembers = &n
			}
		}
		if v := c.PostForm("contribution_amount"); v != "" {
			if f, ferr := strconv.ParseFloat(v, 64); ferr == nil {
				req.ContributionAmount = &f
			}
		}
		if v := c.PostForm("contribution_frequency"); v != "" {
			req.ContributionFrequency = &v
		}
		if v := c.PostForm("wallet_types"); v != "" {
			_ = json.Unmarshal([]byte(v), &req.WalletTypes)
		}
	} else {
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error":   "Invalid request data: " + err.Error(),
			})
			return
		}
	}

	updateMap := make(map[string]interface{})

	if req.Name != nil {
		updateMap["name"] = *req.Name
	}
	if req.Description != nil {
		updateMap["description"] = *req.Description
	}
	if req.IsPublic != nil {
		updateMap["is_public"] = *req.IsPublic
	}
	if req.RequiresApproval != nil {
		updateMap["requires_approval"] = *req.RequiresApproval
	}
	if req.MaxMembers != nil {
		updateMap["max_members"] = *req.MaxMembers
	}
	if req.ContributionAmount != nil {
		updateMap["contribution_amount"] = *req.ContributionAmount
	}
	if req.ContributionFrequency != nil {
		updateMap["contribution_frequency"] = *req.ContributionFrequency
	}
	if req.Rules != nil {
		updateMap["rules"] = *req.Rules
	}
	if req.MeetingSchedule != nil {
		updateMap["meeting_schedule"] = *req.MeetingSchedule
	}
	if req.Permissions != nil {
		updateMap["permissions"] = *req.Permissions
	}
	if req.Notifications != nil {
		updateMap["notifications"] = *req.Notifications
	}
	if len(req.WalletTypes) > 0 {
		updateMap["wallet_types"] = req.WalletTypes
	}
	if req.RulesFilePath != nil {
		updateMap["rules_file_path"] = *req.RulesFilePath
	}
	if req.RulesFileName != nil {
		updateMap["rules_file_name"] = *req.RulesFileName
	}
	if req.Status != nil {
		updateMap["status"] = *req.Status
	}

	// Rules file uploaded via multipart
	if rulesFileURL != "" {
		rulesFileName := c.PostForm("rules_file_name")
		if rulesFileName == "" {
			rulesFileName = filepath.Base(rulesFileURL)
		}
		updateMap["rules_file_path"] = rulesFileURL
		updateMap["rules_file_name"] = rulesFileName
	}

	// Guard against empty updates (e.g. request body had no parsable fields)
	if len(updateMap) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "No updatable fields provided. Ensure the request includes valid JSON fields or a multipart 'rules_file'",
		})
		return
	}

	if err := chamaService.UpdateChamaSettings(chamaID, updateMap); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to update chama settings: " + err.Error(),
		})
		return
	}

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
