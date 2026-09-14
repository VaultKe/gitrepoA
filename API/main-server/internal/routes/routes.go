package routes

import (
	"context"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"strings"
	"time"

	"vaultke-backend/config"
	"vaultke-backend/database"
	"vaultke-backend/internal/api"
	"vaultke-backend/internal/middleware"
	"vaultke-backend/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}

// SetupRoutes registers all route groups and middleware on the given Gin router.
func SetupRoutes(
	router *gin.Engine,
	cfg *config.Config,
	db *database.Database,
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
	devicePolicyService *services.DevicePolicyService,
	cache services.Cache,
) {
	// HTML templates for OAuth pages
	router.LoadHTMLGlob("templates/*")

	// Global middleware
	// NOTE: CORS middleware is registered centrally in main.go to avoid
	// multiple registrations across the codebase. Do not register it here.

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

	// Cache middleware: cache GET responses for idempotent read endpoints
	router.Use(middleware.CacheMiddleware(cache))

	// Health check endpoints and static pages.
	// `commit` reflects the exact source this binary was built from — use it to
	// confirm a deploy actually shipped the latest code (Render sets
	// RENDER_GIT_COMMIT automatically).
	buildCommit := firstNonEmpty(os.Getenv("RENDER_GIT_COMMIT"), os.Getenv("GIT_COMMIT"), os.Getenv("SOURCE_COMMIT"), "unknown")
	startedAt := time.Now().UTC().Format(time.RFC3339)
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "ok",
			"message":   "VaultKe API is running",
			"version":   "1.0.0",
			"commit":    buildCommit,
			"startedAt": startedAt,
		})
	})

	router.GET("/privacy-policy", func(c *gin.Context) {
		c.HTML(http.StatusOK, "privacy-policy.html", nil)
	})
	router.GET("/terms-of-service", func(c *gin.Context) {
		c.HTML(http.StatusOK, "terms-of-service.html", nil)
	})

	router.Static("/notification_sound", "./notification_sound")

	// Authentication middleware
	authMiddleware := middleware.NewAuthMiddleware(authService)

	// Context injection middleware uses primary for all requests to avoid
	// read-replica lag issues that cause "relation does not exist" errors
	// on freshly-migrated databases.
	dbMiddleware := func(c *gin.Context) {
		c.Set("db", db.WriteDB())
		c.Next()
	}

	configMiddleware := func(c *gin.Context) {
		c.Set("config", cfg)
		c.Next()
	}

	// Known Safaricom M-Pesa callback IPs (documented at developer.safaricom.co.ke)
	safaricomCallbackIPs := []string{
		"196.201.214.133",
		"196.201.214.138",
		"196.201.213.114",
		"196.201.212.61",
		"196.201.212.73",
	}

	mpesaCallbackAuthMiddleware := func(c *gin.Context) {
		// In sandbox/development, skip IP whitelist but still require the shared secret
		if cfg.Environment != "production" {
			// Only validate shared secret in non-prod
			if cfg.MpesaCallbackSecret != "" {
				if c.GetHeader("X-M-Pesa-Token") != cfg.MpesaCallbackSecret {
					c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid callback token"})
					c.Abort()
					return
				}
			}
			c.Next()
			return
		}

		// Production: enforce IP whitelist
		clientIP := c.ClientIP()
		allowed := false
		for _, ip := range safaricomCallbackIPs {
			if clientIP == ip {
				allowed = true
				break
			}
		}
		if !allowed {
			log.Printf("[MPESA_CALLBACK] Rejected callback from unauthorized IP: %s", clientIP)
			c.JSON(http.StatusForbidden, gin.H{"error": "Unauthorized callback source"})
			c.Abort()
			return
		}

		// Production: also require shared secret
		if cfg.MpesaCallbackSecret != "" {
			if c.GetHeader("X-M-Pesa-Token") != cfg.MpesaCallbackSecret {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid callback token"})
				c.Abort()
				return
			}
		}

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
			publicPayments.POST("/mpesa/callback", mpesaCallbackAuthMiddleware, api.HandleMpesaCallback)
			publicPayments.POST("/mpesa/b2c/callback", mpesaCallbackAuthMiddleware, api.HandleMpesaB2CCallback)
			publicPayments.POST("/mpesa/b2c/timeout", mpesaCallbackAuthMiddleware, api.HandleMpesaB2CTimeout)
		}

		publicAuth := apiGroup.Group("/auth")
		{
			publicAuth.GET("/google/drive", api.InitiateGoogleDriveAuth)
			publicAuth.GET("/google/callback", api.HandleGoogleDriveCallback)
		}

		// Public APK distribution routes — accessible without authentication.
		// These serve APK downloads and version-check data to end users.
		publicApk := apiGroup.Group("/apk")
		publicApk.Use(dbMiddleware)
		publicApk.Use(configMiddleware)
		{
			publicApk.GET("/latest", api.GetLatestApk)
			publicApk.GET("/version-check", api.VersionCheck)
			publicApk.GET("/download/:version", api.DownloadApk)
			publicApk.GET("/history", api.GetApkHistory)
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

				users.POST("/avatar", func(c *gin.Context) {
					authHandlers.UploadAvatar(c)
				})
				users.GET("/search-by-credentials", api.SearchUserByCredentials)
				users.GET("/search-by-national-id", api.SearchUserByIdNumber)
				users.GET("/search-by-phone", api.SearchUserByPhone)
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
				chamas.POST("/", func(c *gin.Context) {
					api.CreateChama(c, cfg.GetUploadPath())
				})
				chamas.GET("/my", api.GetUserChamas)
				chamas.GET("/:id", api.GetChama)
				chamas.PUT("/:id", func(c *gin.Context) {
					api.UpdateChama(c, cfg.GetUploadPath())
				})
				chamas.DELETE("/:id", api.DeleteChama)
				chamas.POST("/:id/leave", api.LeaveChama)
				chamas.GET("/:id/members", api.GetChamaMembers)
				chamas.GET("/:id/members/:memberId", api.GetChamaMember)
				chamas.DELETE("/:id/members/:memberId", api.RemoveMember)
				chamas.GET("/:id/members/:memberId/role", api.GetMemberRole)
				chamas.GET("/:id/members/:memberId/stats", api.GetChamaMemberStatistics)
				chamas.GET("/:id/members/export", api.ExportChamaMembers)
				chamas.GET("/:id/transactions", api.GetChamaTransactions)
				chamas.GET("/:id/transactions/report", api.DownloadChamaTransactionsReport)
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
				chamas.GET("/:id/subscription-payments/report", api.DownloadChamaSubscriptionReport)
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
				wallets.GET("/transactions/report", api.DownloadUserTransactionsReport)
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
				notifications.POST("/push-token", api.RegisterPushToken)
				notifications.POST("/push-token/remove", api.UnregisterPushToken)
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
				// Register both with and without the trailing slash — the app calls
				// `/chamas/:id/polls` (no slash) and RedirectTrailingSlash is off.
				polls.POST("", pollsHandlers.CreatePoll)
				polls.POST("/", pollsHandlers.CreatePoll)
				polls.GET("", pollsHandlers.GetChamaPolls)
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

				// Two-signature merry-go-round payout: treasurer initiates (amount =
				// what has actually been collected for the round), chairperson
				// confirms with an e-mailed code, and the B2C payout to the
				// recipient's M-Pesa fires immediately on confirmation.
				disbursements.GET("/mgr-disbursements", disbursementHandlers.ListMerryGoRoundDisbursements)
				disbursements.POST("/mgr-disbursements/:cycleId/initiate", disbursementHandlers.InitiateMerryGoRoundDisbursement)
				disbursements.POST("/mgr-disbursements/:cycleId/confirm", disbursementHandlers.ConfirmMerryGoRoundDisbursement)
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
				meetings.POST("/:id/documents", func(c *gin.Context) {
					api.UploadMeetingDocument(c, cfg.GetUploadPath())
				})
				meetings.GET("/:id/documents", api.GetMeetingDocuments)
				meetings.DELETE("/:id/documents/:docId", api.DeleteMeetingDocument)
				meetings.POST("/:id/minutes", api.SaveMeetingMinutes)
				meetings.PUT("/:id/minutes", api.UpdateMeetingMinutes)
				meetings.GET("/:id/minutes", api.GetMeetingMinutes)
			}

			onlineMeetings := protected.Group("/online-meetings")
			{
				onlineMeetings.Use(meetingAuthPassthrough)
				onlineMeetings.Any("/*path", proxyTo(cfg.MeetingServiceURL, "/online-meetings"))
			}

			merryGoRounds := protected.Group("/merry-go-rounds")
			{
				merryGoRounds.GET("/", api.GetMerryGoRounds)
				merryGoRounds.GET("/:id", api.GetMerryGoRound)
				merryGoRounds.GET("/:id/payments", api.GetMerryGoRoundPayments)
				merryGoRounds.POST("/", api.CreateMerryGoRound)
				merryGoRounds.GET("/contribution-status/:chamaId", api.CheckUserContributionStatus)
				// add-url needs no Google account connected at all -- it just
				// hands back a pre-filled calendar.google.com link the user
				// taps to confirm adding it themselves, so it's the route to
				// reach for by default. create is the lower-friction *result*
				// (one tap, no leaving the app) for a user who already has a
				// Google account connected, but depends on that connection.
				merryGoRounds.GET("/:id/calendar/add-url", api.GetMerryGoRoundCalendarAddEventURL)
				merryGoRounds.POST("/:id/calendar/create", api.CreateMerryGoRoundCalendarEvent)
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
				loans.GET("/:id/repayment-history", api.GetLoanRepaymentHistory)
				loans.GET("/:id/report", api.DownloadLoanReport)
				loans.GET("/:id", api.GetLoanApplication)
				loans.PUT("/:id", api.UpdateLoanApplication)
				loans.DELETE("/:id", api.DeleteLoanApplication)
				loans.POST("/:id/approve", api.InitiateLoanApproval)
				loans.POST("/:id/approve/confirm", api.ConfirmLoanApproval)
				loans.POST("/:id/reject", api.RejectLoan)
				loans.POST("/:id/cancel", api.CancelLoan)
				loans.POST("/:id/disburse", api.DisburseLoan)
				loans.POST("/:id/payments", api.RecordLoanPayment)
				loans.GET("/:id/guarantors", api.GetLoanGuarantors)
				loans.GET("/:id/referees", api.GetLoanReferees)
				loans.GET("/:id/fines", api.GetLoanFines)
				loans.POST("/:id/guarantor-response", api.RespondToGuarantorRequest)
				loans.POST("/:id/referee-response", api.RespondToRefereeRequest)
				loans.GET("/guarantor-requests", api.GetGuarantorRequests)
				loans.GET("/referee-requests", api.GetRefereeRequests)
				loans.POST("/guarantors/:guarantorId/respond", api.RespondToGuarantorRequest)
				loans.POST("/referees/:refereeId/respond", api.RespondToRefereeRequest)

				loans.POST("/:id/loan-types", api.CreateLoanType)
				loans.GET("/:id/loan-types", api.GetChamaLoanTypes)
			}
			loanTypes := protected.Group("/loans/loan-types")
			{
				loanTypes.GET("/:loanTypeId", api.GetLoanType)
				loanTypes.PUT("/:loanTypeId", api.UpdateLoanType)
				loanTypes.DELETE("/:loanTypeId", api.DeleteLoanType)
			}

			apk := protected.Group("/apk")
			apk.Use(configMiddleware)
			{
				apk.POST("/upload", api.UploadApk)
				apk.DELETE("/version/:id", api.DeleteApkVersion)
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
		// Use a custom transport with sane timeouts so a slow backend does not
		// pin a proxy goroutine forever.
		proxy.Transport = &http.Transport{
			Proxy:                 http.ProxyFromEnvironment,
			TLSHandshakeTimeout:   10 * time.Second,
			IdleConnTimeout:       90 * time.Second,
			ExpectContinueTimeout: 1 * time.Second,
			ResponseHeaderTimeout: 30 * time.Second,
			DisableKeepAlives:     true,
		}
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
	ctx := c.Request.Context()

	go copyWebSocketMessages(clientConn, backendConn, errChan, ctx)
	go copyWebSocketMessages(backendConn, clientConn, errChan, ctx)

	// Wait for either side to finish, the context to cancel, or an overall
	// reasonable timeout so a hung proxy does not pin a goroutine forever.
	select {
	case err := <-errChan:
		if err != nil {
			log.Printf("proxy ws error: %v", err)
		}
	case <-ctx.Done():
		log.Printf("proxy ws cancelled: %v", ctx.Err())
	case <-time.After(5 * time.Minute):
		log.Println("proxy ws reached max duration")
	}
}

func copyWebSocketMessages(dst, src *websocket.Conn, errChan chan<- error, ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			errChan <- ctx.Err()
			return
		default:
		}

		msgType, msg, err := src.ReadMessage()
		if err != nil {
			// Normal websocket closes (1000-1006) are expected in a proxy;
			// only surface true errors to the caller.
			if closeErr, ok := err.(*websocket.CloseError); ok && closeErr.Code >= websocket.CloseNormalClosure && closeErr.Code <= websocket.CloseAbnormalClosure {
				return
			}
			errChan <- err
			return
		}

		select {
		case <-ctx.Done():
			errChan <- ctx.Err()
			return
		default:
		}

		if err := dst.WriteMessage(msgType, msg); err != nil {
			if closeErr, ok := err.(*websocket.CloseError); ok && closeErr.Code >= websocket.CloseNormalClosure && closeErr.Code <= websocket.CloseAbnormalClosure {
				return
			}
			errChan <- err
			return
		}
	}
}

func meetingAuthPassthrough(c *gin.Context) {
	c.Next()
}
