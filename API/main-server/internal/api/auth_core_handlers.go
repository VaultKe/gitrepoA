package api

import (
	"database/sql"
	"fmt"
	"net/http"
	"strings"
	"sync"

	"github.com/gin-gonic/gin"

	"vaultke-backend/internal/models"
	"vaultke-backend/internal/services"
	"vaultke-backend/internal/utils"
)

// DeviceInfo represents device information extracted from request
type DeviceInfo struct {
	DeviceUID    string
	DeviceType   string
	DeviceName   string
	OS           string
	OSVersion    string
	AppVersion   string
	Manufacturer string
	Model        string
	Locale       string
	Browser      string
	Location     string
}

// extractDeviceInfo extracts device information from request headers
func extractDeviceInfo(c *gin.Context) DeviceInfo {
	userAgent := c.GetHeader("User-Agent")

	deviceInfo := DeviceInfo{
		DeviceType: "unknown",
		DeviceName: "Unknown Device",
		OS:         "Unknown",
		Browser:    "Unknown Browser",
		Location:   "Unknown",
	}

	userAgentLower := strings.ToLower(userAgent)

	if strings.Contains(userAgentLower, "mobile") || strings.Contains(userAgentLower, "android") || strings.Contains(userAgentLower, "iphone") || strings.Contains(userAgentLower, "ipad") {
		deviceInfo.DeviceType = "mobile"

		if strings.Contains(userAgentLower, "android") {
			deviceInfo.OS = "Android"
			if strings.Contains(userAgent, "Android ") {
				parts := strings.Split(userAgent, "Android ")
				if len(parts) > 1 {
					version := strings.Split(parts[1], ";")[0]
					deviceInfo.OS = fmt.Sprintf("Android %s", version)
				}
			}

			if strings.Contains(userAgentLower, "chrome") && !strings.Contains(userAgentLower, "edg") {
				deviceInfo.Browser = "Chrome Mobile"
				deviceInfo.DeviceName = "Android Phone • Chrome"
			} else if strings.Contains(userAgentLower, "firefox") {
				deviceInfo.Browser = "Firefox Mobile"
				deviceInfo.DeviceName = "Android Phone • Firefox"
			} else if strings.Contains(userAgentLower, "samsung") {
				deviceInfo.Browser = "Samsung Internet"
				deviceInfo.DeviceName = "Samsung Phone • Samsung Internet"
			} else {
				deviceInfo.DeviceName = "Android Device"
			}
		}

		if strings.Contains(userAgentLower, "iphone") {
			deviceInfo.OS = "iOS"
			deviceInfo.DeviceType = "mobile"
			if strings.Contains(userAgentLower, "safari") && !strings.Contains(userAgentLower, "chrome") {
				deviceInfo.Browser = "Safari Mobile"
				deviceInfo.DeviceName = "iPhone • Safari"
			} else if strings.Contains(userAgentLower, "crios") {
				deviceInfo.Browser = "Chrome Mobile"
				deviceInfo.DeviceName = "iPhone • Chrome"
			} else if strings.Contains(userAgentLower, "fxios") {
				deviceInfo.Browser = "Firefox Mobile"
				deviceInfo.DeviceName = "iPhone • Firefox"
			} else {
				deviceInfo.DeviceName = "iPhone"
			}
		}

		if strings.Contains(userAgentLower, "ipad") {
			deviceInfo.OS = "iPadOS"
			deviceInfo.DeviceType = "tablet"
			deviceInfo.DeviceName = "iPad"
			if strings.Contains(userAgentLower, "safari") {
				deviceInfo.Browser = "Safari"
				deviceInfo.DeviceName = "iPad • Safari"
			}
		}
	} else {
		deviceInfo.DeviceType = "desktop"

		if strings.Contains(userAgentLower, "windows") {
			deviceInfo.OS = "Windows"
			if strings.Contains(userAgent, "Windows NT 10") {
				deviceInfo.OS = "Windows 10/11"
			} else if strings.Contains(userAgent, "Windows NT 6.3") {
				deviceInfo.OS = "Windows 8.1"
			} else if strings.Contains(userAgent, "Windows NT 6.1") {
				deviceInfo.OS = "Windows 7"
			}
		}

		if strings.Contains(userAgentLower, "mac os x") || strings.Contains(userAgentLower, "macos") {
			deviceInfo.OS = "macOS"
			if strings.Contains(userAgent, "Mac OS X 10_15") {
				deviceInfo.OS = "macOS Catalina+"
			}
		}

		if strings.Contains(userAgentLower, "linux") && !strings.Contains(userAgentLower, "android") {
			deviceInfo.OS = "Linux"
		}

		if strings.Contains(userAgentLower, "edg/") {
			deviceInfo.Browser = "Microsoft Edge"
			deviceInfo.DeviceName = fmt.Sprintf("%s PC - Edge", deviceInfo.OS)
		} else if strings.Contains(userAgentLower, "chrome/") && !strings.Contains(userAgentLower, "edg") {
			deviceInfo.Browser = "Google Chrome"
			deviceInfo.DeviceName = fmt.Sprintf("%s PC - Chrome", deviceInfo.OS)
		} else if strings.Contains(userAgentLower, "firefox/") {
			deviceInfo.Browser = "Mozilla Firefox"
			deviceInfo.DeviceName = fmt.Sprintf("%s PC - Firefox", deviceInfo.OS)
		} else if strings.Contains(userAgentLower, "safari/") && !strings.Contains(userAgentLower, "chrome") {
			deviceInfo.Browser = "Safari"
			deviceInfo.DeviceName = fmt.Sprintf("%s - Safari", deviceInfo.OS)
		} else if strings.Contains(userAgentLower, "opera") {
			deviceInfo.Browser = "Opera"
			deviceInfo.DeviceName = fmt.Sprintf("%s PC - Opera", deviceInfo.OS)
		}
	}

	if strings.Contains(userAgentLower, "vaultke") || strings.Contains(userAgentLower, "expo") {
		deviceInfo.Browser = "VaultKe App"
		if deviceInfo.OS == "Android" {
			deviceInfo.DeviceName = "Android Phone - VaultKe App"
		} else if deviceInfo.OS == "iOS" {
			deviceInfo.DeviceName = "iPhone - VaultKe App"
		} else {
			deviceInfo.DeviceName = "Mobile Device - VaultKe App"
		}
	}

	frontendDeviceUID := c.GetHeader("X-Device-Id")
	frontendDeviceType := c.GetHeader("X-Device-Type")
	frontendDeviceName := c.GetHeader("X-Device-Name")
	frontendBrowserName := c.GetHeader("X-Browser-Name")
	frontendOSName := c.GetHeader("X-OS-Name")
	frontendOSVersion := c.GetHeader("X-OS-Version")
	frontendAppVersion := c.GetHeader("X-App-Version")
	frontendManufacturer := c.GetHeader("X-Manufacturer")
	frontendModel := c.GetHeader("X-Model")
	frontendLocale := c.GetHeader("X-Locale")

	fmt.Printf("Received device headers - UID: '%s', Type: '%s', Name: '%s', Browser: '%s', OS: '%s', OSVer: '%s', AppVer: '%s', Mfr: '%s', Model: '%s', Locale: '%s'\n",
		frontendDeviceUID, frontendDeviceType, frontendDeviceName, frontendBrowserName, frontendOSName, frontendOSVersion, frontendAppVersion, frontendManufacturer, frontendModel, frontendLocale)

	if frontendDeviceUID != "" {
		deviceInfo.DeviceUID = frontendDeviceUID
	}
	if frontendDeviceType != "" {
		deviceInfo.DeviceType = frontendDeviceType
	}
	if frontendDeviceName != "" {
		deviceInfo.DeviceName = frontendDeviceName
	}
	if frontendBrowserName != "" {
		deviceInfo.Browser = frontendBrowserName
	}
	if frontendOSName != "" {
		deviceInfo.OS = frontendOSName
	}
	if frontendOSVersion != "" {
		deviceInfo.OSVersion = frontendOSVersion
	}
	if frontendAppVersion != "" {
		deviceInfo.AppVersion = frontendAppVersion
	}
	if frontendManufacturer != "" {
		deviceInfo.Manufacturer = frontendManufacturer
	}
	if frontendModel != "" {
		deviceInfo.Model = frontendModel
	}
	if frontendLocale != "" {
		deviceInfo.Locale = frontendLocale
	}

	ip := c.ClientIP()

	realIP := c.GetHeader("X-Real-IP")
	forwardedFor := c.GetHeader("X-Forwarded-For")
	cfConnectingIP := c.GetHeader("CF-Connecting-IP")
	trueClientIP := c.GetHeader("True-Client-IP")
	xClientIP := c.GetHeader("X-Client-IP")

	clientIP := ip
	if cfConnectingIP != "" {
		clientIP = cfConnectingIP
	} else if trueClientIP != "" {
		clientIP = trueClientIP
	} else if realIP != "" {
		clientIP = realIP
	} else if xClientIP != "" {
		clientIP = xClientIP
	} else if forwardedFor != "" {
		ips := strings.Split(forwardedFor, ",")
		if len(ips) > 0 {
			clientIP = strings.TrimSpace(ips[0])
		}
	}

	fmt.Printf("IP Detection Debug - ClientIP: %s, X-Real-IP: %s, X-Forwarded-For: %s, CF-Connecting-IP: %s, Final: %s\n",
		ip, realIP, forwardedFor, cfConnectingIP, clientIP)

	timezone := c.GetHeader("X-Timezone")
	connectionType := c.GetHeader("X-Connection-Type")

	if clientIP == "127.0.0.1" || clientIP == "::1" {
		deviceInfo.Location = "Local Development (localhost)"
	} else if strings.HasPrefix(clientIP, "192.168.") || strings.HasPrefix(clientIP, "10.") ||
		(strings.HasPrefix(clientIP, "172.") && len(clientIP) > 8) {
		deviceInfo.Location = fmt.Sprintf("Private Network (%s)", clientIP)
	} else if clientIP != "" && clientIP != ip {
		deviceInfo.Location = fmt.Sprintf("Client IP: %s", clientIP)
	} else {
		deviceInfo.Location = fmt.Sprintf("IP: %s", clientIP)
	}

	if timezone != "" && timezone != "UTC" {
		deviceInfo.Location = fmt.Sprintf("%s (%s)", deviceInfo.Location, timezone)
	}

	if connectionType != "" {
		deviceInfo.Location = fmt.Sprintf("%s • %s", deviceInfo.Location, connectionType)
	}

	return deviceInfo
}

