package api

import (
	"database/sql"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"vaultke-backend/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// UploadMeetingDocument handles document uploads for meetings
func UploadMeetingDocument(c *gin.Context, uploadPath string) {

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
	uploadsDir := filepath.Join(uploadPath, "meetings")
	tempDir := filepath.Join(uploadPath, "temp")
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
