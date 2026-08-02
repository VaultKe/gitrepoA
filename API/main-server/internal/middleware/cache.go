package middleware

import (
	"bytes"
	"encoding/json"
	"time"

	"github.com/gin-gonic/gin"
	"vaultke-backend/internal/services"
)

// bodyCaptureResponseWriter wraps gin.ResponseWriter to capture the response body.
type bodyCaptureResponseWriter struct {
	gin.ResponseWriter
	body *bytes.Buffer
}

func (w *bodyCaptureResponseWriter) Write(b []byte) (int, error) {
	w.body.Write(b)
	return w.ResponseWriter.Write(b)
}

// isValidJSON checks if a byte slice is valid JSON.
func isValidJSON(data []byte) bool {
	var v interface{}
	return json.Unmarshal(data, &v) == nil
}

// CacheMiddleware caches GET responses to reduce database load.
// Only caches successful (2xx) responses for GET requests.
// Cache entries expire after 60 seconds by default.
func CacheMiddleware(cache services.Cache) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Only cache GET requests
		if c.Request.Method != "GET" {
			c.Next()
			return
		}

		cacheKey := "cache:" + c.Request.URL.RequestURI()

		// Try to serve from cache
		if cached, found := cache.Get(cacheKey); found {
			cachedBytes := []byte(cached)
			// Only serve cached data if it is valid JSON
			if isValidJSON(cachedBytes) {
				c.Header("X-Cache", "HIT")
				c.Data(200, "application/json", cachedBytes)
				return
			}
			// Corrupted or non-JSON cache entry; skip cache and fall through
			c.Header("X-Cache", "SKIP")
		}

		// Capture the response body by wrapping the ResponseWriter
		capture := &bodyCaptureResponseWriter{
			ResponseWriter: c.Writer,
			body:           &bytes.Buffer{},
		}
		c.Writer = capture

		// Process the request normally
		c.Next()

		// Only cache successful responses
		if capture.Status() < 200 || capture.Status() >= 300 {
			c.Header("X-Cache", "SKIP")
			return
		}

		// Get the captured body
		body := capture.body.String()
		if body == "" || body == "{}" || body == "null" {
			c.Header("X-Cache", "SKIP")
			return
		}

		// Only cache if the body is valid JSON
		bodyBytes := []byte(body)
		if !isValidJSON(bodyBytes) {
			c.Header("X-Cache", "SKIP")
			return
		}

		// Cache the response with a 60-second TTL
		cache.Set(cacheKey, body, 60*time.Second)
		c.Header("X-Cache", "MISS")
	}
}

// ClearCacheMiddleware removes a specific key from the cache
// when provided as a query parameter (for purging after mutations).
func ClearCacheMiddleware(cache services.Cache) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()

		switch c.Request.Method {
		case "POST", "PUT", "PATCH", "DELETE":
			purgeKey := c.Query("purge_cache")
			if purgeKey != "" {
				cache.Delete("cache:" + purgeKey)
			}
		}
	}
}
