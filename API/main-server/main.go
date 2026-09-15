package main

import (
	"context"
	"crypto/tls"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"

	"vaultke-backend/config"
	"vaultke-backend/database"
	"vaultke-backend/internal/api"
	"vaultke-backend/internal/middleware"
	"vaultke-backend/internal/routes"
	"vaultke-backend/internal/services"
	"vaultke-backend/internal/storage"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment variables")
	}

	// Initialize configuration
	cfg := config.Load()

	// Validate upload directory exists and is writable
	uploadDir := cfg.GetUploadPath()
	if err := os.MkdirAll(uploadDir, 0o755); err != nil {
		log.Printf("[WARN] Failed to create upload directory %s: %v", uploadDir, err)
	} else {
		testFile := filepath.Join(uploadDir, ".write_test")
		if f, err := os.Create(testFile); err == nil {
			f.Close()
			os.Remove(testFile)
			// log.Printf("[INFO] Upload directory validated: %s", uploadDir)
		} else {
			log.Printf("[WARN] Upload directory %s is not writable: %v", uploadDir, err)
		}
	}

	// Initialize database
	db, err := database.Initialize(cfg.PrimaryDatabaseURL, cfg.ReplicaDatabaseURL)
	if err != nil {
		log.Fatal("Failed to initialize database:", err)
	}
	defer func() {
		if err := db.Close(); err != nil {
			log.Printf("Failed to close database connections: %v", err)
		}
	}()

	// Check primary/replica connectivity and log status
	log.Println("Checking database connectivity...")
	if db.Primary == nil {
		log.Println("Primary DB object is nil — initialization failed earlier")
	} else {
		if err := db.Primary.Ping(); err != nil {
			log.Printf("Primary DB not reachable: %v", err)
		} else {
			log.Println("Primary DB reachable")
		}
	}

	if db.Replica == nil {
		log.Println("Replica DB object is nil — reads will use primary")
	} else if db.Replica == db.Primary {
		log.Println("No separate replica configured; replica points to primary")
	} else {
		if err := db.Replica.Ping(); err != nil {
			log.Printf("Replica DB not reachable: %v", err)
		} else {
			log.Println("Replica DB reachable")
		}
	}

	// Run database migrations on the primary database
	if err := database.Migrate(db.WriteDB()); err != nil {
		log.Fatal("Failed to run migrations:", err)
	}

	// Run notification system migrations on the primary database
	migrationManager := database.NewMigrationManager(db.WriteDB())
	if err := migrationManager.RunMigrations(); err != nil {
		log.Fatal("Failed to run notification system migrations:", err)
	}

	// Ensure loan_types table/indexes exist on primary
	if err := database.EnsureLoanTypesTable(db.WriteDB()); err != nil {
		log.Fatalf("Failed to ensure loan types table: %v", err)
	}

	// Initialize Gin router
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()

	// Allow large APK uploads (up to 200MB) to be parsed into memory.
	// Gin's default multipart limit is 32MB, which is too small for APK files.
	router.MaxMultipartMemory = 200 << 20
	router.Use(gin.CustomRecoveryWithWriter(gin.DefaultErrorWriter, func(c *gin.Context, recovered interface{}) {
		if c.Writer.Status() == 0 {
			c.Status(http.StatusInternalServerError)
		}
		c.Header("Content-Type", "application/json")
		log.Printf("[RECOVERY] panic recovered: %v", recovered)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Internal server error",
		})
	}))

	// Disable trailing slash redirects to prevent CORS issues
	router.RedirectTrailingSlash = false

	// Add memory and slow-request monitoring middleware
	slowQueryThreshold := 5 * time.Second
	if cfg.EnableSlowQueryLog {
		slowQueryThreshold = cfg.SlowQueryThreshold
	}
	router.Use(func(c *gin.Context) {
		start := time.Now()
		c.Next()
		duration := time.Since(start)

		// Skip slow-request logging for websocket upgrades; they are long-lived
		// by design and the proxy already logs explicit lifecycle events.
		if strings.EqualFold(c.Request.Header.Get("Upgrade"), "websocket") {
			return
		}

		// Log slow requests
		if duration > slowQueryThreshold {
			// log.Printf("🚨 SLOW REQUEST: %s %s took %v", c.Request.Method, c.Request.URL.Path, duration)
		}
	})

	// Initialize cache — uses Redis when REDIS_URL is configured,
	// otherwise an in-memory LRU cache.
	cache := services.NewCache(cfg.RedisURL)
	defer cache.Close()
	log.Printf("Cache initialized: %s", cfg.RedisURL)

	// Initialize services using primary database for write-capable components.
	primaryDB := db.WriteDB()
	authService := services.NewAuthService(primaryDB, cfg.JWTSecret, cfg.JWTExpiration)

	// Initialize email service
	emailService := services.NewEmailService()

	// Initialize device policy service for single-device enforcement
	devicePolicyService := services.NewDevicePolicyService(primaryDB, authService, emailService)

	// Initialize password reset service
	passwordResetService := services.NewPasswordResetService(primaryDB, emailService)

	// Initialize password reset table
	if err := passwordResetService.InitializePasswordResetTable(); err != nil {
		log.Fatalf("Failed to initialize password reset table: %v", err)
	}

	// Initialize email verification service
	emailVerificationService := services.NewEmailVerificationService(primaryDB, emailService)

	// Initialize email verification table
	if err := emailVerificationService.InitializeEmailVerificationTable(); err != nil {
		log.Fatalf("Failed to initialize email verification table: %v", err)
	}

	// Initialize notification scheduler for reminders
	notificationScheduler := services.NewNotificationScheduler(primaryDB)
	notificationScheduler.Start()

	// Start STK push reconciler to catch cancelled/failed payments that never got callbacks
	cfgForReconciler := cfg
	services.StartSTKReconciler(primaryDB, cfgForReconciler, 10*time.Minute, 15*time.Minute)

	// Keep every meeting's status column true to its schedule -- scheduled ->
	// ongoing the moment it starts, ongoing -> completed the moment its
	// duration is up -- instead of leaving it to whichever read handler
	// happened to derive (or not derive) a status for its own response.
	services.StartMeetingStatusTicker(primaryDB, 30*time.Second)

	// Initialize MinIO storage client
	var storageService *services.StorageService
	if cfg.MinioEndpoint != "" {
		log.Printf("[STORAGE] Initializing MinIO storage at %s (bucket=%s, ssl=%v)", cfg.MinioEndpoint, cfg.MinioBucket, cfg.MinioUseSSL)
		storageClient, err := storage.NewClient(cfg.MinioEndpoint, cfg.MinioAccessKey, cfg.MinioSecretKey, cfg.MinioBucket, cfg.MinioUseSSL)
		if err != nil {
			log.Printf("[STORAGE][ERROR] Failed to initialize MinIO storage at %s: %v", cfg.MinioEndpoint, err)
			log.Println("[STORAGE][WARN] File uploads will fall back to local disk. Check MinIO endpoint, credentials, and Docker port mapping.")
		} else {
			storageService = services.NewStorageService(storageClient)
			log.Printf("[STORAGE][OK] MinIO storage initialized: endpoint=%s bucket=%s", cfg.MinioEndpoint, cfg.MinioBucket)
		}
	} else {
		log.Println("[STORAGE][WARN] MinIO endpoint not configured, skipping storage initialization")
	}

	// Initialize scheduler service for meeting auto-unlock
	authHandlers := api.NewAuthHandlers(primaryDB, cfg.JWTSecret, cfg.JWTExpiration, devicePolicyService, cfg.GetUploadPath(), storageService)
	reminderHandlers := api.NewReminderHandlers(primaryDB)

	pollsHandlers := api.NewPollsHandlers(primaryDB)
	disbursementHandlers := api.NewDisbursementHandlers(primaryDB, cfg)
	reportsHandlers := api.NewFinancialReportsHandlers(primaryDB)
	userSearchHandlers := api.NewUserSearchHandlers(primaryDB)
	receiptHandlers := api.NewReceiptHandlers(primaryDB)
	accountHandlers := api.NewAccountHandlers(primaryDB)
	subwalletHandlers := api.NewSubWalletHandlers(primaryDB, cfg)
	disbursementService := services.NewDisbursementService(primaryDB, cfg)

	// Initialize Test Data Generator (dev/test only)
	var testDataGenerator *services.TestDataGenerator
	if cfg.Environment != "production" || os.Getenv("ENABLE_TEST_DATA_GENERATOR") == "true" {
		testDataGenerator = services.NewTestDataGenerator(primaryDB)
		if os.Getenv("AUTO_START_TEST_DATA") == "true" {
			testDataGenerator.Start(5 * time.Minute)
		}
	}

	// Initialize meeting service for attendance endpoints
	api.InitializeMeetingService(primaryDB, nil)

	// Register CORS middleware early so it applies to ALL routes registered
	// on this router, including the /uploads/* static-file handler below.
	// (Gin's Use() only applies to routes registered after the call, so this
	//  must precede the /uploads/* registration.)
	router.Use(middleware.CORSMiddleware(cfg))

	// Register custom uploads handler BEFORE routes.SetupRoutes to avoid Gin wildcard conflicts.
	// This handles:
	// - /uploads/avatars/* -> MinIO presigned redirect or local disk fallback
	// - /uploads/* -> local disk static files
	router.GET("/uploads/*filepath", func(c *gin.Context) {
		requestedPath := c.Param("filepath")

		// Handle avatars through MinIO when available
		if strings.HasPrefix(requestedPath, "/avatars/") && storageService != nil {
			filename := filepath.Base(requestedPath)
			storageService.ServeAvatarByFilename(c, filename)
			return
		}

		// Serve all other uploads from local disk
		localPath := filepath.Join(cfg.GetUploadPath(), requestedPath)
		if _, err := os.Stat(localPath); err == nil {
			c.File(localPath)
			return
		}
		c.Status(http.StatusNotFound)
	})

	// Register routes and middleware
	routes.SetupRoutes(router, cfg, db, authService, passwordResetService, emailVerificationService, authHandlers, reminderHandlers, pollsHandlers, disbursementHandlers, reportsHandlers, userSearchHandlers, receiptHandlers, accountHandlers, testDataGenerator, subwalletHandlers, disbursementService, devicePolicyService, cache)

	// Register OpenWA routes if enabled
	if cfg.OpenWAEnabled && cfg.OpenWAAPIURL != "" {
		log.Println("[OPENWA] Initializing OpenWA integration...")
		routes.SetupWARoutes(router, cfg, db, cache)
		log.Printf("[OPENWA] Routes registered at /api/v1/wa (baseURL=%s)", cfg.OpenWAAPIURL)
	} else {
		log.Println("[OPENWA] Integration disabled (OPENWA_ENABLED=false or OPENWA_API_URL empty)")
	}

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

	// Startup summary
	log.Println("========================================")
	log.Println("VaultKe API Server")
	log.Printf("Environment: %s", cfg.Environment)
	log.Printf("Port: %s", port)
	if storageService != nil {
		log.Printf("[STORAGE] MinIO: CONNECTED (%s, bucket=%s)", cfg.MinioEndpoint, cfg.MinioBucket)
	} else {
		log.Printf("[STORAGE] MinIO: NOT CONNECTED (endpoint=%s). Uploads will use local disk.", cfg.MinioEndpoint)
	}
	log.Println("========================================")

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
