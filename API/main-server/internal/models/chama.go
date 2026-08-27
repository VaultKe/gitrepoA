package models

import (
	"encoding/json"
	"time"
)

// ChamaStatus represents chama status
type ChamaStatus string

const (
	ChamaStatusActive    ChamaStatus = "active"
	ChamaStatusSuspended ChamaStatus = "suspended"
	ChamaStatusPending   ChamaStatus = "pending"
	ChamaStatusDissolved ChamaStatus = "dissolved"
)

// ChamaCategory represents the fundamental category of the group
type ChamaCategory string

const (
	ChamaCategoryChama        ChamaCategory = "chama"
	ChamaCategoryContribution ChamaCategory = "contribution"
)

// ChamaType represents the type of chama
type ChamaType string

const (
	// Chama types
	ChamaTypeInvestment   ChamaType = "investment"
	ChamaTypeSavings      ChamaType = "savings"
	ChamaTypeBusiness     ChamaType = "business"
	ChamaTypeWelfare      ChamaType = "welfare"
	ChamaTypeMerryGoRound ChamaType = "merry-go-round"

	// Contribution group types
	ChamaTypeEmergency ChamaType = "emergency"
	ChamaTypeMedical   ChamaType = "medical"
	ChamaTypeEducation ChamaType = "education"
	ChamaTypeCommunity ChamaType = "community"
	ChamaTypePersonal  ChamaType = "personal"
)

// ContributionFrequency represents how often contributions are made
type ContributionFrequency string

const (
	ContributionFrequencyWeekly    ContributionFrequency = "weekly"
	ContributionFrequencyMonthly   ContributionFrequency = "monthly"
	ContributionFrequencyQuarterly ContributionFrequency = "quarterly"
	ContributionFrequencyCustom    ContributionFrequency = "custom"
)

// MeetingSchedule represents the meeting schedule for a chama
type MeetingSchedule struct {
	Frequency  string `json:"frequency"`  // weekly, monthly, quarterly
	DayOfWeek  *int   `json:"day_of_week"`  // 0 = Sunday, 1 = Monday, etc.
	DayOfMonth *int   `json:"day_of_month"` // 1-31
	Time       string `json:"time"`       // HH:MM format
}

// Chama represents a chama (investment group) in the system
type Chama struct {
	ID                    string                 `json:"id" db:"id"`
	Name                  string                 `json:"name" db:"name"`
	Description           *string                `json:"description,omitempty" db:"description"`
	Category              ChamaCategory          `json:"category" db:"category"`
	Type                  ChamaType              `json:"type" db:"type"`
	Status                ChamaStatus            `json:"status" db:"status"`
	Avatar                *string                `json:"avatar,omitempty" db:"avatar"`
	County                string                 `json:"county" db:"county"`
	Town                  string                 `json:"town" db:"town"`
	Latitude              *float64               `json:"latitude,omitempty" db:"latitude"`
	Longitude             *float64               `json:"longitude,omitempty" db:"longitude"`
	ContributionAmount    float64                `json:"contribution_amount" db:"contribution_amount"`
	ContributionFrequency ContributionFrequency  `json:"contribution_frequency" db:"contribution_frequency"`
	TargetAmount          *float64               `json:"target_amount,omitempty" db:"target_amount"`
	TargetDeadline        *time.Time             `json:"target_deadline,omitempty" db:"target_deadline"`
	MaxMembers            *int                  `json:"max_members,omitempty" db:"max_members"`
	CurrentMembers        int                    `json:"current_members" db:"current_members"`
	TotalFunds            float64                `json:"total_funds" db:"total_funds"`
	IsPublic              bool                   `json:"is_public" db:"is_public"`
	RequiresApproval      bool                   `json:"requires_approval,omitempty" db:"requires_approval"`
	Rules                 []string               `json:"rules" db:"rules"`
	MeetingSchedule       *MeetingSchedule       `json:"meeting_schedule,omitempty" db:"meeting_schedule"`
	Permissions           map[string]interface{} `json:"permissions,omitempty" db:"permissions"`
	RegistrationFeePaid   bool                   `json:"registration_fee_paid" db:"registration_fee_paid"`
	MonthlySubscriptionFee float64              `json:"monthly_subscription_fee" db:"monthly_subscription_fee"`
	SubscriptionFeePaid   bool                   `json:"subscription_fee_paid" db:"subscription_fee_paid"`
	SubscriptionFeeDueDate *time.Time            `json:"subscription_fee_due_date,omitempty" db:"subscription_fee_due_date"`
	CreatedBy             string                 `json:"created_by" db:"created_by"`
	CreatedAt             time.Time              `json:"created_at" db:"created_at"`
	UpdatedAt             time.Time              `json:"updated_at" db:"updated_at"`
	ChatRoomID            *string                `json:"chat_room_id,omitempty" db:"chat_room_id"`

	// Rules file (uploaded PDF document containing the chama/group rules)
	RulesFilePath *string `json:"rules_file_path,omitempty" db:"rules_file_path"`
	RulesFileName *string `json:"rules_file_name,omitempty" db:"rules_file_name"`

	// Member-specific fields (populated when querying user's chamas)
	MemberID              string                 `json:"member_id" db:"member_id"`
	MemberRole            ChamaRole              `json:"memberRole" db:"role"`
	ServiceFeePaid        bool                   `json:"service_fee_paid" db:"service_fee_paid"`
	ServiceFeeStatus      string                 `json:"service_fee_status" db:"service_fee_status"`
	MembershipIsActive    bool                   `json:"membership_is_active" db:"is_active"`
}

