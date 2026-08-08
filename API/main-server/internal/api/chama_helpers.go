package api

import (
	"database/sql"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"vaultke-backend/internal/services"

	"github.com/gin-gonic/gin"
)

// dbFromContext returns the *sql.DB stored in the gin context. If it is
// missing or of the wrong type it writes a 500 JSON error and returns nil,
// so callers can simply `if db == nil { return }`.
func dbFromContext(c *gin.Context) *sql.DB {
	if v, ok := c.Get("db"); ok {
		if db, ok := v.(*sql.DB); ok {
			return db
		}
	}
	c.JSON(http.StatusInternalServerError, gin.H{
		"success": false,
		"error":   "Database connection not available",
	})
	return nil
}

// chamaServiceFromContext returns a ChamaService backed by the request's DB.
func chamaServiceFromContext(c *gin.Context) *services.ChamaService {
	db := dbFromContext(c)
	if db == nil {
		return nil
	}
	return services.NewChamaService(db)
}

// requireUserID returns the authenticated user ID from the context. It writes
// a 401 JSON error and returns ok=false when the user is not authenticated.
func requireUserID(c *gin.Context) (string, bool) {
	if v, ok := c.Get("userID"); ok {
		if id, ok := v.(string); ok && id != "" {
			return id, true
		}
	}
	c.JSON(http.StatusUnauthorized, gin.H{
		"success": false,
		"error":   "User not authenticated",
	})
	return "", false
}

// requireParam returns the URL path parameter with the given name. It writes a
// 400 JSON error using msg and returns ok=false when the value is empty.
func requireParam(c *gin.Context, name, msg string) (string, bool) {
	if v := c.Param(name); v != "" {
		return v, true
	}
	c.JSON(http.StatusBadRequest, gin.H{
		"success": false,
		"error":   msg,
	})
	return "", false
}

// parsePagination reads limit/offset query parameters. On invalid or out of
// range values it falls back to the supplied defaults (matching prior behavior).
func parsePagination(c *gin.Context, defaultLimit int) (limit, offset int) {
	limit = defaultLimit
	if v, err := strconv.Atoi(c.DefaultQuery("limit", strconv.Itoa(defaultLimit))); err == nil && v > 0 {
		limit = v
	}
	offset = 0
	if v, err := strconv.Atoi(c.DefaultQuery("offset", "0")); err == nil && v >= 0 {
		offset = v
	}
	return limit, offset
}

func generateMockMonthlyData(average float64) []float64 {
	data := make([]float64, 12)
	for i := 0; i < 12; i++ {
		// Add some variation around the average
		variation := (float64(i%3) - 1) * 500 // -500, 0, +500 variation
		data[i] = average + variation
		if data[i] < 0 {
			data[i] = 0
		}
	}
	return data
}

func getStringValue(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func normalizeMpesaPhone(phone string) string {
	cleaned := regexp.MustCompile(`\D`).ReplaceAllString(phone, "")
	if cleaned == "" {
		return ""
	}
	switch {
	case strings.HasPrefix(cleaned, "07"), strings.HasPrefix(cleaned, "01"):
		return "254" + cleaned[1:]
	case strings.HasPrefix(cleaned, "254"):
		return cleaned
	case strings.HasPrefix(cleaned, "7") && len(cleaned) >= 9:
		return "254" + cleaned
	}
	return cleaned
}