// AuthHandlers contains all authentication-related handlers
type AuthHandlers struct {
	userService         *services.UserService
	authService         *services.AuthService
	devicePolicyService *services.DevicePolicyService
	db                  *sql.DB
}

// NewAuthHandlers creates new auth handlers
func NewAuthHandlers(db *sql.DB, jwtSecret string, jwtExpiration int, devicePolicyService *services.DevicePolicyService) *AuthHandlers {
	return &AuthHandlers{
		userService:         services.NewUserService(db),
		authService:         services.NewAuthService(db, jwtSecret, jwtExpiration),
		devicePolicyService: devicePolicyService,
		db:                  db,
	}
}

// AuthResponse represents the authentication response
type AuthResponse struct {
	Success bool      `json:"success"`
	Message string    `json:"message"`
	Data    *AuthData `json:"data,omitempty"`
	Error   string    `json:"error,omitempty"`
}

// AuthData represents the data in auth response
type AuthData struct {
	User                    *models.User `json:"user,omitempty"`
	Token                   string       `json:"token,omitempty"`
	RefreshToken            string       `json:"refreshToken,omitempty"`
	PreviousDeviceLoggedOut bool         `json:"previousDeviceLoggedOut,omitempty"`
	PreviousDeviceName      string       `json:"previousDeviceName,omitempty"`
}

