package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"vaultke-meeting-service/config"
	"vaultke-meeting-service/internal/handler"
	"vaultke-meeting-service/internal/middleware"
	"vaultke-meeting-service/internal/room"
	"vaultke-meeting-service/internal/signaling"
	"vaultke-meeting-service/internal/webrtc"

	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"
	"github.com/redis/go-redis/v9"
)

func main() {
	cfg := config.Load()

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
	if cfg.ServerPort != 8082 {
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
			if o == "*" || o == origin {
				allowedOrigin = origin
				break
			}
		}
		if allowedOrigin != "" {
			c.Writer.Header().Set("Access-Control-Allow-Origin", allowedOrigin)
		}
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	})

	// Rate limiting
	rateLimiter := middleware.RateLimitMiddleware(redisClient, cfg.RateLimitRPS, cfg.RateLimitBurst)

	h := handler.NewMeetingHandler(cfg, roomManager, sfuManager, signalingHub)

	// Health check (no auth required)
	r.GET("/health", h.Health)

	// API routes
	api := r.Group("/api/v1")
	api.Use(rateLimiter)
	api.Use(middleware.AuthMiddleware(cfg.JWTSecret))
	{
		// Room management
		api.POST("/rooms", h.CreateRoom)
		api.GET("/rooms/:roomID", h.GetRoom)
		api.POST("/rooms/:roomID/end", h.EndRoom)
		api.GET("/rooms/:roomID/participants", h.GetParticipants)

		// Participant actions
		api.POST("/rooms/:roomID/join", h.JoinRoom)
		api.POST("/rooms/:roomID/leave", h.LeaveRoom)
		api.PUT("/rooms/:roomID/participants", h.UpdateParticipant)

		// WebRTC signaling
		api.GET("/rooms/:roomID/signal", h.WebRTCSignal)

		// Chat
		api.POST("/rooms/:roomID/chat", h.SendRoomChatMessage)
		api.GET("/rooms/:roomID/chat", h.GetRoomChatMessages)

		// Stats
		api.GET("/stats", h.GetStats)
	}

	// Graceful shutdown
	srv := &http.Server{
		Addr:    fmt.Sprintf(":%d", cfg.ServerPort),
		Handler: r,
	}

	go func() {
		log.Printf("Meeting service starting on port %d", cfg.ServerPort)
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
