package api

import (
	"database/sql"
	"fmt"
	"net/http"
	"time"

	"vaultke-backend/internal/services"

	"github.com/gin-gonic/gin"
)

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
