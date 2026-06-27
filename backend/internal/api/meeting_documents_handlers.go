package api

import (
	"database/sql"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"time"
	"vaultke-backend/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// GetGoogleCalendarAddEventURL returns a pre-filled Google Calendar event URL for a meeting
func GetGoogleCalendarAddEventURL(c *gin.Context) {
	meetingID := c.Param("id")
	if meetingID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Meeting ID is required",
		})
		return
	}

	// Get meeting details
	meeting, err := meetingService.GetMeeting(meetingID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Failed to get meeting: " + err.Error(),
		})
		return
	}

	// Build a summary and description (include chama name)
	// Fetch chama name for better labeling
	db, dbExists := c.Get("db")
	var chamaName string
	if dbExists {
		_ = db.(*sql.DB).QueryRow("SELECT name FROM chamas WHERE id = $1", meeting.ChamaID).Scan(&chamaName)
	}
	if chamaName == "" {
		chamaName = "Chama"
	}

	summary := meeting.Title
	if summary == "" {
		summary = "Chama Meeting"
	}
	summary = fmt.Sprintf("%s — %s", summary, chamaName)

	description := fmt.Sprintf("%s\n\nLocation: %s.", "Chama meeting.", meeting.Location)
	if meeting.MeetingURL != "" {
		description += "\\nJoin: " + meeting.MeetingURL
	}

	// Compute start/end using scheduled time and duration in EAT
	eat, _ := time.LoadLocation("Africa/Nairobi")
	start := meeting.ScheduledAt.In(eat)
	end := meeting.ScheduledAt.In(eat).Add(time.Duration(max(1, meeting.Duration)) * time.Minute)

	// Google Calendar template URL
	// https://calendar.google.com/calendar/render?action=TEMPLATE&text=...&dates=YYYYMMDDTHHMMSSZ/YYY...&details=...&location=...
	const template = "https://calendar.google.com/calendar/render"
	params := url.Values{}
	params.Set("action", "TEMPLATE")
	params.Set("text", summary)
	params.Set("details", description)
	if meeting.Location != "" {
		params.Set("location", meeting.Location)
	}

	// Provide local datetime without Z and set ctz to Africa/Nairobi for accurate display
	toLocal := func(t time.Time) string { return t.Format("20060102T150405") }
	params.Set("dates", fmt.Sprintf("%s/%s", toLocal(start), toLocal(end)))
	params.Set("ctz", "Africa/Nairobi")

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"url": template + "?" + params.Encode(),
		},
	})
}

// CreateGoogleCalendarEvent creates the event in the user's Google Calendar with 30/10/0 minute reminders
func CreateGoogleCalendarEvent(c *gin.Context) {
	meetingID := c.Param("id")
	if meetingID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Meeting ID is required"})
		return
	}

	// Auth user
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "User not authenticated"})
		return
	}

	// Get DB and services
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Database connection not available"})
		return
	}

	// Load meeting and chama name
	meeting, err := meetingService.GetMeeting(meetingID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Failed to get meeting: " + err.Error()})
		return
	}

	// Fetch chama name
	var chamaName string
	err = db.(*sql.DB).QueryRow("SELECT name FROM chamas WHERE id = $1", meeting.ChamaID).Scan(&chamaName)
	if err != nil {
		chamaName = "Chama"
	}

	// Get the user's stored Google tokens via GoogleDriveService storage (shared token store)
	driveService := services.NewGoogleDriveService(db.(*sql.DB))
	token, err := driveService.GetUserTokens(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Google account not connected for this user"})
		return
	}

	// Initialize CalendarService with credentials from env JSON
	creds := os.Getenv("GOOGLE_CALENDAR_CREDENTIALS_JSON")
	if creds == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Calendar credentials not configured"})
		return
	}
	calService, err := services.NewCalendarService([]byte(creds))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to init calendar service: " + err.Error()})
		return
	}
	if err := calService.InitializeWithToken(token); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to authorize calendar: " + err.Error()})
		return
	}

	// Build event with accurate start/end and chama name in title
	title := fmt.Sprintf("%s — %s", meeting.Title, chamaName)
	desc := meeting.Description
	if meeting.MeetingURL != "" {
		desc = fmt.Sprintf("%s\n\nJoin: %s", desc, meeting.MeetingURL)
	}

	ev := &services.CalendarEvent{
		Title:       title,
		Description: desc,
		StartTime:   meeting.ScheduledAt,
		EndTime:     meeting.ScheduledAt.Add(time.Duration(max(1, meeting.Duration)) * time.Minute),
		Location:    meeting.Location,
		MeetingURL:  meeting.MeetingURL,
	}

	// Use primary calendar and reminders 30,10,0 minutes
	created, err := calService.CreateEventWithReminders("primary", ev, []int{30, 10, 0})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to create calendar event: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"eventId": created.Id, "htmlLink": created.HtmlLink}})
}

