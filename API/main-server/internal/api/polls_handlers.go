package api

import (
	"database/sql"
	"log"
	"net/http"
	"strconv"
	"strings"

	"vaultke-backend/internal/models"
	"vaultke-backend/internal/services"

	"github.com/gin-gonic/gin"
)

// PollsHandlers handles poll-related HTTP requests
type PollsHandlers struct {
	pollsService *services.PollsService
}

// NewPollsHandlers creates a new polls handlers instance
func NewPollsHandlers(db *sql.DB) *PollsHandlers {
	return &PollsHandlers{
		pollsService: services.NewPollsService(db),
	}
}

// CreatePoll creates a new poll
func (h *PollsHandlers) CreatePoll(c *gin.Context) {
	userID := c.GetString("userID")
	chamaID := c.Param("id")

	if userID == "" {
		c.JSON(http.StatusUnauthorized, models.PollResponse{
			Success: false,
			Error:   "User not authenticated",
		})
		return
	}

	if chamaID == "" {
		c.JSON(http.StatusBadRequest, models.PollResponse{
			Success: false,
			Error:   "Chama ID is required",
		})
		return
	}

	var req models.CreatePollRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.PollResponse{
			Success: false,
			Error:   "Invalid request data: " + err.Error(),
		})
		return
	}

	poll, err := h.pollsService.CreatePoll(chamaID, userID, &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.PollResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, models.PollResponse{
		Success: true,
		Data:    poll,
		Message: "Poll created successfully",
	})
	c.Abort()
}

