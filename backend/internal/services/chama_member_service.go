package services

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"

	"vaultke-backend/internal/models"
)

func (s *ChamaService) GetChamaMembers(chamaID string) ([]*models.ChamaMember, error) {
	query := `
		SELECT cm.id, cm.chama_id, cm.user_id, cm.role, cm.joined_at, cm.is_active,
			   cm.total_contributions, cm.last_contribution, cm.rating, cm.total_ratings,
			   u.first_name, u.last_name, u.email, u.phone, u.avatar
		FROM chama_members cm
		INNER JOIN users u ON cm.user_id = u.id
		WHERE cm.chama_id = $1 AND cm.is_active = $2
		ORDER BY cm.joined_at ASC
	`

	rows, err := s.db.Query(query, chamaID, true)
	if err != nil {
		return nil, fmt.Errorf("failed to get chama members: %w", err)
	}
	defer rows.Close()

	var members []*models.ChamaMember
	for rows.Next() {
		member := &models.ChamaMember{}
		user := &models.User{}

		err := rows.Scan(
			&member.ID, &member.ChamaID, &member.UserID, &member.Role, &member.JoinedAt,
			&member.IsActive, &member.TotalContributions, &member.LastContribution,
			&member.Rating, &member.TotalRatings, &user.FirstName, &user.LastName,
			&user.Email, &user.Phone, &user.Avatar,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan member: %w", err)
		}

		user.ID = member.UserID
		member.User = user
		members = append(members, member)
	}

	return members, nil
}

func (s *ChamaService) GetChamaMember(chamaID, userID string) (*models.ChamaMember, error) {
	query := `
		SELECT id, chama_id, user_id, role, joined_at, is_active,
			   total_contributions, last_contribution, rating, total_ratings
		FROM chama_members
		WHERE chama_id = $1 AND user_id = $2
	`

	member := &models.ChamaMember{}
	err := s.db.QueryRow(query, chamaID, userID).Scan(
		&member.ID, &member.ChamaID, &member.UserID, &member.Role, &member.JoinedAt,
		&member.IsActive, &member.TotalContributions, &member.LastContribution,
		&member.Rating, &member.TotalRatings,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("member not found")
		}
		return nil, fmt.Errorf("failed to get member: %w", err)
	}

	return member, nil
}

func (s *ChamaService) IsUserMember(chamaID, userID string) (bool, error) {
	query := "SELECT COUNT(*) FROM chama_members WHERE chama_id = $1 AND user_id = $2 AND is_active = $3"
	var count int
	err := s.db.QueryRow(query, chamaID, userID, true).Scan(&count)
	if err != nil {
		return false, fmt.Errorf("failed to check membership: %w", err)
	}
	return count > 0, nil
}

func (s *ChamaService) UpdateMemberRole(chamaID, userID string, newRole models.ChamaRole, updatedBy string) error {
	// Check if updater has permission (only chairperson can change roles)
	updaterMember, err := s.GetChamaMember(chamaID, updatedBy)
	if err != nil {
		return err
	}
	if updaterMember.Role != models.ChamaRoleChairperson {
		return fmt.Errorf("only chairperson can update member roles")
	}

	// Update role
	query := "UPDATE chama_members SET role = $1 WHERE chama_id = $2 AND user_id = $3"
	_, err = s.db.Exec(query, newRole, chamaID, userID)
	if err != nil {
		return fmt.Errorf("failed to update member role: %w", err)
	}

	return nil
}

func (s *ChamaService) UpdateMemberRoleSimple(chamaID, userID, newRole string) error {
	// Update role directly with string
	query := "UPDATE chama_members SET role = $1, updated_at = $2 WHERE chama_id = $3 AND user_id = $4"
	_, err := s.db.Exec(query, newRole, time.Now(), chamaID, userID)
	if err != nil {
		return fmt.Errorf("failed to update member role: %w", err)
	}

	return nil
}

func (s *ChamaService) UpdateMemberStatus(chamaID, userID, status string) error {
	// Validate status
	validStatuses := map[string]bool{
		"active":    true,
		"inactive":  true,
		"suspended": true,
		"pending":   true,
	}

	if !validStatuses[status] {
		return fmt.Errorf("invalid status: %s", status)
	}

	// Update status by setting is_active based on status
	isActive := status == "active"
	query := "UPDATE chama_members SET is_active = $1, updated_at = $1$2 WHERE chama_id = $1$3 AND user_id = $2$4"
	_, err := s.db.Exec(query, isActive, time.Now(), chamaID, userID)
	if err != nil {
		return fmt.Errorf("failed to update member status: %w", err)
	}

	return nil
}

