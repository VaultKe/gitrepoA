package routes

import (
	"database/sql"
	"fmt"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"vaultke-backend/config"
	"vaultke-backend/internal/api"
	"vaultke-backend/internal/middleware"
	"vaultke-backend/internal/services"
)

// SetupRoutes registers all route groups and middleware on the given Gin router.
func SetupRoutes(
	router *gin.Engine,
	cfg *config.Config,
	db *sql.DB,
	authService *services.AuthService,
	passwordResetService *services.PasswordResetService,
	emailVerificationService *services.EmailVerificationService,
	authHandlers *api.AuthHandlers,
	reminderHandlers *api.ReminderHandlers,
	pollsHandlers *api.PollsHandlers,
	disbursementHandlers *api.DisbursementHandlers,
	reportsHandlers *api.FinancialReportsHandlers,
	userSearchHandlers *api.UserSearchHandlers,
	receiptHandlers *api.ReceiptHandlers,
	accountHandlers *api.AccountHandlers,
	testDataGenerator *services.TestDataGenerator,
	subwalletHandlers *api.SubWalletHandlers,
	disbursementService *services.DisbursementService,
) {
	// HTML templates for OAuth pages
	router.LoadHTMLGlob("templates/*")

	// Global middleware
	router.Use(middleware.CORSMiddleware(cfg))

	// Disable rate limiting for development
	if os.Getenv("DISABLE_RATE_LIMITING") != "true" {
		securityConfig := middleware.DefaultSecurityConfig()
		router.Use(middleware.SecurityMiddleware(securityConfig))
	}

	router.Use(middleware.InputValidationMiddleware())
	router.Use(middleware.FileUploadSecurityMiddleware())

	// IP debugging middleware for tunneled environments
	router.Use(func(c *gin.Context) {
		// Only log for non-OPTIONS requests to avoid spam
		if c.Request.Method != "OPTIONS" {
		}
		c.Next()
	})

	// Health check endpoints and static pages
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "ok",
			"message": "VaultKe API is running",
			"version": "1.0.0",
		})
	})

	router.GET("/privacy-policy", func(c *gin.Context) {
		c.HTML(http.StatusOK, "privacy-policy.html", nil)
	})
	router.GET("/terms-of-service", func(c *gin.Context) {
		c.HTML(http.StatusOK, "terms-of-service.html", nil)
	})

	router.Static("/uploads", "./uploads")
	router.Static("/notification_sound", "./notification_sound")

	// Authentication middleware
	authMiddleware := middleware.NewAuthMiddleware(authService)

	// Context injection middleware
	dbMiddleware := func(c *gin.Context) {
		c.Set("db", db)
		c.Next()
	}

	configMiddleware := func(c *gin.Context) {
		c.Set("config", cfg)
		c.Next()
	}

	subwalletMiddleware := func(c *gin.Context) {
		c.Set("subwalletHandlers", subwalletHandlers)
		c.Next()
	}

	disbursementMiddleware := func(c *gin.Context) {
		c.Set("disbursementService", disbursementService)
		c.Next()
	}

	passwordResetMiddleware := func(c *gin.Context) {
		c.Set("passwordResetService", passwordResetService)
		c.Next()
	}

	emailVerificationMiddleware := func(c *gin.Context) {
		c.Set("emailVerificationService", emailVerificationService)
		c.Next()
	}

	apiGroup := router.Group("/api/v1")
	{
		apiGroup.GET("/health", func(c *gin.Context) {
			c.JSON(200, gin.H{
				"success":   true,
				"status":    "healthy",
				"message":   "VaultKe API is running",
				"timestamp": time.Now().Unix(),
			})
		})

		auth := apiGroup.Group("/auth")
		auth.Use(middleware.AuthRateLimitMiddleware())
		auth.Use(dbMiddleware)
		auth.Use(passwordResetMiddleware)
		auth.Use(emailVerificationMiddleware)
		{
			auth.POST("/register", authHandlers.Register)
			auth.POST("/login", authHandlers.Login)
			auth.POST("/logout", authMiddleware.AuthRequired(), authHandlers.Logout)
			auth.POST("/refresh", authHandlers.RefreshToken)
			auth.POST("/verify-email", authMiddleware.AuthRequired(), authHandlers.VerifyEmail)
			auth.POST("/verify-phone", authMiddleware.AuthRequired(), authHandlers.VerifyPhone)
			auth.POST("/forgot-password", authHandlers.ForgotPassword)
			auth.POST("/reset-password", authHandlers.ResetPassword)
			auth.POST("/check-token-status", authHandlers.CheckTokenStatus)

			// Email verification routes
			auth.POST("/send-email-verification", authHandlers.SendEmailVerification)
			auth.POST("/verify-email-code", authHandlers.VerifyEmailCode)
			auth.POST("/check-email-verification-status", authHandlers.CheckEmailVerificationStatus)

			// Onboarding TOTP routes
			auth.POST("/send-onboarding-totp", authHandlers.SendOnboardingTOTP)
			auth.POST("/verify-onboarding-totp", authHandlers.VerifyOnboardingTOTP)

			auth.POST("/test-email", authHandlers.TestEmail)
		}

		publicPayments := apiGroup.Group("/payments")
		publicPayments.Use(dbMiddleware)
		publicPayments.Use(configMiddleware)
		{
			publicPayments.POST("/mpesa/callback", api.HandleMpesaCallback)
			publicPayments.POST("/mpesa/b2c/callback", api.HandleMpesaB2CCallback)
			publicPayments.POST("/mpesa/b2c/timeout", api.HandleMpesaB2CTimeout)
		}

		publicAuth := apiGroup.Group("/auth")
		{
			publicAuth.GET("/google/drive", api.InitiateGoogleDriveAuth)
			publicAuth.GET("/google/callback", api.HandleGoogleDriveCallback)
		}

		protected := apiGroup.Group("/")
		protected.Use(authMiddleware.AuthRequired())
		protected.Use(dbMiddleware)
		protected.Use(configMiddleware)
		protected.Use(subwalletMiddleware)
		protected.Use(disbursementMiddleware)
		protected.Use(passwordResetMiddleware)
		{
			users := protected.Group("/users")
			{
				users.GET("/", api.GetUsers)
				users.GET("/:id", authHandlers.GetUserByID)
				users.GET("/admin/all", api.GetAllUsersForAdmin)
				users.GET("/admin/statistics", api.GetAdminStatistics)
				users.GET("/admin/analytics", api.GetSystemAnalytics)
				users.GET("/profile", authHandlers.GetProfile)
				users.PUT("/profile", authHandlers.UpdateProfile)
				users.GET("/statistics", api.GetUserStatistics)

				users.GET("/google-drive/auth-url", api.GetGoogleDriveAuthURL)
				users.POST("/google-drive/store-tokens", api.StoreGoogleDriveTokens)
				users.POST("/google-drive/disconnect", api.DisconnectGoogleDrive)
				users.POST("/google-drive/backup", api.CreateGoogleDriveBackup)
				users.POST("/google-drive/restore", api.RestoreGoogleDriveBackup)
				users.GET("/google-drive/backup-info", api.GetGoogleDriveBackupInfo)
				users.GET("/google-drive/status", api.GetGoogleDriveStatus)
				users.GET("/google-drive/debug-tokens", api.DebugGoogleDriveTokens)
				users.POST("/google-drive/generate-test-tokens", api.GenerateTestTokens)

				users.GET("/backup/history", api.GetBackupHistory)
				users.GET("/backup/system-status", api.GetSystemStatus)
				users.GET("/backup/settings", api.GetBackupSettings)
				users.PUT("/backup/settings", api.UpdateBackupSettings)
				users.POST("/backup/start", api.StartBackup)
				users.POST("/backup/maintenance", api.PerformSystemMaintenance)

				users.GET("/privacy-settings", api.GetPrivacySettings)
				users.PUT("/privacy-settings", api.UpdatePrivacySettings)
				users.GET("/security-settings", api.GetSecuritySettings)
				users.PUT("/security-settings", api.UpdateSecuritySettings)
				users.GET("/preferences", api.GetUserPreferences)
				users.PUT("/preferences", api.UpdateUserPreferences)

				users.POST("/avatar", api.UploadAvatar)
				users.GET("/search-by-credentials", api.SearchUserByCredentials)
				users.PUT("/:id/role", api.AdminUpdateUserRole)
				users.PUT("/:id/status", api.UpdateUserStatus)
				users.DELETE("/:id", api.DeleteUser)
				users.POST("/onboard", api.OnboardUser)
				users.PUT("/:id/phone-verified", api.UpdateUserPhoneVerified)
				users.PUT("/:id/registration-payment", api.UpdateUserPaymentStatus)
			}

			chamas := protected.Group("/chamas")
			{
				chamas.GET("/", api.GetChamas)
				chamas.GET("/admin/all", api.GetAllChamasForAdmin)
				chamas.POST("/", api.CreateChama)
				chamas.GET("/my", api.GetUserChamas)
				chamas.GET("/:id", api.GetChama)
				chamas.PUT("/:id", api.UpdateChama)
				chamas.DELETE("/:id", api.DeleteChama)
				chamas.POST("/:id/leave", api.LeaveChama)
				chamas.GET("/:id/members", api.GetChamaMembers)
				chamas.GET("/:id/members/:memberId/role", api.GetMemberRole)
				chamas.GET("/:id/members/:memberId/stats", api.GetChamaMemberStatistics)
				chamas.GET("/:id/members/export", api.ExportChamaMembers)
				chamas.GET("/:id/transactions", api.GetChamaTransactions)
				chamas.GET("/:id/statistics", api.GetChamaStatistics)
				chamas.GET("/:id/merry-go-rounds", api.GetMerryGoRounds)
				chamas.GET("/:id/savings/export", api.ExportSavingsTransactions)

				chamas.POST("/:id/invite", api.SendChamaInvitation)
				chamas.POST("/:id/create-chat-room", api.CreateChamaChatRoom)
				chamas.GET("/:id/invitations/sent", api.GetChamaSentInvitations)
				chamas.GET("/invitations", api.GetUserInvitations)
				chamas.POST("/:id/invitations/:invitationId/respond", api.RespondToInvitation)
				chamas.POST("/:id/invitations/:invitationId/cancel", api.CancelInvitation)
				chamas.POST("/:id/invitations/:invitationId/resend", api.ResendInvitation)

				chamas.GET("/:id/eligible-loan-members", api.GetEligibleLoanMembers)
				chamas.GET("/:id/eligible-welfare-members", api.GetEligibleWelfareMembers)
				chamas.GET("/:id/eligible-savings-members", api.GetEligibleSavingsMembers)
				chamas.GET("/:id/eligible-dividend-members", api.GetEligibleDividendMembers)
				chamas.GET("/:id/eligible-shares-members", api.GetChamaSharesOfferings)
				chamas.GET("/:id/eligible-other-members", api.GetEligibleOtherMembers)
				chamas.POST("/:id/shares/offering/", api.CreateChamaShares)
				chamas.GET("/:id/shares/offerings", api.GetChamaShareOfferingsList)
				chamas.GET("/:id/dividends/", api.GetChamaDividendDeclarations)
				chamas.POST("/:id/dividends/", api.DeclareChamaDividends)
				chamas.POST("/:id/disbursements/individual", api.CreateIndividualDisbursement)
				chamas.POST("/:id/disbursements/bulk", api.CreateBulkDisbursement)
				chamas.POST("/:id/mgr-disbursements/:cycleId", api.DisburseMerryGoRoundCycle)
				chamas.POST("/:id/mgr-disbursements/bulk", api.DisburseMerryGoRoundCyclesBulk)
				chamas.POST("/:id/mgr-check-advance/:cycleId", api.CheckAndAdvanceRound)
				chamas.GET("/:id/subscription-payments", api.GetChamaSubscriptionPayments)
				chamas.POST("/:id/subscription-payments/:paymentId/pay", api.PaySubscriptionPayment)
				chamas.GET("/:id/service-fee-payments", api.GetChamaServiceFeePayments)
				chamas.GET("/:id/members/:memberId/service-fee-payments", api.GetMemberServiceFeePayments)
				chamas.POST("/:id/service-fee-payments/:paymentId/pay", api.PayServiceFeePayment)
				chamas.POST("/:id/members/:memberId/pay-service-fee", api.PayMemberServiceFee)
			}

			wallets := protected.Group("/wallets")
			{
				wallets.GET("/", api.GetWallets)
				wallets.GET("/balance", api.GetWalletBalance)
				wallets.GET("/transactions", api.GetUserTransactions)
				wallets.GET("/:id", api.GetWallet)
				wallets.GET("/:id/transactions", api.GetWalletTransactions)
				wallets.POST("/transfer", api.TransferMoney)
				wallets.POST("/deposit", api.DepositMoney)
				wallets.POST("/withdraw", api.WithdrawMoney)
				wallets.POST("/registration-payment", api.InitiateRegistrationPayment)
			}

			subwallets := protected.Group("/chamas/:id/subwallets")
			subwallets.Use(subwalletMiddleware)
			{
				subwallets.GET("/", subwalletHandlers.GetChamaSubWallets)
				subwallets.GET("/:type/transactions", subwalletHandlers.GetSubWalletTransactions)
				subwallets.POST("/:type/pay", subwalletHandlers.PayToSubWallet)
				subwallets.POST("/:type/withdraw", subwalletHandlers.WithdrawFromSubWallet)
			}

			receipts := protected.Group("/receipts")
			{
				receipts.GET("/transactions/:transactionId", receiptHandlers.GetTransactionReceipt)
				receipts.GET("/transactions/:transactionId/download", receiptHandlers.DownloadTransactionReceipt)
			}

			payments := protected.Group("/payments")
			{
				payments.POST("/mpesa/stk", api.InitiateMpesaSTK)
				payments.GET("/mpesa/status/:checkoutRequestId", api.GetMpesaTransactionStatus)
				payments.POST("/bank-transfer", api.InitiateBankTransfer)
			}

			notifications := protected.Group("/notifications")
			{
				notifications.GET("/", api.GetNotifications)
				notifications.GET("/unread-count", api.GetUnreadNotificationCount)
				notifications.PUT("/:id/read", api.MarkNotificationAsRead)
				notifications.POST("/read-all", api.MarkAllNotificationsAsRead)
				notifications.DELETE("/:id", api.DeleteNotification)
				notifications.POST("/system", api.SendSystemNotification)
				notifications.GET("/preferences", api.GetNotificationPreferences)
				notifications.PUT("/preferences", api.UpdateNotificationPreferences)
				notifications.GET("/sounds", api.GetAvailableNotificationSounds)
				notifications.POST("/test-sound", api.TestNotificationSound)
				notifications.GET("/settings", api.GetNotificationSettings)
				notifications.PUT("/settings", api.UpdateNotificationSettings)
				notifications.POST("/invitations/:id/accept", api.AcceptChamaInvitation)
				notifications.POST("/invitations/:id/reject", api.RejectChamaInvitation)
			}

			support := protected.Group("/support")
			{
				support.POST("/requests", api.CreateSupportRequest)
				support.GET("/requests", api.GetSupportRequests)
				support.PUT("/requests/:id", api.UpdateSupportRequest)
				support.POST("/test-request", api.CreateTestSupportRequest)
			}

			auth := protected.Group("/auth")
			{
				auth.POST("/change-password", api.ChangePassword)
				auth.GET("/login-history", api.GetLoginHistory)
				auth.POST("/logout-all-devices", api.LogoutAllDevices)
				auth.POST("/logout-device/:sessionId", api.LogoutSpecificDevice)
			}

			security := protected.Group("/security")
			{
				security.POST("/scan-file", api.ScanFile)
			}

			learning := protected.Group("/learning")
			{
				learning.GET("/categories", api.GetLearningCategories)
				learning.GET("/categories/:id", api.GetLearningCategory)
				learning.GET("/courses", api.GetLearningCourses)
				learning.GET("/courses/:id", api.GetLearningCourse)
				learning.POST("/courses/:id/start", api.StartCourse)
				learning.POST("/courses/:id/submit-quiz", api.SubmitQuizResults)
				learning.POST("/upload/image", api.UploadLearningImage)
				learning.POST("/upload/video", api.UploadLearningVideo)
				learning.POST("/upload/document", api.UploadLearningDocument)
				learning.POST("/validate-video-url", api.ValidateVideoURL)
				admin := learning.Group("/admin")
				admin.Use(func(c *gin.Context) {
					userRole := c.GetString("userRole")
					if userRole != "admin" {
						c.JSON(http.StatusForbidden, gin.H{
							"success": false,
							"error":   "Admin access required",
						})
						c.Abort()
						return
					}
					c.Next()
				})
				{
					admin.POST("/categories", api.CreateLearningCategory)
					admin.PUT("/categories/:id", api.UpdateLearningCategory)
					admin.DELETE("/categories/:id", api.DeleteLearningCategory)
					admin.POST("/courses", api.CreateLearningCourse)
					admin.PUT("/courses/:id", api.UpdateLearningCourse)
					admin.DELETE("/courses/:id", api.DeleteLearningCourse)
				}
			}

			reminders := protected.Group("/reminders")
			{
				reminders.POST("/", reminderHandlers.CreateReminder)
				reminders.GET("/", reminderHandlers.GetUserReminders)
				reminders.GET("/:id", reminderHandlers.GetReminder)
				reminders.PUT("/:id", reminderHandlers.UpdateReminder)
				reminders.DELETE("/:id", reminderHandlers.DeleteReminder)
				reminders.POST("/:id/toggle", reminderHandlers.ToggleReminder)
			}

			polls := protected.Group("/chamas/:id/polls")
			{
				polls.POST("/", pollsHandlers.CreatePoll)
				polls.GET("/", pollsHandlers.GetChamaPolls)
				polls.GET("/active", pollsHandlers.GetActivePolls)
				polls.GET("/results", pollsHandlers.GetPollResults)
				polls.GET("/:pollId", pollsHandlers.GetPollDetails)
				polls.POST("/:pollId/vote", pollsHandlers.CastVote)
				polls.POST("/role-escalation", pollsHandlers.CreateRoleEscalationPoll)
				polls.GET("/members", pollsHandlers.GetChamaMembers)
			}

			votes := protected.Group("/chamas/:id/votes")
			{
				votes.POST("", api.CreateVote)
				votes.GET("", api.GetChamaVotes)
				votes.GET("/active", api.GetActiveVotes)
				votes.GET("/results", api.GetVoteResults)
				votes.GET("/:voteId", api.GetVoteDetails)
				votes.POST("/:voteId/vote", api.CastVoteOnItem)
				votes.POST("/role-escalation", api.CreateRoleEscalationVote)
			}

			disbursements := protected.Group("/chamas/:id")
			{
				disbursements.GET("/disbursements", disbursementHandlers.GetDisbursementBatches)
				disbursements.POST("/disbursements/:batchId/process", disbursementHandlers.ProcessDisbursementBatch)
				disbursements.POST("/disbursements/:batchId/approve", disbursementHandlers.ApproveDisbursementBatch)
				disbursements.GET("/transparency", disbursementHandlers.GetTransparencyLog)
			}

			reports := protected.Group("/chamas/:id")
			{
				reports.GET("/reports", reportsHandlers.GetFinancialReports)
				reports.POST("/reports", reportsHandlers.GenerateFinancialReport)
				reports.GET("/reports/:reportId/download", reportsHandlers.DownloadFinancialReport)
			}

			account := protected.Group("/chamas/:id")
			{
				account.GET("/welfare/eligible-members", accountHandlers.GetEligibleWelfareMembers)
				account.GET("/transparency-feed", accountHandlers.GetTransparencyFeed)
				account.GET("/account-notifications", accountHandlers.GetAccountNotifications)
				account.GET("/validate-security", accountHandlers.ValidateSystemSecurity)
			}

			globalAccount := protected.Group("/account")
			{
				globalAccount.POST("/security-events", accountHandlers.LogSecurityEvent)
			}

			userSearch := protected.Group("/user-search")
			{
				userSearch.GET("/search", userSearchHandlers.SearchUsers)
				userSearch.GET("/search/advanced", userSearchHandlers.SearchUsersAdvanced)
				userSearch.GET("/:userId/profile", userSearchHandlers.GetUserProfile)
			}

			contributions := protected.Group("/contributions")
			{
				contributions.GET("", api.GetContributions)
				contributions.POST("", api.MakeContribution)
				contributions.GET("/:id", api.GetContribution)
				contributions.GET("/chamas/:chamaId/members", api.GetChamaMembersForContributions)
				contributions.GET("/chamas/:chamaId/merry-go-round-amount", api.GetMerryGoRoundContributionAmount)
			}

			meetings := protected.Group("/meetings")
			{
				meetings.GET("/", api.GetMeetings)
				meetings.GET("/user", api.GetUserMeetings)
				meetings.POST("/", api.CreateMeeting)
				meetings.GET("/:id", api.GetMeeting)
				meetings.PUT("/:id", api.UpdateMeeting)
				meetings.PATCH("/:id", api.UpdateMeeting)
				meetings.DELETE("/:id", api.DeleteMeeting)
				meetings.POST("/:id/join", api.JoinMeeting)
				meetings.POST("/:id/attendance", api.MarkAttendance)
				meetings.GET("/:id/attendance", api.GetMeetingAttendance)
				meetings.POST("/:id/documents", api.UploadMeetingDocument)
				meetings.GET("/:id/documents", api.GetMeetingDocuments)
				meetings.DELETE("/:id/documents/:docId", api.DeleteMeetingDocument)
				meetings.POST("/:id/minutes", api.SaveMeetingMinutes)
				meetings.PUT("/:id/minutes", api.UpdateMeetingMinutes)
				meetings.GET("/:id/minutes", api.GetMeetingMinutes)
				meetings.GET("/:id/calendar/add-url", api.GetGoogleCalendarAddEventURL)
				meetings.POST("/:id/calendar/create", api.CreateGoogleCalendarEvent)
			}

			onlineMeetings := protected.Group("/online-meetings")
			{
				onlineMeetings.Use(meetingAuthPassthrough)
				onlineMeetings.Any("/*path", proxyTo(cfg.MeetingServiceURL, "/online-meetings"))
			}

			chat := apiGroup.Group("/chat")
			{
				chat.Use(authMiddleware.AuthRequired())
				chat.Use(meetingAuthPassthrough)
				chat.Any("/*path", proxyTo(cfg.ChatServiceURL, "/chat"))
			}

			chatWS := apiGroup.Group("/chat-ws")
			{
				chatWS.POST("/ws-token", authMiddleware.AuthRequired(), chatWSTokenHandler(cfg))
				chatWS.GET("/ws", chatWSHandler(cfg))
			}

			merryGoRounds := protected.Group("/merry-go-rounds")
			{
				merryGoRounds.GET("/", api.GetMerryGoRounds)
				merryGoRounds.GET("/:id", api.GetMerryGoRound)
				merryGoRounds.GET("/:id/payments", api.GetMerryGoRoundPayments)
				merryGoRounds.POST("/", api.CreateMerryGoRound)
				merryGoRounds.GET("/contribution-status/:chamaId", api.CheckUserContributionStatus)
			}

			welfare := protected.Group("/welfare")
			{
				welfare.GET("/", api.GetWelfareRequests)
				welfare.POST("/", api.CreateWelfareRequest)
				welfare.GET("/:id", api.GetWelfareRequest)
				welfare.PUT("/:id", api.UpdateWelfareRequest)
				welfare.DELETE("/:id", api.DeleteWelfareRequest)
				welfare.POST("/:id/vote", api.VoteOnWelfareRequest)
				welfare.POST("/contribute", api.ContributeToWelfare)
				welfare.GET("/:id/contributions", api.GetWelfareContributions)
			}

			loans := protected.Group("/loans")
			loans.Use(disbursementMiddleware)
			{
				loans.GET("/", api.GetLoanApplications)
				loans.POST("/apply", api.CreateLoanApplication)
				loans.GET("/:id", api.GetLoanApplication)
				loans.PUT("/:id", api.UpdateLoanApplication)
				loans.DELETE("/:id", api.DeleteLoanApplication)
				loans.POST("/:id/approve", api.ApproveLoan)
				loans.POST("/:id/reject", api.RejectLoan)
				loans.POST("/:id/disburse", api.DisburseLoan)
				loans.POST("/:id/guarantor-response", api.RespondToGuarantorRequest)
				loans.GET("/guarantor-requests", api.GetGuarantorRequests)
				loans.POST("/guarantors/:guarantorId/respond", api.RespondToGuarantorRequest)

				loans.POST("/:id/loan-types", api.CreateLoanType)
				loans.GET("/:id/loan-types", api.GetChamaLoanTypes)
			}
			loanTypes := protected.Group("/loans/loan-types")
			{
				loanTypes.GET("/:loanTypeId", api.GetLoanType)
				loanTypes.PUT("/:loanTypeId", api.UpdateLoanType)
				loanTypes.DELETE("/:loanTypeId", api.DeleteLoanType)
			}

			if testDataGenerator != nil {
				testData := protected.Group("/test-data")
				testData.Use(func(c *gin.Context) {
					if os.Getenv("ENVIRONMENT") == "production" && os.Getenv("ENABLE_TEST_DATA_GENERATOR") != "true" {
						c.JSON(http.StatusForbidden, gin.H{"success": false, "error": "Test data endpoints disabled in production"})
						c.Abort()
						return
					}
					if testDataGenerator != nil {
						c.Set("testDataGenerator", testDataGenerator)
					}
					c.Next()
				})
				{
					testData.GET("/stats", api.GetTestDataStats)
					testData.POST("/generate", api.GenerateTestData)
					testData.POST("/start", api.StartTestDataGenerator)
					testData.POST("/stop", api.StopTestDataGenerator)
					testData.POST("/reset", api.ResetTestDataStats)
				}
			}
		}
	}
}

