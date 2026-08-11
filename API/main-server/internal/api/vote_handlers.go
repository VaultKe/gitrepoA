package api

import (
	"database/sql"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// CreateVote creates a new vote using the old vote system
func CreateVote(c *gin.Context) {
	userID := c.GetString("userID")
	chamaID := c.Param("id")

	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	if chamaID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Chama ID is required",
		})
		return
	}

	var req struct {
		Title       string `json:"title" binding:"required"`
		Description string `json:"description"`
		Type        string `json:"type"`
		EndsAt      string `json:"ends_at"`
		Options     []struct {
			OptionText string `json:"option_text" binding:"required"`
		} `json:"options" binding:"required,min=2"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request data: " + err.Error(),
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

	// Parse end date
	var endsAt time.Time
	if req.EndsAt != "" {
		var err error
		endsAt, err = time.Parse(time.RFC3339, req.EndsAt)
		if err != nil {
			// Default to 7 days from now if parsing fails
			endsAt = time.Now().Add(7 * 24 * time.Hour)
		}
	} else {
		// Default to 7 days from now
		endsAt = time.Now().Add(7 * 24 * time.Hour)
	}

	// Create vote
	voteID := fmt.Sprintf("vote-%d", time.Now().UnixNano())
	voteType := req.Type
	if voteType == "" {
		voteType = "general"
	}

	_, err := db.(*sql.DB).Exec(`
		INSERT INTO votes (id, chama_id, title, description, type, status, ends_at, created_by, created_at)
		VALUES ($1, $2, $3, $4, $5, 'active', $6, $7, CURRENT_TIMESTAMP)
	`, voteID, chamaID, req.Title, req.Description, voteType, endsAt, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create vote: " + err.Error(),
		})
		return
	}

	// Create vote options
	for _, option := range req.Options {
		optionID := fmt.Sprintf("option-%d-%s", time.Now().UnixNano(), option.OptionText[:min(10, len(option.OptionText))])
		_, err = db.(*sql.DB).Exec(`
			INSERT INTO vote_options (id, vote_id, option_text, vote_count)
			VALUES ($1, $2, $3, 0)
		`, optionID, voteID, option.OptionText)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to create vote option: " + err.Error(),
			})
			return
		}
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"message": "Vote created successfully",
		"data": map[string]interface{}{
			"id":            voteID,
			"chama_id":      chamaID,
			"title":         req.Title,
			"description":   req.Description,
			"type":          voteType,
			"status":        "active",
			"ends_at":       endsAt.Format(time.RFC3339),
			"created_by":    userID,
			"created_at":    time.Now().Format(time.RFC3339),
		},
	})
	c.Abort()
}

// GetChamaVotes retrieves votes for a chama
func GetChamaVotes(c *gin.Context) {
	userID := c.GetString("userID")
	chamaID := c.Param("id")

	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	if chamaID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Chama ID is required",
		})
		return
	}

	// Parse pagination parameters
	limitStr := c.DefaultQuery("limit", "50")
	offsetStr := c.DefaultQuery("offset", "0")

	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 || limit > 100 {
		limit = 50
	}

	offset, err := strconv.Atoi(offsetStr)
	if err != nil || offset < 0 {
		offset = 0
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

	// Get votes with options and user vote status
	rows, err := db.(*sql.DB).Query(`
		SELECT v.id, v.title, v.description, v.type, v.status, v.starts_at, v.ends_at, v.created_by, v.created_at,
		       u.first_name, u.last_name,
		       CASE WHEN uv.id IS NOT NULL THEN 1 ELSE 0 END as user_voted
		FROM votes v
		LEFT JOIN users u ON v.created_by = u.id
		LEFT JOIN user_votes uv ON v.id = uv.vote_id AND uv.user_id = $1
		WHERE v.chama_id = $2
		ORDER BY v.created_at DESC
		LIMIT $3 OFFSET $4
	`, userID, chamaID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to retrieve votes: " + err.Error(),
		})
		return
	}
	defer rows.Close()

	var voteIDs []string
	var voteMap []struct {
		ID          string
		Title       string
		Description string
		Type        string
		Status      string
		StartsAt    string
		EndsAt      string
		CreatedBy   string
		CreatedAt   string
		FirstName   string
		LastName    string
		UserVoted   int
		CreatedByName string
	}

	for rows.Next() {
		var vote struct {
			ID          string
			Title       string
			Description sql.NullString
			Type        string
			Status      string
			StartsAt    string
			EndsAt      string
			CreatedBy   string
			CreatedAt   string
			FirstName   sql.NullString
			LastName    sql.NullString
			UserVoted   int
		}

		err := rows.Scan(&vote.ID, &vote.Title, &vote.Description, &vote.Type, &vote.Status,
			&vote.StartsAt, &vote.EndsAt, &vote.CreatedBy, &vote.CreatedAt,
			&vote.FirstName, &vote.LastName, &vote.UserVoted)
		if err != nil {
			continue
		}

		createdByName := "Unknown"
		if vote.FirstName.Valid && vote.LastName.Valid {
			createdByName = vote.FirstName.String + " " + vote.LastName.String
		}

		voteIDs = append(voteIDs, vote.ID)
		voteMap = append(voteMap, struct {
			ID          string
			Title       string
			Description string
			Type        string
			Status      string
			StartsAt    string
			EndsAt      string
			CreatedBy   string
			CreatedAt   string
			FirstName   string
			LastName    string
			UserVoted   int
			CreatedByName string
		}{
			ID:          vote.ID,
			Title:       vote.Title,
			Description: vote.Description.String,
			Type:        vote.Type,
			Status:      vote.Status,
			StartsAt:    vote.StartsAt,
			EndsAt:      vote.EndsAt,
			CreatedBy:   vote.CreatedBy,
			CreatedAt:   vote.CreatedAt,
			FirstName:   vote.FirstName.String,
			LastName:    vote.LastName.String,
			UserVoted:   vote.UserVoted,
			CreatedByName: createdByName,
		})
	}

	// Preload all vote options in a single query to avoid N+1
	optionsByVoteID := map[string][]map[string]interface{}{}
	if len(voteIDs) > 0 {
		optionRows, err := db.(*sql.DB).Query(`
			SELECT vote_id, id, option_text, vote_count
			FROM vote_options
			WHERE vote_id = ANY($1)
			ORDER BY vote_id, id
		`, voteIDs)
		if err == nil {
			for optionRows.Next() {
				var voteID, optionID, optionText string
				var voteCount int
				if err := optionRows.Scan(&voteID, &optionID, &optionText, &voteCount); err == nil {
					if optionsByVoteID[voteID] == nil {
						optionsByVoteID[voteID] = []map[string]interface{}{}
					}
					optionsByVoteID[voteID] = append(optionsByVoteID[voteID], map[string]interface{}{
						"id":          optionID,
						"option_text": optionText,
						"vote_count":  voteCount,
					})
				}
			}
			optionRows.Close()
		}
	}

	votes := []map[string]interface{}{}
	for _, vote := range voteMap {
		options := optionsByVoteID[vote.ID]
		if options == nil {
			options = []map[string]interface{}{}
		}
		totalVotes := 0
		for _, opt := range options {
			if vc, ok := opt["vote_count"].(int); ok {
				totalVotes += vc
			}
		}

		votes = append(votes, map[string]interface{}{
			"id":           vote.ID,
			"title":        vote.Title,
			"description":  vote.Description,
			"type":         vote.Type,
			"status":       vote.Status,
			"starts_at":    vote.StartsAt,
			"ends_at":      vote.EndsAt,
			"created_by":   vote.CreatedByName,
			"created_at":   vote.CreatedAt,
			"options":      options,
			"total_votes":  totalVotes,
			"user_voted":   vote.UserVoted == 1,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    votes,
		"count":   len(votes),
	})
	c.Abort()
}

// GetActiveVotes retrieves active votes for a chama
func GetActiveVotes(c *gin.Context) {
	userID := c.GetString("userID")
	chamaID := c.Param("id")

	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	if chamaID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Chama ID is required",
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

	// Get active votes (status = 'active' and ends_at > now)
	rows, err := db.(*sql.DB).Query(`
		SELECT v.id, v.title, v.description, v.type, v.status, v.starts_at, v.ends_at, v.created_by, v.created_at,
		       u.first_name, u.last_name,
		       CASE WHEN uv.id IS NOT NULL THEN 1 ELSE 0 END as user_voted
		FROM votes v
		LEFT JOIN users u ON v.created_by = u.id
		LEFT JOIN user_votes uv ON v.id = uv.vote_id AND uv.user_id = $1
		WHERE v.chama_id = $2 AND v.status = 'active' AND v.ends_at > NOW()
		ORDER BY v.created_at DESC
	`, userID, chamaID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to retrieve active votes: " + err.Error(),
		})
		return
	}
	defer rows.Close()

	var voteIDs []string
	var voteMap []struct {
		ID          string
		Title       string
		Description string
		Type        string
		Status      string
		StartsAt    string
		EndsAt      string
		CreatedBy   string
		CreatedAt   string
		FirstName   string
		LastName    string
		UserVoted   int
		CreatedByName string
	}

	for rows.Next() {
		var vote struct {
			ID          string
			Title       string
			Description sql.NullString
			Type        string
			Status      string
			StartsAt    string
			EndsAt      string
			CreatedBy   string
			CreatedAt   string
			FirstName   sql.NullString
			LastName    sql.NullString
			UserVoted   int
		}

		err := rows.Scan(&vote.ID, &vote.Title, &vote.Description, &vote.Type, &vote.Status,
			&vote.StartsAt, &vote.EndsAt, &vote.CreatedBy, &vote.CreatedAt,
			&vote.FirstName, &vote.LastName, &vote.UserVoted)
		if err != nil {
			continue
		}

		createdByName := "Unknown"
		if vote.FirstName.Valid && vote.LastName.Valid {
			createdByName = vote.FirstName.String + " " + vote.LastName.String
		}

		voteIDs = append(voteIDs, vote.ID)
		voteMap = append(voteMap, struct {
			ID          string
			Title       string
			Description string
			Type        string
			Status      string
			StartsAt    string
			EndsAt      string
			CreatedBy   string
			CreatedAt   string
			FirstName   string
			LastName    string
			UserVoted   int
			CreatedByName string
		}{
			ID:          vote.ID,
			Title:       vote.Title,
			Description: vote.Description.String,
			Type:        vote.Type,
			Status:      vote.Status,
			StartsAt:    vote.StartsAt,
			EndsAt:      vote.EndsAt,
			CreatedBy:   vote.CreatedBy,
			CreatedAt:   vote.CreatedAt,
			FirstName:   vote.FirstName.String,
			LastName:    vote.LastName.String,
			UserVoted:   vote.UserVoted,
			CreatedByName: createdByName,
		})
	}

	// Preload all vote options in a single query to avoid N+1
	optionsByVoteID := map[string][]map[string]interface{}{}
	if len(voteIDs) > 0 {
		optionRows, err := db.(*sql.DB).Query(`
			SELECT vote_id, id, option_text, vote_count
			FROM vote_options
			WHERE vote_id = ANY($1)
			ORDER BY vote_id, id
		`, voteIDs)
		if err == nil {
			for optionRows.Next() {
				var voteID, optionID, optionText string
				var voteCount int
				if err := optionRows.Scan(&voteID, &optionID, &optionText, &voteCount); err == nil {
					if optionsByVoteID[voteID] == nil {
						optionsByVoteID[voteID] = []map[string]interface{}{}
					}
					optionsByVoteID[voteID] = append(optionsByVoteID[voteID], map[string]interface{}{
						"id":          optionID,
						"option_text": optionText,
						"vote_count":  voteCount,
					})
				}
			}
			optionRows.Close()
		}
	}

	votes := []map[string]interface{}{}
	for _, vote := range voteMap {
		options := optionsByVoteID[vote.ID]
		if options == nil {
			options = []map[string]interface{}{}
		}
		totalVotes := 0
		for _, opt := range options {
			if vc, ok := opt["vote_count"].(int); ok {
				totalVotes += vc
			}
		}

		votes = append(votes, map[string]interface{}{
			"id":           vote.ID,
			"title":        vote.Title,
			"description":  vote.Description,
			"type":         vote.Type,
			"status":       vote.Status,
			"starts_at":    vote.StartsAt,
			"ends_at":      vote.EndsAt,
			"created_by":   vote.CreatedByName,
			"created_at":   vote.CreatedAt,
			"options":      options,
			"total_votes":  totalVotes,
			"user_voted":   vote.UserVoted == 1,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    votes,
		"count":   len(votes),
	})
	c.Abort()
}

// GetVoteResults retrieves completed votes for a chama
func GetVoteResults(c *gin.Context) {
	userID := c.GetString("userID")
	chamaID := c.Param("id")

	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	if chamaID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Chama ID is required",
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

	// Get completed votes (status = 'completed' or ends_at < now)
	rows, err := db.(*sql.DB).Query(`
		SELECT v.id, v.title, v.description, v.type, v.status, v.starts_at, v.ends_at, v.created_by, v.created_at,
		       u.first_name, u.last_name,
		       CASE WHEN uv.id IS NOT NULL THEN 1 ELSE 0 END as user_voted
		FROM votes v
		LEFT JOIN users u ON v.created_by = u.id
		LEFT JOIN user_votes uv ON v.id = uv.vote_id AND uv.user_id = $1
		WHERE v.chama_id = $2 AND (v.status = 'completed' OR v.ends_at <= NOW())
		ORDER BY v.created_at DESC
	`, userID, chamaID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to retrieve vote results: " + err.Error(),
		})
		return
	}
	defer rows.Close()

	var voteIDs []string
	var voteMap []struct {
		ID          string
		Title       string
		Description string
		Type        string
		Status      string
		StartsAt    string
		EndsAt      string
		CreatedBy   string
		CreatedAt   string
		FirstName   string
		LastName    string
		UserVoted   int
		CreatedByName string
	}

	for rows.Next() {
		var vote struct {
			ID          string
			Title       string
			Description sql.NullString
			Type        string
			Status      string
			StartsAt    string
			EndsAt      string
			CreatedBy   string
			CreatedAt   string
			FirstName   sql.NullString
			LastName    sql.NullString
			UserVoted   int
		}

		err := rows.Scan(&vote.ID, &vote.Title, &vote.Description, &vote.Type, &vote.Status,
			&vote.StartsAt, &vote.EndsAt, &vote.CreatedBy, &vote.CreatedAt,
			&vote.FirstName, &vote.LastName, &vote.UserVoted)
		if err != nil {
			continue
		}

		createdByName := "Unknown"
		if vote.FirstName.Valid && vote.LastName.Valid {
			createdByName = vote.FirstName.String + " " + vote.LastName.String
		}

		voteIDs = append(voteIDs, vote.ID)
		voteMap = append(voteMap, struct {
			ID          string
			Title       string
			Description string
			Type        string
			Status      string
			StartsAt    string
			EndsAt      string
			CreatedBy   string
			CreatedAt   string
			FirstName   string
			LastName    string
			UserVoted   int
			CreatedByName string
		}{
			ID:          vote.ID,
			Title:       vote.Title,
			Description: vote.Description.String,
			Type:        vote.Type,
			Status:      vote.Status,
			StartsAt:    vote.StartsAt,
			EndsAt:      vote.EndsAt,
			CreatedBy:   vote.CreatedBy,
			CreatedAt:   vote.CreatedAt,
			FirstName:   vote.FirstName.String,
			LastName:    vote.LastName.String,
			UserVoted:   vote.UserVoted,
			CreatedByName: createdByName,
		})
	}

	// Preload all vote options in a single query to avoid N+1
	optionsByVoteID := map[string][]map[string]interface{}{}
	if len(voteIDs) > 0 {
		optionRows, err := db.(*sql.DB).Query(`
			SELECT vote_id, id, option_text, vote_count
			FROM vote_options
			WHERE vote_id = ANY($1)
			ORDER BY vote_id, vote_count DESC, id
		`, voteIDs)
		if err == nil {
			for optionRows.Next() {
				var voteID, optionID, optionText string
				var voteCount int
				if err := optionRows.Scan(&voteID, &optionID, &optionText, &voteCount); err == nil {
					if optionsByVoteID[voteID] == nil {
						optionsByVoteID[voteID] = []map[string]interface{}{}
					}
					optionsByVoteID[voteID] = append(optionsByVoteID[voteID], map[string]interface{}{
						"id":          optionID,
						"option_text": optionText,
						"vote_count":  voteCount,
					})
				}
			}
			optionRows.Close()
		}
	}

	votes := []map[string]interface{}{}
	for _, vote := range voteMap {
		options := optionsByVoteID[vote.ID]
		if options == nil {
			options = []map[string]interface{}{}
		}
		totalVotes := 0
		for _, opt := range options {
			if vc, ok := opt["vote_count"].(int); ok {
				totalVotes += vc
			}
		}

		// Determine result
		result := "pending"
		if len(options) > 0 && totalVotes > 0 {
			firstOption := options[0]
			if firstOptionVotes, ok := firstOption["vote_count"].(int); ok && firstOptionVotes > totalVotes/2 {
				result = "passed"
			} else {
				result = "failed"
			}
		}

		votes = append(votes, map[string]interface{}{
			"id":           vote.ID,
			"title":        vote.Title,
			"description":  vote.Description,
			"type":         vote.Type,
			"status":       vote.Status,
			"starts_at":    vote.StartsAt,
			"ends_at":      vote.EndsAt,
			"created_by":   vote.CreatedByName,
			"created_at":   vote.CreatedAt,
			"options":      options,
			"total_votes":  totalVotes,
			"user_voted":   vote.UserVoted == 1,
			"result":       result,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    votes,
		"count":   len(votes),
	})
	c.Abort()
}

// Helper function for min
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