// ChamaMember represents a member of a chama
type ChamaMember struct {
	ID                 string     `json:"id" db:"id"`
	ChamaID            string     `json:"chama_id" db:"chama_id"`
	UserID             string     `json:"user_id" db:"user_id"`
	Role               ChamaRole  `json:"role" db:"role"`
	JoinedAt           time.Time  `json:"joined_at" db:"joined_at"`
	IsActive           bool       `json:"is_active" db:"is_active"`
	TotalContributions float64    `json:"total_contributions" db:"total_contributions"`
	LastContribution   *time.Time `json:"last_contribution,omitempty" db:"last_contribution"`
	Rating             float64    `json:"rating" db:"rating"`
	TotalRatings       int        `json:"total_ratings" db:"total_ratings"`

	// Joined user data (populated when needed)
	User *User `json:"user,omitempty"`

	// Service fee fields (one-time fee to join chama)
	ServiceFeePaid      bool       `json:"service_fee_paid" db:"service_fee_paid"`
	ServiceFeePaidAt    *time.Time `json:"service_fee_paid_at,omitempty" db:"service_fee_paid_at"`
	ServiceFeeStatus    string     `json:"service_fee_status" db:"service_fee_status"`
	ServiceFeeWarningSent bool     `json:"service_fee_warning_sent" db:"service_fee_warning_sent"`
}

// ChamaCreation represents data for creating a new chama
type ChamaCreation struct {
	Name                   string                `json:"name" validate:"required"`
	Description            *string               `json:"description,omitempty"`
	Category               ChamaCategory         `json:"category" validate:"required"`
	Type                   ChamaType             `json:"type" validate:"required"`
	County                 string                `json:"county" validate:"required"`
	Town                   string                `json:"town" validate:"required"`
	Latitude               *float64              `json:"latitude,omitempty"`
	Longitude              *float64              `json:"longitude,omitempty"`
	ContributionAmount     float64               `json:"contribution_amount"`
	ContributionFrequency  ContributionFrequency `json:"contribution_frequency"`
	TargetAmount           *float64              `json:"target_amount,omitempty"`
	TargetDeadline         *time.Time             `json:"target_deadline,omitempty"`
	MaxMembers             *int                  `json:"max_members,omitempty"`
	IsPublic               bool                  `json:"is_public"`
	RequiresApproval       bool                  `json:"requires_approval"`
	Rules                  []string              `json:"rules"`
	MeetingSchedule        *MeetingSchedule      `json:"meetingSchedule,omitempty"`
	RegistrationFeePaid    bool                  `json:"registrationFeePaid"`
	MonthlySubscriptionFee float64              `json:"monthlySubscriptionFee"`
	WalletTypes            []string              `json:"walletTypes,omitempty"`
}

// ChamaUpdate represents data for updating a chama
type ChamaUpdate struct {
	Name                  *string                `json:"name,omitempty"`
	Description           *string                `json:"description,omitempty"`
	Type                  *ChamaType             `json:"type,omitempty"`
	County                *string                `json:"county,omitempty"`
	Town                  *string                `json:"town,omitempty"`
	Latitude              *float64               `json:"latitude,omitempty"`
	Longitude             *float64               `json:"longitude,omitempty"`
	ContributionAmount    *float64               `json:"contribution_amount,omitempty"`
	ContributionFrequency *ContributionFrequency `json:"contribution_frequency,omitempty"`
	MaxMembers            *int                   `json:"max_members,omitempty"`
	IsPublic              *bool                  `json:"is_public,omitempty"`
	RequiresApproval      *bool                  `json:"requires_approval,omitempty"`
	Rules                 []string               `json:"rules,omitempty"`
	MeetingSchedule       *MeetingSchedule       `json:"meetingSchedule,omitempty"`
	MonthlySubscriptionFee *float64              `json:"monthlySubscriptionFee,omitempty"`
}

// GetLocation returns the chama's location as a formatted string
func (c *Chama) GetLocation() string {
	return c.Town + ", " + c.County
}