func isWebSocket(r *http.Request) bool {
	return strings.EqualFold(r.Header.Get("Upgrade"), "websocket")
}

func proxyTo(targetBase string, _ string) gin.HandlerFunc {
	return func(c *gin.Context) {
		path := c.Param("path")
		query := c.Request.URL.RawQuery

		// Build target URL: targetBase + path (path already has leading /)
		targetURL := targetBase + path
		if query != "" {
			targetURL += "?" + query
		}

		if isWebSocket(c.Request) {
			proxyWebSocket(c, targetURL)
			return
		}

		u, _ := url.Parse(targetURL)
		proxy := httputil.NewSingleHostReverseProxy(u)
		proxy.FlushInterval = 100 * time.Millisecond
		proxy.Director = func(req *http.Request) {
			req.URL.Scheme = u.Scheme
			req.URL.Host = u.Host
			req.URL.Path = u.Path
			req.Host = u.Host
			if u.RawQuery != "" {
				req.URL.RawQuery = u.RawQuery
			}
			req.Header.Del("Authorization")
			if userID := c.GetString("userID"); userID != "" {
				req.Header.Set("X-User-ID", userID)
			}
		}
		proxy.ServeHTTP(c.Writer, c.Request)
	}
}

func proxyWebSocket(c *gin.Context, targetURL string) {
	headers := make(http.Header)
	for k, v := range c.Request.Header {
		headers[k] = v
	}
	headers.Del("Host")
	headers.Del("Upgrade")
	headers.Del("Connection")
	headers.Del("Sec-WebSocket-Key")
	headers.Del("Sec-WebSocket-Version")
	headers.Del("Sec-WebSocket-Protocol")

	wsURL := targetURL
	if strings.HasPrefix(wsURL, "http://") {
		wsURL = "ws://" + strings.TrimPrefix(wsURL, "http://")
	} else if strings.HasPrefix(wsURL, "https://") {
		wsURL = "wss://" + strings.TrimPrefix(wsURL, "https://")
	}

	backendConn, _, err := websocket.DefaultDialer.Dial(wsURL, headers)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "failed to connect to service"})
		return
	}
	defer backendConn.Close()

	upgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool { return true },
	}
	clientConn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	defer clientConn.Close()

	errChan := make(chan error, 2)
	go copyWebSocketMessages(clientConn, backendConn, errChan)
	go copyWebSocketMessages(backendConn, clientConn, errChan)
	<-errChan
}

