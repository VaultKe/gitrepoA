package api

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"vaultke-backend/internal/services"
	"vaultke-backend/internal/utils"
)

// TestEmail handles email testing (for development only)
func (h *AuthHandlers) TestEmail(c *gin.Context) {
	var req struct {
		Email string `json:"email" validate:"required,email,no_sql_injection,no_xss"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, AuthResponse{
			Success: false,
			Error:   "Invalid request data: " + err.Error(),
		})
		return
	}

	if err := utils.ValidateStruct(&req); err != nil {
		c.JSON(http.StatusBadRequest, AuthResponse{
			Success: false,
			Error:   "Validation error: " + err.Error(),
		})
		return
	}

	passwordResetService, exists := c.Get("passwordResetService")
	if !exists {
		c.JSON(http.StatusInternalServerError, AuthResponse{
			Success: false,
			Error:   "Password reset service not available",
		})
		return
	}

	resetService := passwordResetService.(*services.PasswordResetService)

	err := resetService.SendPasswordResetEmail(req.Email, "Test User", "123456")
	if err != nil {
		c.JSON(http.StatusInternalServerError, AuthResponse{
			Success: false,
			Error:   "Failed to send test email: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, AuthResponse{
		Success: true,
		Message: "Test email sent successfully",
	})
	c.Abort()
}
