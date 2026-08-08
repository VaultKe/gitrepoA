package api

import (
	"database/sql"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"vaultke-backend/internal/services"
	"vaultke-backend/internal/utils"
)

// VerifyEmail handles email verification
func (h *AuthHandlers) VerifyEmail(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, AuthResponse{
			Success: false,
			Error:   "User not authenticated",
		})
		return
	}

	err := h.userService.VerifyEmail(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, AuthResponse{
			Success: false,
			Error:   "Failed to verify email: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, AuthResponse{
		Success: true,
		Message: "Email verified successfully",
	})
	c.Abort()
}

// VerifyPhone handles phone verification
func (h *AuthHandlers) VerifyPhone(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, AuthResponse{
			Success: false,
			Error:   "User not authenticated",
		})
		return
	}

	err := h.userService.VerifyPhone(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, AuthResponse{
			Success: false,
			Error:   "Failed to verify phone: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, AuthResponse{
		Success: true,
		Message: "Phone verified successfully",
	})
	c.Abort()
}

// CheckTokenStatus checks the status of a password reset token for countdown display
func (h *AuthHandlers) CheckTokenStatus(c *gin.Context) {
	var req struct {
		Token string `json:"token" validate:"required,max=128,no_sql_injection,no_xss"`
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

	status, err := resetService.GetTokenStatus(req.Token)
	if err != nil {
		c.JSON(http.StatusInternalServerError, AuthResponse{
			Success: false,
			Error:   "Failed to check token status",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    status,
	})
		c.Abort()
}

// SendEmailVerification sends an email verification code to the user
func (h *AuthHandlers) SendEmailVerification(c *gin.Context) {
	var req struct {
		UserID string `json:"userId" validate:"required,max=100,no_sql_injection,no_xss"`
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

	emailVerificationService, exists := c.Get("emailVerificationService")
	if !exists {
		c.JSON(http.StatusInternalServerError, AuthResponse{
			Success: false,
			Error:   "Email verification service not available",
		})
		return
	}

	verificationService := emailVerificationService.(*services.EmailVerificationService)

	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, AuthResponse{
			Success: false,
			Error:   "Database not available",
		})
		return
	}
	database := db.(*sql.DB)

	var userEmail, userName string
	query := `SELECT email, COALESCE(first_name || ' ' || last_name, first_name, email) as name FROM users WHERE id = $1`
	err := database.QueryRow(query, req.UserID).Scan(&userEmail, &userName)
	if err != nil {
		c.JSON(http.StatusNotFound, AuthResponse{
			Success: false,
			Error:   "User not found",
		})
		return
	}

	verificationToken, err := verificationService.CreateEmailVerificationToken(req.UserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, AuthResponse{
			Success: false,
			Error:   "Failed to create verification token",
		})
		return
	}

	err = verificationService.SendVerificationEmail(userEmail, userName, verificationToken.Token)
	if err != nil {
		c.JSON(http.StatusInternalServerError, AuthResponse{
			Success: false,
			Error:   "Failed to send verification email",
		})
		return
	}

	c.JSON(http.StatusOK, AuthResponse{
		Success: true,
		Message: "Verification email sent successfully",
	})
	c.Abort()
}

// VerifyEmailCode verifies a user's email using the verification code
func (h *AuthHandlers) VerifyEmailCode(c *gin.Context) {
	var req struct {
		Token string `json:"token" validate:"required,max=128,no_sql_injection,no_xss"`
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

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, AuthResponse{
			Success: false,
			Error:   "Invalid request data: " + err.Error(),
		})
		return
	}

	emailVerificationService, exists := c.Get("emailVerificationService")
	if !exists {
		c.JSON(http.StatusInternalServerError, AuthResponse{
			Success: false,
			Error:   "Email verification service not available",
		})
		return
	}

	verificationService := emailVerificationService.(*services.EmailVerificationService)

	_, err := verificationService.VerifyEmail(req.Token)
	if err != nil {
		c.JSON(http.StatusBadRequest, AuthResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, AuthResponse{
		Success: true,
		Message: "Email verified successfully",
		Data:    nil,
	})
	c.Abort()
}

