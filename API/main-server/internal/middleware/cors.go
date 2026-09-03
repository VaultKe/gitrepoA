package middleware

import (
	"net/http"
	"strings"

	"vaultke-backend/config"

	"github.com/gin-gonic/gin"
)

const corsAllowHeaders = "Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, X-CSRF-Token, X-File-Name, X-File-Size, X-Timezone, X-Language, X-Locale, X-Screen-Resolution, X-Device-Id, X-Device-Type, X-Device-Name, X-Browser-Name, X-OS-Name, X-OS-Version, X-App-Version, X-Manufacturer, X-Model, X-Connection-Type"

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
	// Build allowed origins map strictly from config (env via config.Load)
	allowedOrigins := make(map[string]struct{})
	for _, origin := range cfg.AllowedOrigins {
		allowedOrigins[origin] = struct{}{}
	}

	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		path := c.Request.URL.Path

		var allowedOrigin string

		// Handle requests with missing or null origin (mobile apps, curl, etc.)
		if origin == "" || origin == "null" {
			// For requests without Origin header we only allow them if the
			// server is explicitly configured to allow all origins or if
			// a specific allowed origin exists in the env. We strictly read
			// allowed origins from the environment (`API/main-server/.env`).
			if cfg.AllowAllOrigins {
				allowedOrigin = "*"
			} else if len(cfg.AllowedOrigins) > 0 {
				// Use the first allowed origin from config
				allowedOrigin = cfg.AllowedOrigins[0]
			} else {
				// No explicit allowed origins configured — deny
				c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Origin not allowed (no allowed origins configured)"})
				return
			}
		} else if cfg.AllowAllOrigins {
			// When ALLOW_ALL_ORIGINS is true, echo back the requesting origin
			allowedOrigin = origin
		} else if _, allowed := allowedOrigins[origin]; !allowed {
			// If origin is not allowed, for development environments we still
			// include CORS headers so browser clients get a JSON response instead
			// of a silent CORS block. In production we keep the strict behavior.
			if cfg.Environment != "production" || cfg.AllowAllOrigins {
				// Echo back the requesting origin so browsers accept the response
				allowedOrigin = origin
				setCORSHeaders(c.Writer.Header(), allowedOrigin)
				c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
					"error": "Origin not allowed (dev override)",
				})
				return
			}

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
