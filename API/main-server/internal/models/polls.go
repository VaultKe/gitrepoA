package models

import (
	"crypto/sha256"
	"encoding/hex"
	"time"
)

// PollType represents the type of poll
type PollType string

const (
	PollTypeGeneral           PollType = "general"
	PollTypeRoleEscalation    PollType = "Election / Voting"
	PollTypeFinancialDecision PollType = "financial_decision"
)

// PollStatus represents the status of a poll
type PollStatus string

const (
	PollStatusActive    PollStatus = "active"
	PollStatusCompleted PollStatus = "completed"
	PollStatusCancelled PollStatus = "cancelled"
)

// PollResult represents the result of a poll
type PollResult string

const (
	PollResultPassed  PollResult = "passed"
	PollResultFailed  PollResult = "failed"
	PollResultPending PollResult = "pending"
)

// Poll represents a poll in the system
type Poll struct {
	ID                  string      `json:"id" db:"id"`
	ChamaID             string      `json:"chama_id" db:"chama_id"`
	Title               string      `json:"title" db:"title"`
	Description         *string     `json:"description,omitempty" db:"description"`
	PollType            PollType    `json:"poll_type" db:"poll_type"`
	CreatedBy           string      `json:"created_by" db:"created_by"`
	StartDate           time.Time   `json:"start_date" db:"start_date"`
	EndDate             time.Time   `json:"end_date" db:"end_date"`
	Status              PollStatus  `json:"status" db:"status"`
	IsAnonymous         bool        `json:"is_anonymous" db:"is_anonymous"`
	RequiresMajority    bool        `json:"requires_majority" db:"requires_majority"`
	MajorityPercentage  float64     `json:"majority_percentage" db:"majority_percentage"`
	TotalEligibleVoters int         `json:"total_eligible_voters" db:"total_eligible_voters"`
	TotalVotesCast      int         `json:"total_votes_cast" db:"total_votes_cast"`
	Result              *PollResult `json:"result,omitempty" db:"result"`
	ResultDeclaredAt    *time.Time  `json:"result_declared_at,omitempty" db:"result_declared_at"`
	Metadata            *string     `json:"metadata,omitempty" db:"metadata"`
	CreatedAt           time.Time   `json:"created_at" db:"created_at"`
	UpdatedAt           time.Time   `json:"updated_at" db:"updated_at"`
}