func copyWebSocketMessages(dst, src *websocket.Conn, errChan chan<- error) {
	for {
		msgType, msg, err := src.ReadMessage()
		if err != nil {
			errChan <- err
			return
		}
		if err := dst.WriteMessage(msgType, msg); err != nil {
			errChan <- err
			return
		}
	}
}

func meetingAuthPassthrough(c *gin.Context) {
	c.Next()
}

var chatSessions = struct {
	store map[string]string
	mu    sync.Mutex
}{store: make(map[string]string)}

var chatSessionStore = struct {
	store map[string]string
	mu    sync.Mutex
}{store: make(map[string]string)}

func chatWSTokenHandler(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetString("userID")
		if userID == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		sessionID := uuid.New().String()
		chatSessionStore.mu.Lock()
		chatSessionStore.store[sessionID] = userID
		chatSessionStore.mu.Unlock()

		go func(id string) {
			time.Sleep(5 * time.Minute)
			chatSessionStore.mu.Lock()
			delete(chatSessionStore.store, id)
			chatSessionStore.mu.Unlock()
		}(sessionID)

		c.JSON(http.StatusOK, gin.H{
			"sessionId": sessionID,
			"expiresIn": 300,
		})
	}
}

func chatWSHandler(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		sessionID := c.Query("session")
		if sessionID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "session required"})
			return
		}

		chatSessionStore.mu.Lock()
		userID, ok := chatSessionStore.store[sessionID]
		chatSessionStore.mu.Unlock()

		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired session"})
			return
		}

		roomID := c.Query("roomId")
		if roomID == "" {
			roomID = "main"
		}

		targetURL := fmt.Sprintf("%s/rooms/%s/ws?session=%s", cfg.ChatServiceURL, roomID, sessionID)
		targetURL = strings.Replace(targetURL, "http://", "ws://", 1)
		targetURL = strings.Replace(targetURL, "https://", "wss://", 1)

		headers := make(http.Header)
		for k, v := range c.Request.Header {
			headers[k] = v
		}
		headers.Set("X-User-ID", userID)
		headers.Del("Host")
		headers.Del("Cookie")
		headers.Del("Authorization")
		headers.Del("Upgrade")
		headers.Del("Connection")
		headers.Del("Sec-WebSocket-Key")
		headers.Del("Sec-WebSocket-Version")
		headers.Del("Sec-WebSocket-Protocol")
		headers.Del("Sec-WebSocket-Extensions")

		dialer := &websocket.Dialer{
			HandshakeTimeout: 10 * time.Second,
			NetDialContext: (&net.Dialer{
				Timeout:   10 * time.Second,
				KeepAlive: 30 * time.Second,
			}).DialContext,
		}
		backendConn, _, err := dialer.Dial(targetURL, headers)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "failed to connect to chat service"})
			return
		}
		defer backendConn.Close()

		upgrader := websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool { return true },
		}
		clientConn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			return
		}
		defer clientConn.Close()

		errChan := make(chan error, 2)
		go copyWebSocketMessages(clientConn, backendConn, errChan)
		go copyWebSocketMessages(backendConn, clientConn, errChan)
		<-errChan
	}
}
