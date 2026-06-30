package config

import (
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	ServerPort       string
	DatabaseURL      string
	RedisAddr        string
	RedisPassword    string
	RedisDB          int
	JWTSecret        string
	MaxRoomCapacity  int
	MessageRetention int
	EnableE2EE       bool
	TLSCertFile      string
	TLSKeyFile       string
}

func Load() *Config {
	godotenv.Load(".env")
	godotenv.Load("../../.env")

	port := getEnv("SERVER_PORT", "8084")
	dbURL := getEnv("DATABASE_URL", "")
	redisAddr := getEnv("REDIS_ADDR", "localhost:6379")
	redisPassword := getEnv("REDIS_PASSWORD", "")
	redisDB := getEnvInt("REDIS_DB", 0)
	jwtSecret := getEnv("JWT_SECRET", "")
	maxRoom := getEnvInt("MAX_ROOM_CAPACITY", 150)
	retention := getEnvInt("MESSAGE_RETENTION_DAYS", 30)
	enableE2EE := getEnvBool("ENABLE_E2EE", true)
	tlsCert := getEnv("TLS_CERT_FILE", "")
	tlsKey := getEnv("TLS_KEY_FILE", "")

	return &Config{
		ServerPort:       port,
		DatabaseURL:      dbURL,
		RedisAddr:        redisAddr,
		RedisPassword:    redisPassword,
		RedisDB:          redisDB,
		JWTSecret:        jwtSecret,
		MaxRoomCapacity:  maxRoom,
		MessageRetention: retention,
		EnableE2EE:       enableE2EE,
		TLSCertFile:      tlsCert,
		TLSKeyFile:       tlsKey,
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if i, err := strconv.Atoi(value); err == nil {
			return i
		}
	}
	return defaultValue
}

func getEnvBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if b, err := strconv.ParseBool(value); err == nil {
			return b
		}
	}
	return defaultValue
}
