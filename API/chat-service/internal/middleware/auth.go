package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

func AuthMiddleware(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetHeader("X-User-ID")
		if userID != "" {
			c.Set("userID", userID)
			c.Next()
			return
		}

		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing authorization header"})
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenString == authHeader {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid authorization format"})
			return
		}

		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			return []byte(jwtSecret), nil
		})

		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid claims"})
			return
		}

		uid, _ := claims["userId"].(string)
		email, _ := claims["email"].(string)
		role, _ := claims["role"].(string)

		if uid == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "user_id not in token"})
			return
		}

		c.Set("userID", uid)
		c.Set("email", email)
		c.Set("role", role)
		c.Next()
	}
}

func RequireRoomMember(getRoomFunc func(roomID, userID string) bool) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("userID")
		if !exists {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
			return
		}

		roomID := c.Param("roomId")
		if roomID == "" {
			roomID = c.Query("roomId")
		}

		if roomID == "" {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "room_id required"})
			return
		}

		if !getRoomFunc(roomID, userID.(string)) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "not a room member"})
			return
		}

		c.Next()
	}
}