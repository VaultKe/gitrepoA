package middleware

import (
	"log"
	"net/http"
	"strings"

	"vaultke-backend/config"

	"github.com/gin-gonic/gin"
)

const corsAllowHeaders = "Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, X-CSRF-Token, X-File-Name, X-File-Size, X-Timezone, X-Language, X-Screen-Resolution, X-Device-Type, X-Device-Name, X-Browser-Name, X-OS-Name, X-Connection-Type"

const corsExposeHeaders = "Content-Length, Authorization, Content-Disposition"

const corsAllowMethods = "GET, POST, PUT, DELETE, OPTIONS, PATCH"

const corsMaxAge = "86400"

// central helper (single source of truth)
func setCORSHeaders(h http.Header, origin string) {
	h.Set("Access-Control-Allow-Origin", origin)
	h.Set("Access-Control-Allow-Credentials", "false")
	h.Set("Access-Control-Allow-Headers", corsAllowHeaders)
	h.Set("Access-Control-Allow-Methods", corsAllowMethods)
	h.Set("Access-Control-Expose-Headers", corsExposeHeaders)
	h.Set("Access-Control-Max-Age", corsMaxAge)
}

// Custom response writer ensures CORS on ALL responses (including redirects)
type corsResponseWriter struct {
	gin.ResponseWriter
	origin string
}

func (w *corsResponseWriter) WriteHeader(code int) {
	setCORSHeaders(w.Header(), w.origin)

	// For redirects (3xx), keep hook for future debugging if needed
	if code >= 300 && code < 400 {
		// log.Printf("🔒 CORS: Redirect response (status: %d)", code)
	}

	w.ResponseWriter.WriteHeader(code)
}

func (w *corsResponseWriter) Write(data []byte) (int, error) {
	// Ensure headers are set even if Write is called without WriteHeader
	if w.Header().Get("Access-Control-Allow-Origin") == "" {
		setCORSHeaders(w.Header(), w.origin)
	}
	return w.ResponseWriter.Write(data)
}

// CORSMiddleware applies strict CORS handling
func CORSMiddleware(cfg *config.Config) gin.HandlerFunc {
	allowedOrigins := make(map[string]struct{})
	for _, origin := range cfg.AllowedOrigins {
		allowedOrigins[origin] = struct{}{}
	}

	// Default fallback origins for development when none configured
	defaultOrigins := []string{
		"https://gitrepoa-1.onrender.com",
		"http://localhost:8081",
		"https://localhost",
		"https://127.0.0.1:8081",
		"http://localhost:8085",
		"http://localhost:3000",
		"http://127.0.0.1:3000",
		"https://vault-better1.vercel.app",
		"http://localhost:19006",
		"http://127.0.0.1:19006",
	}
	if len(allowedOrigins) == 0 {
		for _, origin := range defaultOrigins {
			allowedOrigins[origin] = struct{}{}
		}
	}

	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		path := c.Request.URL.Path

		var allowedOrigin string

		// Handle requests with missing or null origin (mobile apps, curl, etc.)
		if origin == "" || origin == "null" {
			// For API requests without Origin, allow with wildcard or use first available origin
			// This enables mobile app access while still logging
			log.Printf("ℹ️ CORS: Request without Origin header (likely mobile client)")
			// Allow the request to proceed - don't abort
			allowedOrigin = "*"
		} else if cfg.AllowAllOrigins {
			// When ALLOW_ALL_ORIGINS is true, echo back the requesting origin
			allowedOrigin = origin
		} else if _, allowed := allowedOrigins[origin]; !allowed {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error": "Origin not allowed",
			})
			return
		} else {
			allowedOrigin = origin
		}

		// Wrap writer (single CORS behavior point)
		c.Writer = &corsResponseWriter{
			ResponseWriter: c.Writer,
			origin:         allowedOrigin,
		}

		// Preflight handling
		if c.Request.Method == http.MethodOptions {
			setCORSHeaders(c.Writer.Header(), allowedOrigin)
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		// Reserved logging hook (no behavior change)
		if c.Request.Method == http.MethodPost &&
			strings.HasPrefix(path, "/api/v1/chamas") &&
			!strings.HasSuffix(path, "/") {
			// placeholder for redirect safety
		}

		c.Next()
	}
}
