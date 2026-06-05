package middleware

import (
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"vaultke-backend/config"
)

// Custom response writer to ensure CORS headers on all responses including redirects
type corsResponseWriter struct {
	gin.ResponseWriter
	origin string
}

func (w *corsResponseWriter) WriteHeader(code int) {
	w.Header().Set("Access-Control-Allow-Origin", w.origin)
	w.Header().Set("Access-Control-Allow-Credentials", "false")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, X-CSRF-Token, X-File-Name, X-File-Size, X-Timezone, X-Language, X-Screen-Resolution, X-Device-Type, X-Device-Name, X-Browser-Name, X-OS-Name, X-Connection-Type")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")
	w.Header().Set("Access-Control-Expose-Headers", "Content-Length, Authorization, Content-Disposition")
	w.Header().Set("Access-Control-Max-Age", "86400")

	// For redirects (3xx status codes), ensure proper handling
	if code >= 300 && code < 400 {
		// log.Printf("🔒 CORS: Handling redirect response (status: %d) with CORS headers", code)
	}

	w.ResponseWriter.WriteHeader(code)
}

// CORSMiddleware applies smart CORS handling for localhost and production URLs
func CORSMiddleware(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		// method := c.Request.Method
		path := c.Request.URL.Path

		// Define allowed origins for different environments
		allowedOrigins := []string{
			"https://gitrepoa-1.onrender.com", // your backend domain
			"http://localhost:8081",           // Metro / Expo
			"https://localhost",              // Metro / Expo
			"https://127.0.0.1:8081",
			"http://localhost:8085",
			"http://localhost:3000",       // Web development
			"http://127.0.0.1:3000",       // Web development
			"https://vault-better1.vercel.app",
			"http://localhost:19006", // Expo web preview
			"http://127.0.0.1:19006",
		}

		// Check if origin is allowed - be restrictive in production
		allowedOrigin := ""
		if origin != "" {
			for _, allowed := range allowedOrigins {
				if origin == allowed {
					allowedOrigin = origin
					break
				}
			}
		}

		// In development, allow all origins; in production only allow specific ones
		if cfg.Environment != "production" {
			if origin == "" || origin == "null" {
				allowedOrigin = "*"
			} else {
				allowedOrigin = origin
			}
		} else if origin == "" || origin == "null" {
			allowedOrigin = "*"
		}

		// If origin is not in the allowed list (production), forbid the request
		if cfg.Environment == "production" && allowedOrigin == "" {
			log.Printf("🚫 CORS: Origin '%s' not allowed", origin)
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error": "Origin not allowed",
			})
			return
		}

		
		// Replace response writer with CORS-enabled one
		c.Writer = &corsResponseWriter{
			ResponseWriter: c.Writer,
			origin:         allowedOrigin,
		}

		// Handle preflight OPTIONS requests
		if c.Request.Method == "OPTIONS" {
			// log.Printf("🔒 CORS: Handling OPTIONS preflight for %s", path)
			c.Header("Access-Control-Allow-Origin", allowedOrigin)
			c.Header("Access-Control-Allow-Credentials", "false")
			c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, X-CSRF-Token, X-File-Name, X-File-Size, X-Timezone, X-Language, X-Screen-Resolution, X-Device-Type, X-Device-Name, X-Browser-Name, X-OS-Name, X-Connection-Type")
			c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")
			c.Header("Access-Control-Expose-Headers", "Content-Length, Authorization, Content-Disposition")
			c.Header("Access-Control-Max-Age", "86400")
			c.AbortWithStatus(204)
			return
		}

		// For POST requests to /api/v1/chamas, ensure no redirects
		if c.Request.Method == "POST" && strings.HasPrefix(path, "/api/v1/chamas") && !strings.HasSuffix(path, "/") {
			// log.Printf("🔒 CORS: Ensuring no redirect for POST /api/v1/chamas")
		}

		c.Next()
	}
}