// PollOption represents an option in a poll
type PollOption struct {
	ID          string    `json:"id" db:"id"`
	PollID      string    `json:"poll_id" db:"poll_id"`
	OptionText  string    `json:"option_text" db:"option_text"`
	OptionOrder int       `json:"option_order" db:"option_order"`
	VoteCount   int       `json:"vote_count" db:"vote_count"`
	Metadata    *string   `json:"metadata,omitempty" db:"metadata"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
}

// Vote represents a vote in the system
type Vote struct {
	ID            string    `json:"id" db:"id"`
	PollID        string    `json:"poll_id" db:"poll_id"`
	OptionID      string    `json:"option_id" db:"option_id"`
	VoterHash     string    `json:"voter_hash" db:"voter_hash"`
	VoteTimestamp time.Time `json:"vote_timestamp" db:"vote_timestamp"`
	IsValid       bool      `json:"is_valid" db:"is_valid"`
}

// RoleEscalationRequest represents a role escalation request
type RoleEscalationRequest struct {
	ID            string `json:"id" db:"id"`
	ChamaID       string `json:"chama_id" db:"chama_id"`
	CandidateID   string `json:"candidate_id" db:"candidate_id"`
	CurrentRole   string `json:"current_role" db:"current_role"`
	RequestedRole string `json:"requested_role" db:"requested_role"`
	RequestedBy   string `json:"requested_by" db:"requested_by"`
	PollID        *string `json:"poll_id,omitempty" db:"poll_id"`
	Status        string `json:"status" db:"status"`
	Justification *string `json:"justification,omitempty" db:"justification"`
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time `json:"updated_at" db:"updated_at"`
}

// CreatePollRequest represents the request to create a new poll
type CreatePollRequest struct {
	Title              string              `json:"title" binding:"required,min=1,max=200"`
	Description        *string             `json:"description,omitempty" binding:"omitempty,max=1000"`
	PollType           PollType            `json:"poll_type" binding:"required,oneof=general Election / Voting financial_decision"`
	EndDate            time.Time           `json:"end_date" binding:"required"`
	IsAnonymous        *bool               `json:"is_anonymous,omitempty"`
	RequiresMajority   *bool               `json:"requires_majority,omitempty"`
	MajorityPercentage *float64            `json:"majority_percentage,omitempty" binding:"omitempty,min=0,max=100"`
	Options            []PollOptionRequest `json:"options" binding:"required,min=2,max=10"`
	Metadata           *string             `json:"metadata,omitempty"`
}

// PollOptionRequest represents a poll option in the create request
type PollOptionRequest struct {
	OptionText string  `json:"option_text" binding:"required,min=1,max=200"`
	Metadata   *string `json:"metadata,omitempty"`
}

// UpdatePollRequest represents the request to update a poll
type UpdatePollRequest struct {
	Title       *string     `json:"title,omitempty" binding:"omitempty,min=1,max=200"`
	Description *string     `json:"description,omitempty" binding:"omitempty,max=1000"`
	EndDate     *time.Time  `json:"end_date,omitempty"`
	Status      *PollStatus `json:"status,omitempty" binding:"omitempty,oneof=active completed cancelled"`
}

// CastVoteRequest represents the request to cast a vote
type CastVoteRequest struct {
	OptionID string `json:"option_id" binding:"required"`
}

// CreateRoleEscalationRequest represents the request to create a role escalation
type CreateRoleEscalationRequest struct {
	CandidateID   string  `json:"candidate_id" binding:"required"`
	RequestedRole string  `json:"requested_role" binding:"required,oneof=chairperson secretary treasurer member"`
	Justification *string `json:"justification,omitempty" binding:"omitempty,max=500"`
}

// PollWithDetails represents a poll with additional details
type PollWithDetails struct {
	Poll
	CreatedByName string       `json:"created_by_name"`
	Options       []PollOption `json:"options"`
	UserVoted     bool         `json:"user_voted"`
	UserCanVote   bool         `json:"user_can_vote"`
	TimeRemaining *int64       `json:"time_remaining,omitempty"` // seconds
}

// PollResponse represents the response structure for poll operations
type PollResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
	Message string      `json:"message,omitempty"`
}

// PollsListResponse represents the response for listing polls
type PollsListResponse struct {
	Success bool   `json:"success"`
	Data    []Poll `json:"data"`
	Count   int    `json:"count"`
	Error   string `json:"error,omitempty"`
}

// VoteResponse represents the response for voting operations
type VoteResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
	Message string      `json:"message,omitempty"`
}

// IsValidPollType checks if the poll type is valid
func IsValidPollType(pollType string) bool {
	switch PollType(pollType) {
	case PollTypeGeneral, PollTypeRoleEscalation, PollTypeFinancialDecision:
		return true
	default:
		return false
	}
}

// IsValidPollStatus checks if the poll status is valid
func IsValidPollStatus(status string) bool {
	switch PollStatus(status) {
	case PollStatusActive, PollStatusCompleted, PollStatusCancelled:
		return true
	default:
		return false
	}
}

// GenerateVoterHash generates an anonymous hash for a voter
func GenerateVoterHash(voterID, pollID string) string {
	data := voterID + pollID + "salt_for_anonymity"
	hash := sha256.Sum256([]byte(data))
	return hex.EncodeToString(hash[:])
}

// IsActive checks if the poll is currently active
func (p *Poll) IsActive() bool {
	now := time.Now()
	return p.Status == PollStatusActive && now.After(p.StartDate) && now.Before(p.EndDate)
}

// HasEnded checks if the poll has ended
func (p *Poll) HasEnded() bool {
	return time.Now().After(p.EndDate)
}

// CanVote checks if voting is allowed on this poll
func (p *Poll) CanVote() bool {
	return p.IsActive() && !p.HasEnded()
}

// GetTimeRemaining returns the time remaining for the poll in seconds
func (p *Poll) GetTimeRemaining() *int64 {
	if p.HasEnded() {
		return nil
	}
	remaining := int64(p.EndDate.Sub(time.Now()).Seconds())
	if remaining < 0 {
		return nil
	}
	return &remaining
}

// CalculateResult calculates the poll result based on votes
func (p *Poll) CalculateResult(options []PollOption) PollResult {
	if p.TotalVotesCast == 0 {
		return PollResultFailed
	}

	if !p.RequiresMajority {
		// Simple plurality - option with most votes wins
		maxVotes := 0
		for _, option := range options {
			if option.VoteCount > maxVotes {
				maxVotes = option.VoteCount
			}
		}
		if maxVotes > 0 {
			return PollResultPassed
		}
		return PollResultFailed
	}

	// Majority required
	requiredVotes := int(float64(p.TotalEligibleVoters) * (p.MajorityPercentage / 100.0))
	for _, option := range options {
		if option.VoteCount >= requiredVotes {
			return PollResultPassed
		}
	}

	return PollResultFailed
}

// ShouldDeclareResult checks if the result should be declared immediately
func (p *Poll) ShouldDeclareResult(options []PollOption) bool {
	if !p.RequiresMajority {
		return p.HasEnded()
	}

	// For majority polls, declare immediately if majority is reached
	requiredVotes := int(float64(p.TotalEligibleVoters) * (p.MajorityPercentage / 100.0))
	for _, option := range options {
		if option.VoteCount >= requiredVotes {
			return true
		}
	}

	return p.HasEnded()
}

// ChamaMemberInfo represents member information for role voting
type ChamaMemberInfo struct {
	UserID    string `json:"userId" db:"user_id"`
	Role      string `json:"role" db:"role"`
	FirstName string `json:"firstName" db:"first_name"`
	LastName  string `json:"lastName" db:"last_name"`
	Email     string `json:"email" db:"email"`
	Phone     string `json:"phone" db:"phone"`
	FullName  string `json:"fullName"`
}