// MarkAttendance marks a user's attendance for a meeting
func MarkAttendance(c *gin.Context) {
	meetingID := c.Param("id")
	if meetingID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Meeting ID is required",
		})
		return
	}

	// Get user ID from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	var req struct {
		AttendanceType string `json:"attendanceType" binding:"required"` // 'physical', 'virtual'
		IsPresent      bool   `json:"isPresent"`
		UserID         string `json:"userId"` // Optional: for secretary to mark attendance for others
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request data: " + err.Error(),
		})
		return
	}

	// Determine which user's attendance to mark
	targetUserID := userID.(string) // Default to current user
	if req.UserID != "" {
		// Secretary is marking attendance for another user
		targetUserID = req.UserID

		// Verify that the current user has permission to mark attendance for others
		// This should be a secretary or chairperson
		// TODO: Add proper role verification here
		log.Printf("User %s is marking attendance for user %s", userID.(string), targetUserID)
	}

	err := meetingService.MarkAttendance(meetingID, targetUserID, req.AttendanceType, req.IsPresent)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to mark attendance: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Attendance marked successfully",
	})
}

// GetMeetingAttendance retrieves attendance records for a meeting
func GetMeetingAttendance(c *gin.Context) {
	meetingID := c.Param("id")
	if meetingID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Meeting ID is required",
		})
		return
	}

	attendances, err := meetingService.GetMeetingAttendance(meetingID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to get meeting attendance: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    attendances,
	})
}

// UploadMeetingDocument handles document uploads for meetings
func UploadMeetingDocument(c *gin.Context) {

	meetingID := c.Param("id")
	if meetingID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Meeting ID is required",
		})
		return
	}


	// Get user ID from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	// Debug: Log request details

	// Parse multipart form
	err := c.Request.ParseMultipartForm(10 << 20) // 10 MB max
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Failed to parse multipart form: " + err.Error(),
		})
		return
	}

	// Get file from form
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "No file provided: " + err.Error(),
		})
		return
	}
	defer file.Close()

	// Validate file size (10MB max)
	if header.Size > 10*1024*1024 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "File too large. Maximum size is 10MB",
		})
		return
	}

	// Create uploads directory
	uploadsDir := "./uploads/meetings"
	tempDir := "./uploads/temp"
	if err := os.MkdirAll(uploadsDir, 0o755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create upload directory: " + err.Error(),
		})
		return
	}
	if err := os.MkdirAll(tempDir, 0o755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create temp directory: " + err.Error(),
		})
		return
	}

	// Generate unique filename
	fileExt := filepath.Ext(header.Filename)
	fileName := fmt.Sprintf("%s_%d%s", uuid.New().String(), time.Now().Unix(), fileExt)
	tempFilePath := filepath.Join(tempDir, fileName)
	finalFilePath := filepath.Join(uploadsDir, fileName)

	// Save file to temp location first
	dst, err := os.Create(tempFilePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create temp file: " + err.Error(),
		})
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		os.Remove(tempFilePath)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to save file: " + err.Error(),
		})
		return
	}
	dst.Close()

	// ClamAV scan before persisting (optional if ClamAV is not installed)
	scanResult := services.ScanFileWithClamAV(tempFilePath)
	if !services.IsClamAVAvailable() {
		log.Printf("⚠️ ClamAV not installed; skipping scan for %s", tempFilePath)
	} else if scanResult.ScanError != nil || scanResult.Infected || !scanResult.IsClean {
		os.Remove(tempFilePath)
		reason := "unknown error"
		if scanResult.Infected {
			reason = "malware detected"
		} else if scanResult.ScanError != nil {
			reason = scanResult.ScanError.Error()
		}
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "File rejected by security policy: " + reason,
		})
		return
	}

	// Move file from temp to final location after clean scan
	if err := os.Rename(tempFilePath, finalFilePath); err != nil {
		os.Remove(tempFilePath)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to move file to storage: " + err.Error(),
		})
		return
	}

	// Create file URL
	fileURL := fmt.Sprintf("/uploads/meetings/%s", fileName)

	// Get form values
	documentType := c.PostForm("documentType")
	description := c.PostForm("description")

	if documentType == "" {
		documentType = "meeting_document"
	}

	// Save document info to database
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}

	documentID := uuid.New().String()
	_, err = db.(*sql.DB).Exec(`
		INSERT INTO meeting_documents (
			id, meeting_id, uploaded_by, file_name, file_path, file_url,
			file_size, file_type, document_type, description, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
	`, documentID, meetingID, userID, header.Filename, finalFilePath, fileURL,
		header.Size, header.Header.Get("Content-Type"), documentType, description)
	if err != nil {
		// Clean up uploaded file if database insert fails
		os.Remove(finalFilePath)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to save document info: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Document uploaded successfully",
		"data": map[string]interface{}{
			"id":           documentID,
			"meetingId":    meetingID,
			"fileName":     header.Filename,
			"fileSize":     header.Size,
			"fileType":     header.Header.Get("Content-Type"),
			"documentType": documentType,
			"description":  description,
			"url":          fileURL,
			"uploadedBy":   userID,
			"uploadedAt":   time.Now().Format(time.RFC3339),
		},
	})
}

