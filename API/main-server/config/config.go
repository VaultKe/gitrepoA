package config

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

// Config holds all configuration for the application
type Config struct {
	Environment        string
	Port               string
	DatabaseURL        string
	PrimaryDatabaseURL string
	ReplicaDatabaseURL string
	JWTSecret          string
	JWTExpiration      int

	// M-Pesa Configuration
	MpesaConsumerKey       string
	MpesaConsumerSecret    string
	MpesaPasskey           string
	MpesaShortcode         string
	MpesaCallbackURL       string
	MpesaInitiatorName     string
	MpesaInitiatorPassword string
	MpesaPublicKeyCertPath string // Path to M-Pesa public key certificate for RSA-OAEP encryption
	MpesaCallbackSecret    string // Shared secret for callback endpoint authentication
	MpesaEnvironment       string // "sandbox" or "production" - controls M-Pesa API base URL
	BaseURL                string

	// Centralized Paybill Configuration (for all chama payments)
	SystemPaybillBusinessNumber string // Single paybill for all chama payments
	SystemPaybillAccountPrefix  string // Prefix for account numbers (e.g., "VAULTKE")

	// Firebase Configuration
	FirebaseProjectID    string
	FirebasePrivateKeyID string
	FirebasePrivateKey   string
	FirebaseClientEmail  string
	FirebaseClientID     string
	FirebaseAuthURI      string
	FirebaseTokenURI     string
	FirebaseServerKey    string

	// Google Drive Configuration
	GoogleDriveClientID     string
	GoogleDriveClientSecret string
	GoogleDriveRedirectURL  string

	// Email Configuration
	SMTPHost     string
	SMTPPort     int
	SMTPUsername string
	SMTPPassword string

	// SMS Configuration (Africa's Talking)
	ATUsername string
	ATAPIKey   string
	ATSender   string

	// MinIO Configuration
	MinioEndpoint  string
	MinioAccessKey string
	MinioSecretKey string
	MinioBucket    string
	MinioUseSSL    bool

	// File Upload Configuration
	MaxFileSize      int64
	AllowedFileTypes []string
	UploadPath       string

	// Resolved absolute upload path (set during Load)
	uploadPathAbs string

	// Google OAuth Configuration
	GoogleClientID     string
	GoogleClientSecret string
	GoogleRedirectURL  string

	// Redis Configuration
	RedisURL      string
	RedisPassword string

	// Rate Limiting Configuration
	RateLimitRequests int
	RateLimitWindow   int

	// Logging Configuration
	LogLevel string
	LogFile  string

	// Metrics and Monitoring Configuration
	EnableMetrics bool
	MetricsPort   string
	EnableTracing bool

	// Slow Query Logging
	EnableSlowQueryLog bool
	SlowQueryThreshold time.Duration // threshold for slow query logging

	// Backup Configuration
	BackupEnabled  bool
	BackupInterval int
	BackupPath     string

	// CORS Configuration
	AllowedOrigins  []string
	AllowAllOrigins bool

	// Microservice URLs
	MeetingServiceURL string
	ChatServiceURL    string

	// OpenWA Configuration
	OpenWAAPIURL           string
	OpenWAAPIKey           string
	OpenWAWebhookSecret    string
	OpenWADefaultSessionID string
	OpenWAEnabled          bool
}

