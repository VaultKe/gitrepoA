package api

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"vaultke-backend/internal/services"

	"github.com/gin-gonic/gin"
)

// GetTestDataStats returns test data generation statistics
func GetTestDataStats(c *gin.Context) {
	// Check admin access (only admins can manage test data)
	userRole := c.GetString("userRole")
	if userRole != "admin" {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "Admin access required",
		})
		return
	}

	// Get generator from context (set by middleware)
	genInterface, exists := c.Get("testDataGenerator")
	if !exists {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"error":   "Test data generator not initialized",
		})
		return
	}

	gen := genInterface.(*services.TestDataGenerator)
	stats := gen.GetStats()

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    stats,
	})
}

// GenerateTestData manually triggers a batch of test data generation
func GenerateTestData(c *gin.Context) {
	userRole := c.GetString("userRole")
	if userRole != "admin" {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "Admin access required",
		})
		return
	}

	genInterface, exists := c.Get("testDataGenerator")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Test data generator not initialized",
		})
		return
	}

	gen := genInterface.(*services.TestDataGenerator)

	// Get batch size from query param (default 5)
	batchSize := 5
	if bs := c.DefaultQuery("count", "5"); bs != "" {
		if val, err := strconv.Atoi(bs); err == nil && val > 0 && val <= 50 {
			batchSize = val
		}
	}

	stats := gen.GenerateBatch(batchSize)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": fmt.Sprintf("Generated test data batch (size=%d)", batchSize),
		"data":    stats,
	})
}

// StartTestDataGenerator starts the periodic test data generator
func StartTestDataGenerator(c *gin.Context) {
	if c.GetString("userRole") != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "error": "Admin only"})
		return
	}
	gen, _ := c.Get("testDataGenerator")
	generator := gen.(*services.TestDataGenerator)

	if generator.IsRunning() {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Generator already running"})
		return
	}

	// Default interval 5 minutes; can be customized later
	generator.Start(5 * time.Minute)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Test data generator started",
	})
}

// StopTestDataGenerator stops the periodic generator
func StopTestDataGenerator(c *gin.Context) {
	if c.GetString("userRole") != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "error": "Admin only"})
		return
	}
	gen, _ := c.Get("testDataGenerator")
	generator := gen.(*services.TestDataGenerator)

	if !generator.IsRunning() {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Generator not running"})
		return
	}

	generator.Stop()

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Test data generator stopped",
	})
}

// ResetTestDataStats resets generation statistics
func ResetTestDataStats(c *gin.Context) {
	if c.GetString("userRole") != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "error": "Admin only"})
		return
	}
	gen, _ := c.Get("testDataGenerator")
	generator := gen.(*services.TestDataGenerator)

	generator.ResetStats()

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Test data statistics reset",
	})
}
