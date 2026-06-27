package main

import (
	"context"
	"database/sql"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"vaultke-meeting-service/config"
	"vaultke-meeting-service/internal/handler"
	"vaultke-meeting-service/internal/middleware"
	"vaultke-meeting-service/internal/room"
	"vaultke-meeting-service/internal/signaling"
	"vaultke-meeting-service/internal/webrtc"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"
	"github.com/redis/go-redis/v9"
)

func main() {
	cfg := config.Load()

	db, err := sql.Open("postgres", cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}

	rdb := redis.NewClient(&redis.Options{
		Addr:     cfg.RedisAddr,
		Password: cfg.RedisPassword,
		DB:       cfg.RedisDB,
	})
	defer rdb.Close()

	roomManager := room.NewRoomManager(db)
	sfuManager := webrtc.NewSFUManager(cfg)
	signalingHub := signaling.NewHub()

	go signalingHub.Run()
	go cleanupLoop(roomManager, 5*time.Minute)

	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Authorization", "Content-Type"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	h := handler.NewMeetingHandler(cfg, roomManager, sfuManager, signalingHub)

	api := r.Group("/api/v1")
	api.Use(middleware.AuthMiddleware(cfg.JWTSecret))
	{
		api.POST("/rooms", h.CreateRoom)
		api.GET("/rooms/:roomID", h.GetRoom)
		api.POST("/rooms/:roomID/end", middleware.RequireHost(), h.EndRoom)
		api.POST("/rooms/:roomID/join", h.JoinRoom)
		api.POST("/rooms/:roomID/leave", h.LeaveRoom)
		api.GET("/rooms/:roomID/participants", h.GetParticipants)
		api.PUT("/rooms/:roomID/participants", h.UpdateParticipant)
		api.GET("/rooms/:roomID/signal", h.WebRTCSignal)
		api.GET("/stats", h.GetStats)
	}

	r.GET("/health", h.Health)

	srv := &http.Server{
		Addr:    ":" + strconv.Itoa(cfg.ServerPort),
		Handler: r,
	}

	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	sfuManager.CloseAll()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("Server shutdown error: %v", err)
	}
}

func cleanupLoop(rm *room.RoomManager, interval time.Duration) {
	ticker := time.NewTicker(interval)
	for range ticker.C {
		rm.CleanupStaleRooms(24 * time.Hour)
	}
}