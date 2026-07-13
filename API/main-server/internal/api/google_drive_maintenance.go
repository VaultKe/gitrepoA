package api

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// SystemStatus represents system monitoring data
type SystemStatus struct {
	DiskUsage         float64 `json:"disk_usage"`
	MemoryUsage       float64 `json:"memory_usage"`
	CPUUsage          float64 `json:"cpu_usage"`
	ActiveConnections int     `json:"active_connections"`
	Uptime            string  `json:"uptime"`
	LastMaintenance   string  `json:"last_maintenance"`
}

// GetSystemStatus retrieves current system status
func GetSystemStatus(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	// Check if user is admin
	userRole := c.GetString("userRole")
	if userRole != "admin" {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "Admin access required",
		})
		return
	}

	// Get system metrics (simulated for now)
	systemStatus := SystemStatus{
		DiskUsage:         67.5,
		MemoryUsage:       45.2,
		CPUUsage:          23.8,
		ActiveConnections: 156,
		Uptime:            "15 days, 8 hours",
		LastMaintenance:   time.Now().Add(-24 * time.Hour).Format("2006-01-02 15:04:05"),
	}

	c.JSON(http.StatusOK, gin.H{
		"success":       true,
		"system_status": systemStatus,
	})
}

// PerformSystemMaintenance performs system maintenance operations
func PerformSystemMaintenance(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	// Check if user is admin
	userRole := c.GetString("userRole")
	if userRole != "admin" {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "Admin access required",
		})
		return
	}

	var request struct {
		Action string `json:"action" binding:"required"` // restart, optimize, cleanup
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request data: " + err.Error(),
		})
		return
	}

	// Simulate maintenance operation
	// Use a timeout context to prevent goroutine leaks
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("Recovered from panic in maintenance goroutine: %v", r)
			}
		}()

		select {
		case <-ctx.Done():
			log.Printf("Maintenance cancelled: %v", ctx.Err())
			return
		default:
			time.Sleep(3 * time.Second) // Simulate maintenance time
			// In real implementation, this would perform actual maintenance
		}
	}()

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": fmt.Sprintf("System %s initiated successfully", request.Action),
	})
}
