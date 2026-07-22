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
	// The chat service is fully dependent on the database: it must be
	// reachable before we start serving, otherwise message persistence and
	// room/member lookups would fail. Fail fast and let the process
	// manager/orchestrator restart or alert.
	if err := db.Ping(); err != nil {
		log.Fatal("database unreachable, refusing to start:", err)
	}
	// Match the main-server pool tuning so Neon doesn't get torn apart
	// by a flood of concurrent chat polls.
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(25)
	db.SetConnMaxLifetime(5 * time.Minute)
	defer db.Close()

	// Redis is a required dependency. If it cannot be reached the
	// server must not start (and must not run degraded), so we treat a
	// failed Redis ping as fatal.
	redisClient := redis.NewClient(&redis.Options{
		Addr:         cfg.RedisAddr,
		Password:     cfg.RedisPassword,
		DB:           cfg.RedisDB,
		DialTimeout:  5 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
	})
	defer redisClient.Close()
	if err := redisClient.Ping(context.Background()).Err(); err != nil {
		log.Fatal("redis connection failed (required dependency):", err)
	}
	log.Println("redis connected")

	roomMgr := room.NewRoomManager(db)
	hub := websocket.NewHub()

	if err := roomMgr.LoadFromDB(); err != nil {
		log.Fatal("failed to load rooms from DB, refusing to start:", err)
	}

	// Ensure chat performance indexes exist on the shared database.
	chatIdx := []string{
		`CREATE INDEX IF NOT EXISTS idx_chat_messages_room_created_active ON chat_messages(room_id, created_at DESC) WHERE is_deleted = false`,
		`CREATE INDEX IF NOT EXISTS idx_chat_room_members_room_active ON chat_room_members(room_id, is_active)`,
		`CREATE INDEX IF NOT EXISTS idx_chat_rooms_active ON chat_rooms(is_active) WHERE is_active = TRUE`,
	}
	for _, q := range chatIdx {
		if _, err := db.Exec(q); err != nil {
			log.Printf("WARNING: chat index migration failed: %v", err)
		}
	}

	h := handler.NewChatHandler(db, hub, roomMgr, redisClient)

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
		rooms.GET("/:roomId", middleware.RequireRoomMember(roomMgr.IsMember), h.GetRoom)
		rooms.POST("/:roomId/join", h.JoinRoom)
		rooms.POST("/:roomId/leave", h.LeaveRoom)
		rooms.GET("/:roomId/messages", middleware.RequireRoomMember(roomMgr.IsMember), h.GetMessages)
		rooms.POST("/:roomId/messages", middleware.RequireRoomMember(roomMgr.IsMember), h.SendMessage)
		rooms.GET("/:roomId/ws", h.WebSocketEndpoint)
		rooms.POST("/:roomId/read", middleware.RequireRoomMember(roomMgr.IsMember), h.MarkAsRead)
		rooms.DELETE("/messages/:messageId", middleware.RequireRoomMember(roomMgr.IsMember), h.DeleteMessage)
		rooms.GET("/:roomId/search", middleware.RequireRoomMember(roomMgr.IsMember), h.SearchMessages)
		rooms.POST("/:roomId/files", middleware.RequireRoomMember(roomMgr.IsMember), h.UploadFile)
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
	hub.Close()
	log.Println("chat service stopped")
}
