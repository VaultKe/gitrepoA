package services

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"vaultke-backend/internal/models"
	"vaultke-backend/internal/utils"
)

// Global email service instance to avoid recreating it
var globalEmailService *EmailService

// getChamaStatistics is expensive (many aggregate queries against a remote DB),
// and the dashboard polls it frequently. Cache the result for a short window so
// repeated polling does not re-run all the queries on every request. This is a
// best-effort, process-local cache with a short TTL; slightly stale dashboard
// numbers are acceptable.
type chamaStatsCacheEntry struct {
	stats    map[string]interface{}
	cachedAt time.Time
}

var (
	chamaStatsCacheMu sync.Mutex
	chamaStatsCache   = make(map[string]chamaStatsCacheEntry)
	chamaStatsTTL     = 20 * time.Second
)

func chamaStatsCacheKey(chamaID, userID string) string {
	return chamaID + "|" + userID
}

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
		   meeting_time, permissions, created_by, created_at, updated_at, chat_room_id,
		   rules_file_path, rules_file_name
		FROM chamas WHERE id = $1
	`

	chama := &models.Chama{}
	var rulesJSON, permissionsJSON []byte
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
		&chama.RulesFilePath, &chama.RulesFileName,
	)
	chama.ChatRoomID = chatRoomID
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("chama not found")
		}
		return nil, fmt.Errorf("failed to get chama: %w", err)
	}

	// Parse JSON fields
	if err = chama.SetRulesFromJSON(string(rulesJSON)); err != nil {
		return nil, fmt.Errorf("failed to parse rules: %w", err)
	}

	// Parse permissions JSON
	if len(permissionsJSON) > 0 {
		var permissions map[string]interface{}
		if err := json.Unmarshal(permissionsJSON, &permissions); err == nil {
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
		   meeting_time, permissions, created_by, created_at, updated_at, rules_file_path, rules_file_name
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
		var rulesJSON, permissionsJSON []byte
		var meetingFreq, meetingTime *string
		var meetingDayOfWeek, meetingDayOfMonth *int

		err := rows.Scan(
			&chama.ID, &chama.Name, &chama.Description, &chama.Category, &chama.Type, &chama.Status,
			&chama.Avatar, &chama.County, &chama.Town, &chama.Latitude, &chama.Longitude,
			&chama.ContributionAmount, &chama.ContributionFrequency, &chama.MaxMembers,
			&chama.CurrentMembers, &chama.TotalFunds, &chama.IsPublic, &chama.RequiresApproval,
			&rulesJSON, &meetingFreq, &meetingDayOfWeek, &meetingDayOfMonth, &meetingTime,
			&permissionsJSON, &chama.CreatedBy, &chama.CreatedAt, &chama.UpdatedAt,
			&chama.RulesFilePath, &chama.RulesFileName,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan chama: %w", err)
		}

		// Parse JSON fields
		if err = chama.SetRulesFromJSON(string(rulesJSON)); err != nil {
			return nil, fmt.Errorf("failed to parse rules: %w", err)
		}

		// Parse permissions JSON
		if len(permissionsJSON) > 0 {
			var permissions map[string]interface{}
			if err := json.Unmarshal(permissionsJSON, &permissions); err == nil {
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
			   meeting_time, permissions, created_by, created_at, updated_at, rules_file_path, rules_file_name
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
		var rulesJSON, permissionsJSON []byte
		var meetingFreq, meetingTime *string
		var meetingDayOfWeek, meetingDayOfMonth *int

		err := rows.Scan(
			&chama.ID, &chama.Name, &chama.Description, &chama.Type, &chama.Status,
			&chama.Avatar, &chama.County, &chama.Town, &chama.Latitude, &chama.Longitude,
			&chama.ContributionAmount, &chama.ContributionFrequency, &chama.MaxMembers,
			&chama.CurrentMembers, &chama.TotalFunds, &chama.IsPublic, &chama.RequiresApproval,
			&rulesJSON, &meetingFreq, &meetingDayOfWeek, &meetingDayOfMonth, &meetingTime,
			&permissionsJSON, &chama.CreatedBy, &chama.CreatedAt, &chama.UpdatedAt,
			&chama.RulesFilePath, &chama.RulesFileName,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan chama: %w", err)
		}

		// Parse JSON fields
		if err = chama.SetRulesFromJSON(string(rulesJSON)); err != nil {
			return nil, fmt.Errorf("failed to parse rules: %w", err)
		}

		// Parse permissions JSON
		if len(permissionsJSON) > 0 {
			var permissions map[string]interface{}
			if err := json.Unmarshal(permissionsJSON, &permissions); err == nil {
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
		   c.rules_file_path, c.rules_file_name,
 		   cm.role, cm.service_fee_paid, cm.service_fee_status, cm.id as member_id, cm.is_active
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
		var rulesJSON, permissionsJSON []byte
		var meetingFreq, meetingTime *string
		var meetingDayOfWeek, meetingDayOfMonth *int
		var role string
		var serviceFeePaid bool
		var serviceFeeStatus string
		var memberID string
		var membershipIsActive bool

		err := rows.Scan(
			&chama.ID, &chama.Name, &chama.Description, &chama.Category, &chama.Type, &chama.Status,
			&chama.Avatar, &chama.County, &chama.Town, &chama.Latitude, &chama.Longitude,
			&chama.ContributionAmount, &chama.ContributionFrequency, &chama.MaxMembers,
			&chama.CurrentMembers, &chama.TotalFunds, &chama.IsPublic, &chama.RequiresApproval,
			&rulesJSON, &meetingFreq, &meetingDayOfWeek, &meetingDayOfMonth, &meetingTime,
			&permissionsJSON, &chama.CreatedBy, &chama.CreatedAt, &chama.UpdatedAt,
			&chama.RulesFilePath, &chama.RulesFileName,
			&role, &serviceFeePaid, &serviceFeeStatus, &memberID, &membershipIsActive,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan chama: %w", err)
		}

		// Parse JSON fields
		if err = chama.SetRulesFromJSON(string(rulesJSON)); err != nil {
			return nil, fmt.Errorf("failed to parse rules: %w", err)
		}

		// Parse permissions JSON
		if len(permissionsJSON) > 0 {
			var permissions map[string]interface{}
			if err := json.Unmarshal(permissionsJSON, &permissions); err == nil {
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
		chama.MembershipIsActive = membershipIsActive

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
	// Serve from short-TTL cache when available to absorb dashboard polling.
	cacheKey := chamaStatsCacheKey(chamaID, userID)
	chamaStatsCacheMu.Lock()
	if entry, ok := chamaStatsCache[cacheKey]; ok && time.Since(entry.cachedAt) < chamaStatsTTL {
		statsCopy := make(map[string]interface{}, len(entry.stats))
		for k, v := range entry.stats {
			statsCopy[k] = v
		}
		chamaStatsCacheMu.Unlock()
		return statsCopy, nil
	}
	chamaStatsCacheMu.Unlock()

	stats := make(map[string]interface{})

	// Fan out the independent queries in parallel.
	var (
		wg sync.WaitGroup

		chamaObj       *models.Chama
		memberStats    map[string]interface{}
		financialStats map[string]interface{}
		activityStats  map[string]interface{}
		walletBalance  float64
		userStats      map[string]interface{}

		chamaErr, memberErr, financialErr, activityErr error
		walletErr, userStatsErr                        error
	)

	wg.Add(6)
	go func() {
		defer wg.Done()
		chamaObj, chamaErr = s.GetChamaByID(chamaID)
	}()
	go func() {
		defer wg.Done()
		memberStats, memberErr = s.getMemberStatistics(chamaID)
	}()
	go func() {
		defer wg.Done()
		financialStats, financialErr = s.getFinancialStatistics(chamaID)
	}()
	go func() {
		defer wg.Done()
		activityStats, activityErr = s.getActivityStatistics(chamaID)
	}()
	go func() {
		defer wg.Done()
		walletBalance, walletErr = s.getChamaWalletBalance(chamaID)
		if walletErr != nil {
			walletBalance = 0
		}
	}()
	go func() {
		defer wg.Done()
		userStats, userStatsErr = s.getUserChamaStatistics(chamaID, userID)
		if userStatsErr != nil {
			userStats = make(map[string]interface{})
		}
	}()
	wg.Wait()

	// Preserve original error semantics: abort in the same order queries used to run.
	if chamaErr != nil {
		return nil, fmt.Errorf("failed to get chama: %w", chamaErr)
	}
	if memberErr != nil {
		return nil, fmt.Errorf("failed to get member statistics: %w", memberErr)
	}
	if financialErr != nil {
		return nil, fmt.Errorf("failed to get financial statistics: %w", financialErr)
	}
	if activityErr != nil {
		return nil, fmt.Errorf("failed to get activity statistics: %w", activityErr)
	}

	chamaInfo := map[string]interface{}{
		"id":                     chamaObj.ID,
		"name":                   chamaObj.Name,
		"type":                   chamaObj.Type,
		"status":                 chamaObj.Status,
		"created_at":             chamaObj.CreatedAt,
		"contribution_amount":    chamaObj.ContributionAmount,
		"contribution_frequency": chamaObj.ContributionFrequency,
		"max_members":            chamaObj.MaxMembers,
		"current_members":        chamaObj.CurrentMembers,
		"total_funds":            walletBalance, // combined balance of every sub-wallet
		"wallet_balance":         walletBalance,
	}
	if lf, lerr := s.getChamaLoanableFunds(chamaID); lerr == nil {
		chamaInfo["loanable_funds"] = lf["loanable"]
		chamaInfo["restricted_welfare"] = lf["welfare"]
		chamaInfo["restricted_merry_go_round"] = lf["merry_go_round"]
		chamaInfo["reserved_loan_funds"] = lf["reserved"]
	}
	stats["chama_info"] = chamaInfo
	stats["user_stats"] = userStats

	stats["member_stats"] = memberStats
	stats["financial_stats"] = financialStats
	stats["activity_stats"] = activityStats

	chamaStatsCacheMu.Lock()
	chamaStatsCache[cacheKey] = chamaStatsCacheEntry{stats: stats, cachedAt: time.Now()}
	chamaStatsCacheMu.Unlock()

	return stats, nil
}

func (s *ChamaService) getMemberStatistics(chamaID string) (map[string]interface{}, error) {
	stats := make(map[string]interface{})

	// Count members by role and active status in a single query
	// (include all members, not just active ones)
	roleQuery := `
		SELECT role,
		       COUNT(*) as count,
		       SUM(CASE WHEN (is_active = true OR is_active IS NULL) THEN 1 ELSE 0 END) as active_count
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
	activeMembers := 0
	for rows.Next() {
		var role string
		var count, activeCount int
		if err := rows.Scan(&role, &count, &activeCount); err != nil {
			continue
		}
		roleStats[role] = count
		totalMembers += count
		activeMembers += activeCount
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

	// Meeting statistics (upcoming / ongoing / completed)
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

// getChamaWalletBalance returns the chama's headline wallet balance shown on the
// dashboard — the COMBINED total of every chama sub-wallet (savings, shares,
// dividends, welfare, merry-go-round, loans, …). Welfare and merry-go-round are
// restricted PORTIONS of this total, not separate money; the loanable pool is
// this balance minus those restricted portions (see chamaLoanableFunds).
// Interest and fines paid by borrowers land in the unrestricted sub-wallets and
// therefore raise this figure.
func (s *ChamaService) getChamaWalletBalance(chamaID string) (float64, error) {
	if err := s.ensureChamaWallet(chamaID); err != nil {
		return 0, fmt.Errorf("failed to ensure chama wallet: %w", err)
	}

	var balance float64
	err := s.db.QueryRow(`
		SELECT COALESCE(SUM(balance), 0)
		FROM wallets
		WHERE owner_id = $1 AND type = 'chama'
	`, chamaID).Scan(&balance)
	if err != nil {
		return 0, fmt.Errorf("failed to get chama wallet balance: %w", err)
	}
	return balance, nil
}

// getChamaLoanableFunds returns how much the chama can currently lend:
// combined wallet balance − welfare − merry-go-round − approved-but-undisbursed
// loan principal (money already committed to other borrowers).
func (s *ChamaService) getChamaLoanableFunds(chamaID string) (map[string]interface{}, error) {
	var total, welfare, mgr, reserved float64
	if err := s.db.QueryRow(`
		SELECT
			COALESCE(SUM(balance), 0),
			COALESCE(SUM(CASE WHEN COALESCE(subwallet_type,'') = 'welfare' THEN balance ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN COALESCE(subwallet_type,'') IN ('merry_go_round','merry-go-round') THEN balance ELSE 0 END), 0)
		FROM wallets WHERE owner_id = $1 AND type = 'chama'
	`, chamaID).Scan(&total, &welfare, &mgr); err != nil {
		return nil, err
	}
	_ = s.db.QueryRow(`
		SELECT COALESCE(SUM(COALESCE(NULLIF(amount,0), total_amount, 0)), 0)
		FROM loans
		WHERE chama_id = $1 AND disbursed_at IS NULL
		  AND (lower(COALESCE(approval_stage,'')) = 'fully_approved' OR lower(COALESCE(status,'')) IN ('approved','disbursing'))
		  AND lower(COALESCE(status,'')) NOT IN ('rejected','cancelled','completed')
	`, chamaID).Scan(&reserved)

	loanable := total - welfare - mgr - reserved
	if loanable < 0 {
		loanable = 0
	}
	return map[string]interface{}{
		"wallet_balance": total,
		"welfare":        welfare,
		"merry_go_round": mgr,
		"reserved":       reserved,
		"loanable":       loanable,
	}, nil
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
		var metadataJSON []byte
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
		if len(metadataJSON) > 0 {
			_ = transaction.SetMetadataFromJSON(string(metadataJSON))
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

	// Normalize updates into a map for flexible processing
	updateMap := make(map[string]interface{})
	if m, ok := updates.(map[string]interface{}); ok {
		updateMap = m
	} else if ptr, ok := updates.(*struct {
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
		WalletTypes           *[]string               `json:"wallet_types,omitempty"`
	}); ok {
		if ptr.Name != nil {
			updateMap["name"] = *ptr.Name
		}
		if ptr.Description != nil {
			updateMap["description"] = *ptr.Description
		}
		if ptr.IsPublic != nil {
			updateMap["is_public"] = *ptr.IsPublic
		}
		if ptr.RequiresApproval != nil {
			updateMap["requires_approval"] = *ptr.RequiresApproval
		}
		if ptr.MaxMembers != nil {
			updateMap["max_members"] = *ptr.MaxMembers
		}
		if ptr.ContributionAmount != nil {
			updateMap["contribution_amount"] = *ptr.ContributionAmount
		}
		if ptr.ContributionFrequency != nil {
			updateMap["contribution_frequency"] = *ptr.ContributionFrequency
		}
		if ptr.Rules != nil {
			updateMap["rules"] = *ptr.Rules
		}
		if ptr.MeetingSchedule != nil {
			updateMap["meeting_schedule"] = *ptr.MeetingSchedule
		}
		if ptr.Permissions != nil {
			updateMap["permissions"] = *ptr.Permissions
		}
		if ptr.Notifications != nil {
			updateMap["notifications"] = *ptr.Notifications
		}
		if ptr.WalletTypes != nil {
			updateMap["wallet_types"] = *ptr.WalletTypes
		}
	}

	if len(updateMap) == 0 {
		return fmt.Errorf("no fields to update")
	}

	paramIndex := 1
	if v, ok := updateMap["name"]; ok {
		setParts = append(setParts, fmt.Sprintf("name = $%d", paramIndex))
		args = append(args, v)
		paramIndex++
	}
	if v, ok := updateMap["description"]; ok {
		setParts = append(setParts, fmt.Sprintf("description = $%d", paramIndex))
		args = append(args, v)
		paramIndex++
	}
	if v, ok := updateMap["is_public"]; ok {
		setParts = append(setParts, fmt.Sprintf("is_public = $%d", paramIndex))
		args = append(args, v)
		paramIndex++
	}
	if v, ok := updateMap["requires_approval"]; ok {
		setParts = append(setParts, fmt.Sprintf("requires_approval = $%d", paramIndex))
		args = append(args, v)
		paramIndex++
	}
	if v, ok := updateMap["max_members"]; ok {
		setParts = append(setParts, fmt.Sprintf("max_members = $%d", paramIndex))
		args = append(args, v)
		paramIndex++
	}
	if v, ok := updateMap["contribution_amount"]; ok {
		setParts = append(setParts, fmt.Sprintf("contribution_amount = $%d", paramIndex))
		args = append(args, v)
		paramIndex++
	}
	if v, ok := updateMap["contribution_frequency"]; ok {
		setParts = append(setParts, fmt.Sprintf("contribution_frequency = $%d", paramIndex))
		args = append(args, v)
		paramIndex++
	}
	if v, ok := updateMap["rules"]; ok {
		rulesJSON, err := json.Marshal(v)
		if err != nil {
			return fmt.Errorf("failed to marshal rules: %w", err)
		}
		setParts = append(setParts, fmt.Sprintf("rules = $%d", paramIndex))
		args = append(args, string(rulesJSON))
		paramIndex++
	}
	if v, ok := updateMap["meeting_schedule"]; ok {
		scheduleJSON, err := json.Marshal(v)
		if err != nil {
			return fmt.Errorf("failed to marshal meeting schedule: %w", err)
		}
		setParts = append(setParts, fmt.Sprintf("meeting_schedule = $%d", paramIndex))
		args = append(args, string(scheduleJSON))
		paramIndex++
	}

	if v, ok := updateMap["rules_file_path"]; ok {
		setParts = append(setParts, fmt.Sprintf("rules_file_path = $%d", paramIndex))
		args = append(args, v)
		paramIndex++
	}
	if v, ok := updateMap["rules_file_name"]; ok {
		setParts = append(setParts, fmt.Sprintf("rules_file_name = $%d", paramIndex))
		args = append(args, v)
		paramIndex++
	}

	if v, ok := updateMap["status"]; ok {
		setParts = append(setParts, fmt.Sprintf("status = $%d", paramIndex))
		args = append(args, v)
		paramIndex++
	}

	// Handle permissions and wallet_types together
	if _, hasPermissions := updateMap["permissions"]; hasPermissions || updateMap["wallet_types"] != nil {
		// Get existing permissions
		var existingPermissionsJSON string
		err = tx.QueryRow("SELECT permissions FROM chamas WHERE id = $1", chamaID).Scan(&existingPermissionsJSON)
		if err != nil && err != sql.ErrNoRows {
			return fmt.Errorf("failed to get existing permissions: %w", err)
		}

		permissions := make(map[string]interface{})
		if existingPermissionsJSON != "" {
			if err := json.Unmarshal([]byte(existingPermissionsJSON), &permissions); err != nil {
				permissions = make(map[string]interface{})
			}
		}
		if permissions == nil {
			permissions = make(map[string]interface{})
		}

		// Merge boolean permissions
		if perms, ok := updateMap["permissions"].(map[string]interface{}); ok {
			for k, v := range perms {
				permissions[k] = v
			}
		}

		// Update activeWalletTypes if provided
		if walletTypes, ok := updateMap["wallet_types"].([]interface{}); ok {
			stringTypes := make([]string, 0, len(walletTypes))
			for _, wt := range walletTypes {
				if s, ok := wt.(string); ok {
					stringTypes = append(stringTypes, s)
				}
			}
			permissions["activeWalletTypes"] = stringTypes
		} else if walletTypes, ok := updateMap["wallet_types"].([]string); ok {
			permissions["activeWalletTypes"] = walletTypes
		}

		permissionsJSON, err := json.Marshal(permissions)
		if err != nil {
			return fmt.Errorf("failed to marshal permissions: %w", err)
		}
		setParts = append(setParts, fmt.Sprintf("permissions = $%d", paramIndex))
		args = append(args, string(permissionsJSON))
		paramIndex++
	}

	// Add updated_at timestamp
	setParts = append(setParts, fmt.Sprintf("updated_at = $%d", paramIndex))
	args = append(args, time.Now())
	paramIndex++

	// Add chama ID for WHERE clause
	args = append(args, chamaID)

	// Build and execute update query
	query := fmt.Sprintf("UPDATE chamas SET %s WHERE id = $%d", strings.Join(setParts, ", "), paramIndex)

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

	// Delete welfare contributions (linked to chama via welfare_funds)
	_, err = tx.Exec("DELETE FROM welfare_contributions WHERE welfare_fund_id IN (SELECT id FROM welfare_funds WHERE chama_id = $1)", chamaID)
	if err != nil {
		return fmt.Errorf("failed to delete welfare contributions: %w", err)
	}

	// Delete welfare funds
	_, err = tx.Exec("DELETE FROM welfare_funds WHERE chama_id = $1", chamaID)
	if err != nil {
		return fmt.Errorf("failed to delete welfare funds: %w", err)
	}

	// Delete welfare requests
	_, err = tx.Exec("DELETE FROM welfare_requests WHERE chama_id = $1", chamaID)
	if err != nil {
		return fmt.Errorf("failed to delete welfare requests: %w", err)
	}

	// Delete loan payments (linked to loans)
	_, err = tx.Exec("DELETE FROM loan_payments WHERE loan_id IN (SELECT id FROM loans WHERE chama_id = $1)", chamaID)
	if err != nil {
		return fmt.Errorf("failed to delete loan payments: %w", err)
	}

	// Delete loan guarantors (linked to loans)
	_, err = tx.Exec("DELETE FROM guarantors WHERE loan_id IN (SELECT id FROM loans WHERE chama_id = $1)", chamaID)
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