// GetMeetingDocuments retrieves all documents for a meeting
func GetMeetingDocuments(c *gin.Context) {
	meetingID := c.Param("id")
	if meetingID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Meeting ID is required",
		})
		return
	}

	// Get database connection
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}

	// Query documents
	rows, err := db.(*sql.DB).Query(`
		SELECT id, meeting_id, uploaded_by, file_name, file_url, file_size,
			   file_type, document_type, description, created_at
		FROM meeting_documents
		WHERE meeting_id = $1
		ORDER BY created_at DESC
	`, meetingID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to fetch documents: " + err.Error(),
		})
		return
	}
	defer rows.Close()

	var documents []map[string]interface{}
	for rows.Next() {
		var doc struct {
			ID           string    `json:"id"`
			MeetingID    string    `json:"meetingId"`
			UploadedBy   string    `json:"uploadedBy"`
			FileName     string    `json:"fileName"`
			FileURL      string    `json:"fileUrl"`
			FileSize     int64     `json:"fileSize"`
			FileType     string    `json:"fileType"`
			DocumentType string    `json:"documentType"`
			Description  string    `json:"description"`
			CreatedAt    time.Time `json:"createdAt"`
		}

		err := rows.Scan(&doc.ID, &doc.MeetingID, &doc.UploadedBy, &doc.FileName,
			&doc.FileURL, &doc.FileSize, &doc.FileType, &doc.DocumentType,
			&doc.Description, &doc.CreatedAt)
		if err != nil {
			continue
		}

		documents = append(documents, map[string]interface{}{
			"id":           doc.ID,
			"meetingId":    doc.MeetingID,
			"uploadedBy":   doc.UploadedBy,
			"name":         doc.FileName,
			"url":          doc.FileURL,
			"size":         doc.FileSize,
			"type":         doc.FileType,
			"documentType": doc.DocumentType,
			"description":  doc.Description,
			"uploadedAt":   doc.CreatedAt.Format(time.RFC3339),
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    documents,
	})
}

// DeleteMeetingDocument deletes a document from a meeting
func DeleteMeetingDocument(c *gin.Context) {
	meetingID := c.Param("id")
	documentID := c.Param("docId")

	if meetingID == "" || documentID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Meeting ID and Document ID are required",
		})
		return
	}

	// Get user ID from context for authentication
	_, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	// Get database connection
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}

	// Get document info first to delete the file
	var filePath string
	err := db.(*sql.DB).QueryRow(`
		SELECT file_path FROM meeting_documents
		WHERE id = $1 AND meeting_id = $2
	`, documentID, meetingID).Scan(&filePath)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"error":   "Document not found",
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to find document: " + err.Error(),
			})
		}
		return
	}

	// Delete from database first
	_, err = db.(*sql.DB).Exec(`
		DELETE FROM meeting_documents
		WHERE id = $1 AND meeting_id = $2
	`, documentID, meetingID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to delete document from database: " + err.Error(),
		})
		return
	}

	// Delete physical file
	if filePath != "" {
		os.Remove(filePath) // Ignore error if file doesn't exist
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Document deleted successfully",
	})
}

