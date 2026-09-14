package api

import (
	"database/sql"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"vaultke-backend/config"
)

type ApkVersion struct {
	ID           int        `json:"id" db:"id"`
	VersionCode  int        `json:"versionCode" db:"version_code"`
	VersionName  string     `json:"versionName" db:"version_name"`
	FileName     string     `json:"fileName" db:"file_name"`
	FilePath     string     `json:"-" db:"file_path"`
	FileSize     int64      `json:"fileSize" db:"file_size"`
	ReleaseNotes string     `json:"releaseNotes" db:"release_notes"`
	IsMandatory  bool       `json:"isMandatory" db:"is_mandatory"`
	IsActive     bool       `json:"isActive" db:"is_active"`
	IsLatest     bool       `json:"isLatest" db:"is_latest"`
	UploadedBy   *string    `json:"uploadedBy" db:"uploaded_by"`
	UploadIP     *string    `json:"uploadIP" db:"upload_ip"`
	CreatedAt    time.Time  `json:"createdAt" db:"created_at"`
	UpdatedAt    time.Time  `json:"updatedAt" db:"updated_at"`
}

func configFromContext(c *gin.Context) (*config.Config, bool) {
	cfgVal, exists := c.Get("config")
	if !exists {
		return nil, false
	}
	cfg, ok := cfgVal.(*config.Config)
	if !ok {
		return nil, false
	}
	return cfg, true
}

func UploadApk(c *gin.Context) {
	userRole := c.GetString("userRole")
	if userRole != "admin" && userRole != "publisher" {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "Only admins and publishers can upload APKs",
		})
		return
	}

	cfg, ok := configFromContext(c)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Configuration not available",
		})
		return
	}

	file, err := c.FormFile("apk")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "APK file is required",
		})
		return
	}

	if !strings.HasSuffix(strings.ToLower(file.Filename), ".apk") {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Only .apk files are allowed",
		})
		return
	}

	versionCodeStr := c.PostForm("versionCode")
	versionCode, err := strconv.Atoi(versionCodeStr)
	if err != nil || versionCode <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Valid version code is required (integer > 0)",
		})
		return
	}

	versionName := strings.TrimSpace(c.PostForm("versionName"))
	if versionName == "" {
		versionName = file.Filename
	}
	releaseNotes := c.PostForm("releaseNotes")
	isMandatory := strings.ToLower(c.PostForm("isMandatory")) == "true"

	db := dbFromContext(c)
	if db == nil {
		return
	}

	var existingCode int
	err = db.QueryRow(
		`SELECT 1 FROM apk_versions WHERE version_code = $1`, versionCode,
	).Scan(&existingCode)
	if err == nil {
		c.JSON(http.StatusConflict, gin.H{
			"success": false,
			"error":   fmt.Sprintf("Version code %d already exists. Use a higher version code.", versionCode),
		})
		return
	}

	uploadDir := filepath.Join(cfg.GetUploadPath(), "apk")
	if err := os.MkdirAll(uploadDir, 0o755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to prepare upload directory",
		})
		return
	}

	safeFilename := fmt.Sprintf("vaultke-v%d-%s.apk", versionCode, sanitizeFilename(versionName))
	relativePath := filepath.Join("apk", safeFilename)
	fullPath := filepath.Join(cfg.GetUploadPath(), relativePath)

	src, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to open uploaded file",
		})
		return
	}
	defer src.Close()

	maxSize := int64(200 << 20)
	limitedReader := io.LimitReader(src, maxSize+1)

	out, err := os.OpenFile(fullPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0o644)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create destination file",
		})
		return
	}

	written, err := io.Copy(out, limitedReader)
	out.Close()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to write APK file",
		})
		return
	}

	if written > maxSize {
		os.Remove(fullPath)
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{
			"success": false,
			"error":   "APK file too large (max 200MB)",
		})
		return
	}

	fileSize := file.Size

	userID := c.GetString("userID")
	clientIP := c.ClientIP()

	tx, err := db.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to begin transaction",
		})
		return
	}
	defer tx.Rollback()

	if _, err := tx.Exec(
		`UPDATE apk_versions SET is_latest = FALSE WHERE is_latest = TRUE`,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to reset latest flag",
		})
		return
	}

	var newVersionID int
	err = tx.QueryRow(`
		INSERT INTO apk_versions (
			version_code, version_name, file_name, file_path, file_size,
			release_notes, is_mandatory, is_active, is_latest, uploaded_by, upload_ip,
			created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, TRUE, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		RETURNING id
	`, versionCode, versionName, safeFilename, relativePath, fileSize,
		releaseNotes, isMandatory, userID, clientIP,
	).Scan(&newVersionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to store APK metadata: " + err.Error(),
		})
		return
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to commit transaction",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "APK uploaded successfully",
		"data": gin.H{
			"id":           newVersionID,
			"versionCode":  versionCode,
			"versionName":  versionName,
			"fileName":     safeFilename,
			"fileSize":     fileSize,
			"isLatest":     true,
			"isMandatory":  isMandatory,
			"releaseNotes": releaseNotes,
			"createdAt":    time.Now(),
		},
	})
}