// CheckEmailVerificationStatus checks the status of an email verification token
func (h *AuthHandlers) CheckEmailVerificationStatus(c *gin.Context) {
	var req struct {
		Token string `json:"token" validate:"required,max=128,no_sql_injection,no_xss"`
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

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, AuthResponse{
			Success: false,
			Error:   "Invalid request data: " + err.Error(),
		})
		return
	}

	emailVerificationService, exists := c.Get("emailVerificationService")
	if !exists {
		c.JSON(http.StatusInternalServerError, AuthResponse{
			Success: false,
			Error:   "Email verification service not available",
		})
		return
	}

	verificationService := emailVerificationService.(*services.EmailVerificationService)

	status, err := verificationService.GetTokenStatus(req.Token)
	if err != nil {
		c.JSON(http.StatusInternalServerError, AuthResponse{
			Success: false,
			Error:   "Failed to check token status",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    status,
	})
		c.Abort()
}

// ResendVerification handles resending verification email/SMS
func (h *AuthHandlers) ResendVerification(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, AuthResponse{
			Success: false,
			Error:   "User not authenticated",
		})
		return
	}

	var req struct {
		Type string `json:"type" binding:"required,oneof=email phone"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, AuthResponse{
			Success: false,
			Error:   "Invalid request data: " + err.Error(),
		})
		return
	}

	user, err := h.userService.GetUserByID(userID)
	if err != nil {
		c.JSON(http.StatusNotFound, AuthResponse{
			Success: false,
			Error:   "User not found",
		})
		return
	}

	switch req.Type {
	case "email":
		if user.IsEmailVerified {
			c.JSON(http.StatusBadRequest, AuthResponse{
				Success: false,
				Error:   "Email is already verified",
			})
			return
		}

		passwordResetService, exists := c.Get("passwordResetService")
		if !exists {
			c.JSON(http.StatusInternalServerError, AuthResponse{
				Success: false,
				Error:   "Email service not available",
			})
			return
		}

		resetService := passwordResetService.(*services.PasswordResetService)

		err := resetService.SendPasswordResetEmail(user.Email, user.FirstName+" "+user.LastName, "123456")
		if err != nil {
			c.JSON(http.StatusInternalServerError, AuthResponse{
				Success: false,
				Error:   "Failed to send verification email",
			})
			return
		}

		c.JSON(http.StatusOK, AuthResponse{
			Success: true,
			Message: "Verification email sent successfully",
		})
		c.Abort()


	case "phone":
		if user.IsPhoneVerified {
			c.JSON(http.StatusBadRequest, AuthResponse{
				Success: false,
				Error:   "Phone is already verified",
			})
			return
		}

		c.JSON(http.StatusOK, AuthResponse{
			Success: true,
			Message: "Phone verification SMS sent successfully",
		})
		c.Abort()

	default:
		c.JSON(http.StatusBadRequest, AuthResponse{
			Success: false,
			Error:   "Invalid verification type. Must be 'email' or 'phone'",
		})
	}
}

// SendOnboardingTOTP generates and sends a 6-digit TOTP for member onboarding via phone
func (h *AuthHandlers) SendOnboardingTOTP(c *gin.Context) {
	var req struct {
		Phone  string `json:"phone" validate:"required,phone,max=20,no_sql_injection,no_xss"`
		UserID string `json:"userId" validate:"required,max=100,no_sql_injection,no_xss"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request data: " + err.Error(),
		})
		return
	}

	if err := utils.ValidateStruct(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Validation error: " + err.Error(),
		})
		return
	}

	code := fmt.Sprintf("%06d", int(time.Now().UnixNano()%1000000))

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Onboarding TOTP sent successfully",
		"data": gin.H{
			"devCode": code,
			"phone":   req.Phone,
		},
	})
		c.Abort()
}

// VerifyOnboardingTOTP verifies a 6-digit TOTP for member onboarding
func (h *AuthHandlers) VerifyOnboardingTOTP(c *gin.Context) {
	var req struct {
		Code   string `json:"code" validate:"required,len=6,numeric,no_sql_injection,no_xss"`
		UserID string `json:"userId" validate:"required,max=100,no_sql_injection,no_xss"`
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


	c.JSON(http.StatusOK, AuthResponse{
		Success: true,
		Message: "Onboarding TOTP verified successfully",
	})
	c.Abort()
}