func (s *ChamaService) AddMemberToChama(chamaID, userID, role string) error {
	// Validate role
	validRoles := map[string]bool{
		"chairperson": true,
		"treasurer":   true,
		"secretary":   true,
		"member":      true,
		"assistant":   true,
	}

	if !validRoles[role] {
		role = "member" // Default to member if invalid role
	}

	// Check if user is already a member
	checkQuery := `SELECT COUNT(*) FROM chama_members WHERE chama_id = $1 AND user_id = $2 AND is_active = true`
	var count int
	err := s.db.QueryRow(checkQuery, chamaID, userID).Scan(&count)
	if err != nil {
		return fmt.Errorf("failed to check existing membership: %w", err)
	}

	if count > 0 {
		return fmt.Errorf("user is already a member of this chama")
	}

	// Add member
	member := &models.ChamaMember{
		ID:                 uuid.New().String(),
		ChamaID:            chamaID,
		UserID:             userID,
		Role:               models.ChamaRole(role),
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

	_, err = s.db.Exec(memberQuery,
		member.ID, member.ChamaID, member.UserID, member.Role, member.JoinedAt,
		member.IsActive, member.TotalContributions, member.Rating, member.TotalRatings,
	)
	if err != nil {
		return fmt.Errorf("failed to add member to chama: %w", err)
	}

	// Create service fee payment record for the new member (KES 50 registration fee)
	serviceFeeQuery := `
		INSERT INTO service_fee_payments (id, chama_id, user_id, amount, status, due_date, created_at, updated_at)
		VALUES ($1, $2, $3, 50, 'pending', $4, $5, $6)
		ON CONFLICT (chama_id, user_id) DO NOTHING
	`
	_, err = s.db.Exec(serviceFeeQuery,
		uuid.New().String(), chamaID, userID, time.Now(), time.Now(), time.Now(),
	)
	if err != nil {
		log.Printf("Warning: failed to create service fee payment record: %v", err)
	}

	return nil
}

func (s *ChamaService) RemoveUserFromChama(chamaID, userID string) error {
	// Start transaction
	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback()

	// Check if user is a member
	var memberExists bool
	err = tx.QueryRow("SELECT EXISTS(SELECT 1 FROM chama_members WHERE chama_id = $1 AND user_id = $2 AND is_active = true)", chamaID, userID).Scan(&memberExists)
	if err != nil {
		return fmt.Errorf("failed to check membership: %w", err)
	}

	if !memberExists {
		return fmt.Errorf("user is not a member of this chama")
	}

	// Mark member as inactive instead of deleting (for audit trail)
	_, err = tx.Exec("UPDATE chama_members SET is_active = false, updated_at = $3 WHERE chama_id = $1 AND user_id = $2", chamaID, userID, time.Now())
	if err != nil {
		return fmt.Errorf("failed to remove user from chama: %w", err)
	}

	// Update chama member count
	_, err = tx.Exec("UPDATE chamas SET current_members = current_members - 1, updated_at = $2 WHERE id = $1", chamaID, time.Now())
	if err != nil {
		return fmt.Errorf("failed to update member count: %w", err)
	}

	// Commit transaction
	if err = tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

func (s *ChamaService) SendInvitation(chamaID, inviterID, email, phoneNumber, message, role, roleName, roleDescription string) (string, error) {
	// Start transaction
	tx, err := s.db.Begin()
	if err != nil {
		return "", fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback()

	// Check if user with email already exists and is already a member
	var existingUserID string
	err = tx.QueryRow("SELECT id FROM users WHERE email = $1", email).Scan(&existingUserID)
	if err == nil {
		// User exists, check if already a member
		var memberExists bool
		err = tx.QueryRow("SELECT EXISTS(SELECT 1 FROM chama_members WHERE chama_id = $1 AND user_id = $2 AND is_active = true)", chamaID, existingUserID).Scan(&memberExists)
		if err != nil {
			return "", fmt.Errorf("failed to check existing membership: %w", err)
		}
		if memberExists {
			return "", fmt.Errorf("user is already a member of this chama")
		}
	}

	// Check if there's already a pending invitation for this email and chama
	var pendingInvitation bool
	err = tx.QueryRow("SELECT EXISTS(SELECT 1 FROM chama_invitations WHERE chama_id = $1 AND email = $2 AND status = 'pending')", chamaID, email).Scan(&pendingInvitation)
	if err != nil {
		return "", fmt.Errorf("failed to check pending invitations: %w", err)
	}
	if pendingInvitation {
		return "", fmt.Errorf("invitation already sent to this email")
	}

	// Create invitation
	invitationID := uuid.New().String()
	invitationToken := uuid.New().String() // Token for accepting invitation

	_, err = tx.Exec(`
		INSERT INTO chama_invitations (
			id, chama_id, inviter_id, email, phone_number, message,
			role, role_name, role_description,
			invitation_token, status, created_at, expires_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending', $11, $12)
	`, invitationID, chamaID, inviterID, email, phoneNumber, message,
		role, roleName, roleDescription,
		invitationToken, time.Now(), time.Now().Add(7*24*time.Hour)) // Expires in 7 days
	if err != nil {
		return "", fmt.Errorf("failed to create invitation: %w", err)
	}

	// Commit transaction
	if err = tx.Commit(); err != nil {
		return "", fmt.Errorf("failed to commit transaction: %w", err)
	}

	// Get chama and inviter details for the email
	var chamaName, inviterFirstName, inviterLastName string
	err = s.db.QueryRow(`
		SELECT c.name, u.first_name, u.last_name
		FROM chamas c, users u
		WHERE c.id = $1 AND u.id = $2
	`, chamaID, inviterID).Scan(&chamaName, &inviterFirstName, &inviterLastName)
	if err != nil {
		// Don't fail the invitation if email details cannot be loadedclea
		return invitationID, nil
	}

	if s.emailService != nil && email != "" {
		inviterFullName := fmt.Sprintf("%s %s", inviterFirstName, inviterLastName)
		_ = s.emailService.SendChamaInvitationEmail(email, chamaName, inviterFullName, message, invitationToken)
	}

	return invitationID, nil
}

func (s *ChamaService) RespondToInvitation(invitationID, userID, response string) error {
	// Start transaction
	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback()

	// Get invitation details
	var invitation struct {
		ChamaID   string
		Email     string
		Status    string
		ExpiresAt time.Time
	}

	err = tx.QueryRow(`
		SELECT chama_id, email, status, expires_at
		FROM chama_invitations
		WHERE id = $1
	`, invitationID).Scan(&invitation.ChamaID, &invitation.Email, &invitation.Status, &invitation.ExpiresAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("invitation not found")
		}
		return fmt.Errorf("failed to get invitation: %w", err)
	}

	// Check if invitation is still valid
	if invitation.Status != "pending" {
		return fmt.Errorf("invitation has already been %s", invitation.Status)
	}

	if time.Now().After(invitation.ExpiresAt) {
		return fmt.Errorf("invitation has expired")
	}

	// Verify that the user's email matches the invitation
	var userEmail string
	err = tx.QueryRow("SELECT email FROM users WHERE id = $1", userID).Scan(&userEmail)
	if err != nil {
		return fmt.Errorf("failed to get user email: %w", err)
	}

	if userEmail != invitation.Email {
		return fmt.Errorf("invitation email does not match user email")
	}

	// Update invitation status
	_, err = tx.Exec(`
		UPDATE chama_invitations
		SET status = $1, responded_at = $2, responded_by = $3
		WHERE id = $4
	`, response+"ed", time.Now(), userID, invitationID) // "accepted" or "rejected"
	if err != nil {
		return fmt.Errorf("failed to update invitation: %w", err)
	}

	// If accepted, add user to chama
	if response == "accept" {
		// Check if user is already a member (double-check)
		var memberExists bool
		err = tx.QueryRow("SELECT EXISTS(SELECT 1 FROM chama_members WHERE chama_id = $1 AND user_id = $2 AND is_active = $3)", invitation.ChamaID, userID, true).Scan(&memberExists)
		if err != nil {
			return fmt.Errorf("failed to check membership: %w", err)
		}

		if !memberExists {
			// Add user as member
			memberID := uuid.New().String()
			_, err = tx.Exec(`
				INSERT INTO chama_members (
					id, chama_id, user_id, role, joined_at, is_active,
					total_contributions, rating, total_ratings
				) VALUES ($1, $2, $3, 'member', $4, true, 0, 0, 0)
			`, memberID, invitation.ChamaID, userID, time.Now())
			if err != nil {
				return fmt.Errorf("failed to add user to chama: %w", err)
			}

			// Update chama member count
			_, err = tx.Exec("UPDATE chamas SET current_members = current_members + 1, updated_at = $1 WHERE id = $2", time.Now(), invitation.ChamaID)
			if err != nil {
				return fmt.Errorf("failed to update member count: %w", err)
			}
		}
	}

	// Commit transaction
	if err = tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

func (s *ChamaService) GetUserInvitations(userID string) ([]map[string]interface{}, error) {
	// Get user's email
	var userEmail string
	err := s.db.QueryRow("SELECT email FROM users WHERE id = $1", userID).Scan(&userEmail)
	if err != nil {
		return nil, fmt.Errorf("failed to get user email: %w", err)
	}

	// Get pending invitations for this email
	query := `
		SELECT
			ci.id, ci.chama_id, ci.inviter_id, ci.email, ci.phone_number,
			ci.message, ci.created_at, ci.expires_at,
			c.name as chama_name, c.description as chama_description,
			c.contribution_amount, c.contribution_frequency,
			u.first_name as inviter_first_name, u.last_name as inviter_last_name
		FROM chama_invitations ci
		INNER JOIN chamas c ON ci.chama_id = c.id
		INNER JOIN users u ON ci.inviter_id = u.id
		WHERE ci.email = $1 AND ci.status = 'pending' AND ci.expires_at > $2
		ORDER BY ci.created_at DESC
	`

	rows, err := s.db.Query(query, userEmail, time.Now())
	if err != nil {
		return nil, fmt.Errorf("failed to get invitations: %w", err)
	}
	defer rows.Close()

	var invitations []map[string]interface{}
	for rows.Next() {
		var (
			id, chamaID, inviterID, email, chamaName, chamaDescription string
			contributionFrequency, inviterFirstName, inviterLastName   string
			createdAt, expiresAt                                       string
			phoneNumber, message                                       *string
			contributionAmount                                         float64
		)

		err := rows.Scan(
			&id, &chamaID, &inviterID, &email, &phoneNumber,
			&message, &createdAt, &expiresAt,
			&chamaName, &chamaDescription, &contributionAmount, &contributionFrequency,
			&inviterFirstName, &inviterLastName,
		)
		if err != nil {
			continue // Skip invalid rows
		}

		invitation := map[string]interface{}{
			"id":         id,
			"chama_id":   chamaID,
			"inviter_id": inviterID,
			"email":      email,
			"phone":      phoneNumber,
			"message":    message,
			"created_at": createdAt,
			"expires_at": expiresAt,
			"chama": map[string]interface{}{
				"id":                     chamaID,
				"name":                   chamaName,
				"description":            chamaDescription,
				"contribution_amount":    contributionAmount,
				"contribution_frequency": contributionFrequency,
			},
			"inviter": map[string]interface{}{
				"id":         inviterID,
				"first_name": inviterFirstName,
				"last_name":  inviterLastName,
			},
		}

		invitations = append(invitations, invitation)
	}

	return invitations, nil
}

func (s *ChamaService) GetChamaSentInvitations(chamaID string) ([]map[string]interface{}, error) {
	query := `
		SELECT
			ci.id, ci.chama_id, ci.inviter_id, ci.email, ci.phone_number,
			ci.message, ci.role, ci.role_name, ci.role_description,
			ci.status, ci.created_at, ci.expires_at, ci.responded_at,
			u.first_name as inviter_first_name, u.last_name as inviter_last_name
		FROM chama_invitations ci
		INNER JOIN users u ON ci.inviter_id = u.id
		WHERE ci.chama_id = $1
		ORDER BY ci.created_at DESC
	`

	rows, err := s.db.Query(query, chamaID)
	if err != nil {
		return nil, fmt.Errorf("failed to get sent invitations: %w", err)
	}
	defer rows.Close()

	var invitations []map[string]interface{}

	for rows.Next() {
		var (
			id, chamaID, inviterID, email                         string
			phoneNumber, message, role, roleName, roleDescription sql.NullString
			status                                                string
			createdAt, expiresAt                                  time.Time
			respondedAt                                           sql.NullTime
			inviterFirstName, inviterLastName                     string
		)

		err := rows.Scan(
			&id, &chamaID, &inviterID, &email, &phoneNumber,
			&message, &role, &roleName, &roleDescription,
			&status, &createdAt, &expiresAt, &respondedAt,
			&inviterFirstName, &inviterLastName,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan invitation: %w", err)
		}

		invitation := map[string]interface{}{
			"id":               id,
			"chama_id":         chamaID,
			"inviter_id":       inviterID,
			"email":            email,
			"phone":            phoneNumber.String,
			"message":          message.String,
			"role":             role.String,
			"role_name":        roleName.String,
			"role_description": roleDescription.String,
			"status":           status,
			"created_at":       createdAt,
			"expires_at":       expiresAt,
			"inviter": map[string]interface{}{
				"id":         inviterID,
				"first_name": inviterFirstName,
				"last_name":  inviterLastName,
			},
		}

		if respondedAt.Valid {
			invitation["responded_at"] = respondedAt.Time
		}

		invitations = append(invitations, invitation)
	}

	return invitations, nil
}