func GetLatestApk(c *gin.Context) {
	db := dbFromContext(c)
	if db == nil {
		return
	}

	var v ApkVersion
	err := db.QueryRow(`
		SELECT id, version_code, version_name, file_name, file_size, release_notes,
		       is_mandatory, is_active, is_latest, uploaded_by, upload_ip, created_at, updated_at
		FROM apk_versions
		WHERE is_active = TRUE AND is_latest = TRUE
		ORDER BY version_code DESC
		LIMIT 1
	`).Scan(
		&v.ID, &v.VersionCode, &v.VersionName, &v.FileName, &v.FileSize,
		&v.ReleaseNotes, &v.IsMandatory, &v.IsActive, &v.IsLatest,
		&v.UploadedBy, &v.UploadIP, &v.CreatedAt, &v.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data":    nil,
		})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to fetch latest APK",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"versionCode":  v.VersionCode,
			"versionName":  v.VersionName,
			"fileName":     v.FileName,
			"fileSize":     v.FileSize,
			"releaseNotes": v.ReleaseNotes,
			"isMandatory":  v.IsMandatory,
			"createdAt":    v.CreatedAt,
			"downloadUrl":  fmt.Sprintf("/api/v1/apk/download/%s", v.VersionName),
		},
	})
}

func DownloadApk(c *gin.Context) {
	versionName := c.Param("version")

	cfg, ok := configFromContext(c)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Configuration not available",
		})
		return
	}

	db := dbFromContext(c)
	if db == nil {
		return
	}

	if versionName == "" || versionName == "latest" {
		err := db.QueryRow(
			`SELECT version_name FROM apk_versions WHERE is_active = TRUE AND is_latest = TRUE ORDER BY version_code DESC LIMIT 1`,
		).Scan(&versionName)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"error":   "No APK version available for download",
			})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to fetch latest APK",
			})
			return
		}
	}

	var relativePath, fileName string
	var fileSize int64
	err := db.QueryRow(`
		SELECT file_path, file_name, file_size FROM apk_versions WHERE version_name = $1 AND is_active = TRUE
	`).Scan(&relativePath, &fileName, &fileSize)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "APK version not found",
		})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to fetch APK metadata",
		})
		return
	}

	fullPath := filepath.Join(cfg.GetUploadPath(), relativePath)
	file, err := os.Open(fullPath)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "APK file not found on disk",
		})
		return
	}
	defer file.Close()

	if fileName == "" {
		fileName = fmt.Sprintf("vaultke-%s.apk", versionName)
	}

	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, fileName))
	c.Header("Content-Type", "application/vnd.android.package-archive")
	c.Header("Content-Length", strconv.FormatInt(fileSize, 10))
	c.Header("Cache-Control", "public, max-age=3600")

	http.ServeContent(c.Writer, c.Request, fileName, time.Now(), file)
}