// Load loads configuration from environment variables
func Load() *Config {
	c := &Config{
		Environment:        getEnv("ENVIRONMENT", "development"),
		Port:               getEnv("PORT", "8085"),
		DatabaseURL:        getEnv("DATABASE_URL", ""),
		PrimaryDatabaseURL: getEnv("DATABASE_URL_PRIMARY", getEnv("DATABASE_URL", "")),
		ReplicaDatabaseURL: getEnv("DATABASE_URL_REPLICA", ""),
		JWTSecret:          getEnv("JWT_SECRET", "your-super-secret-jwt-key-change-in-production"),
		JWTExpiration:      getEnvAsInt("JWT_EXPIRATION", 24*60*60), // 24 hours in seconds

		// M-Pesa Configuration
		MpesaConsumerKey:       getEnv("MPESA_CONSUMER_KEY", ""),
		MpesaConsumerSecret:    getEnv("MPESA_CONSUMER_SECRET", ""),
		MpesaPasskey:           getEnv("MPESA_PASSKEY", ""),
		MpesaShortcode:         getEnv("MPESA_SHORTCODE", ""),
		MpesaCallbackURL:       getEnv("MPESA_CALLBACK_URL", ""),
		MpesaInitiatorName:     getEnv("MPESA_INITIATOR_NAME", ""),
		MpesaInitiatorPassword: getEnv("MPESA_INITIATOR_PASSWORD", ""),
		MpesaPublicKeyCertPath: getEnv("MPESA_PUBLIC_KEY_CERT_PATH", ""),
		MpesaCallbackSecret:    getEnv("MPESA_CALLBACK_SECRET", ""),
		MpesaEnvironment:       getEnv("MPESA_ENVIRONMENT", "sandbox"),
		BaseURL:                getEnv("BASE_URL", "https://gitrepoa-1.onrender.com"),

		// Centralized Paybill Configuration
		SystemPaybillBusinessNumber: getEnv("SYSTEM_PAYBILL_BUSINESS_NUMBER", "247247"),
		SystemPaybillAccountPrefix:  getEnv("SYSTEM_PAYBILL_ACCOUNT_PREFIX", "VAULT"),

		// Firebase Configuration
		FirebaseProjectID:    getEnv("FIREBASE_PROJECT_ID", ""),
		FirebasePrivateKeyID: getEnv("FIREBASE_PRIVATE_KEY_ID", ""),
		FirebasePrivateKey:   getEnv("FIREBASE_PRIVATE_KEY", ""),
		FirebaseClientEmail:  getEnv("FIREBASE_CLIENT_EMAIL", ""),
		FirebaseClientID:     getEnv("FIREBASE_CLIENT_ID", ""),
		FirebaseAuthURI:      getEnv("FIREBASE_AUTH_URI", ""),
		FirebaseTokenURI:     getEnv("FIREBASE_TOKEN_URI", ""),
		FirebaseServerKey:    getEnv("FIREBASE_SERVER_KEY", ""),

		// Google Drive Configuration
		GoogleDriveClientID:     getEnv("GOOGLE_DRIVE_CLIENT_ID", ""),
		GoogleDriveClientSecret: getEnv("GOOGLE_DRIVE_CLIENT_SECRET", ""),
		GoogleDriveRedirectURL:  getEnv("GOOGLE_DRIVE_REDIRECT_URL", ""),

		// Email Configuration
		SMTPHost:     getEnv("SMTP_HOST", "smtp.gmail.com"),
		SMTPPort:     getEnvAsInt("SMTP_PORT", 587),
		SMTPUsername: getEnv("SMTP_USERNAME", ""),
		SMTPPassword: getEnv("SMTP_PASSWORD", ""),

		// SMS Configuration
		ATUsername: getEnv("AT_USERNAME", ""),
		ATAPIKey:   getEnv("AT_API_KEY", ""),
		ATSender:   getEnv("AT_SENDER", "VaultKe"),

		// MinIO Configuration
		MinioEndpoint:  getEnv("MINIO_ENDPOINT", "localhost:9001"),
		MinioAccessKey: getEnv("MINIO_ACCESS_KEY", "minioadmin"),
		MinioSecretKey: getEnv("MINIO_SECRET_KEY", "minioadmin123"),
		MinioBucket:    getEnv("MINIO_BUCKET", "documents"),
		MinioUseSSL:    getEnvAsBool("MINIO_USE_SSL", false),

		// File Upload Configuration
		MaxFileSize:      getEnvAsInt64("MAX_FILE_SIZE", 5*1024*1024),
		AllowedFileTypes: []string{"image/jpeg", "image/png", "image/webp"},
		UploadPath:       getEnv("UPLOAD_PATH", "./uploads"),

		// Google OAuth Configuration
		GoogleClientID:     getEnv("GOOGLE_CLIENT_ID", ""),
		GoogleClientSecret: getEnv("GOOGLE_CLIENT_SECRET", ""),
		GoogleRedirectURL:  getEnv("GOOGLE_REDIRECT_URL", ""),

		// Redis Configuration
		RedisURL:      getEnv("REDIS_URL", "redis://localhost:6379"),
		RedisPassword: getEnv("REDIS_PASSWORD", ""),

		// Rate Limiting Configuration
		RateLimitRequests: getEnvAsInt("RATE_LIMIT_REQUESTS", 100),
		RateLimitWindow:   getEnvAsInt("RATE_LIMIT_WINDOW", 60),

		// Logging Configuration
		LogLevel: getEnv("LOG_LEVEL", "info"),
		LogFile:  getEnv("LOG_FILE", ""),

		// Metrics and Monitoring Configuration
		EnableMetrics: getEnvAsBool("ENABLE_METRICS", true),
		MetricsPort:   getEnv("METRICS_PORT", "9090"),
		EnableTracing: getEnvAsBool("ENABLE_TRACING", false),

		// Slow Query Logging
		EnableSlowQueryLog: getEnvAsBool("ENABLE_SLOW_QUERY_LOG", true),
		SlowQueryThreshold: time.Duration(getEnvAsInt("SLOW_QUERY_THRESHOLD_MS", 1000)) * time.Millisecond,

		// Backup Configuration
		BackupEnabled:  getEnvAsBool("BACKUP_ENABLED", true),
		BackupInterval: getEnvAsInt("BACKUP_INTERVAL", 24),
		BackupPath:     getEnv("BACKUP_PATH", "./backups"),

		// CORS Configuration
		AllowedOrigins:  getEnvAsStringSlice("ALLOWED_ORIGINS", []string{}),
		AllowAllOrigins: getEnvAsBool("ALLOW_ALL_ORIGINS", true), // Default to true for development

		// Microservice URLs
		MeetingServiceURL: getEnv("MEETING_SERVICE_URL", "https://livemeeting-service.onrender.com"),
		ChatServiceURL:    getEnv("CHAT_SERVICE_URL", "https://chat-services-l1a6.onrender.com"),

		// OpenWA Configuration
		OpenWAAPIURL:           getEnv("OPENWA_API_URL", "http://localhost:2785"),
		OpenWAAPIKey:           getEnv("OPENWA_API_KEY", ""),
		OpenWAWebhookSecret:    getEnv("OPENWA_WEBHOOK_SECRET", ""),
		OpenWADefaultSessionID: getEnv("OPENWA_DEFAULT_SESSION_ID", "default"),
		OpenWAEnabled:          getEnv("OPENWA_ENABLED", "true") == "true",
	}

	// Resolve UploadPath to an absolute path so that uploads and static file
	// serving remain consistent regardless of the process's working directory.
	if !filepath.IsAbs(c.UploadPath) {
		absPath, err := filepath.Abs(c.UploadPath)
		if err == nil {
			c.uploadPathAbs = absPath
		} else {
			c.uploadPathAbs = c.UploadPath
		}
	} else {
		c.uploadPathAbs = c.UploadPath
	}

	return c
}