// issueRefreshToken generates and returns a refresh token for a user
func (h *AuthHandlers) issueRefreshToken(c *gin.Context, userID string) (string, error) {
	userAgent := c.GetHeader("User-Agent")
	clientIP := c.ClientIP()
	plainToken, _, err := h.authService.GenerateRefreshToken(userID, userAgent, clientIP)
	return plainToken, err
}

// Register handles user registration
func (h *AuthHandlers) Register(c *gin.Context) {
	var req models.UserRegistration
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, AuthResponse{
			Success: false,
			Error:   "Invalid request data: " + err.Error(),
		})
		return
	}

	user, err := h.userService.CreateUser(&req)
	if err != nil {
		c.JSON(http.StatusBadRequest, AuthResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	token, err := h.authService.GenerateToken(user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, AuthResponse{
			Success: false,
			Error:   "Failed to generate token",
		})
		return
	}

	refreshToken, err := h.issueRefreshToken(c, user.ID)
	if err != nil {
		fmt.Printf("Failed to issue refresh token for new user %s: %v\n", user.ID, err)
	}

	emailVerificationService, exists := c.Get("emailVerificationService")
	if exists {
		verificationService := emailVerificationService.(*services.EmailVerificationService)

		verificationToken, err := verificationService.CreateEmailVerificationToken(user.ID)
		if err == nil {
			userName := user.FirstName
			if user.LastName != "" {
				userName += " " + user.LastName
			}
			if userName == "" {
				userName = user.Email
			}

			err = verificationService.SendVerificationEmail(user.Email, userName, verificationToken.Token)
			if err != nil {
				fmt.Printf("Failed to send verification email to %s: %v\n", user.Email, err)
			}
		}
	}

	c.JSON(http.StatusCreated, AuthResponse{
		Success: true,
		Message: "Registration successful! Please check your email for a verification code to complete your account setup.",
		Data: &AuthData{
			User:         user,
			Token:        token,
			RefreshToken: refreshToken,
		},
	})
}

