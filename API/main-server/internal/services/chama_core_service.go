package services

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/google/uuid"

	"vaultke-backend/internal/models"
	"vaultke-backend/internal/utils"
)

// Global email service instance to avoid recreating it
var globalEmailService *EmailService

// ChamaService handles chama-related business logic
type ChamaService struct {
	db           *sql.DB
	emailService *EmailService
}

func NewChamaService(db *sql.DB) *ChamaService {
	// Use singleton pattern for email service to avoid recreating it
	if globalEmailService == nil {
		globalEmailService = NewEmailService()
	}

	return &ChamaService{
		db:           db,
		emailService: globalEmailService,
	}
}

func (s *ChamaService) GetEmailService() *EmailService {
	return s.emailService
}

func (s *ChamaService) CreateChama(creation *models.ChamaCreation, createdBy string) (*models.Chama, error) {
	// Validate input
	if err := utils.ValidateStruct(creation); err != nil {
		return nil, fmt.Errorf("validation error: %w", err)
	}

	if creation.MonthlySubscriptionFee == 0 {
		creation.MonthlySubscriptionFee = 1000
	}

	// Create chama
	chama := &models.Chama{
		ID:                     uuid.New().String(),
		Name:                   creation.Name,
		Description:            creation.Description,
		Category:               creation.Category,
		Type:                   creation.Type,
		Status:                 models.ChamaStatusActive,
		County:                 creation.County,
		Town:                   creation.Town,
		Latitude:               creation.Latitude,
		Longitude:              creation.Longitude,
		ContributionAmount:     creation.ContributionAmount,
		ContributionFrequency:  creation.ContributionFrequency,
		TargetAmount:           creation.TargetAmount,
		TargetDeadline:         creation.TargetDeadline,
		MaxMembers:             creation.MaxMembers,
		CurrentMembers:         1,
		TotalFunds:             0,
		IsPublic:               creation.IsPublic,
		RequiresApproval:       creation.RequiresApproval,
		Rules:                  creation.Rules,
		MeetingSchedule:        creation.MeetingSchedule,
		RegistrationFeePaid:    creation.RegistrationFeePaid,
		MonthlySubscriptionFee: creation.MonthlySubscriptionFee,
		CreatedBy:              createdBy,
		CreatedAt:              time.Now(),
		UpdatedAt:              time.Now(),
	}

	// Build permissions with active wallet types
	permissions := map[string]interface{}{
		"allowMerryGoRound": true,
		"allowWelfare":      true,
		"activeWalletTypes": []string{},
	}
	if len(creation.WalletTypes) > 0 {
		permissions["activeWalletTypes"] = creation.WalletTypes
	} else {
		// Default wallet types based on chama type
		if creation.Type == models.ChamaTypeMerryGoRound {
			permissions["activeWalletTypes"] = []string{"merry-go-round"}
			permissions["allowMerryGoRound"] = true
		} else if creation.Type == models.ChamaTypeWelfare {
			permissions["activeWalletTypes"] = []string{"welfare"}
			permissions["allowWelfare"] = true
		} else if creation.Type == models.ChamaTypeSavings {
			permissions["activeWalletTypes"] = []string{"savings"}
		} else if creation.Type == models.ChamaTypeBusiness {
			permissions["activeWalletTypes"] = []string{"savings", "loans"}
		} else if creation.Type == models.ChamaTypeInvestment {
			permissions["activeWalletTypes"] = []string{"savings", "shares", "dividends"}
		}
	}
	permissionsJSON, _ := json.Marshal(permissions)

	// Serialize JSON fields
	rulesJSON, err := chama.GetRulesJSON()
	if err != nil {
		return nil, fmt.Errorf("failed to serialize rules: %w", err)
	}

	_, err = chama.GetMeetingScheduleJSON()
	if err != nil {
		return nil, fmt.Errorf("failed to serialize meeting schedule: %w", err)
	}

	// Start database transaction
	tx, err := s.db.Begin()
	if err != nil {
		return nil, fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback()

	// Insert chama
	query := `
		INSERT INTO chamas (
			id, name, description, category, type, status, county, town, latitude, longitude,
			contribution_amount, contribution_frequency, target_amount, target_deadline,
			max_members, current_members, total_funds, is_public, requires_approval, rules,
			meeting_frequency, meeting_day_of_week, meeting_day_of_month, meeting_time,
			registration_fee_paid, created_by, created_at, updated_at, permissions
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29)
	`

	var meetingFreq, meetingTime *string
	var meetingDayOfWeek, meetingDayOfMonth *int

	if chama.MeetingSchedule != nil {
		meetingFreq = &chama.MeetingSchedule.Frequency
		meetingTime = &chama.MeetingSchedule.Time
		meetingDayOfWeek = chama.MeetingSchedule.DayOfWeek
		meetingDayOfMonth = chama.MeetingSchedule.DayOfMonth
	}

	_, err = tx.Exec(query,
		chama.ID, chama.Name, chama.Description, chama.Category, chama.Type, chama.Status,
		chama.County, chama.Town, chama.Latitude, chama.Longitude,
		chama.ContributionAmount, chama.ContributionFrequency, chama.TargetAmount, chama.TargetDeadline,
		chama.MaxMembers, chama.CurrentMembers, chama.TotalFunds, chama.IsPublic, chama.RequiresApproval,
		rulesJSON, meetingFreq, meetingDayOfWeek, meetingDayOfMonth, meetingTime,
		chama.RegistrationFeePaid, chama.CreatedBy, chama.CreatedAt, chama.UpdatedAt,
		permissionsJSON,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create chama: %w", err)
	}

	// Add creator as chairperson
	member := &models.ChamaMember{
		ID:                 uuid.New().String(),
		ChamaID:            chama.ID,
		UserID:             createdBy,
		Role:               models.ChamaRoleChairperson,
		JoinedAt:           time.Now(),
		IsActive:           true,
		TotalContributions: 0,
		Rating:             0,
		TotalRatings:       0,
	}

	memberQuery := `
		INSERT INTO chama_members (
			id, chama_id, user_id, role, joined_at, is_active,
			total_contributions, rating, total_ratings
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`

	_, err = tx.Exec(memberQuery,
		member.ID, member.ChamaID, member.UserID, member.Role, member.JoinedAt,
		member.IsActive, member.TotalContributions, member.Rating, member.TotalRatings,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to add creator as member: %w", err)
	}

	// Create service fee payment record for the chama creator (KES 50 registration fee)
	serviceFeeQuery := `
		INSERT INTO service_fee_payments (id, chama_id, user_id, amount, status, due_date, created_at, updated_at)
		VALUES ($1, $2, $3, 50, 'pending', $4, $5, $6)
	`
	_, err = tx.Exec(serviceFeeQuery,
		uuid.New().String(), chama.ID, createdBy, time.Now(), time.Now(), time.Now(),
	)
	if err != nil {
		log.Printf("Warning: failed to create service fee payment for creator: %v", err)
	}

	// Create chama wallet within the same transaction
	walletService := NewWalletService(s.db)
	_, err = walletService.CreateWalletWithTx(tx, chama.ID, models.WalletTypeChama)
	if err != nil {
		return nil, fmt.Errorf("failed to create chama wallet: %w", err)
	}

	// For chamas, create initial subscription payment record
	if creation.Category == models.ChamaCategoryChama {
		now := time.Now()
		dueDate := time.Date(now.Year(), now.Month()+1, 2, 0, 0, 0, 0, now.Location())
		monthYear := dueDate.Format("2006-01")

		subscriptionAmount := creation.MonthlySubscriptionFee
		if subscriptionAmount <= 0 {
			subscriptionAmount = 1000
		}

		subscriptionQuery := `
			INSERT INTO subscription_payments (id, chama_id, amount, status, due_date, month_year, created_at, updated_at)
			VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7)
		`
		_, err = tx.Exec(subscriptionQuery,
			uuid.New().String(), chama.ID, subscriptionAmount,
			dueDate, monthYear, now, now,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to create subscription payment: %w", err)
		}
	}

	// Commit transaction
	if err = tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	// Provision all sub-wallets for the chama after successful creation
	paybillService := NewPaybillTrackingService(s.db)
	if err = paybillService.ProvisionChamaSubWallets(chama.ID); err != nil {
		log.Printf("Warning: failed to provision chama sub-wallets: %v", err)
	}

	return chama, nil
}

func (s *ChamaService) GetChamaByID(chamaID string) (*models.Chama, error) {
	query := `
		SELECT id, name, description, category, type, status, avatar, county, town,
			   latitude, longitude, contribution_amount, contribution_frequency,
			   max_members, current_members, total_funds, is_public, requires_approval,
			   rules, meeting_frequency, meeting_day_of_week, meeting_day_of_month,
			   meeting_time, permissions, created_by, created_at, updated_at, chat_room_id
		FROM chamas WHERE id = $1
	`

	chama := &models.Chama{}
	var rulesJSON, permissionsJSON string
	var meetingFreq, meetingTime *string
	var chatRoomID *string
	var meetingDayOfWeek, meetingDayOfMonth *int

	err := s.db.QueryRow(query, chamaID).Scan(
		&chama.ID, &chama.Name, &chama.Description, &chama.Category, &chama.Type, &chama.Status,
		&chama.Avatar, &chama.County, &chama.Town, &chama.Latitude, &chama.Longitude,
		&chama.ContributionAmount, &chama.ContributionFrequency, &chama.MaxMembers,
		&chama.CurrentMembers, &chama.TotalFunds, &chama.IsPublic, &chama.RequiresApproval,
		&rulesJSON, &meetingFreq, &meetingDayOfWeek, &meetingDayOfMonth, &meetingTime,
		&permissionsJSON, &chama.CreatedBy, &chama.CreatedAt, &chama.UpdatedAt, &chatRoomID,
	)
	chama.ChatRoomID = chatRoomID
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("chama not found")
		}
		return nil, fmt.Errorf("failed to get chama: %w", err)
	}

	// Parse JSON fields
	if err = chama.SetRulesFromJSON(rulesJSON); err != nil {
		return nil, fmt.Errorf("failed to parse rules: %w", err)
	}

	// Parse permissions JSON
	if permissionsJSON != "" {
		var permissions map[string]interface{}
		if err := json.Unmarshal([]byte(permissionsJSON), &permissions); err == nil {
			chama.Permissions = permissions
		}
	}
	// Set default permissions if none exist
	if chama.Permissions == nil {
		chama.Permissions = map[string]interface{}{
			"allowMerryGoRound": true,
			"allowWelfare":      true,
			"activeWalletTypes": []string{},
		}
	}
	// Ensure activeWalletTypes exists in permissions
	if _, ok := chama.Permissions["activeWalletTypes"]; !ok {
		chama.Permissions["activeWalletTypes"] = []string{}
	}

	// Reconstruct meeting schedule
	if meetingFreq != nil {
		chama.MeetingSchedule = &models.MeetingSchedule{
			Frequency:  *meetingFreq,
			DayOfWeek:  meetingDayOfWeek,
			DayOfMonth: meetingDayOfMonth,
			Time:       utils.DerefString(meetingTime),
		}
	}

	return chama, nil
}

