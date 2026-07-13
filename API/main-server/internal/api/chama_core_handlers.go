package api

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

// GetChamas returns a paginated list of public chamas.
func GetChamas(c *gin.Context) {
	limit, offset := parsePagination(c, 20)

	chamaService := chamaServiceFromContext(c)
	if chamaService == nil {
		return
	}

	chamas, err := chamaService.GetChamas(limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to get chamas: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    chamas,
		"count":   len(chamas),
	})
}

// GetAllChamasForAdmin - Admin endpoint to get all chamas (no filters).
func GetAllChamasForAdmin(c *gin.Context) {
	if c.GetString("userRole") != "admin" {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "Only admins can access this endpoint",
		})
		return
	}

	limit, offset := parsePagination(c, 100)

	chamaService := chamaServiceFromContext(c)
	if chamaService == nil {
		return
	}

	chamas, err := chamaService.GetAllChamasForAdmin(limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to get chamas for admin: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    chamas,
		"count":   len(chamas),
	})
}

// GetUserChamas returns the chamas the authenticated user belongs to.
func GetUserChamas(c *gin.Context) {
	userID, ok := requireUserID(c)
	if !ok {
		return
	}

	limit, offset := parsePagination(c, 20)

	chamaService := chamaServiceFromContext(c)
	if chamaService == nil {
		return
	}

	chamas, err := chamaService.GetChamasByUser(userID, limit, offset)
	if err != nil {
		log.Printf("ERROR fetching chamas for user %s: %v", userID, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to get user chamas: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    chamas,
		"count":   len(chamas),
	})
}

// GetChama returns a single chama by ID.
func GetChama(c *gin.Context) {
	chamaID, ok := requireParam(c, "id", "Chama ID is required")
	if !ok {
		return
	}

	chamaService := chamaServiceFromContext(c)
	if chamaService == nil {
		return
	}

	chama, err := chamaService.GetChamaByID(chamaID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Chama not found: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    chama,
		"message": "Chama details retrieved successfully",
	})
}

// DeleteChama removes a chama (cascades related data). Only the chairperson may delete.
func DeleteChama(c *gin.Context) {
	chamaID, ok := requireParam(c, "id", "Chama ID is required")
	if !ok {
		return
	}

	userID, ok := requireUserID(c)
	if !ok {
		return
	}

	chamaService := chamaServiceFromContext(c)
	if chamaService == nil {
		return
	}

	userRole, err := chamaService.GetUserRoleInChama(chamaID, userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "You are not a member of this chama",
		})
		return
	}

	if userRole != "chairperson" {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "Only chairperson can delete the chama",
		})
		return
	}

	if err := chamaService.DeleteChama(chamaID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to delete chama: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Chama deleted successfully",
	})
}

// LeaveChama removes the authenticated user from a chama (chairperson must transfer first).
func LeaveChama(c *gin.Context) {
	chamaID, ok := requireParam(c, "id", "Chama ID is required")
	if !ok {
		return
	}

	userID, ok := requireUserID(c)
	if !ok {
		return
	}

	chamaService := chamaServiceFromContext(c)
	if chamaService == nil {
		return
	}

	userRole, err := chamaService.GetUserRoleInChama(chamaID, userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "You are not a member of this chama",
		})
		return
	}

	if userRole == "chairperson" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Chairperson cannot leave chama. Please transfer chairperson role first or delete the chama.",
		})
		return
	}

	if err := chamaService.RemoveUserFromChama(chamaID, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to leave chama: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Successfully left the chama",
	})
}