// Login handles user authentication
func (h *AuthHandlers) Login(c *gin.Context) {
	var req models.UserLogin
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, AuthResponse{
			Success: false,
			Error:   "Invalid request data: " + err.Error(),
		})
		return
	}

	user, err := h.userService.AuthenticateUser(&req)
	if err != nil {
		c.JSON(http.StatusUnauthorized, AuthResponse{
			Success: false,
			Error:   "Invalid credentials",
		})
		return
	}

	token, err := h.authService.GenerateToken(user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, AuthResponse{
			Success: false,
			Error:   "Failed to generate token",
		})
		return
	}

	userAgent := c.GetHeader("User-Agent")
	clientIP := c.ClientIP()

	db, exists := c.Get("db")
	if exists {
		deviceInfo := extractDeviceInfo(c)
		fmt.Printf("Extracted device info for user %s: %+v\n", user.ID, deviceInfo)

		realIP := c.GetHeader("X-Real-IP")
		forwardedFor := c.GetHeader("X-Forwarded-For")
		cfConnectingIP := c.GetHeader("CF-Connecting-IP")
		trueClientIP := c.GetHeader("True-Client-IP")
		xClientIP := c.GetHeader("X-Client-IP")

		if cfConnectingIP != "" {
			clientIP = cfConnectingIP
		} else if trueClientIP != "" {
			clientIP = trueClientIP
		} else if realIP != "" {
			clientIP = realIP
		} else if xClientIP != "" {
			clientIP = xClientIP
		} else if forwardedFor != "" {
			ips := strings.Split(forwardedFor, ",")
			if len(ips) > 0 {
				clientIP = strings.TrimSpace(ips[0])
			}
		}

		// STRONG SINGLE-DEVICE ENFORCEMENT:
		// Before issuing a new session, enforce the single-active-device policy.
		// This revokes all tokens and deactivates any previously active device
		// for this user, then returns whether a previous device was logged out.
		devicePolicyResult, policyErr := h.devicePolicyService.EnforceSingleDevicePolicy(
			user.ID,
			deviceInfo.DeviceUID,
			deviceInfo.DeviceName,
			clientIP,
			userAgent,
		)
		if policyErr != nil {
			fmt.Printf("SECURITY: single-device policy enforcement failed for user %s: %v\n", user.ID, policyErr)
		} else if devicePolicyResult != nil && devicePolicyResult.PreviousDeviceLoggedOut {
			fmt.Printf("SECURITY: previous device logged out for user %s. Old device: %s (UID: %s)\n",
				user.ID, devicePolicyResult.PreviousDeviceName, devicePolicyResult.PreviousDeviceUID)
		}

		// Now issue the new refresh token, record the login session, and
		// update the device registry in parallel - they are independent DB writes.
		var (
			wg          sync.WaitGroup
			sessionErr  error
			deviceErr   error
			isNewDevice bool
		)

		refreshToken, _, refreshErr := h.authService.GenerateRefreshToken(user.ID, userAgent, clientIP)
		if refreshErr != nil {
			fmt.Printf("Failed to issue refresh token for user %s: %v\n", user.ID, refreshErr)
		}

		wg.Add(2)
		go func() {
			defer wg.Done()
			sessionErr = RecordLoginSession(
				db.(*sql.DB),
				user.ID,
				deviceInfo.DeviceUID,
				deviceInfo.DeviceType,
				deviceInfo.DeviceName,
				deviceInfo.OS,
				deviceInfo.Browser,
				clientIP,
				deviceInfo.Location,
			)
			if sessionErr != nil {
				fmt.Printf("Failed to record login session: %v\n", sessionErr)
			} else {
				fmt.Printf("Successfully called RecordLoginSession for user %s with IP %s\n", user.ID, clientIP)
			}
		}()
		go func() {
			defer wg.Done()
			isNewDevice, deviceErr = UpsertUserDevice(
				db.(*sql.DB),
				user.ID,
				deviceInfo.DeviceUID,
				deviceInfo.DeviceName,
				deviceInfo.DeviceType,
				clientIP,
				deviceInfo.OSVersion,
				deviceInfo.AppVersion,
				deviceInfo.Manufacturer,
				deviceInfo.Model,
				deviceInfo.Locale,
				c.GetHeader("X-Timezone"),
			)
			if deviceErr != nil {
				fmt.Printf("Failed to upsert user device for user %s: %v\n", user.ID, deviceErr)
			} else if isNewDevice {
				fmt.Printf("New device registered for user %s: %s (%s)\n", user.ID, deviceInfo.DeviceName, clientIP)
			}
		}()
		wg.Wait()

		// Build response
		authData := &AuthData{
			User:         user,
			Token:        token,
			RefreshToken: refreshToken,
		}

		// If a previous device was logged out, include that info so the client can act on it
		if devicePolicyResult != nil && devicePolicyResult.PreviousDeviceLoggedOut {
			authData.PreviousDeviceLoggedOut = true
			authData.PreviousDeviceName = devicePolicyResult.PreviousDeviceName
		}

		response := AuthResponse{
			Success: true,
			Message: "Login successful",
			Data:    authData,
		}

		c.JSON(http.StatusOK, response)
	} else {
		fmt.Printf("Database not available in context for recording login session\n")

		refreshToken, _, err := h.authService.GenerateRefreshToken(user.ID, userAgent, clientIP)
		if err != nil {
			fmt.Printf("Failed to issue refresh token for user %s: %v\n", user.ID, err)
		}

		c.JSON(http.StatusOK, AuthResponse{
			Success: true,
			Message: "Login successful",
			Data: &AuthData{
				User:         user,
				Token:        token,
				RefreshToken: refreshToken,
			},
		})
	}
}