// GetUploadPath returns the absolute path for file uploads,
// ensuring consistency regardless of the process's working directory.
func (c *Config) GetUploadPath() string {
	if c.uploadPathAbs != "" {
		return c.uploadPathAbs
	}
	return c.UploadPath
}

// Helper functions
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvAsInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getEnvAsInt64(key string, defaultValue int64) int64 {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.ParseInt(value, 10, 64); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getEnvAsBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if boolValue, err := strconv.ParseBool(value); err == nil {
			return boolValue
		}
	}
	return defaultValue
}

func getEnvAsStringSlice(key string, defaultValue []string) []string {
	if value := os.Getenv(key); value != "" {
		return strings.Split(value, ",")
	}
	return defaultValue
}

// ServerPort returns the server port (alias for Port for test compatibility)
func (c *Config) ServerPort() string {
	return c.Port
}

// Validate validates the configuration
func (c *Config) Validate() error {
	if c.JWTSecret == "" {
		return fmt.Errorf("JWT secret is required")
	}
	if c.PrimaryDatabaseURL == "" {
		return fmt.Errorf("primary database URL is required")
	}
	if c.Environment == "" {
		return fmt.Errorf("environment is required")
	}

	// Validate environment values
	validEnvs := map[string]bool{
		"development": true,
		"production":  true,
		"test":        true,
	}
	if !validEnvs[c.Environment] {
		return fmt.Errorf("invalid environment: %s", c.Environment)
	}

	// Production-specific validations
	if c.Environment == "production" {
		if c.MpesaInitiatorName == "" || c.MpesaInitiatorName == "testapi" {
			return fmt.Errorf("MPESA_INITIATOR_NAME must be set to a production value in production environment")
		}
		if c.MpesaInitiatorPassword == "" || c.MpesaInitiatorPassword == "Safaricom999!*!" {
			return fmt.Errorf("MPESA_INITIATOR_PASSWORD must be set to a production value in production environment")
		}
		if c.MpesaConsumerKey == "" {
			return fmt.Errorf("MPESA_CONSUMER_KEY is required in production")
		}
		if c.MpesaConsumerSecret == "" {
			return fmt.Errorf("MPESA_CONSUMER_SECRET is required in production")
		}
		if c.MpesaShortcode == "" {
			return fmt.Errorf("MPESA_SHORTCODE is required in production")
		}
		if c.MpesaPasskey == "" {
			return fmt.Errorf("MPESA_PASSKEY is required in production")
		}
		if c.MpesaPublicKeyCertPath == "" {
			return fmt.Errorf("MPESA_PUBLIC_KEY_CERT_PATH is required in production for B2C security credential encryption")
		}
		// Warn (but don't fail) if callback secret is missing
		if c.MpesaCallbackSecret == "" {
			log.Printf("[CONFIG][WARN] MPESA_CALLBACK_SECRET is not set — callback endpoints are protected by IP whitelist only")
		}
	}

	return nil
}