// SaveMeetingMinutes saves meeting notes/minutes
func SaveMeetingMinutes(c *gin.Context) {
	meetingID := c.Param("id")
	if meetingID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Meeting ID is required",
		})
		return
	}

	// Get user ID from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	var req struct {
		Content   string `json:"content" binding:"required"`
		Status    string `json:"status"`
		MeetingID string `json:"meetingId"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request data: " + err.Error(),
		})
		return
	}

	// Set default status
	if req.Status == "" {
		req.Status = "draft"
	}

	// Get database connection
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}

	// Check if minutes already exist for this meeting
	var existingID string
	err := db.(*sql.DB).QueryRow(`
		SELECT id FROM meeting_minutes WHERE meeting_id = $1
	`, meetingID).Scan(&existingID)

	if err == sql.ErrNoRows {
		// Create new minutes
		minutesID := uuid.New().String()
		_, err = db.(*sql.DB).Exec(`
			INSERT INTO meeting_minutes (
				id, meeting_id, content, status, taken_by, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		`, minutesID, meetingID, req.Content, req.Status, userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to save meeting minutes: " + err.Error(),
			})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"success": true,
			"message": "Meeting minutes saved successfully",
			"data": map[string]interface{}{
				"id":        minutesID,
				"meetingId": meetingID,
				"content":   req.Content,
				"status":    req.Status,
				"takenBy":   userID,
				"createdAt": time.Now().Format(time.RFC3339),
			},
		})
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to check existing minutes: " + err.Error(),
		})
		return
	} else {
		// Update existing minutes
		_, err = db.(*sql.DB).Exec(`
			UPDATE meeting_minutes
			SET content = $1, status = $2, taken_by = $3, updated_at = CURRENT_TIMESTAMP
			WHERE id = $4
		`, req.Content, req.Status, userID, existingID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to update meeting minutes: " + err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "Meeting minutes updated successfully",
			"data": map[string]interface{}{
				"id":        existingID,
				"meetingId": meetingID,
				"content":   req.Content,
				"status":    req.Status,
				"takenBy":   userID,
				"updatedAt": time.Now().Format(time.RFC3339),
			},
		})
	}
}

// UpdateMeetingMinutes updates meeting minutes fields (content/status). If minutes do not exist, creates them.
func UpdateMeetingMinutes(c *gin.Context) {
	meetingID := c.Param("id")
	if meetingID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Meeting ID is required",
		})
		return
	}

	// Get user ID from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	var req struct {
		Content string `json:"content"`
		Status  string `json:"status"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request data: " + err.Error(),
		})
		return
	}

	// Default status if omitted
	if req.Status == "" {
		req.Status = "draft"
	}

	// Get database connection
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}

	// Check if minutes exist
	var existingID string
	err := db.(*sql.DB).QueryRow(`
		SELECT id FROM meeting_minutes WHERE meeting_id = $1
	`, meetingID).Scan(&existingID)

	if err == sql.ErrNoRows {
		// Create if not exists
		minutesID := uuid.New().String()
		_, err = db.(*sql.DB).Exec(`
			INSERT INTO meeting_minutes (
				id, meeting_id, content, status, taken_by, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		`, minutesID, meetingID, req.Content, req.Status, userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to create meeting minutes: " + err.Error(),
			})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"success": true,
			"message": "Meeting minutes created",
			"data": map[string]interface{}{
				"id":        minutesID,
				"meetingId": meetingID,
				"content":   req.Content,
				"status":    req.Status,
				"takenBy":   userID,
				"createdAt": time.Now().Format(time.RFC3339),
			},
		})
		return
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to check existing minutes: " + err.Error(),
		})
		return
	}

	// Update existing
	_, err = db.(*sql.DB).Exec(`
		UPDATE meeting_minutes
		SET content = COALESCE(NULLIF($1, ''), content),
			status = $2,
			taken_by = $3,
			updated_at = CURRENT_TIMESTAMP
		WHERE id = $4
	`, req.Content, req.Status, userID, existingID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to update meeting minutes: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Meeting minutes updated",
		"data": map[string]interface{}{
			"id":        existingID,
			"meetingId": meetingID,
			"content":   req.Content,
			"status":    req.Status,
			"takenBy":   userID,
			"updatedAt": time.Now().Format(time.RFC3339),
		},
	})
}

// GetMeetingMinutes retrieves meeting minutes
func GetMeetingMinutes(c *gin.Context) {
	meetingID := c.Param("id")
	if meetingID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Meeting ID is required",
		})
		return
	}

	// Get database connection
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}

	var minutes struct {
		ID        string    `json:"id"`
		MeetingID string    `json:"meetingId"`
		Content   string    `json:"content"`
		Status    string    `json:"status"`
		TakenBy   string    `json:"takenBy"`
		CreatedAt time.Time `json:"createdAt"`
		UpdatedAt time.Time `json:"updatedAt"`
	}

	err := db.(*sql.DB).QueryRow(`
		SELECT id, meeting_id, content, status, taken_by, created_at, updated_at
		FROM meeting_minutes
		WHERE meeting_id = $1
	`, meetingID).Scan(&minutes.ID, &minutes.MeetingID, &minutes.Content, &minutes.Status,
		&minutes.TakenBy, &minutes.CreatedAt, &minutes.UpdatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusOK, gin.H{
				"success": true,
				"data":    nil,
				"message": "No minutes found for this meeting",
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to fetch meeting minutes: " + err.Error(),
			})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": map[string]interface{}{
			"id":        minutes.ID,
			"meetingId": minutes.MeetingID,
			"content":   minutes.Content,
			"status":    minutes.Status,
			"takenBy":   minutes.TakenBy,
			"createdAt": minutes.CreatedAt.Format(time.RFC3339),
			"updatedAt": minutes.UpdatedAt.Format(time.RFC3339),
		},
	})
}