func VersionCheck(c *gin.Context) {
	currentVersionCodeStr := c.Query("currentVersionCode")
	currentVersionCode := 0
	if currentVersionCodeStr != "" {
		currentVersionCode, _ = strconv.Atoi(currentVersionCodeStr)
	}
	currentVersionName := c.Query("currentVersionName")

	db := dbFromContext(c)
	if db == nil {
		return
	}

	var v ApkVersion
	err := db.QueryRow(`
		SELECT id, version_code, version_name, file_size, release_notes, is_mandatory
		FROM apk_versions
		WHERE is_active = TRUE AND is_latest = TRUE
		ORDER BY version_code DESC
		LIMIT 1
	`).Scan(
		&v.ID, &v.VersionCode, &v.VersionName, &v.FileSize,
		&v.ReleaseNotes, &v.IsMandatory,
	)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data": gin.H{
				"latest":    nil,
				"hasUpdate": false,
			},
		})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to check version",
		})
		return
	}

	updateType := "none"
	hasUpdate := v.VersionCode > currentVersionCode
	if hasUpdate {
		diff := v.VersionCode - currentVersionCode
		if diff >= 1000 {
			updateType = "major"
		} else if diff >= 1 {
			updateType = "minor"
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"latest": gin.H{
				"latestVersionCode": v.VersionCode,
				"latestVersionName": v.VersionName,
				"versionCode":       v.VersionCode,
				"versionName":       v.VersionName,
				"releaseNotes":      v.ReleaseNotes,
				"releaseDate":       v.CreatedAt,
				"fileSize":          v.FileSize,
				"downloadUrl":       fmt.Sprintf("/api/v1/apk/download/%s", v.VersionName),
				"isMandatory":       v.IsMandatory,
			},
			"hasUpdate":          hasUpdate,
			"updateType":         updateType,
			"currentVersionCode": currentVersionCode,
			"currentVersionName": currentVersionName,
		},
	})
}

func GetApkHistory(c *gin.Context) {
	db := dbFromContext(c)
	if db == nil {
		return
	}

	rows, err := db.Query(`
		SELECT id, version_code, version_name, file_name, file_size, release_notes,
		       is_mandatory, is_active, is_latest, uploaded_by, upload_ip, created_at, updated_at
		FROM apk_versions
		ORDER BY version_code DESC
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to fetch APK history",
		})
		return
	}
	defer rows.Close()

	var versions []gin.H
	for rows.Next() {
		var v ApkVersion
		if err := rows.Scan(
			&v.ID, &v.VersionCode, &v.VersionName, &v.FileName, &v.FileSize,
			&v.ReleaseNotes, &v.IsMandatory, &v.IsActive, &v.IsLatest,
			&v.UploadedBy, &v.UploadIP, &v.CreatedAt, &v.UpdatedAt,
		); err != nil {
			continue
		}

		versions = append(versions, gin.H{
			"id":           v.ID,
			"versionCode":  v.VersionCode,
			"versionName":  v.VersionName,
			"fileName":     v.FileName,
			"fileSize":     v.FileSize,
			"releaseNotes": v.ReleaseNotes,
			"isMandatory":  v.IsMandatory,
			"isActive":     v.IsActive,
			"isLatest":     v.IsLatest,
			"uploadedBy":   v.UploadedBy,
			"createdAt":    v.CreatedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    versions,
	})
}

func DeleteApkVersion(c *gin.Context) {
	userRole := c.GetString("userRole")
	if userRole != "admin" && userRole != "publisher" {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "Only admins and publishers can delete APK versions",
		})
		return
	}

	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid version ID",
		})
		return
	}

	cfg, ok := configFromContext(c)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Configuration not available",
		})
		return
	}

	db := dbFromContext(c)
	if db == nil {
		return
	}

	var filePath string
	var isLatest bool
	err = db.QueryRow(`
		SELECT file_path, is_latest FROM apk_versions WHERE id = $1
	`).Scan(&filePath, &isLatest)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "APK version not found",
		})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to fetch APK version",
		})
		return
	}

	fullPath := filepath.Join(cfg.GetUploadPath(), filePath)
	_ = os.Remove(fullPath)

	tx, err := db.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to begin transaction",
		})
		return
	}
	defer tx.Rollback()

	_, err = tx.Exec(`DELETE FROM apk_versions WHERE id = $1`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to delete APK version",
		})
		return
	}

	if isLatest {
		var maxCode int
		err = tx.QueryRow(`
			SELECT COALESCE(MAX(version_code), 0) FROM apk_versions WHERE is_active = TRUE
		`).Scan(&maxCode)
		if err == nil && maxCode > 0 {
			_, _ = tx.Exec(
				`UPDATE apk_versions SET is_latest = TRUE WHERE version_code = $1`,
				maxCode,
			)
		}
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to commit deletion",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "APK version removed successfully",
	})
}

func sanitizeFilename(name string) string {
	name = strings.Map(func(r rune) rune {
		if r >= 32 && r != '/' && r != '\\' && r != '*' && r != '?' && r != '"' && r != '<' && r != '>' && r != '|' {
			return r
		}
		return -1
	}, name)
	name = strings.TrimSpace(name)
	if name == "" {
		name = "release"
	}
	return name
}
