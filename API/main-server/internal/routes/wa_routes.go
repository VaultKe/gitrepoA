package routes

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"vaultke-backend/config"
	"vaultke-backend/database"
	"vaultke-backend/internal/middleware"
	"vaultke-backend/internal/wa"
	"vaultke-backend/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func bootstrapDefaultSession(client *wa.OpenWAClient, defaultSessionID string) {
	if defaultSessionID == "" {
		return
	}
	ctx := context.Background()

	// 1) Check if OpenWA already knows this session
	checkReq, _ := http.NewRequestWithContext(ctx, http.MethodGet, client.BaseURL+"/api/sessions/"+defaultSessionID, nil)
	checkReq.Header.Set("Authorization", client.APIKey)
	checkResp, err := client.HTTPClient.Do(checkReq)
	if err == nil && checkResp.StatusCode == http.StatusOK {
		checkResp.Body.Close()
		// Session exists; try to start it if it's not ready.
		startReq, _ := http.NewRequestWithContext(ctx, http.MethodPost, client.BaseURL+"/api/sessions/"+defaultSessionID+"/start", nil)
		startReq.Header.Set("Authorization", client.APIKey)
		startResp, err := client.HTTPClient.Do(startReq)
		if err == nil && startResp.StatusCode < 300 {
			fmt.Printf("[WA] default session %s start initiated\n", defaultSessionID)
			startResp.Body.Close()
		} else if err != nil {
			fmt.Printf("[WA] default session start request failed: %v\n", err)
		}
		return
	}
	if checkResp != nil && checkResp.Body != nil {
		checkResp.Body.Close()
	}

	// 2) Create the session in OpenWA
	createPayload := map[string]interface{}{"name": "vaultke-default"}
	createBody := strings.NewReader(wa.MustJSON(createPayload))
	createReq, err := http.NewRequestWithContext(ctx, http.MethodPost, client.BaseURL+"/api/sessions", createBody)
	if err != nil {
		fmt.Printf("[WA] create session request error: %v\n", err)
		return
	}
	createReq.Header.Set("Authorization", client.APIKey)
	createReq.Header.Set("Content-Type", "application/json")
	createResp, err := client.HTTPClient.Do(createReq)
	if err != nil {
		fmt.Printf("[WA] create session failed: %v\n", err)
		return
	}
	defer createResp.Body.Close()
	if createResp.StatusCode != http.StatusCreated && createResp.StatusCode != http.StatusOK {
		fmt.Printf("[WA] create session unexpected status: %d\n", createResp.StatusCode)
		return
	}

	// 3) Start the newly created session
	startReq, err := http.NewRequestWithContext(ctx, http.MethodPost, client.BaseURL+"/api/sessions/"+defaultSessionID+"/start", nil)
	if err != nil {
		fmt.Printf("[WA] start session request error: %v\n", err)
		return
	}
	startReq.Header.Set("Authorization", client.APIKey)
	startResp, err := client.HTTPClient.Do(startReq)
	if err != nil {
		fmt.Printf("[WA] start session failed: %v\n", err)
		return
	}
	defer startResp.Body.Close()
	if startResp.StatusCode < 300 {
		fmt.Printf("[WA] default session %s created and started\n", defaultSessionID)
	} else {
		fmt.Printf("[WA] default session start unexpected status: %d\n", startResp.StatusCode)
	}
}

