package middleware

import (
	"database/sql"
	"net/http"
	"strings"
	"vaultke-backend/internal/services"

	"github.com/gin-gonic/gin"
)

// AuthMiddleware contains the auth service for token validation
type AuthMiddleware struct {
	authService *services.AuthService
}

// NewAuthMiddleware creates a new auth middleware
func NewAuthMiddleware(authService *services.AuthService) *AuthMiddleware {
	return &AuthMiddleware{
		authService: authService,
	}
}

// AuthRequired is a middleware that checks for valid JWT token
func (m *AuthMiddleware) AuthRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get token from Authorization header
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "Authorization header required",
			})
			c.Abort()
			return
		}

		// Check if header starts with "Bearer "
		if !strings.HasPrefix(authHeader, "Bearer ") {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "Invalid authorization header format",
			})
			c.Abort()
			return
		}

		// Extract token
		token := strings.TrimPrefix(authHeader, "Bearer ")
		if token == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "Token required",
			})
			c.Abort()
			return
		}

		// Validate JWT token
		claims, err := m.authService.ValidateToken(token)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "Invalid token: " + err.Error(),
			})
			c.Abort()
			return
		}

		// STRONG: Check token version to enforce immediate session invalidation
		// when single-device policy kicks out a previous device.
		validVersion, err := m.authService.ValidateTokenVersion(claims.UserID, claims.TokenVersion)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "Session invalidated: " + err.Error(),
			})
			c.Abort()
			return
		}
		if !validVersion {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "Session expired: your account was logged in from another device",
			})
			c.Abort()
			return
		}

		// Set user information in context
		c.Set("userID", claims.UserID)
		c.Set("userRole", claims.Role)
		c.Set("userEmail", claims.Email)

		c.Next()
	}
}

// OptionalAuth is a middleware that optionally validates JWT token
func (m *AuthMiddleware) OptionalAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get token from Authorization header
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.Next()
			return
		}

		// Check if header starts with "Bearer "
		if !strings.HasPrefix(authHeader, "Bearer ") {
			c.Next()
			return
		}

		// Extract token
		token := strings.TrimPrefix(authHeader, "Bearer ")
		if token == "" {
			c.Next()
			return
		}

		// Validate JWT token
		claims, err := m.authService.ValidateToken(token)
		if err != nil {
			c.Next()
			return
		}

		// Set user information in context
		c.Set("userID", claims.UserID)
		c.Set("userRole", claims.Role)
		c.Set("userEmail", claims.Email)

		c.Next()
	}
}

// RequireRole is a middleware that checks if the user has a specific role
func (m *AuthMiddleware) RequireRole(requiredRole string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userRole := c.GetString("userRole")
		if userRole == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "User not authenticated",
			})
			c.Abort()
			return
		}

		if userRole != requiredRole {
			c.JSON(http.StatusForbidden, gin.H{
				"success": false,
				"error":   "Insufficient permissions",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// RequireChamaMembership is a middleware that ensures the user is a member of the chama
func (m *AuthMiddleware) RequireChamaMembership(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetString("userID")
		chamaID := c.Param("id")
		if chamaID == "" {
			chamaID = c.Param("chamaId")
		}

		if userID == "" || chamaID == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "Unauthorized",
			})
			c.Abort()
			return
		}

		var exists bool
		err := db.QueryRow("SELECT EXISTS(SELECT 1 FROM chama_members WHERE chama_id = $1 AND user_id = $2 AND is_active = TRUE)", chamaID, userID).Scan(&exists)
		if err != nil || !exists {
			c.JSON(http.StatusForbidden, gin.H{
				"success": false,
				"error":   "You are not a member of this chama",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// RequireChamaChatAccess is a middleware that ensures the user can access the chama chat room
func (m *AuthMiddleware) RequireChamaChatAccess(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetString("userID")
		roomID := c.Param("id")

		if userID == "" || roomID == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "Unauthorized",
			})
			c.Abort()
			return
		}

		var chamaID string
		err := db.QueryRow("SELECT chama_id FROM chat_rooms WHERE id = $1 AND type = 'chama'", roomID).Scan(&chamaID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"error":   "Chat room not found",
			})
			c.Abort()
			return
		}

		var exists bool
		err = db.QueryRow("SELECT EXISTS(SELECT 1 FROM chama_members WHERE chama_id = $1 AND user_id = $2 AND is_active = TRUE)", chamaID, userID).Scan(&exists)
		if err != nil || !exists {
			c.JSON(http.StatusForbidden, gin.H{
				"success": false,
				"error":   "You are not authorized to access this chat room",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// RequireRoles is a middleware that checks if the user has one of the specified roles
func (m *AuthMiddleware) RequireRoles(requiredRoles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userRole := c.GetString("userRole")
		if userRole == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "User not authenticated",
			})
			c.Abort()
			return
		}

		hasValidRole := false
		for _, role := range requiredRoles {
			if userRole == role {
				hasValidRole = true
				break
			}
		}

		if !hasValidRole {
			c.JSON(http.StatusForbidden, gin.H{
				"success": false,
				"error":   "Insufficient permissions",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