// HasCoordinates checks if the chama has location coordinates
func (c *Chama) HasCoordinates() bool {
	return c.Latitude != nil && c.Longitude != nil
}

// GetCoordinates returns the chama's coordinates
func (c *Chama) GetCoordinates() (float64, float64) {
	if c.HasCoordinates() {
		return *c.Latitude, *c.Longitude
	}
	return 0, 0
}

// IsActive checks if the chama is active
func (c *Chama) IsActive() bool {
	return c.Status == ChamaStatusActive
}

// IsFull checks if the chama has reached its maximum members
func (c *Chama) IsFull() bool {
	return c.MaxMembers != nil && c.CurrentMembers >= *c.MaxMembers
}

// CanJoin checks if a user can join the chama
func (c *Chama) CanJoin() bool {
	return c.IsActive() && !c.IsFull()
}

// GetRulesJSON returns rules as JSON string for database storage
func (c *Chama) GetRulesJSON() (string, error) {
	if len(c.Rules) == 0 {
		return "[]", nil
	}
	data, err := json.Marshal(c.Rules)
	return string(data), err
}

// SetRulesFromJSON sets rules from JSON string
func (c *Chama) SetRulesFromJSON(rulesJSON string) error {
	if rulesJSON == "" {
		c.Rules = []string{}
		return nil
	}
	return json.Unmarshal([]byte(rulesJSON), &c.Rules)
}

// GetMeetingScheduleJSON returns meeting schedule as JSON string for database storage
func (c *Chama) GetMeetingScheduleJSON() (string, error) {
	if c.MeetingSchedule == nil {
		return "", nil
	}
	data, err := json.Marshal(c.MeetingSchedule)
	return string(data), err
}

// SetMeetingScheduleFromJSON sets meeting schedule from JSON string
func (c *Chama) SetMeetingScheduleFromJSON(scheduleJSON string) error {
	if scheduleJSON == "" {
		c.MeetingSchedule = nil
		return nil
	}
	var schedule MeetingSchedule
	err := json.Unmarshal([]byte(scheduleJSON), &schedule)
	if err != nil {
		return err
	}
	c.MeetingSchedule = &schedule
	return nil
}

// IsLeader checks if a member role is a leadership role
func (cm *ChamaMember) IsLeader() bool {
	return cm.Role == ChamaRoleChairperson || cm.Role == ChamaRoleTreasurer || cm.Role == ChamaRoleSecretary
}

// CanManageMembers checks if a member can manage other members
func (cm *ChamaMember) CanManageMembers() bool {
	return cm.Role == ChamaRoleChairperson || cm.Role == ChamaRoleSecretary
}

// CanManageFinances checks if a member can manage finances
func (cm *ChamaMember) CanManageFinances() bool {
	return cm.Role == ChamaRoleChairperson || cm.Role == ChamaRoleTreasurer
}

// SubscriptionPayment represents a monthly subscription payment for a chama
type SubscriptionPayment struct {
	ID                 string     `json:"id" db:"id"`
	ChamaID            string     `json:"chamaId" db:"chama_id"`
	Amount              float64    `json:"amount" db:"amount"`
	Status              string     `json:"status" db:"status"`
	DueDate             time.Time  `json:"dueDate" db:"due_date"`
	PaidAt              *time.Time `json:"paidAt,omitempty" db:"paid_at"`
	PaymentMethod       *string    `json:"paymentMethod,omitempty" db:"payment_method"`
	TransactionID       *string    `json:"transactionId,omitempty" db:"transaction_id"`
	MonthYear           string     `json:"monthYear" db:"month_year"`
	CreatedAt           time.Time  `json:"createdAt" db:"created_at"`
	UpdatedAt           time.Time  `json:"updatedAt" db:"updated_at"`
}

// ServiceFeePayment represents a one-time service fee payment for a member joining a chama
type ServiceFeePayment struct {
	ID                 string     `json:"id" db:"id"`
	ChamaID            string     `json:"chamaId" db:"chama_id"`
	UserID             string     `json:"userId" db:"user_id"`
	Amount             float64    `json:"amount" db:"amount"`
	Status             string     `json:"status" db:"status"`
	DueDate            time.Time  `json:"dueDate" db:"due_date"`
	PaidAt             *time.Time `json:"paidAt,omitempty" db:"paid_at"`
	PaymentMethod      *string    `json:"paymentMethod,omitempty" db:"payment_method"`
	TransactionID      *string    `json:"transactionId,omitempty" db:"transaction_id"`
	WarningSent        bool       `json:"warningSent" db:"warning_sent"`
	CreatedAt          time.Time  `json:"createdAt" db:"created_at"`
	UpdatedAt          time.Time  `json:"updatedAt" db:"updated_at"`
}