// SetupWARoutes registers OpenWA-related routes on the given router group.
func SetupWARoutes(
	router *gin.Engine,
	cfg *config.Config,
	db *database.Database,
	cache services.Cache,
) {
	if !cfg.OpenWAEnabled || cfg.OpenWAAPIURL == "" {
		return
	}

	// Initialize OpenWA schema tables
	_ = wa.InitializeSchema(db.WriteDB())
	_ = wa.InitializeDefaultSession(db.WriteDB(), cfg.OpenWADefaultSessionID, "vaultke-default")

	waClient := wa.NewOpenWAClient(cfg)
	wsHandler := wa.NewWSHandler(waClient, nil, db.WriteDB(), cfg.OpenWADefaultSessionID)
	webhookHandler := wa.NewWebhookHandler(waClient, wsHandler, cfg.OpenWAWebhookSecret)

	_ = cache
	_ = waClient
	_ = wsHandler
	_ = webhookHandler

	// Best-effort: ensure the default session exists in OpenWA and is started.
	go bootstrapDefaultSession(waClient, cfg.OpenWADefaultSessionID)

	// Auth middleware for protected WA endpoints
	authMiddleware := middleware.NewAuthMiddleware(services.NewAuthService(db.WriteDB(), cfg.JWTSecret, cfg.JWTExpiration))

	waGroup := router.Group("/api/v1/wa")
	{
		// Public webhook endpoint (no auth - OpenWA sends here)
		waGroup.POST("/webhook", func(c *gin.Context) {
			webhookHandler.HandleWebhook(c)
		})

		// Health check for OpenWA connectivity
		waGroup.GET("/health", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{
				"success":   true,
				"status":    "ok",
				"service":   "openwa",
				"baseURL":   cfg.OpenWAAPIURL,
				"timestamp": time.Now().Unix(),
			})
		})

		// Protected session management
		waProtected := waGroup.Group("/")
		waProtected.Use(authMiddleware.AuthRequired())
		waProtected.Use(func(c *gin.Context) {
			c.Set("db", db.WriteDB())
			c.Next()
		})
		{
			waProtected.GET("/sessions", func(c *gin.Context) {
				handleListSessions(c, db.WriteDB())
			})
			waProtected.GET("/sessions/:sessionId", func(c *gin.Context) {
				handleGetSession(c, db.WriteDB(), c.Param("sessionId"))
			})
			waProtected.POST("/sessions", func(c *gin.Context) {
				handleCreateSession(c, waClient)
			})
			waProtected.POST("/sessions/:sessionId/start", func(c *gin.Context) {
				handleStartSession(c, waClient, c.Param("sessionId"))
			})
			waProtected.POST("/sessions/:sessionId/logout", func(c *gin.Context) {
				handleLogoutSession(c, waClient, c.Param("sessionId"))
			})
			waProtected.GET("/sessions/:sessionId/chats", func(c *gin.Context) {
				handleGetChats(c, waClient, c.Param("sessionId"))
			})
			waProtected.GET("/sessions/:sessionId/chats/:chatId/messages", func(c *gin.Context) {
				handleGetMessages(c, waClient, c.Param("sessionId"), c.Param("chatId"), c.Query("limit"), c.Query("before"))
			})
			waProtected.POST("/sessions/:sessionId/messages/send-text", func(c *gin.Context) {
				handleSendText(c, waClient, c.Param("sessionId"))
			})
			waProtected.POST("/sessions/:sessionId/messages/send-image", func(c *gin.Context) {
				handleSendImage(c, waClient, c.Param("sessionId"))
			})
			waProtected.POST("/sessions/:sessionId/messages/send-document", func(c *gin.Context) {
				handleSendDocument(c, waClient, c.Param("sessionId"))
			})
			waProtected.POST("/sessions/:sessionId/chats/read", func(c *gin.Context) {
				handleMarkRead(c, waClient, c.Param("sessionId"))
			})
			waProtected.POST("/sessions/:sessionId/chats/typing", func(c *gin.Context) {
				handleSendChatState(c, waClient, c.Param("sessionId"))
			})
			waProtected.GET("/sessions/:sessionId/groups", func(c *gin.Context) {
				handleGetGroups(c, waClient, c.Param("sessionId"))
			})
			waProtected.POST("/sessions/:sessionId/groups", func(c *gin.Context) {
				handleCreateGroup(c, waClient, c.Param("sessionId"))
			})
			waProtected.POST("/sessions/:sessionId/groups/:groupId/participants", func(c *gin.Context) {
				handleAddGroupParticipants(c, waClient, c.Param("sessionId"), c.Param("groupId"))
			})
			waProtected.DELETE("/sessions/:sessionId/groups/:groupId/participants/:participantId", func(c *gin.Context) {
				handleRemoveGroupParticipant(c, waClient, c.Param("sessionId"), c.Param("groupId"), c.Param("participantId"))
			})
			waProtected.GET("/sessions/:sessionId/contacts", func(c *gin.Context) {
				handleGetContacts(c, waClient, c.Param("sessionId"))
			})
		waProtected.GET("/sessions/:sessionId/profile", func(c *gin.Context) {
			handleGetProfile(c, waClient, c.Param("sessionId"))
		})
		}

		// Chat compatibility layer: /api/v1/chat/* proxies to OpenWA default session.
		// This preserves the existing mobile REST fallbacks without requiring a frontend change.
		chatProxy := waGroup.Group("/chat")
		chatProxy.Use(authMiddleware.AuthRequired())
		chatProxy.Use(func(c *gin.Context) {
			c.Set("db", db.WriteDB())
			c.Next()
		})
		{
			chatProxy.GET("/rooms", func(c *gin.Context) {
				handleGetChats(c, waClient, cfg.OpenWADefaultSessionID)
			})
			chatProxy.GET("/rooms/:roomId", func(c *gin.Context) {
				// OpenWA doesn't have a single-room endpoint; return the room mapping info.
				roomID := c.Param("roomId")
				var chatID string
				if err := db.WriteDB().QueryRow(`SELECT chat_id FROM wa_room_mappings WHERE room_id = $1`, roomID).Scan(&chatID); err != nil {
					c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "room not mapped"})
					return
				}
				c.JSON(http.StatusOK, gin.H{"success": true, "data": map[string]interface{}{"id": roomID, "chatId": chatID}})
			})
			chatProxy.POST("/rooms", func(c *gin.Context) {
				// Create a chat room via OpenWA group creation or private chat mapping.
				var req struct {
					Name     string `json:"name"`
					Type     string `json:"type"`
					MemberIds []string `json:"memberIds"`
					RecipientId string `json:"recipientId"`
				}
				if err := c.ShouldBindJSON(&req); err != nil {
					c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
					return
				}
				if req.Type == "group" || req.Type == "chama" {
					group, err := waClient.CreateGroup(c.Request.Context(), cfg.OpenWADefaultSessionID, req.Name, req.MemberIds)
					if err != nil {
						c.JSON(http.StatusBadGateway, gin.H{"success": false, "error": err.Error()})
						return
					}
					c.JSON(http.StatusCreated, gin.H{"success": true, "data": group})
					return
				}
				roomID := req.RecipientId
				if roomID == "" {
					roomID = req.Name
				}
				c.JSON(http.StatusCreated, gin.H{"success": true, "data": map[string]interface{}{"id": roomID}})
			})
			chatProxy.POST("/rooms/:roomId/join", func(c *gin.Context) {
				c.JSON(http.StatusOK, gin.H{"success": true})
			})
			chatProxy.POST("/rooms/:roomId/leave", func(c *gin.Context) {
				c.JSON(http.StatusOK, gin.H{"success": true})
			})
			chatProxy.GET("/rooms/:roomId/messages", func(c *gin.Context) {
				roomID := c.Param("roomId")
				chatID, ok := wa.NewRoomMapper(db.WriteDB()).Lookup(roomID)
				if !ok {
					c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "room not mapped"})
					return
				}
				handleGetMessages(c, waClient, cfg.OpenWADefaultSessionID, chatID, c.Query("limit"), c.Query("before"))
			})
			chatProxy.POST("/rooms/:roomId/messages", func(c *gin.Context) {
				roomID := c.Param("roomId")
				chatID, ok := wa.NewRoomMapper(db.WriteDB()).Lookup(roomID)
				if !ok {
					c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "room not mapped"})
					return
				}
				var req struct {
					Content string `json:"content"`
					Type    string `json:"type"`
				}
				if err := c.ShouldBindJSON(&req); err != nil {
					c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
					return
				}
				// Build a new request with chatId injected
				result, err := waClient.SendText(c.Request.Context(), cfg.OpenWADefaultSessionID, chatID, req.Content)
				if err != nil {
					c.JSON(http.StatusBadGateway, gin.H{"success": false, "error": err.Error()})
					return
				}
				c.JSON(http.StatusCreated, gin.H{"success": true, "data": result})
			})
			chatProxy.POST("/rooms/:roomId/read", func(c *gin.Context) {
				roomID := c.Param("roomId")
				chatID, ok := wa.NewRoomMapper(db.WriteDB()).Lookup(roomID)
				if !ok {
					c.JSON(http.StatusOK, gin.H{"success": true})
					return
				}
				_ = waClient.MarkRead(c.Request.Context(), cfg.OpenWADefaultSessionID, chatID)
				c.JSON(http.StatusOK, gin.H{"success": true})
			})
			chatProxy.DELETE("/messages/:messageId", func(c *gin.Context) {
				c.JSON(http.StatusOK, gin.H{"success": true})
			})
			chatProxy.GET("/rooms/:roomId/search", func(c *gin.Context) {
				c.JSON(http.StatusOK, gin.H{"success": true, "data": []interface{}{}})
			})
			chatProxy.POST("/rooms/:roomId/files", func(c *gin.Context) {
				c.JSON(http.StatusNotImplemented, gin.H{"success": false, "error": "file upload not yet implemented for OpenWA"})
			})
			chatProxy.POST("/upload/image", func(c *gin.Context) {
				c.JSON(http.StatusNotImplemented, gin.H{"success": false, "error": "image upload not yet implemented for OpenWA"})
			})
			chatProxy.GET("/rooms/:roomId/members", func(c *gin.Context) {
				c.JSON(http.StatusOK, gin.H{"success": true, "data": []interface{}{}})
			})
		}

	}

	// WebSocket endpoint for real-time chat via OpenWA
	waWSGroup := router.Group("/api/v1/wa")
	{
		waWSGroup.POST("/ws-token", func(c *gin.Context) {
			waWSTokenHandler(c, cache)
		})
		waWSGroup.GET("/ws", func(c *gin.Context) {
			waWSHandler(c, cfg, cache, wsHandler)
		})
	}
}