// Logout handles user logout
func (h *AuthHandlers) Logout(c *gin.Context) {
	authHeader := c.GetHeader("Authorization")

	var refreshToken string
	if c.Request.Body != nil {
		_ = c.BindJSON(&struct {
			RefreshToken string `json:"refreshToken"`
		}{})
	}

	if authHeader != "" && len(authHeader) > 7 && authHeader[:7] == "Bearer " {
		tokenString := authHeader[7:]
		_ = h.authService.BlacklistToken(tokenString)
	}

	if refreshToken != "" {
		_ = h.authService.RevokeRefreshToken(refreshToken)
	}

	c.JSON(http.StatusOK, AuthResponse{
		Success: true,
		Message: "Logout successful",
	})
}

// RefreshToken handles token refresh using stored refresh token
func (h *AuthHandlers) RefreshToken(c *gin.Context) {
	var req struct {
		RefreshToken string `json:"refreshToken" validate:"required,max=128,no_sql_injection,no_xss"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, AuthResponse{
			Success: false,
			Error:   "Refresh token is required",
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

	userAgent := c.GetHeader("User-Agent")
	clientIP := c.ClientIP()

	accessToken, newRefreshToken, err := h.authService.RefreshAccessToken(req.RefreshToken, userAgent, clientIP)
	if err != nil {
		c.JSON(http.StatusUnauthorized, AuthResponse{
			Success: false,
			Error:   "Failed to refresh token: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, AuthResponse{
		Success: true,
		Message: "Token refreshed successfully",
		Data: &AuthData{
			Token:        accessToken,
			RefreshToken: newRefreshToken,
		},
	})
}
