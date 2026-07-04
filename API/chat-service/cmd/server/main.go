package main

import (
	"context"
	"database/sql"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"
	"github.com/redis/go-redis/v9"

	"vaultke-chat-service/config"
	"vaultke-chat-service/internal/handler"
	"vaultke-chat-service/internal/middleware"
	"vaultke-chat-service/internal/room"
	"vaultke-chat-service/internal/websocket"
)

func main() {
	cfg := config.Load()

	db, err := sql.Open("postgres", cfg.DatabaseURL)
	if err != nil {
		log.Fatal("database connection failed:", err)
	}
	defer db.Close()

	redisClient := redis.NewClient(&redis.Options{
		Addr:     cfg.RedisAddr,
		Password: cfg.RedisPassword,
		DB:       cfg.RedisDB,
	})
	if err := redisClient.Ping(context.Background()).Err(); err != nil {
		log.Println("redis connection failed, continuing without redis:", err)
	} else {
		log.Println("redis connected")
	}

	roomMgr := room.NewRoomManager(db)
	hub := websocket.NewHub()

	go hub.Run()
	go hub.HandlePingPong()

	if err := roomMgr.LoadFromDB(); err != nil {
		log.Printf("Warning: failed to load rooms from DB: %v", err)
	}

	h := handler.NewChatHandler(db, hub, roomMgr)

	r := gin.Default()

	r.Use(middleware.CORSMiddleware())

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy", "service": "chat"})
	})

	rooms := r.Group("/rooms")
	rooms.Use(middleware.AuthMiddleware(cfg.JWTSecret))
	{
		rooms.POST("", h.CreateRoom)
		rooms.GET("", h.GetRooms)
		rooms.GET("/:roomId", h.GetRoom)
		rooms.POST("/:roomId/join", h.JoinRoom)
		rooms.POST("/:roomId/leave", h.LeaveRoom)
		rooms.GET("/:roomId/messages", h.GetMessages)
		rooms.POST("/:roomId/messages", h.SendMessage)
		rooms.GET("/:roomId/ws", h.WebSocketEndpoint)
		rooms.POST("/:roomId/read", h.MarkAsRead)
		rooms.DELETE("/messages/:messageId", h.DeleteMessage)
		rooms.GET("/:roomId/search", h.SearchMessages)
		rooms.POST("/:roomId/files", h.UploadFile)
	}

	srv := &http.Server{
		Addr:    ":" + cfg.ServerPort,
		Handler: r,
	}

	go func() {
		if cfg.TLSCertFile != "" && cfg.TLSKeyFile != "" {
			srv.ListenAndServeTLS(cfg.TLSCertFile, cfg.TLSKeyFile)
		} else {
			srv.ListenAndServe()
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Println("server shutdown error:", err)
	}
}