// waWSTokenHandler issues a short-lived token for the WebSocket connection.
func waWSTokenHandler(c *gin.Context, cache services.Cache) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	sessionID := uuid.New().String()

	waChatSessionStore.mu.Lock()
	waChatSessionStore.store[sessionID] = userID
	waChatSessionStore.mu.Unlock()

	go func(id string) {
		time.Sleep(5 * time.Minute)
		waChatSessionStore.mu.Lock()
		delete(waChatSessionStore.store, id)
		waChatSessionStore.mu.Unlock()
	}(sessionID)

	c.JSON(http.StatusOK, gin.H{
		"sessionId": sessionID,
		"expiresIn": 300,
	})
}

var waChatSessionStore = struct {
	store map[string]string
	mu    sync.Mutex
}{store: make(map[string]string)}

// waWSHandler upgrades to WebSocket and bridges VaultKe chat protocol to OpenWA.
func waWSHandler(c *gin.Context, cfg *config.Config, cache services.Cache, handler *wa.WSHandler) {
	_ = cfg
	_ = cache

	sessionID := c.Query("session")
	if sessionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "session required"})
		return
	}

	waChatSessionStore.mu.Lock()
	userID, ok := waChatSessionStore.store[sessionID]
	waChatSessionStore.mu.Unlock()

	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired session"})
		return
	}

	c.Set("userID", userID)
	handler.HandleWebSocket(c)
}