// GetChamaPolls retrieves polls for a chama
func (h *PollsHandlers) GetChamaPolls(c *gin.Context) {
	userID := c.GetString("userID")
	chamaID := c.Param("id")

	if userID == "" {
		c.JSON(http.StatusUnauthorized, models.PollsListResponse{
			Success: false,
			Error:   "User not authenticated",
		})
		return
	}

	if chamaID == "" {
		c.JSON(http.StatusBadRequest, models.PollsListResponse{
			Success: false,
			Error:   "Chama ID is required",
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

	polls, err := h.pollsService.GetChamaPollsForUser(chamaID, userID, limit, offset)
	if err != nil {
		// Log the error server-side for diagnosis
		log.Printf("[POLLS] Failed to get polls for chama %s: %v", chamaID, err)

		// Return more informative message in non-production may be configured
		c.JSON(http.StatusInternalServerError, models.PollsListResponse{
			Success: false,
			Error:   "Failed to retrieve polls: " + err.Error(),
		})
		return
	}

	// Convert to polls with details for list response
	c.JSON(http.StatusOK, models.PollsListResponse{
		Success: true,
		Data:    polls,
		Count:   len(polls),
	})
	c.Abort()
}

// GetPollDetails retrieves detailed information about a poll
func (h *PollsHandlers) GetPollDetails(c *gin.Context) {
	userID := c.GetString("userID")
	chamaID := c.Param("id")
	pollID := c.Param("pollId")

	if userID == "" {
		c.JSON(http.StatusUnauthorized, models.PollResponse{
			Success: false,
			Error:   "User not authenticated",
		})
		return
	}

	if chamaID == "" || pollID == "" {
		c.JSON(http.StatusBadRequest, models.PollResponse{
			Success: false,
			Error:   "Chama ID and Poll ID are required",
		})
		return
	}

	pollDetails, err := h.pollsService.GetPollDetails(pollID, userID)
	if err != nil {
		if err.Error() == "poll not found" {
			c.JSON(http.StatusNotFound, models.PollResponse{
				Success: false,
				Error:   "Poll not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, models.PollResponse{
			Success: false,
			Error:   "Failed to retrieve poll details",
		})
		return
	}

	c.JSON(http.StatusOK, models.PollResponse{
		Success: true,
		Data:    pollDetails,
	})
	c.Abort()
}

// CastVote casts a vote in a poll
func (h *PollsHandlers) CastVote(c *gin.Context) {
	userID := c.GetString("userID")
	chamaID := c.Param("id")
	pollID := c.Param("pollId")

	if userID == "" {
		c.JSON(http.StatusUnauthorized, models.VoteResponse{
			Success: false,
			Error:   "User not authenticated",
		})
		return
	}

	if chamaID == "" || pollID == "" {
		c.JSON(http.StatusBadRequest, models.VoteResponse{
			Success: false,
			Error:   "Chama ID and Poll ID are required",
		})
		return
	}

	var req models.CastVoteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.VoteResponse{
			Success: false,
			Error:   "Invalid request data: " + err.Error(),
		})
		return
	}

	err := h.pollsService.CastVote(pollID, userID, &req)
	if err != nil {
		// "already voted" is not a UI failure — the ballot just needs to catch
		// up. Return the current poll so the client can reconcile in place.
		if strings.Contains(strings.ToLower(err.Error()), "already voted") {
			if pd, gerr := h.pollsService.GetPollDetails(pollID, userID); gerr == nil {
				c.JSON(http.StatusOK, models.VoteResponse{
					Success: true,
					Message: "You have already voted on this poll",
					Data:    pd,
				})
				c.Abort()
				return
			}
		}
		c.JSON(http.StatusBadRequest, models.VoteResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	// Return the updated poll (with the caller's vote state) so the client can
	// update the tally and hide the ballot immediately — no reload needed.
	if pd, gerr := h.pollsService.GetPollDetails(pollID, userID); gerr == nil {
		c.JSON(http.StatusOK, models.VoteResponse{
			Success: true,
			Message: "Vote cast successfully",
			Data:    pd,
		})
		c.Abort()
		return
	}

	c.JSON(http.StatusOK, models.VoteResponse{
		Success: true,
		Message: "Vote cast successfully",
	})
	c.Abort()
}

// CreateRoleEscalationPoll creates a poll for role escalation
func (h *PollsHandlers) CreateRoleEscalationPoll(c *gin.Context) {
	userID := c.GetString("userID")
	chamaID := c.Param("id")

	if userID == "" {
		c.JSON(http.StatusUnauthorized, models.PollResponse{
			Success: false,
			Error:   "User not authenticated",
		})
		return
	}

	if chamaID == "" {
		c.JSON(http.StatusBadRequest, models.PollResponse{
			Success: false,
			Error:   "Chama ID is required",
		})
		return
	}

	var req models.CreateRoleEscalationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.PollResponse{
			Success: false,
			Error:   "Invalid request data: " + err.Error(),
		})
		return
	}

	escalationReq, err := h.pollsService.CreateRoleEscalationPoll(chamaID, userID, &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.PollResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, models.PollResponse{
		Success: true,
		Data:    escalationReq,
		Message: "Role escalation poll created successfully",
	})
	c.Abort()
}

// GetActivePolls retrieves active polls for a chama
func (h *PollsHandlers) GetActivePolls(c *gin.Context) {
	userID := c.GetString("userID")
	chamaID := c.Param("id")

	if userID == "" {
		c.JSON(http.StatusUnauthorized, models.PollsListResponse{
			Success: false,
			Error:   "User not authenticated",
		})
		return
	}

	if chamaID == "" {
		c.JSON(http.StatusBadRequest, models.PollsListResponse{
			Success: false,
			Error:   "Chama ID is required",
		})
		return
	}

	// Get all polls and filter active ones
	polls, err := h.pollsService.GetChamaPolls(chamaID, 100, 0)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.PollsListResponse{
			Success: false,
			Error:   "Failed to retrieve polls",
		})
		return
	}

	// Filter active polls
	var activePolls []models.PollWithDetails
	for _, poll := range polls {
		if poll.Poll.Status == models.PollStatusActive {
			activePolls = append(activePolls, poll)
		}
	}

	c.JSON(http.StatusOK, models.PollsListResponse{
		Success: true,
		Data:    activePolls,
		Count:   len(activePolls),
	})
	c.Abort()
}

// GetPollResults retrieves results for completed polls
func (h *PollsHandlers) GetPollResults(c *gin.Context) {
	userID := c.GetString("userID")
	chamaID := c.Param("id")

	if userID == "" {
		c.JSON(http.StatusUnauthorized, models.PollsListResponse{
			Success: false,
			Error:   "User not authenticated",
		})
		return
	}

	if chamaID == "" {
		c.JSON(http.StatusBadRequest, models.PollsListResponse{
			Success: false,
			Error:   "Chama ID is required",
		})
		return
	}

	// Get all polls and filter completed ones
	polls, err := h.pollsService.GetChamaPolls(chamaID, 100, 0)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.PollsListResponse{
			Success: false,
			Error:   "Failed to retrieve polls",
		})
		return
	}

	// Filter completed polls with results
	var completedPolls []models.PollWithDetails
	for _, poll := range polls {
		if poll.Status == models.PollStatusCompleted && poll.Result != nil {
			completedPolls = append(completedPolls, poll)
		}
	}

	c.JSON(http.StatusOK, models.PollsListResponse{
		Success: true,
		Data:    completedPolls,
		Count:   len(completedPolls),
	})
	c.Abort()
}

// GetChamaMembers retrieves chama members for role voting
func (h *PollsHandlers) GetChamaMembers(c *gin.Context) {
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

	members, err := h.pollsService.GetChamaMembers(chamaID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to retrieve chama members",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    members,
		"count":   len(members),
	})
	c.Abort()
}
