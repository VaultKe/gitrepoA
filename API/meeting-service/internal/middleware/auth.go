package middleware

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/redis/go-redis/v9"
	"golang.org/x/time/rate"
)

// AuthMiddleware validates JWT tokens from the Authorization header.
// For WebSocket connections (which can't send custom headers), the token
// may also be passed as a "token" query parameter.
func AuthMiddleware(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		tokenString := ""

		if authHeader != "" {
			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || parts[0] != "Bearer" {
				fmt.Printf("[MeetingAuth] Invalid auth header format: %s\n", authHeader)
				c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid authorization header format"})
				c.Abort()
				return
			}
			tokenString = parts[1]
		} else {
			// Fallback: accept token from query parameter (for WebSocket connections)
			tokenString = c.Query("token")
			if tokenString != "" {
				fmt.Printf("[MeetingAuth] Token received via query parameter (WebSocket connection)\n")
			} else {
				fmt.Printf("[MeetingAuth] No Authorization header or token query parameter found\n")
				c.JSON(http.StatusUnauthorized, gin.H{"error": "missing authorization header or token"})
				c.Abort()
				return
			}
		}

		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return []byte(jwtSecret), nil
		})

		if err != nil {
			fmt.Printf("[MeetingAuth] Token parse error: %v\n", err)
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token: " + err.Error()})
			c.Abort()
			return
		}

		if !token.Valid {
			fmt.Printf("[MeetingAuth] Token is invalid\n")
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			c.Abort()
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			fmt.Printf("[MeetingAuth] Invalid token claims type: %T\n", token.Claims)
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token claims"})
			c.Abort()
			return
		}

		userID, ok := claims["sub"].(string)
		if !ok || userID == "" {
			fmt.Printf("[MeetingAuth] No user ID in token claims: %v\n", claims)
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid user ID in token"})
			c.Abort()
			return
		}

		userRole, ok := claims["role"].(string)
		if !ok || userRole == "" {
			userRole = "participant"
		}

		fmt.Printf("[MeetingAuth] Token valid for user: %s\n", userID)
		c.Set("userID", userID)
		c.Set("role", userRole)
		c.Next()
	}
}

// RequireHost ensures the user has host or co_host role.
func RequireHost() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, exists := c.Get("role")
		if !exists {
			role = "participant"
		}

		roleStr, ok := role.(string)
		if !ok {
			roleStr = "participant"
		}

		if roleStr != "host" && roleStr != "co_host" {
			c.JSON(http.StatusForbidden, gin.H{"error": "host or co_host role required"})
			c.Abort()
			return
		}

		c.Next()
	}
}

// RateLimitMiddleware provides per-IP rate limiting using Redis.
func RateLimitMiddleware(redisClient *redis.Client, rps int, burst int) gin.HandlerFunc {
	if redisClient == nil {
		limiter := rate.NewLimiter(rate.Limit(rps), burst)
		return func(c *gin.Context) {
			if !limiter.Allow() {
				c.JSON(http.StatusTooManyRequests, gin.H{"error": "rate limit exceeded"})
				c.Abort()
				return
			}
			c.Next()
		}
	}

	return func(c *gin.Context) {
		ip := c.ClientIP()
		key := fmt.Sprintf("rate-limit:%s:%s", c.FullPath(), ip)

		ctx := c.Request.Context()
		now := time.Now().Unix()
		windowStart := now - 1

		pipe := redisClient.Pipeline()
		pipe.ZRemRangeByScore(ctx, key, "0", fmt.Sprintf("%d", windowStart))
		pipe.ZAdd(ctx, key, redis.Z{
			Score:  float64(now),
			Member: fmt.Sprintf("%d", now),
		})
		zCardCmd := pipe.ZCard(ctx, key)
		pipe.Expire(ctx, key, 2*time.Second)

		_, err := pipe.Exec(ctx)
		if err != nil {
			c.Next()
			return
		}

		count, _ := zCardCmd.Result()
		if int(count) > burst {
			c.JSON(http.StatusTooManyRequests, gin.H{"error": "rate limit exceeded"})
			c.Abort()
			return
		}

		c.Next()
	}
}