// ==================== REST Handlers ====================

func handleListSessions(c *gin.Context, db *sql.DB) {
	rows, err := db.Query(`SELECT session_id, name, status, phone, push_name, is_default, created_at, updated_at FROM wa_sessions ORDER BY created_at DESC`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	defer rows.Close()

	sessions := make([]map[string]interface{}, 0)
	for rows.Next() {
		var id, name, status, phone, pushName sql.NullString
		var isDefault bool
		var createdAt, updatedAt sql.NullTime
		if err := rows.Scan(&id, &name, &status, &phone, &pushName, &isDefault, &createdAt, &updatedAt); err != nil {
			continue
		}
		sessions = append(sessions, map[string]interface{}{
			"sessionId":  id.String,
			"name":       name.String,
			"status":     status.String,
			"phone":      phone.String,
			"pushName":   pushName.String,
			"isDefault":  isDefault,
			"createdAt":  createdAt.Time,
			"updatedAt":  updatedAt.Time,
		})
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": sessions})
}

func handleGetSession(c *gin.Context, db *sql.DB, sessionID string) {
	var name, status, phone, pushName sql.NullString
	var isDefault bool
	var createdAt, updatedAt sql.NullTime
	err := db.QueryRow(`SELECT session_id, name, status, phone, push_name, is_default, created_at, updated_at FROM wa_sessions WHERE session_id = $1`,
		sessionID).Scan(&sessionID, &name, &status, &phone, &pushName, &isDefault, &createdAt, &updatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "session not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": map[string]interface{}{
			"sessionId": sessionID,
			"name":      name.String,
			"status":    status.String,
			"phone":     phone.String,
			"pushName":  pushName.String,
			"isDefault": isDefault,
			"createdAt": createdAt.Time,
			"updatedAt": updatedAt.Time,
		},
	})
}

func handleCreateSession(c *gin.Context, client *wa.OpenWAClient) {
	var req struct {
		Name string `json:"name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	path := "/api/sessions"
	payload := map[string]interface{}{"name": req.Name}
	reqBody := strings.NewReader(wa.MustJSON(payload))
	httpReq, err := http.NewRequestWithContext(c.Request.Context(), http.MethodPost, client.BaseURL+path, reqBody)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	httpReq.Header.Set("Authorization", client.APIKey)
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := client.HTTPClient.Do(httpReq)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"success": false, "error": fmt.Sprintf("openwa unreachable: %v", err)})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		c.JSON(http.StatusBadGateway, gin.H{"success": false, "error": fmt.Sprintf("openwa create session failed: %d", resp.StatusCode)})
		return
	}

	var session struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&session); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"success": true, "data": map[string]interface{}{"sessionId": session.ID, "name": req.Name, "status": "created"}})
}

func handleStartSession(c *gin.Context, client *wa.OpenWAClient, sessionID string) {
	path := fmt.Sprintf("/api/sessions/%s/start", sessionID)
	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodPost, client.BaseURL+path, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	req.Header.Set("Authorization", client.APIKey)

	resp, err := client.HTTPClient.Do(req)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"success": false, "error": fmt.Sprintf("openwa unreachable: %v", err)})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusAccepted {
		c.JSON(http.StatusBadGateway, gin.H{"success": false, "error": fmt.Sprintf("openwa start failed: %d", resp.StatusCode)})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "session start initiated"})
}

func handleLogoutSession(c *gin.Context, client *wa.OpenWAClient, sessionID string) {
	path := fmt.Sprintf("/api/sessions/%s/logout", sessionID)
	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodPost, client.BaseURL+path, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	req.Header.Set("Authorization", client.APIKey)

	resp, err := client.HTTPClient.Do(req)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"success": false, "error": fmt.Sprintf("openwa unreachable: %v", err)})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		c.JSON(http.StatusBadGateway, gin.H{"success": false, "error": fmt.Sprintf("openwa logout failed: %d", resp.StatusCode)})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "session logged out"})
}

func handleGetChats(c *gin.Context, client *wa.OpenWAClient, sessionID string) {
	limit := 100
	if l := c.Query("limit"); l != "" {
		fmt.Sscanf(l, "%d", &limit)
	}
	offset := 0
	if o := c.Query("offset"); o != "" {
		fmt.Sscanf(o, "%d", &offset)
	}

	chats, err := client.GetChats(c.Request.Context(), sessionID, limit, offset)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": chats})
}

func handleGetMessages(c *gin.Context, client *wa.OpenWAClient, sessionID, chatID, limitStr, before string) {
	limit := 50
	if limitStr != "" {
		fmt.Sscanf(limitStr, "%d", &limit)
	}

	messages, err := client.GetMessages(c.Request.Context(), sessionID, chatID, limit, before)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": messages})
}

func handleSendText(c *gin.Context, client *wa.OpenWAClient, sessionID string) {
	var req struct {
		ChatID string `json:"chatId" binding:"required"`
		Text   string `json:"text" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	result, err := client.SendText(c.Request.Context(), sessionID, req.ChatID, req.Text)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"success": true, "data": result})
}

