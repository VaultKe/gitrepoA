package api

import (
	"database/sql"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// CastVoteOnItem allows a user to cast a vote on a specific vote item
func CastVoteOnItem(c *gin.Context) {
	userID := c.GetString("userID")
	chamaID := c.Param("id")
	voteID := c.Param("voteId")

	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	if chamaID == "" || voteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Chama ID and Vote ID are required",
		})
		return
	}

	var req struct {
		OptionID string `json:"optionId" binding:"required"`
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

	// Check if vote exists and is active
	var voteStatus string
	var voteEndsAt string
	err := db.(*sql.DB).QueryRow(`
		SELECT status, ends_at FROM votes
		WHERE id = $1 AND chama_id = $2
	`, voteID, chamaID).Scan(&voteStatus, &voteEndsAt)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Vote not found",
		})
		return
	}

	if voteStatus != "active" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Vote is not active",
		})
		return
	}

	// Check if vote has ended
	endsAt, err := time.Parse("2006-01-02 15:04:05", voteEndsAt)
	if err == nil && time.Now().After(endsAt) {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Vote has ended",
		})
		return
	}

	// Check if user has already voted
	var existingVote string
	err = db.(*sql.DB).QueryRow(`
		SELECT id FROM user_votes
		WHERE vote_id = $1 AND user_id = $2
	`, voteID, userID).Scan(&existingVote)
	if existingVote != "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "You have already voted on this item",
		})
		return
	}

	// Verify option exists for this vote
	var optionExists string
	err = db.(*sql.DB).QueryRow(`
		SELECT id FROM vote_options
		WHERE id = $1 AND vote_id = $2
	`, req.OptionID, voteID).Scan(&optionExists)
	if optionExists == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid vote option",
		})
		return
	}

	// Cast the vote
	userVoteID := fmt.Sprintf("uv-%d", time.Now().UnixNano())
	_, err = db.(*sql.DB).Exec(`
		INSERT INTO user_votes (id, vote_id, user_id, option_id, created_at)
		VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
	`, userVoteID, voteID, userID, req.OptionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to cast vote: " + err.Error(),
		})
		return
	}

	// Update vote count
	_, err = db.(*sql.DB).Exec(`
		UPDATE vote_options
		SET vote_count = vote_count + 1
		WHERE id = $1
	`, req.OptionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to update vote count: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Vote cast successfully",
		"data": map[string]interface{}{
			"vote_id":     voteID,
			"option_id":   req.OptionID,
			"user_vote_id": userVoteID,
		},
	})
	c.Abort()
}

// CreateRoleEscalationVote creates a role escalation vote
func CreateRoleEscalationVote(c *gin.Context) {
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
		CandidateID   string `json:"candidateId" binding:"required"`
		RequestedRole string `json:"requestedRole" binding:"required"`
		Justification string `json:"justification"`
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

	// Get candidate name
	var candidateName string
	err := db.(*sql.DB).QueryRow(`
		SELECT first_name || ' ' || last_name FROM users WHERE id = $1
	`, req.CandidateID).Scan(&candidateName)
	if err != nil {
		candidateName = "Unknown Candidate"
	}

	// Create role escalation vote
	voteID := fmt.Sprintf("vote-%d", time.Now().UnixNano())
	title := fmt.Sprintf("Role Escalation: %s for %s", candidateName, req.RequestedRole)
	description := fmt.Sprintf("Vote to change %s's role to %s. Justification: %s", candidateName, req.RequestedRole, req.Justification)
	endsAt := time.Now().Add(7 * 24 * time.Hour) // 7 days

	_, err = db.(*sql.DB).Exec(`
		INSERT INTO votes (id, chama_id, title, description, type, status, ends_at, created_by, created_at)
		VALUES ($1, $2, $3, $4, 'Election / Voting', 'active', $5, $6, CURRENT_TIMESTAMP)
	`, voteID, chamaID, title, description, endsAt, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create role escalation vote: " + err.Error(),
		})
		return
	}

	// Create vote options (Yes/No)
	yesOptionID := fmt.Sprintf("option-%d-yes", time.Now().UnixNano())
	noOptionID := fmt.Sprintf("option-%d-no", time.Now().UnixNano())

	_, err = db.(*sql.DB).Exec(`
		INSERT INTO vote_options (id, vote_id, option_text, vote_count) VALUES
		($1, $2, 'Yes - Approve role change', 0),
		($3, $4, 'No - Reject role change', 0)
	`, yesOptionID, voteID, noOptionID, voteID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create vote options: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"message": "Role escalation vote created successfully",
		"data": map[string]interface{}{
			"id":            voteID,
			"chama_id":      chamaID,
			"candidate_id":  req.CandidateID,
			"candidate_name": candidateName,
			"requested_role": req.RequestedRole,
			"title":         title,
			"description":   description,
			"ends_at":       endsAt.Format(time.RFC3339),
			"created_by":    userID,
		},
	})
	c.Abort()
}

