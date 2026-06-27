package api

import (
	"database/sql"
	"fmt"
	"net/http"

	"vaultke-backend/internal/services"

	"github.com/gin-gonic/gin"
)

// Helper functions for safe metadata extraction
func getStringFromMeta(meta map[string]interface{}, key, defaultValue string) string {
	if val, exists := meta[key]; exists {
		if str, ok := val.(string); ok {
			return str
		}
	}
	return defaultValue
}

func getFloatFromMeta(meta map[string]interface{}, key string, defaultValue float64) float64 {
	if val, exists := meta[key]; exists {
		if flt, ok := val.(float64); ok {
			return flt
		}
	}
	return defaultValue
}

// GetChatRooms retrieves chat rooms for the authenticated user (OPTIMIZED)
func GetChatRooms(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	// fmt.Printf("🔍 GetChatRooms: Starting request for user %s\n", userID)

	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}

	// Use the proper chat service with timeout protection
	chatService := services.NewChatService(db.(*sql.DB))

	rooms, err := chatService.GetUserChatRooms(userID)
	if err != nil {
		fmt.Printf("❌ GetChatRooms: Failed for user %s: %v\n", userID, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to retrieve chat rooms: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    rooms,
	})
}

// CreateChatRoom creates a new chat room
func CreateChatRoom(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	var req struct {
		Type        string                 `json:"type" binding:"required"`
		Name        string                 `json:"name"`
		ChamaID     string                 `json:"chamaId"`
		UserIDs     []string               `json:"userIds"`
		RecipientID string                 `json:"recipientId"`
		Context     map[string]interface{} `json:"context"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		fmt.Printf("❌ Failed to bind JSON in CreateChatRoom: %v\n", err)
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

	chatService := services.NewChatService(db.(*sql.DB))

	switch req.Type {
	case "private":
		if req.RecipientID == "" {
			fmt.Printf("❌ Missing RecipientID for private chat\n")
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error":   "Recipient ID required for private chat",
			})
			return
		}


		// Create or get existing private chat room
		room, err := chatService.CreatePrivateChat(userID, req.RecipientID)
		if err != nil {
			fmt.Printf("❌ Failed to create private chat: %v\n", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to create private chat: " + err.Error(),
			})
			return
		}


		// If context is provided (e.g., product inquiry), send an initial message
		if req.Context != nil {
			if productID, exists := req.Context["productId"]; exists {
				if productName, nameExists := req.Context["productName"]; nameExists {
					// Send initial context message about the product
					contextMessage := fmt.Sprintf("Hi! I'm interested in your product: %s", productName)
					metadata := map[string]interface{}{
						"type":      "product_inquiry",
						"productId": productID,
					}

					_, err := chatService.SendMessage(room.ID, userID, services.MessageTypeText, contextMessage, metadata, nil)
					if err != nil {
						// Log error but don't fail the chat creation
						fmt.Printf("Failed to send initial product inquiry message: %v\n", err)
					}
				}
			}
		}

		c.JSON(http.StatusCreated, gin.H{
			"success": true,
			"data":    room,
		})
		return

	case "chama":
		if req.ChamaID == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error":   "Chama ID required for chama chat",
			})
			return
		}

		// Create chama chat room
		room, err := chatService.CreateChamaChat(req.ChamaID, userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to create chama chat: " + err.Error(),
			})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"success": true,
			"data":    room,
		})
		return

	case "support":
		// For support chats, we need a user ID (the user who needs support)
		supportUserID := req.RecipientID
		if supportUserID == "" && len(req.UserIDs) > 0 {
			// Try to get it from the UserID field if RecipientID is not provided
			supportUserID = req.UserIDs[0]
		}

		// Check if we have a userId in the request body
		if supportUserID == "" {
			if userIDFromBody, ok := req.Context["userId"].(string); ok {
				supportUserID = userIDFromBody
			}
		}

		if supportUserID == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error":   "User ID required for support chat",
			})
			return
		}


		// Create support chat room (similar to private chat but allows admin to chat with user)
		room, err := chatService.CreateSupportChat(userID, supportUserID, req.Context)
		if err != nil {
			fmt.Printf("❌ Failed to create support chat: %v\n", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to create support chat: " + err.Error(),
			})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"success": true,
			"data":    room,
		})
		return

	default:
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid chat room type",
		})
		return
	}
}

// GetChatRoom retrieves a specific chat room
func GetChatRoom(c *gin.Context) {
	userID := c.GetString("userID")
	roomID := c.Param("id")

	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	// For now, return a simple response
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"id":     roomID,
			"name":   "Chat Room",
			"type":   "private",
			"userId": userID,
		},
	})
}

// JoinChatRoom allows a user to join a chat room
func JoinChatRoom(c *gin.Context) {
	userID := c.GetString("userID")
	roomID := c.Param("id")

	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	if roomID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Room ID is required",
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

	chatService := services.NewChatService(db.(*sql.DB))

	// Check if user is already a member
	isMember, err := chatService.IsUserMemberOfRoom(roomID, userID)
	if err != nil {
		fmt.Printf("❌ JoinChatRoom: Error checking membership for user %s in room %s: %v\n", userID, roomID, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to check room membership: " + err.Error(),
		})
		return
	}

	if isMember {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "User is already a member of this room",
		})
		return
	}

	// Add user to room
	err = chatService.AddUserToRoom(roomID, userID)
	if err != nil {
		fmt.Printf("❌ JoinChatRoom: Failed to add user %s to room %s: %v\n", userID, roomID, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to join room: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Successfully joined room",
	})
}

// GetChatRoomMembers retrieves members of a chat room
func GetChatRoomMembers(c *gin.Context) {
	userID := c.GetString("userID")
	roomID := c.Param("id")

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

	chatService := services.NewChatService(db.(*sql.DB))
	members, err := chatService.GetRoomMembers(roomID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to retrieve room members: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    members,
	})
}

// DeleteChatRoom deletes a chat room for the user
func DeleteChatRoom(c *gin.Context) {
	userID := c.GetString("userID")
	roomID := c.Param("id")

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

	chatService := services.NewChatService(db.(*sql.DB))
	err := chatService.DeleteChatRoom(roomID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to delete chat room: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Chat room deleted successfully",
	})
}

// ClearChatRoom clears all messages in a chat room for the user
func ClearChatRoom(c *gin.Context) {
	userID := c.GetString("userID")
	roomID := c.Param("id")

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

	chatService := services.NewChatService(db.(*sql.DB))
	err := chatService.ClearChatRoom(roomID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to clear chat room: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Chat room cleared successfully",
	})
}