// ValidateRequired validates only required fields
func (c *Config) ValidateRequired() error {
	if c.JWTSecret == "" {
		return fmt.Errorf("JWT secret is required")
	}
	if c.DatabaseURL == "" {
		return fmt.Errorf("Database URL is required")
	}
	if c.Environment == "" {
		return fmt.Errorf("Environment is required")
	}
	return nil
}

// SetDefaults sets default values for configuration
func (c *Config) SetDefaults() {
	if c.JWTSecret == "" {
		c.JWTSecret = "your-super-secret-jwt-key-change-in-production"
	}
	if c.Environment == "" {
		c.Environment = "development"
	}
	if c.Port == "" {
		c.Port = "8085"
	}
}

// String returns a string representation of the configuration
func (c *Config) String() string {
	return fmt.Sprintf("Config{Environment: %s, Port: %s, DatabaseURL: %s}", c.Environment, c.Port, c.DatabaseURL)
}

// Clone creates a deep copy of the configuration
func (c *Config) Clone() *Config {
	clone := *c
	// Deep copy slices
	if c.AllowedFileTypes != nil {
		clone.AllowedFileTypes = make([]string, len(c.AllowedFileTypes))
		copy(clone.AllowedFileTypes, c.AllowedFileTypes)
	}
	return &clone
}

// Reload reloads the configuration from environment variables
func (c *Config) Reload() {
	newConfig := Load()
	*c = *newConfig
}