// GetVoteDetails retrieves details for a specific vote
func GetVoteDetails(c *gin.Context) {
	userID := c.GetString("userID")
	chamaID := c.Param("id")
	voteID := c.Param("voteId")

	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	if chamaID == "" || voteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Chama ID and Vote ID are required",
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

	// Get vote details
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

	err := db.(*sql.DB).QueryRow(`
		SELECT v.id, v.title, v.description, v.type, v.status, v.starts_at, v.ends_at, v.created_by, v.created_at,
		       u.first_name, u.last_name,
		       CASE WHEN uv.id IS NOT NULL THEN 1 ELSE 0 END as user_voted
		FROM votes v
		LEFT JOIN users u ON v.created_by = u.id
		LEFT JOIN user_votes uv ON v.id = uv.vote_id AND uv.user_id = $1
		WHERE v.id = $2 AND v.chama_id = $3
	`, userID, voteID, chamaID).Scan(&vote.ID, &vote.Title, &vote.Description, &vote.Type, &vote.Status,
		&vote.StartsAt, &vote.EndsAt, &vote.CreatedBy, &vote.CreatedAt,
		&vote.FirstName, &vote.LastName, &vote.UserVoted)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Vote not found",
		})
		return
	}

	// Get vote options
	optionRows, err := db.(*sql.DB).Query(`
		SELECT id, option_text, vote_count
		FROM vote_options
		WHERE vote_id = $1
		ORDER BY id
	`, vote.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to retrieve vote options",
		})
		return
	}
	defer optionRows.Close()

	var options []map[string]interface{}
	totalVotes := 0
	for optionRows.Next() {
		var option struct {
			ID        string
			Text      string
			VoteCount int
		}
		if err := optionRows.Scan(&option.ID, &option.Text, &option.VoteCount); err == nil {
			options = append(options, map[string]interface{}{
				"id":        option.ID,
				"text":      option.Text,
				"voteCount": option.VoteCount,
			})
			totalVotes += option.VoteCount
		}
	}

	createdByName := "Unknown"
	if vote.FirstName.Valid && vote.LastName.Valid {
		createdByName = vote.FirstName.String + " " + vote.LastName.String
	}

	// Check if vote is still active
	endsAt, _ := time.Parse("2006-01-02 15:04:05", vote.EndsAt)
	isActive := vote.Status == "active" && time.Now().Before(endsAt)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": map[string]interface{}{
			"id":            vote.ID,
			"title":         vote.Title,
			"description":   vote.Description.String,
			"type":          vote.Type,
			"status":        vote.Status,
			"starts_at":     vote.StartsAt,
			"ends_at":       vote.EndsAt,
			"created_by":    createdByName,
			"created_at":    vote.CreatedAt,
			"options":       options,
			"total_votes":   totalVotes,
			"user_voted":    vote.UserVoted == 1,
			"is_active":     isActive,
		},
	})
	c.Abort()
}
