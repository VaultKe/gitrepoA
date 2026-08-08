package api

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"

	"vaultke-backend/internal/services"
	"vaultke-backend/internal/utils"
)

// ForgotPassword handles password reset request
func (h *AuthHandlers) ForgotPassword(c *gin.Context) {
	var req struct {
		Identifier string `json:"identifier" validate:"required,max=100,no_sql_injection,no_xss"`
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

	err := resetService.RequestPasswordReset(req.Identifier)
	if err != nil {
		fmt.Printf("Password reset error: %v\n", err)

		if err.Error() == "user not found" {
			c.JSON(http.StatusBadRequest, AuthResponse{
				Success: false,
				Error:   "No account found with this email or phone number",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, AuthResponse{
			Success: false,
			Error:   "Failed to send reset instructions. Please try again.",
		})
		return
	}

	c.JSON(http.StatusOK, AuthResponse{
		Success: true,
		Message: "Password reset instructions sent successfully",
	})
	c.Abort()
}

// ResetPassword handles password reset
func (h *AuthHandlers) ResetPassword(c *gin.Context) {
	var req struct {
		Token       string `json:"token" validate:"required,max=128,no_sql_injection,no_xss"`
		NewPassword string `json:"newPassword" validate:"required,min=6,max=128,no_sql_injection,no_xss"`
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

	err := resetService.ResetPassword(req.Token, req.NewPassword)
	if err != nil {
		c.JSON(http.StatusBadRequest, AuthResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, AuthResponse{
		Success: true,
		Message: "Password reset successfully! You can now login with your new password.",
	})
	c.Abort()
}