func handleSendImage(c *gin.Context, client *wa.OpenWAClient, sessionID string) {
	var req struct {
		ChatID   string `json:"chatId" binding:"required"`
		URL      string `json:"url"`
		Base64   string `json:"base64"`
		MimeType string `json:"mimetype"`
		Caption  string `json:"caption"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	result, err := client.SendImage(c.Request.Context(), sessionID, req.ChatID, req.URL, req.Base64, req.MimeType, req.Caption)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"success": true, "data": result})
}

func handleSendDocument(c *gin.Context, client *wa.OpenWAClient, sessionID string) {
	var req struct {
		ChatID   string `json:"chatId" binding:"required"`
		URL      string `json:"url"`
		Base64   string `json:"base64"`
		MimeType string `json:"mimetype"`
		Filename string `json:"filename"`
		Caption  string `json:"caption"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	result, err := client.SendDocument(c.Request.Context(), sessionID, req.ChatID, req.URL, req.Base64, req.MimeType, req.Filename, req.Caption)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"success": true, "data": result})
}

func handleMarkRead(c *gin.Context, client *wa.OpenWAClient, sessionID string) {
	var req struct {
		ChatID string `json:"chatId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	if err := client.MarkRead(c.Request.Context(), sessionID, req.ChatID); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func handleSendChatState(c *gin.Context, client *wa.OpenWAClient, sessionID string) {
	var req struct {
		ChatID string `json:"chatId" binding:"required"`
		State  string `json:"state" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	if err := client.SendChatState(c.Request.Context(), sessionID, req.ChatID, req.State); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func handleGetGroups(c *gin.Context, client *wa.OpenWAClient, sessionID string) {
	limit := 100
	if l := c.Query("limit"); l != "" {
		fmt.Sscanf(l, "%d", &limit)
	}
	offset := 0
	if o := c.Query("offset"); o != "" {
		fmt.Sscanf(o, "%d", &offset)
	}

	groups, err := client.GetGroups(c.Request.Context(), sessionID, limit, offset)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": groups})
}

func handleCreateGroup(c *gin.Context, client *wa.OpenWAClient, sessionID string) {
	var req struct {
		Name         string   `json:"name" binding:"required"`
		Participants []string `json:"participants"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	group, err := client.CreateGroup(c.Request.Context(), sessionID, req.Name, req.Participants)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"success": true, "data": group})
}

func handleAddGroupParticipants(c *gin.Context, client *wa.OpenWAClient, sessionID, groupID string) {
	var req struct {
		Participants []string `json:"participants" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	if err := client.AddGroupParticipants(c.Request.Context(), sessionID, groupID, req.Participants); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func handleRemoveGroupParticipant(c *gin.Context, client *wa.OpenWAClient, sessionID, groupID, participantID string) {
	if err := client.RemoveGroupParticipant(c.Request.Context(), sessionID, groupID, participantID); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func handleGetContacts(c *gin.Context, client *wa.OpenWAClient, sessionID string) {
	path := fmt.Sprintf("/api/sessions/%s/contacts", sessionID)
	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodGet, client.BaseURL+path, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	req.Header.Set("Authorization", client.APIKey)
	req.Header.Set("Accept", "application/json")

	resp, err := client.HTTPClient.Do(req)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"success": false, "error": err.Error()})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		c.JSON(http.StatusBadGateway, gin.H{"success": false, "error": fmt.Sprintf("openwa get contacts failed: %d", resp.StatusCode)})
		return
	}

	var contacts []map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&contacts); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": contacts})
}

func handleGetProfile(c *gin.Context, client *wa.OpenWAClient, sessionID string) {
	path := fmt.Sprintf("/api/sessions/%s/profile", sessionID)
	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodGet, client.BaseURL+path, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	req.Header.Set("Authorization", client.APIKey)
	req.Header.Set("Accept", "application/json")

	resp, err := client.HTTPClient.Do(req)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"success": false, "error": err.Error()})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		c.JSON(http.StatusBadGateway, gin.H{"success": false, "error": fmt.Sprintf("openwa get profile failed: %d", resp.StatusCode)})
		return
	}

	var profile map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&profile); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": profile})
}
