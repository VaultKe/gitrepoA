package config

import (
	"os"
	"strconv"
	"strings"
	"time"

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
	TURNCredentials     []string
	MaxRoomCapacity     int
	MaxConcurrentRooms  int
	EnableRecording     bool
	RecordingStoragePath string
	TLSCertFile         string
	TLSKeyFile          string
	WebSocketPingInterval time.Duration
	WebSocketPongTimeout  time.Duration
	RateLimitRPS        int
	RateLimitBurst      int
	MaxICEConnections   int
	AllowedOrigins      []string
	RedisSignalingChannel string
}

func Load() *Config {
	godotenv.Load(".env")
	godotenv.Load("../../.env")

	cfg := &Config{
		ServerPort:           getIntEnv("SERVER_PORT", 8086),
		DatabaseURL:          getEnv("DATABASE_URL", ""),
		RedisAddr:            getEnv("REDIS_ADDR", "localhost:6379"),
		RedisPassword:        getEnv("REDIS_PASSWORD", ""),
		RedisDB:              getIntEnv("REDIS_DB", 0),
		JWTSecret:            getEnv("JWT_SECRET", ""),
		STUNServer1:          getEnv("STUN_SERVER1", "stun:stun.l.google.com:19302"),
		STUNServer2:          getEnv("STUN_SERVER2", ""),
		TURNServers:          getStringSliceEnv("TURN_SERVERS", []string{}),
		TURNCredentials:      getStringSliceEnv("TURN_CREDENTIALS", []string{}),
		MaxRoomCapacity:      getIntEnv("MAX_ROOM_CAPACITY", 150),
		MaxConcurrentRooms:   getIntEnv("MAX_CONCURRENT_ROOMS", 900),
		EnableRecording:      getBoolEnv("ENABLE_RECORDING", false),
		RecordingStoragePath: getEnv("RECORDING_STORAGE_PATH", "/tmp/recordings"),
		TLSCertFile:          getEnv("TLS_CERT_FILE", ""),
		TLSKeyFile:           getEnv("TLS_KEY_FILE", ""),
		WebSocketPingInterval: getDurationEnv("WS_PING_INTERVAL", 30*time.Second),
		WebSocketPongTimeout:  getDurationEnv("WS_PONG_TIMEOUT", 10*time.Second),
		RateLimitRPS:         getIntEnv("RATE_LIMIT_RPS", 100),
		RateLimitBurst:       getIntEnv("RATE_LIMIT_BURST", 200),
		MaxICEConnections:    getIntEnv("MAX_ICE_CONNECTIONS", 500),
		AllowedOrigins:       getStringSliceEnv("ALLOWED_ORIGINS", []string{
			"https://livemeeting-service.onrender.com",
			"wss://livemeeting-service.onrender.com",
			"https://gitrepoa-1.onrender.com",
			"http://localhost:8081",
			"http://localhost:8082",
			"http://localhost:8085",
			"http://localhost:3000",
			"https://vault-better1.vercel.app",
			"http://localhost:19006",
		}),
		RedisSignalingChannel: getEnv("REDIS_SIGNALING_CHANNEL", "vaultke-meeting-signaling"),
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
		parts := strings.Split(value, ",")
		result := make([]string, 0, len(parts))
		for _, p := range parts {
			p = strings.TrimSpace(p)
			if p != "" {
				result = append(result, p)
			}
		}
		if len(result) > 0 {
			return result
		}
	}
	return defaultValue
}

func getDurationEnv(key string, defaultValue time.Duration) time.Duration {
	if value, exists := os.LookupEnv(key); exists {
		if d, err := time.ParseDuration(value); err == nil {
			return d
		}
	}
	return defaultValue
}