func (s *ChamaService) GetChamas(limit, offset int) ([]*models.Chama, error) {
	query := `
		SELECT id, name, description, category, type, status, avatar, county, town,
			   latitude, longitude, contribution_amount, contribution_frequency,
			   max_members, current_members, total_funds, is_public, requires_approval,
			   rules, meeting_frequency, meeting_day_of_week, meeting_day_of_month,
			   meeting_time, permissions, created_by, created_at, updated_at
		FROM chamas
		WHERE is_public = $1 AND status = 'active'
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := s.db.Query(query, true, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to get chamas: %w", err)
	}
	defer rows.Close()

	var chamas []*models.Chama
	for rows.Next() {
		chama := &models.Chama{}
		var rulesJSON, permissionsJSON string
		var meetingFreq, meetingTime *string
		var meetingDayOfWeek, meetingDayOfMonth *int

		err := rows.Scan(
			&chama.ID, &chama.Name, &chama.Description, &chama.Category, &chama.Type, &chama.Status,
			&chama.Avatar, &chama.County, &chama.Town, &chama.Latitude, &chama.Longitude,
			&chama.ContributionAmount, &chama.ContributionFrequency, &chama.MaxMembers,
			&chama.CurrentMembers, &chama.TotalFunds, &chama.IsPublic, &chama.RequiresApproval,
			&rulesJSON, &meetingFreq, &meetingDayOfWeek, &meetingDayOfMonth, &meetingTime,
			&permissionsJSON, &chama.CreatedBy, &chama.CreatedAt, &chama.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan chama: %w", err)
		}

		// Parse JSON fields
		if err = chama.SetRulesFromJSON(rulesJSON); err != nil {
			return nil, fmt.Errorf("failed to parse rules: %w", err)
		}

		// Parse permissions JSON
		if permissionsJSON != "" {
			var permissions map[string]interface{}
			if err := json.Unmarshal([]byte(permissionsJSON), &permissions); err == nil {
				chama.Permissions = permissions
			}
		}
		if chama.Permissions == nil {
			chama.Permissions = map[string]interface{}{
				"allowMerryGoRound": true,
				"allowWelfare":      true,
				"activeWalletTypes": []string{},
			}
		}
		if _, ok := chama.Permissions["activeWalletTypes"]; !ok {
			chama.Permissions["activeWalletTypes"] = []string{}
		}

		// Reconstruct meeting schedule
		if meetingFreq != nil {
			chama.MeetingSchedule = &models.MeetingSchedule{
				Frequency:  *meetingFreq,
				DayOfWeek:  meetingDayOfWeek,
				DayOfMonth: meetingDayOfMonth,
				Time:       utils.DerefString(meetingTime),
			}
		}

		chamas = append(chamas, chama)
	}

	return chamas, nil
}

func (s *ChamaService) GetAllChamasForAdmin(limit, offset int) ([]*models.Chama, error) {
	query := `
		SELECT id, name, description, type, status, avatar, county, town,
			   latitude, longitude, contribution_amount, contribution_frequency,
			   max_members, current_members, total_funds, is_public, requires_approval,
			   rules, meeting_frequency, meeting_day_of_week, meeting_day_of_month,
			   meeting_time, permissions, created_by, created_at, updated_at
		FROM chamas
		ORDER BY created_at DESC
		LIMIT $1 OFFSET $2
	`

	rows, err := s.db.Query(query, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to get all chamas for admin: %w", err)
	}
	defer rows.Close()

	var chamas []*models.Chama
	for rows.Next() {
		chama := &models.Chama{}
		var rulesJSON, permissionsJSON string
		var meetingFreq, meetingTime *string
		var meetingDayOfWeek, meetingDayOfMonth *int

		err := rows.Scan(
			&chama.ID, &chama.Name, &chama.Description, &chama.Type, &chama.Status,
			&chama.Avatar, &chama.County, &chama.Town, &chama.Latitude, &chama.Longitude,
			&chama.ContributionAmount, &chama.ContributionFrequency, &chama.MaxMembers,
			&chama.CurrentMembers, &chama.TotalFunds, &chama.IsPublic, &chama.RequiresApproval,
			&rulesJSON, &meetingFreq, &meetingDayOfWeek, &meetingDayOfMonth, &meetingTime,
			&permissionsJSON, &chama.CreatedBy, &chama.CreatedAt, &chama.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan chama: %w", err)
		}

		// Parse JSON fields
		if err = chama.SetRulesFromJSON(rulesJSON); err != nil {
			return nil, fmt.Errorf("failed to parse rules: %w", err)
		}

		// Parse permissions JSON
		if permissionsJSON != "" {
			var permissions map[string]interface{}
			if err := json.Unmarshal([]byte(permissionsJSON), &permissions); err == nil {
				chama.Permissions = permissions
			}
		}
		if chama.Permissions == nil {
			chama.Permissions = map[string]interface{}{
				"allowMerryGoRound": true,
				"allowWelfare":      true,
				"activeWalletTypes": []string{},
			}
		}
		if _, ok := chama.Permissions["activeWalletTypes"]; !ok {
			chama.Permissions["activeWalletTypes"] = []string{}
		}

		// Reconstruct meeting schedule
		if meetingFreq != nil {
			chama.MeetingSchedule = &models.MeetingSchedule{
				Frequency:  *meetingFreq,
				DayOfWeek:  meetingDayOfWeek,
				DayOfMonth: meetingDayOfMonth,
				Time:       utils.DerefString(meetingTime),
			}
		}

		chamas = append(chamas, chama)
	}

	return chamas, nil
}

func (s *ChamaService) GetChamasByUser(userID string, limit, offset int) ([]*models.Chama, error) {
	query := `
		SELECT c.id, c.name, c.description, c.category, c.type, c.status, c.avatar, c.county, c.town,
			   c.latitude, c.longitude, c.contribution_amount, c.contribution_frequency,
			   c.max_members, c.current_members, c.total_funds, c.is_public, c.requires_approval,
			   c.rules, c.meeting_frequency, c.meeting_day_of_week, c.meeting_day_of_month,
			   c.meeting_time, c.permissions, c.created_by, c.created_at, c.updated_at,
			   cm.role, cm.service_fee_paid, cm.service_fee_status, cm.id as member_id
		FROM chamas c
		INNER JOIN chama_members cm ON c.id = cm.chama_id
		WHERE cm.user_id = $1 AND cm.is_active = $2
		ORDER BY c.created_at DESC
		LIMIT $3 OFFSET $4
	`

	rows, err := s.db.Query(query, userID, true, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to get user chamas: %w", err)
	}
	defer rows.Close()

	var chamas []*models.Chama
	for rows.Next() {
		chama := &models.Chama{}
		var rulesJSON, permissionsJSON string
		var meetingFreq, meetingTime *string
		var meetingDayOfWeek, meetingDayOfMonth *int
		var role string
		var serviceFeePaid bool
		var serviceFeeStatus string
		var memberID string

		err := rows.Scan(
			&chama.ID, &chama.Name, &chama.Description, &chama.Category, &chama.Type, &chama.Status,
			&chama.Avatar, &chama.County, &chama.Town, &chama.Latitude, &chama.Longitude,
			&chama.ContributionAmount, &chama.ContributionFrequency, &chama.MaxMembers,
			&chama.CurrentMembers, &chama.TotalFunds, &chama.IsPublic, &chama.RequiresApproval,
			&rulesJSON, &meetingFreq, &meetingDayOfWeek, &meetingDayOfMonth, &meetingTime,
			&permissionsJSON, &chama.CreatedBy, &chama.CreatedAt, &chama.UpdatedAt,
			&role, &serviceFeePaid, &serviceFeeStatus, &memberID,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan chama: %w", err)
		}

		// Parse JSON fields
		if err = chama.SetRulesFromJSON(rulesJSON); err != nil {
			return nil, fmt.Errorf("failed to parse rules: %w", err)
		}

		// Parse permissions JSON
		if permissionsJSON != "" {
			var permissions map[string]interface{}
			if err := json.Unmarshal([]byte(permissionsJSON), &permissions); err == nil {
				chama.Permissions = permissions
			}
		}
		if chama.Permissions == nil {
			chama.Permissions = map[string]interface{}{
				"allowMerryGoRound": true,
				"allowWelfare":      true,
				"activeWalletTypes": []string{},
			}
		}
		if _, ok := chama.Permissions["activeWalletTypes"]; !ok {
			chama.Permissions["activeWalletTypes"] = []string{}
		}

		// Reconstruct meeting schedule
		if meetingFreq != nil {
			chama.MeetingSchedule = &models.MeetingSchedule{
				Frequency:  *meetingFreq,
				DayOfWeek:  meetingDayOfWeek,
				DayOfMonth: meetingDayOfMonth,
				Time:       utils.DerefString(meetingTime),
			}
		}

		// Attach member-specific data
		chama.MemberRole = models.ChamaRole(role)
		chama.ServiceFeePaid = serviceFeePaid
		chama.ServiceFeeStatus = serviceFeeStatus
		chama.MemberID = memberID

		chamas = append(chamas, chama)
	}

	return chamas, nil
}

func (s *ChamaService) JoinChama(chamaID, userID string) error {
	// Get chama
	chama, err := s.GetChamaByID(chamaID)
	if err != nil {
		return err
	}

	// Check if user can join
	if !chama.CanJoin() {
		return fmt.Errorf("cannot join this chama")
	}

	// Check if user is already a member
	exists, err := s.IsUserMember(chamaID, userID)
	if err != nil {
		return err
	}
	if exists {
		return fmt.Errorf("user is already a member")
	}

	// Start transaction
	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback()

	// Add member
	member := &models.ChamaMember{
		ID:                 uuid.New().String(),
		ChamaID:            chamaID,
		UserID:             userID,
		Role:               models.ChamaRoleMember,
		JoinedAt:           time.Now(),
		IsActive:           true,
		TotalContributions: 0,
		Rating:             0,
		TotalRatings:       0,
	}

	memberQuery := `
		INSERT INTO chama_members (
			id, chama_id, user_id, role, joined_at, is_active,
			total_contributions, rating, total_ratings
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`

	_, err = tx.Exec(memberQuery,
		member.ID, member.ChamaID, member.UserID, member.Role, member.JoinedAt,
		member.IsActive, member.TotalContributions, member.Rating, member.TotalRatings,
	)
	if err != nil {
		return fmt.Errorf("failed to add member: %w", err)
	}

	// Update chama member count
	_, err = tx.Exec(
		"UPDATE chamas SET current_members = current_members + 1, updated_at = $1 WHERE id = $2",
		time.Now(), chamaID,
	)
	if err != nil {
		return fmt.Errorf("failed to update member count: %w", err)
	}

	// Commit transaction
	if err = tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

func (s *ChamaService) LeaveChama(chamaID, userID string) error {
	// Check if user is a member
	exists, err := s.IsUserMember(chamaID, userID)
	if err != nil {
		return err
	}
	if !exists {
		return fmt.Errorf("user is not a member")
	}

	// Get member details
	member, err := s.GetChamaMember(chamaID, userID)
	if err != nil {
		return err
	}

	// Check if user is chairperson (chairperson cannot leave unless transferring role)
	if member.Role == models.ChamaRoleChairperson {
		return fmt.Errorf("chairperson cannot leave without transferring role")
	}

	// Start transaction
	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback()

	// Deactivate member
	_, err = tx.Exec(
		"UPDATE chama_members SET is_active = $1 WHERE chama_id = $2 AND user_id = $3",
		false, chamaID, userID,
	)
	if err != nil {
		return fmt.Errorf("failed to deactivate member: %w", err)
	}

	// Update chama member count
	_, err = tx.Exec(
		"UPDATE chamas SET current_members = current_members - 1, updated_at = $1 WHERE id = $2",
		time.Now(), chamaID,
	)
	if err != nil {
		return fmt.Errorf("failed to update member count: %w", err)
	}

	// Commit transaction
	if err = tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

func (s *ChamaService) GetChamaStatistics(chamaID, userID string) (map[string]interface{}, error) {
	stats := make(map[string]interface{})

	// Get basic chama info
	chama, err := s.GetChamaByID(chamaID)
	if err != nil {
		return nil, fmt.Errorf("failed to get chama: %w", err)
	}

	// Get member statistics
	memberStats, err := s.getMemberStatistics(chamaID)
	if err != nil {
		return nil, fmt.Errorf("failed to get member statistics: %w", err)
	}

	// Get financial statistics
	financialStats, err := s.getFinancialStatistics(chamaID)
	if err != nil {
		return nil, fmt.Errorf("failed to get financial statistics: %w", err)
	}

	// Get activity statistics
	activityStats, err := s.getActivityStatistics(chamaID)
	if err != nil {
		return nil, fmt.Errorf("failed to get activity statistics: %w", err)
	}

	// Get chama wallet balance
	walletBalance, err := s.getChamaWalletBalance(chamaID)
	if err != nil {
		walletBalance = 0
	}

	// Get user-specific statistics
	userStats, err := s.getUserChamaStatistics(chamaID, userID)
	if err != nil {
		userStats = make(map[string]interface{})
	}

	stats["chama_info"] = map[string]interface{}{
		"id":                     chama.ID,
		"name":                   chama.Name,
		"type":                   chama.Type,
		"status":                 chama.Status,
		"created_at":             chama.CreatedAt,
		"contribution_amount":    chama.ContributionAmount,
		"contribution_frequency": chama.ContributionFrequency,
		"max_members":            chama.MaxMembers,
		"current_members":        chama.CurrentMembers,
		"total_funds":            walletBalance, // Use actual wallet balance
		"wallet_balance":         walletBalance,
	}
	stats["user_stats"] = userStats

	stats["member_stats"] = memberStats
	stats["financial_stats"] = financialStats
	stats["activity_stats"] = activityStats

	return stats, nil
}

func (s *ChamaService) getMemberStatistics(chamaID string) (map[string]interface{}, error) {
	stats := make(map[string]interface{})

	// Count members by role (include all members, not just active ones)
	roleQuery := `
		SELECT role, COUNT(*) as count
		FROM chama_members
		WHERE chama_id = $1
		GROUP BY role
	`
	rows, err := s.db.Query(roleQuery, chamaID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	roleStats := make(map[string]int)
	totalMembers := 0
	for rows.Next() {
		var role string
		var count int
		if err := rows.Scan(&role, &count); err != nil {
			continue
		}
		roleStats[role] = count
		totalMembers += count
	}

	// Get active members count separately
	activeMembersQuery := `
		SELECT COUNT(*) as active_count
		FROM chama_members
		WHERE chama_id = $1 AND (is_active = true OR is_active IS NULL)
	`
	var activeMembers int
	err = s.db.QueryRow(activeMembersQuery, chamaID).Scan(&activeMembers)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}

	stats["total_members"] = totalMembers
	stats["active_members"] = activeMembers
	stats["members_by_role"] = roleStats

	// Get member join trend (last 6 months)
	joinTrendQuery := `
		SELECT DATE(joined_at) as join_date, COUNT(*) as count
		FROM chama_members
		WHERE chama_id = $1 AND joined_at >= NOW() - INTERVAL '6 months'
		GROUP BY DATE(joined_at)
		ORDER BY join_date
	`
	rows, err = s.db.Query(joinTrendQuery, chamaID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	joinTrend := make([]map[string]interface{}, 0)
	for rows.Next() {
		var joinDate string
		var count int
		if err := rows.Scan(&joinDate, &count); err != nil {
			continue
		}
		joinTrend = append(joinTrend, map[string]interface{}{
			"date":  joinDate,
			"count": count,
		})
	}

	stats["join_trend"] = joinTrend

	return stats, nil
}

func (s *ChamaService) getFinancialStatistics(chamaID string) (map[string]interface{}, error) {
	stats := make(map[string]interface{})

	// Get total contributions (chama transactions use chama_id)
	contributionQuery := `
		SELECT
			COALESCE(SUM(amount), 0) as total_contributions,
			COUNT(*) as total_transactions,
			COALESCE(AVG(amount), 0) as average_contribution
		FROM transactions
		WHERE chama_id = $1 AND type = 'contribution' AND status = 'completed'
	`
	var totalContributions, averageContribution float64
	var totalTransactions int
	err := s.db.QueryRow(contributionQuery, chamaID).Scan(&totalContributions, &totalTransactions, &averageContribution)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}

	stats["total_contributions"] = totalContributions
	stats["total_transactions"] = totalTransactions
	stats["average_contribution"] = averageContribution

	// Get monthly contribution trend
	monthlyQuery := `
		SELECT
			TO_CHAR(created_at, 'YYYY-MM') as month,
			COALESCE(SUM(amount), 0) as total,
			COUNT(*) as count
		FROM transactions
		WHERE chama_id = $1 AND type = 'contribution' AND status = 'completed'
		AND created_at >= NOW() - INTERVAL '12 months'
		GROUP BY TO_CHAR(created_at, 'YYYY-MM')
		ORDER BY month
	`
	rows, err := s.db.Query(monthlyQuery, chamaID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	monthlyTrend := make([]map[string]interface{}, 0)
	for rows.Next() {
		var month string
		var total float64
		var count int
		if err := rows.Scan(&month, &total, &count); err != nil {
			continue
		}
		monthlyTrend = append(monthlyTrend, map[string]interface{}{
			"month": month,
			"total": total,
			"count": count,
		})
	}

	stats["monthly_trend"] = monthlyTrend

	return stats, nil
}

func (s *ChamaService) getActivityStatistics(chamaID string) (map[string]interface{}, error) {
	stats := make(map[string]interface{})

	// Get meeting statistics (only upcoming and ongoing meetings)

	// First, let's check if there are any meetings at all for this chama
	var debugCount int
	debugQuery := "SELECT COUNT(*) FROM meetings WHERE chama_id = $1"
	debugErr := s.db.QueryRow(debugQuery, chamaID).Scan(&debugCount)
	if debugErr != nil {
		// ignore debug errors
	}

	// Let's see what the actual meeting data looks like
	if debugCount > 0 {
		detailQuery := `SELECT id, title, status, scheduled_at,
			NOW() as current_utc,
			NOW() + INTERVAL '3 hours' as current_eat,
			CASE WHEN scheduled_at > NOW() + INTERVAL '3 hours' THEN 'UPCOMING' ELSE 'PAST' END as time_status
			FROM meetings WHERE chama_id = $1 LIMIT 3`
		rows, detailErr := s.db.Query(detailQuery, chamaID)
		if detailErr == nil {
			defer rows.Close()
			for rows.Next() {
				var id, title, status, scheduledAt, currentUTC, currentEAT, timeStatus string
				if scanErr := rows.Scan(&id, &title, &status, &scheduledAt, &currentUTC, &currentEAT, &timeStatus); scanErr == nil {
					// ignore debug rows
				}
			}
		}
	}

	// Fixed query - use EAT timezone and correct status values
	meetingQuery := `
		SELECT
			COUNT(*) as total_meetings,
			COUNT(CASE WHEN status IN ('completed', 'ended') THEN 1 END) as completed_meetings,
			COUNT(CASE WHEN status IN ('scheduled', 'pending', 'ready') AND scheduled_at > NOW() + INTERVAL '3 hours' THEN 1 END) as upcoming_meetings,
			COUNT(CASE WHEN status IN ('ongoing', 'active', 'started', 'live') THEN 1 END) as ongoing_meetings,
			COUNT(CASE WHEN status NOT IN ('completed', 'cancelled', 'ended') THEN 1 END) as active_meetings_alt
		FROM meetings
		WHERE chama_id = $1
	`
	var totalMeetings, completedMeetings, upcomingMeetings, ongoingMeetings, activeMeetingsAlt int
	err := s.db.QueryRow(meetingQuery, chamaID).Scan(&totalMeetings, &completedMeetings, &upcomingMeetings, &ongoingMeetings, &activeMeetingsAlt)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}

	// Use total meetings for dashboard (as requested)
	activeMeetings := upcomingMeetings + ongoingMeetings

	stats["total_meetings"] = totalMeetings
	stats["completed_meetings"] = completedMeetings
	stats["upcoming_meetings"] = upcomingMeetings
	stats["ongoing_meetings"] = ongoingMeetings
	stats["active_meetings"] = activeMeetings

	// Get loan statistics
	loanQuery := `
		SELECT
			COUNT(*) as total_loans,
			COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_loans,
			COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_loans,
			COALESCE(SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END), 0) as total_loan_amount
		FROM loans
		WHERE chama_id = $1
	`
	var totalLoans, approvedLoans, pendingLoans int
	var totalLoanAmount float64
	err = s.db.QueryRow(loanQuery, chamaID).Scan(&totalLoans, &approvedLoans, &pendingLoans, &totalLoanAmount)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}

	stats["total_loans"] = totalLoans
	stats["approved_loans"] = approvedLoans
	stats["pending_loans"] = pendingLoans
	stats["total_loan_amount"] = totalLoanAmount

	return stats, nil
}

func (s *ChamaService) getChamaWalletBalance(chamaID string) (float64, error) {
	// First, ensure chama wallet exists
	err := s.ensureChamaWallet(chamaID)
	if err != nil {
		return 0, fmt.Errorf("failed to ensure chama wallet: %w", err)
	}

	query := `
		SELECT COALESCE(balance, 0) as balance
		FROM wallets
		WHERE owner_id = $1 AND type = 'chama'
	`
	var balance float64
	err = s.db.QueryRow(query, chamaID).Scan(&balance)
	if err != nil {
		return 0, fmt.Errorf("failed to get chama wallet balance: %w", err)
	}
	return balance, nil
}

func (s *ChamaService) ensureChamaWallet(chamaID string) error {
	// Check if wallet exists
	var exists bool
	checkQuery := `
		SELECT EXISTS(SELECT 1 FROM wallets WHERE owner_id = $1 AND type = 'chama')
	`
	err := s.db.QueryRow(checkQuery, chamaID).Scan(&exists)
	if err != nil {
		return fmt.Errorf("failed to check wallet existence: %w", err)
	}

	if !exists {
		// Create chama wallet
		walletID := fmt.Sprintf("wallet-%s", chamaID)
		_, err = s.db.Exec(`
			INSERT INTO wallets (id, owner_id, type, balance, created_at, updated_at)
			VALUES ($1, $2, 'chama', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		`, walletID, chamaID)
		if err != nil {
			return fmt.Errorf("failed to create chama wallet: %w", err)
		}
	}

	return nil
}

func (s *ChamaService) getUserChamaStatistics(chamaID, userID string) (map[string]interface{}, error) {
	userStats := make(map[string]interface{})

	// Get user's role in the chama
	var role string
	roleQuery := `
		SELECT role
		FROM chama_members
		WHERE chama_id = $1 AND user_id = $2
	`
	err := s.db.QueryRow(roleQuery, chamaID, userID).Scan(&role)
	if err != nil {
		if err == sql.ErrNoRows {
			role = "not_member"
		} else {
			return nil, fmt.Errorf("failed to get user role: %w", err)
		}
	}

	// Get user's transaction summary in this chama
	transactionQuery := `
		SELECT
			COUNT(*) as total_transactions,
			COALESCE(SUM(CASE WHEN type = 'contribution' THEN amount ELSE 0 END), 0) as total_contributions,
			COALESCE(SUM(CASE WHEN type = 'loan' THEN amount ELSE 0 END), 0) as total_loans,
			COALESCE(SUM(CASE WHEN type = 'withdrawal' THEN amount ELSE 0 END), 0) as total_withdrawals
		FROM transactions
		WHERE initiated_by = $1 AND chama_id = $2
	`
	var totalTransactions int
	var totalContributions, totalLoans, totalWithdrawals float64
	err = s.db.QueryRow(transactionQuery, userID, chamaID).Scan(
		&totalTransactions, &totalContributions, &totalLoans, &totalWithdrawals)
	if err != nil && err != sql.ErrNoRows {
		return nil, fmt.Errorf("failed to get user transaction summary: %w", err)
	}

	// Get user's contribution count (number of contribution records)
	contributionCountQuery := `
		SELECT COUNT(*)
		FROM transactions
		WHERE initiated_by = $1 AND chama_id = $2 AND type = 'contribution' AND status = 'completed'
	`
	var contributionCount int
	err = s.db.QueryRow(contributionCountQuery, userID, chamaID).Scan(&contributionCount)
	if err != nil && err != sql.ErrNoRows {
		return nil, fmt.Errorf("failed to get user contribution count: %w", err)
	}

	userStats["role"] = role
	userStats["total_transactions"] = totalTransactions
	userStats["total_contributions_amount"] = totalContributions
	userStats["total_loans_amount"] = totalLoans
	userStats["total_withdrawals_amount"] = totalWithdrawals
	userStats["contribution_count"] = contributionCount

	return userStats, nil
}

func (s *ChamaService) GetMemberStatistics(chamaID, memberID string) (map[string]interface{}, error) {
	return s.getUserChamaStatistics(chamaID, memberID)
}

func (s *ChamaService) GetChamaTransactions(chamaID string, limit, offset int) ([]*models.Transaction, error) {
	query := `
		SELECT
			t.id, t.from_wallet_id, t.to_wallet_id, t.type, t.status, t.amount, t.currency,
			t.description, t.reference, t.payment_method, t.metadata, t.fees,
			t.initiated_by, t.recipient_id, t.approved_by, t.requires_approval, t.approval_deadline,
			t.created_at, t.updated_at,
			u.first_name, u.last_name, u.email, u.phone
		FROM transactions t
		LEFT JOIN users u ON t.initiated_by = u.id
		WHERE t.chama_id = $1
		ORDER BY t.created_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := s.db.Query(query, chamaID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to get chama transactions: %w", err)
	}
	defer rows.Close()

	var transactions []*models.Transaction
	for rows.Next() {
		transaction := &models.Transaction{}
		var userFirstName, userLastName, userEmail, userPhone sql.NullString
		var metadataJSON sql.NullString
		var recipientID sql.NullString

		err := rows.Scan(
			&transaction.ID,
			&transaction.FromWalletID,
			&transaction.ToWalletID,
			&transaction.Type,
			&transaction.Status,
			&transaction.Amount,
			&transaction.Currency,
			&transaction.Description,
			&transaction.Reference,
			&transaction.PaymentMethod,
			&metadataJSON,
			&transaction.Fees,
			&transaction.InitiatedBy,
			&recipientID,
			&transaction.ApprovedBy,
			&transaction.RequiresApproval,
			&transaction.ApprovalDeadline,
			&transaction.CreatedAt,
			&transaction.UpdatedAt,
			&userFirstName,
			&userLastName,
			&userEmail,
			&userPhone,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan transaction: %w", err)
		}

		// Set recipient ID
		if recipientID.Valid {
			transaction.RecipientID = &recipientID.String
		}

		// Set metadata from JSON
		if metadataJSON.Valid && metadataJSON.String != "" {
			_ = transaction.SetMetadataFromJSON(metadataJSON.String)
		}

		// Add user information if available
		if userFirstName.Valid || userLastName.Valid {
			transaction.User = &models.User{
				ID:        transaction.InitiatedBy,
				FirstName: userFirstName.String,
				LastName:  userLastName.String,
				Email:     userEmail.String,
				Phone:     userPhone.String,
			}
		}

		transactions = append(transactions, transaction)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating transactions: %w", err)
	}

	return transactions, nil
}

func (s *ChamaService) UpdateChamaMemberCount(chamaID string, memberCount int) error {
	query := `UPDATE chamas SET current_members = $1, updated_at = $1$2 WHERE id = $1$3`

	_, err := s.db.Exec(query, memberCount, time.Now(), chamaID)
	if err != nil {
		return fmt.Errorf("failed to update chama member count: %w", err)
	}

	return nil
}

func (s *ChamaService) GetUserRoleInChama(chamaID, userID string) (string, error) {
	query := `
		SELECT role
		FROM chama_members
		WHERE chama_id = $1 AND user_id = $2 AND is_active = true
	`

	var role string
	err := s.db.QueryRow(query, chamaID, userID).Scan(&role)
	if err != nil {
		if err == sql.ErrNoRows {
			return "", fmt.Errorf("user is not a member of this chama")
		}
		return "", fmt.Errorf("failed to get user role: %w", err)
	}

	return role, nil
}

func (s *ChamaService) UpdateChamaSettings(chamaID string, updates interface{}) error {
	// Start transaction
	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback()

	// Build dynamic update query based on provided fields
	setParts := []string{}
	args := []interface{}{}

	// Use type assertion to handle the updates struct
	if updateMap, ok := updates.(*struct {
		Name                  *string                 `json:"name,omitempty"`
		Description           *string                 `json:"description,omitempty"`
		IsPublic              *bool                   `json:"is_public,omitempty"`
		RequiresApproval      *bool                   `json:"requires_approval,omitempty"`
		MaxMembers            *int                    `json:"max_members,omitempty"`
		ContributionAmount    *float64                `json:"contribution_amount,omitempty"`
		ContributionFrequency *string                 `json:"contribution_frequency,omitempty"`
		Rules                 *[]string               `json:"rules,omitempty"`
		MeetingSchedule       *map[string]interface{} `json:"meeting_schedule,omitempty"`
		Permissions           *map[string]bool        `json:"permissions,omitempty"`
		Notifications         *map[string]bool        `json:"notifications,omitempty"`
	}); ok {

		if updateMap.Name != nil {
			setParts = append(setParts, "name = $1")
			args = append(args, *updateMap.Name)
		}

		if updateMap.Description != nil {
			setParts = append(setParts, "description = $1")
			args = append(args, *updateMap.Description)
		}

		if updateMap.IsPublic != nil {
			setParts = append(setParts, "is_public = $1")
			args = append(args, *updateMap.IsPublic)
		}

		if updateMap.RequiresApproval != nil {
			setParts = append(setParts, "requires_approval = $1")
			args = append(args, *updateMap.RequiresApproval)
		}

		if updateMap.MaxMembers != nil {
			setParts = append(setParts, "max_members = $1")
			args = append(args, *updateMap.MaxMembers)
		}

		if updateMap.ContributionAmount != nil {
			setParts = append(setParts, "contribution_amount = $1")
			args = append(args, *updateMap.ContributionAmount)
		}

		if updateMap.ContributionFrequency != nil {
			setParts = append(setParts, "contribution_frequency = $1")
			args = append(args, *updateMap.ContributionFrequency)
		}

		if updateMap.Rules != nil {
			rulesJSON, err := json.Marshal(*updateMap.Rules)
			if err != nil {
				return fmt.Errorf("failed to marshal rules: %w", err)
			}
			setParts = append(setParts, "rules = $1")
			args = append(args, string(rulesJSON))
		}

		if updateMap.Permissions != nil {
			permissionsJSON, err := json.Marshal(*updateMap.Permissions)
			if err != nil {
				return fmt.Errorf("failed to marshal permissions: %w", err)
			}
			setParts = append(setParts, "permissions = $1")
			args = append(args, string(permissionsJSON))
		}
	}

	if len(setParts) == 0 {
		return fmt.Errorf("no fields to update")
	}

	// Add updated_at timestamp
	setParts = append(setParts, "updated_at = $1")
	args = append(args, time.Now())

	// Add chama ID for WHERE clause
	args = append(args, chamaID)

	// Build and execute update query
	query := fmt.Sprintf("UPDATE chamas SET %s WHERE id = $1", strings.Join(setParts, ", "))

	_, err = tx.Exec(query, args...)
	if err != nil {
		return fmt.Errorf("failed to update chama: %w", err)
	}

	// Commit transaction
	if err = tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

func (s *ChamaService) DeleteChama(chamaID string) error {
	// Start transaction
	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback()

	// Check if chama exists
	var chamaExists bool
	err = tx.QueryRow("SELECT EXISTS(SELECT 1 FROM chamas WHERE id = $1)", chamaID).Scan(&chamaExists)
	if err != nil {
		return fmt.Errorf("failed to check chama existence: %w", err)
	}

	if !chamaExists {
		return fmt.Errorf("chama not found")
	}

	// Delete related data in correct order (respecting foreign key constraints)

	// Delete meeting attendance
	_, err = tx.Exec("DELETE FROM meeting_attendance WHERE meeting_id IN (SELECT id FROM meetings WHERE chama_id = $1)", chamaID)
	if err != nil {
		return fmt.Errorf("failed to delete meeting attendance: %w", err)
	}

	// Delete meeting documents
	_, err = tx.Exec("DELETE FROM meeting_documents WHERE meeting_id IN (SELECT id FROM meetings WHERE chama_id = $1)", chamaID)
	if err != nil {
		return fmt.Errorf("failed to delete meeting documents: %w", err)
	}

	// Delete meetings
	_, err = tx.Exec("DELETE FROM meetings WHERE chama_id = $1", chamaID)
	if err != nil {
		return fmt.Errorf("failed to delete meetings: %w", err)
	}

	// Delete welfare contributions
	_, err = tx.Exec("DELETE FROM welfare_contributions WHERE chama_id = $1", chamaID)
	if err != nil {
		return fmt.Errorf("failed to delete welfare contributions: %w", err)
	}

	// Delete welfare requests
	_, err = tx.Exec("DELETE FROM welfare_requests WHERE chama_id = $1", chamaID)
	if err != nil {
		return fmt.Errorf("failed to delete welfare requests: %w", err)
	}

	// Delete loan guarantors
	_, err = tx.Exec("DELETE FROM loan_guarantors WHERE loan_id IN (SELECT id FROM loans WHERE chama_id = $1)", chamaID)
	if err != nil {
		return fmt.Errorf("failed to delete loan guarantors: %w", err)
	}

	// Delete loans
	_, err = tx.Exec("DELETE FROM loans WHERE chama_id = $1", chamaID)
	if err != nil {
		return fmt.Errorf("failed to delete loans: %w", err)
	}

	// Delete contributions
	_, err = tx.Exec("DELETE FROM contributions WHERE chama_id = $1", chamaID)
	if err != nil {
		return fmt.Errorf("failed to delete contributions: %w", err)
	}

	// Delete chama members
	_, err = tx.Exec("DELETE FROM chama_members WHERE chama_id = $1", chamaID)
	if err != nil {
		return fmt.Errorf("failed to delete chama members: %w", err)
	}

	// Finally, delete the chama itself
	_, err = tx.Exec("DELETE FROM chamas WHERE id = $1", chamaID)
	if err != nil {
		return fmt.Errorf("failed to delete chama: %w", err)
	}

	// Commit transaction
	if err = tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}
