package main

import (
	"context"
	"crypto/tls"
	"net/http"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"

	"vaultke-backend/config"
	"vaultke-backend/database"
	"vaultke-backend/internal/api"
	"vaultke-backend/internal/routes"
	"vaultke-backend/internal/services"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment variables")
	}

	// Initialize configuration
	cfg := config.Load()

	// Initialize database
	db, err := database.Initialize(cfg.DatabaseURL)
	if err != nil {
		log.Fatal("Failed to initialize database:", err)
	}
	defer db.Close()

	// Run database migrations
	if err := database.Migrate(db); err != nil {
		log.Fatal("Failed to run migrations:", err)
	}

	// Run notification system migrations
	migrationManager := database.NewMigrationManager(db)
	if err := migrationManager.RunMigrations(); err != nil {
		log.Fatal("Failed to run notification system migrations:", err)
	}

	// Ensure loan_types table/indexes exist
	if err := database.EnsureLoanTypesTable(db); err != nil {
		log.Fatalf("Failed to ensure loan types table: %v", err)
	}

	// Initialize Gin router
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()

	// Disable trailing slash redirects to prevent CORS issues
	router.RedirectTrailingSlash = false

	// Add memory monitoring middleware
	router.Use(func(c *gin.Context) {
		start := time.Now()
		c.Next()
		duration := time.Since(start)

		// Log memory-intensive requests
		if duration > 5*time.Second {
			log.Printf("🚨 SLOW REQUEST: %s %s took %v", c.Request.Method, c.Request.URL.Path, duration)
		}
	})

	// Initialize services
	authService := services.NewAuthService(db, cfg.JWTSecret, cfg.JWTExpiration)

	// Initialize email service
	emailService := services.NewEmailService()

	// Initialize device policy service for single-device enforcement
	devicePolicyService := services.NewDevicePolicyService(db, authService, emailService)

	// Initialize password reset service
	passwordResetService := services.NewPasswordResetService(db, emailService)

	// Initialize password reset table
	if err := passwordResetService.InitializePasswordResetTable(); err != nil {
		log.Fatalf("Failed to initialize password reset table: %v", err)
	}

	// Initialize email verification service
	emailVerificationService := services.NewEmailVerificationService(db, emailService)

	// Initialize email verification table
	if err := emailVerificationService.InitializeEmailVerificationTable(); err != nil {
		log.Fatalf("Failed to initialize email verification table: %v", err)
	}

	// Initialize notification scheduler for reminders
	notificationScheduler := services.NewNotificationScheduler(db)
	notificationScheduler.Start()

	// Start STK push reconciler to catch cancelled/failed payments that never got callbacks
	cfgForReconciler := cfg
	services.StartSTKReconciler(db, cfgForReconciler, 10*time.Minute, 15*time.Minute)

	// Initialize scheduler service for meeting auto-unlock
	authHandlers := api.NewAuthHandlers(db, cfg.JWTSecret, cfg.JWTExpiration, devicePolicyService)
	reminderHandlers := api.NewReminderHandlers(db)

	pollsHandlers := api.NewPollsHandlers(db)
	disbursementHandlers := api.NewDisbursementHandlers(db, cfg)
	reportsHandlers := api.NewFinancialReportsHandlers(db)
	userSearchHandlers := api.NewUserSearchHandlers(db)
	receiptHandlers := api.NewReceiptHandlers(db)
	accountHandlers := api.NewAccountHandlers(db)
	subwalletHandlers := api.NewSubWalletHandlers(db, cfg)
	disbursementService := services.NewDisbursementService(db, cfg)

	// Initialize Test Data Generator (dev/test only)
	var testDataGenerator *services.TestDataGenerator
	if cfg.Environment != "production" || os.Getenv("ENABLE_TEST_DATA_GENERATOR") == "true" {
		testDataGenerator = services.NewTestDataGenerator(db)
		if os.Getenv("AUTO_START_TEST_DATA") == "true" {
			testDataGenerator.Start(5 * time.Minute)
		}
	}

	// Initialize meeting service for attendance endpoints
	api.InitializeMeetingService(db, nil)

	// Register routes and middleware
	routes.SetupRoutes(router, cfg, db, authService, passwordResetService, emailVerificationService, authHandlers, reminderHandlers, pollsHandlers, disbursementHandlers, reportsHandlers, userSearchHandlers, receiptHandlers, accountHandlers, testDataGenerator, subwalletHandlers, disbursementService, devicePolicyService)

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8085"
	}

	// Configure TLS 1.3
	tlsConfig := &tls.Config{
		MinVersion:               tls.VersionTLS13,
		CurvePreferences:         []tls.CurveID{tls.X25519, tls.CurveP256},
		PreferServerCipherSuites: true,
		CipherSuites: []uint16{
			tls.TLS_AES_256_GCM_SHA384,
			tls.TLS_AES_128_GCM_SHA256,
			tls.TLS_CHACHA20_POLY1305_SHA256,
		},
	}

	// Configure server to handle both IPv4 and IPv6
	server := &http.Server{
		Addr:      ":" + port,
		Handler:   router,
		TLSConfig: tlsConfig,
		// Add timeouts for better stability
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	log.Printf("VaultKe API server starting on port %s", port)

	// Check if TLS certificates are available
	certFile := os.Getenv("TLS_CERT_FILE")
	keyFile := os.Getenv("TLS_KEY_FILE")

	// Graceful shutdown
	go func() {
		var err error
		if certFile != "" && keyFile != "" {
			err = server.ListenAndServeTLS(certFile, keyFile)
		} else {
			err = server.ListenAndServe()
		}

		if err != nil && err != http.ErrServerClosed {
			log.Fatal("Server failed to start:", err)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	// Stop notification scheduler
	notificationScheduler.Stop()

	// Create a deadline to wait for
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Shutdown server
	if err := server.Shutdown(ctx); err != nil {
		log.Fatal("Server forced to shutdown:", err)
	}

	log.Println("Server shutdown complete")
}
