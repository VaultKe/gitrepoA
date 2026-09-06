package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"vaultke-meeting-service/config"
	"vaultke-meeting-service/internal/handler"
	"vaultke-meeting-service/internal/middleware"
	"vaultke-meeting-service/internal/room"
	"vaultke-meeting-service/internal/signaling"
	"vaultke-meeting-service/internal/webrtc"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	_ "github.com/lib/pq"
	"github.com/redis/go-redis/v9"
)

func main() {
	cfg := config.Load()

	// Log CORS configuration for debugging
	log.Printf("CORS allowed origins: %v", cfg.AllowedOrigins)

	// Database setup with connection pooling
	db, err := sql.Open("postgres", cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Configure connection pool for high concurrency
	db.SetMaxOpenConns(100)
	db.SetMaxIdleConns(20)
	db.SetConnMaxLifetime(5 * time.Minute)

	if err := db.Ping(); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}

	// Redis setup
	var redisClient *redis.Client
	if cfg.RedisAddr != "" {
		redisClient = redis.NewClient(&redis.Options{
			Addr:     cfg.RedisAddr,
			Password: cfg.RedisPassword,
			DB:       cfg.RedisDB,
		})
		defer redisClient.Close()

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := redisClient.Ping(ctx).Err(); err != nil {
			log.Printf("Warning: Redis connection failed: %v", err)
			redisClient = nil
		}
	}

	// Initialize components
	roomManager := room.NewRoomManager(db, redisClient)
	sfuManager := webrtc.NewSFUManager(cfg)
	redisChannel := cfg.RedisSignalingChannel
	signalingHub := signaling.NewSignalingHub(redisClient, redisChannel)

	// Start cleanup goroutine
	go cleanupLoop(roomManager, 5*time.Minute)

	// Gin setup
	if cfg.ServerPort != 8086 {
		gin.SetMode(gin.ReleaseMode)
	}
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(gin.Logger())

	// CORS middleware
	r.Use(func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		allowedOrigin := ""

		for _, o := range cfg.AllowedOrigins {
			if o == "*" {
				allowedOrigin = origin
				break
			}
			if origin != "" && matchOrigin(origin, o) {
				allowedOrigin = origin
				break
			}
		}

		if allowedOrigin != "" {
			c.Writer.Header().Set("Access-Control-Allow-Origin", allowedOrigin)
			c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		}
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	})

	// matchOrigin checks if an origin matches an allowed pattern.
	// Supports exact match, wildcard (*), and localhost wildcard (http://localhost:* or *://localhost:*).

	// Rate limiting
	rateLimiter := middleware.RateLimitMiddleware(redisClient, cfg.RateLimitRPS, cfg.RateLimitBurst)

	h := handler.NewMeetingHandler(cfg, roomManager, sfuManager, signalingHub)

	// Health check (no auth required)
	r.GET("/health", h.Health)

	// Debug endpoint to check token validity (remove in production)
	r.POST("/api/v1/debug/token", func(c *gin.Context) {
		var req struct {
			Token string `json:"token"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		
		token, err := jwt.Parse(req.Token, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return []byte(cfg.JWTSecret), nil
		})
		
		if err != nil || !token.Valid {
			c.JSON(http.StatusOK, gin.H{
				"valid": false,
				"error": err.Error(),
			})
			return
		}
		
		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			c.JSON(http.StatusOK, gin.H{
				"valid": false,
				"error": "invalid claims",
			})
			return
		}
		
		c.JSON(http.StatusOK, gin.H{
			"valid": true,
			"claims": claims,
		})
	})

	// The unauthenticated "/api/v1/debug/rooms/:roomID/join" route that used
	// to sit here let anyone who knew a meeting id join as any userId/role
	// with no auth at all -- it was the client's *first* attempt on every
	// join too (see useOnlineMeetingScreen.js), so it was on the critical
	// path of every real join as well as being a standing security hole.
	// Nothing else in the codebase called it (grep for "debug/rooms"); the
	// authenticated "POST /api/v1/rooms/:roomID/join" below is the only join
	// route now.

	// API routes
	api := r.Group("/api/v1")
	api.Use(rateLimiter)
	{
		// Room management - no auth required for testing
		api.POST("/rooms", h.CreateRoom)
		api.GET("/rooms/:roomID", h.GetRoom)
		api.POST("/rooms/:roomID/end", h.EndRoom)
		api.GET("/rooms/:roomID/participants", h.GetParticipants)
		// Who attended -- including people who have since left, which is what
		// a finished meeting needs and GetParticipants cannot answer.
		api.GET("/rooms/:roomID/attendance", h.GetRoomAttendance)

		// WebSocket signaling - intentionally NOT behind the JWT auth group.
		// The meeting client connects here with the userId carried in the JOIN
		// message body (debug/unauthenticated flow), and the hub preserves it.
		// Requiring the main-app JWT here silently broke signaling for the
		// unauthenticated debug join, so participants never learned about each
		// other (looked like they weren't in the same room).
		api.GET("/rooms/:roomID/signal", h.WebRTCSignal)

		// Participant actions - WITH auth
		authApi := api.Group("")
		authApi.Use(middleware.AuthMiddleware(cfg.JWTSecret))
		{
			authApi.POST("/rooms/:roomID/join", h.JoinRoom)
			authApi.POST("/rooms/:roomID/leave", h.LeaveRoom)
			authApi.PUT("/rooms/:roomID/participants", h.UpdateParticipant)
			authApi.POST("/rooms/:roomID/chat", h.SendRoomChatMessage)
			authApi.GET("/rooms/:roomID/chat", h.GetRoomChatMessages)
			authApi.GET("/stats", h.GetStats)
		}
	}

	// Graceful shutdown
	srv := &http.Server{
		Addr:    fmt.Sprintf(":%d", cfg.ServerPort),
		Handler: r,
	}

	go func() {
		log.Printf("Meeting service starting on port %d", cfg.ServerPort)
		log.Printf("JWT secret configured: %s", cfg.JWTSecret)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down meeting service...")

	// Close all WebRTC connections
	sfuManager.CloseAll()

	// Shutdown HTTP server
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("Server shutdown error: %v", err)
	}

	log.Println("Meeting service stopped")
}

// cleanupLoop periodically removes stale rooms.
func cleanupLoop(rm *room.RoomManager, interval time.Duration) {
	ticker := time.NewTicker(interval)
	for range ticker.C {
		rm.CleanupStaleRooms()
	}
}

// matchOrigin checks if an origin matches an allowed pattern.
// Supports exact match, wildcard (*), and localhost wildcard (http://localhost:* or *://localhost:*).
func matchOrigin(origin, pattern string) bool {
	if pattern == "*" {
		return true
	}
	if origin == pattern {
		return true
	}

	// Support wildcard localhost patterns: http://localhost:* or *://localhost:*
	if strings.Contains(pattern, "://") {
		parts := strings.SplitN(pattern, "://", 2)
		if len(parts) == 2 {
			scheme := parts[0]
			hostPort := parts[1]
			originParts := strings.SplitN(origin, "://", 2)
			if len(originParts) == 2 {
				originScheme := originParts[0]
				originHostPort := originParts[1]
				schemeMatch := scheme == "*" || scheme == originScheme
				hostMatch := hostPort == "*" || matchHostPort(originHostPort, hostPort)
				return schemeMatch && hostMatch
			}
		}
	}
	return false
}

// matchHostPort checks if an origin host:port matches a pattern that may contain wildcards.
// Example: localhost:8081 matches localhost:*, but 127.0.0.1:8081 does not.
func matchHostPort(originHostPort, pattern string) bool {
	if pattern == "*" {
		return true
	}
	if originHostPort == pattern {
		return true
	}

	// Support localhost:* pattern
	if strings.HasPrefix(pattern, "localhost") {
		patternParts := strings.SplitN(pattern, ":", 2)
		patternHost := patternParts[0]
		patternPort := ""
		if len(patternParts) == 2 {
			patternPort = patternParts[1]
		}

		originParts := strings.SplitN(originHostPort, ":", 2)
		originHost := originParts[0]
		originPort := ""
		if len(originParts) == 2 {
			originPort = originParts[1]
		}

		if patternHost == originHost {
			if patternPort == "*" || patternPort == "" {
				return true
			}
			return originPort == patternPort
		}
	}

	return false
}
