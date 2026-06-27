package config

import (
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	ServerPort          int
	DatabaseURL         string
	RedisAddr           string
	RedisPassword       string
	RedisDB             int
	JWTSecret           string
	STUNServer1         string
	STUNServer2         string
	TURNServers         []string
	MaxRoomCapacity     int
	MaxConcurrentRooms  int
	EnableRecording     bool
	RecordingStoragePath string
	TLSCertFile         string
	TLSKeyFile          string
}

func Load() *Config {
	godotenv.Load()

	cfg := &Config{
		ServerPort:          getIntEnv("SERVER_PORT", 8082),
		DatabaseURL:         getEnv("DATABASE_URL", ""),
		RedisAddr:           getEnv("REDIS_ADDR", "localhost:6379"),
		RedisPassword:       getEnv("REDIS_PASSWORD", ""),
		RedisDB:             getIntEnv("REDIS_DB", 0),
		JWTSecret:           getEnv("JWT_SECRET", ""),
		STUNServer1:         getEnv("STUN_SERVER1", "stun:stun.l.google.com:19302"),
		STUNServer2:         getEnv("STUN_SERVER2", ""),
		TURNServers:         getStringSliceEnv("TURN_SERVERS", []string{}),
		MaxRoomCapacity:     getIntEnv("MAX_ROOM_CAPACITY", 150),
		MaxConcurrentRooms:  getIntEnv("MAX_CONCURRENT_ROOMS", 50000),
		EnableRecording:     getBoolEnv("ENABLE_RECORDING", false),
		RecordingStoragePath: getEnv("RECORDING_STORAGE_PATH", "/tmp/recordings"),
		TLSCertFile:         getEnv("TLS_CERT_FILE", ""),
		TLSKeyFile:          getEnv("TLS_KEY_FILE", ""),
	}

	return cfg
}

func getEnv(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}

func getIntEnv(key string, defaultValue int) int {
	if value, exists := os.LookupEnv(key); exists {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getBoolEnv(key string, defaultValue bool) bool {
	if value, exists := os.LookupEnv(key); exists {
		if boolValue, err := strconv.ParseBool(value); err == nil {
			return boolValue
		}
	}
	return defaultValue
}

func getStringSliceEnv(key string, defaultValue []string) []string {
	if value, exists := os.LookupEnv(key); exists && value != "" {
		return []string{value}
	}
	return defaultValue
}