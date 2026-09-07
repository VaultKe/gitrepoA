package api

import (
	"database/sql"
	"fmt"
	"strings"
	"sync"
	"time"
)

// Helper functions to get different types of notifications

// getSystemNotifications retrieves system notifications from the notifications table
func getSystemNotifications(db *sql.DB, userID string) ([]map[string]interface{}, error) {
	// guarantor_request / referee_request are served live by
	// getGuarantorRefereeNotifications — never also emit any stored rows of
	// those types (would double up / never clear).
	query := `
		SELECT id, user_id, title, message, type, data, is_read, created_at
		FROM notifications
		WHERE user_id = $1
		  AND (type IS NULL OR type NOT IN ('guarantor_request', 'referee_request'))
		ORDER BY created_at DESC
	`

	rows, err := db.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var notifications []map[string]interface{}
	for rows.Next() {
		var notification struct {
			ID        string `json:"id"`
			UserID    string `json:"userId"`
			Title     string `json:"title"`
			Message   string `json:"message"`
			Type      string `json:"type"`
			Data      []byte `json:"data"`
			IsRead    bool   `json:"isRead"`
			CreatedAt string `json:"createdAt"`
		}

		err := rows.Scan(
			&notification.ID,
			&notification.UserID,
			&notification.Title,
			&notification.Message,
			&notification.Type,
			&notification.Data,
			&notification.IsRead,
			&notification.CreatedAt,
		)
		if err != nil {
			continue
		}

		notificationMap := map[string]interface{}{
			"id":        notification.ID,
			"userId":    notification.UserID,
			"title":     notification.Title,
			"message":   notification.Message,
			"type":      notification.Type,
			"isRead":    notification.IsRead,
			"createdAt": notification.CreatedAt,
			"source":    "system",
		}

		if len(notification.Data) > 0 {
			notificationMap["data"] = string(notification.Data)
		}

		notifications = append(notifications, notificationMap)
	}

	return notifications, nil
}

// getChamaInvitationNotifications retrieves chama invitation notifications
func getChamaInvitationNotifications(db *sql.DB, userID string) ([]map[string]interface{}, error) {
	// Get user's email first
	var userEmail string
	err := db.QueryRow("SELECT email FROM users WHERE id = $1", userID).Scan(&userEmail)
	if err != nil {
		return nil, err
	}

	query := `
		SELECT
			ci.id, ci.chama_id, ci.email, ci.message, ci.created_at, ci.expires_at,
			c.name as chama_name, c.description as chama_description,
			c.contribution_amount, c.contribution_frequency,
			u.first_name as inviter_first_name, u.last_name as inviter_last_name
		FROM chama_invitations ci
		INNER JOIN chamas c ON ci.chama_id = c.id
		INNER JOIN users u ON ci.inviter_id = u.id
		WHERE ci.email = $1 AND ci.status = 'pending' AND ci.expires_at > $2
		ORDER BY ci.created_at DESC
	`

	rows, err := db.Query(query, userEmail, time.Now())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var notifications []map[string]interface{}
	for rows.Next() {
		var (
			id, chamaID, email, chamaName, chamaDescription          string
			contributionFrequency, inviterFirstName, inviterLastName string
			createdAt, expiresAt                                     string
			message                                                  *string
			contributionAmount                                       float64
		)

		err := rows.Scan(
			&id, &chamaID, &email, &message, &createdAt, &expiresAt,
			&chamaName, &chamaDescription, &contributionAmount, &contributionFrequency,
			&inviterFirstName, &inviterLastName,
		)
		if err != nil {
			continue
		}

		inviterName := fmt.Sprintf("%s %s", inviterFirstName, inviterLastName)
		title := fmt.Sprintf("Chama Invitation: %s", chamaName)
		messageText := fmt.Sprintf("%s invited you to join %s", inviterName, chamaName)
		if message != nil && *message != "" {
			messageText = *message
		}

		notificationMap := map[string]interface{}{
			"id":         id,
			"user_id":    userID,
			"title":      title,
			"message":    messageText,
			"type":       "chama_invitation",
			"is_read":    false, // Invitations are always unread until responded
			"created_at": createdAt,
			"source":     "chama_invitation",
			"data": map[string]interface{}{
				"invitation_id":          id,
				"chama_id":               chamaID,
				"chama_name":             chamaName,
				"chama_description":      chamaDescription,
				"contribution_amount":    contributionAmount,
				"contribution_frequency": contributionFrequency,
				"inviter_name":           inviterName,
				"expires_at":             expiresAt,
			},
		}

		notifications = append(notifications, notificationMap)
	}

	return notifications, nil
}

// getMeetingNotifications retrieves meeting-related notifications
func getMeetingNotifications(db *sql.DB, userID string) ([]map[string]interface{}, error) {
	query := `
		SELECT
			m.id, m.chama_id, m.title, m.description, m.scheduled_at,
			m.meeting_type, m.status, m.created_at,
			c.name as chama_name,
			u.first_name as creator_first_name, u.last_name as creator_last_name
		FROM meetings m
		INNER JOIN chamas c ON m.chama_id = c.id
		INNER JOIN users u ON m.created_by = u.id
		INNER JOIN chama_members cm ON c.id = cm.chama_id
		WHERE cm.user_id = $1 AND cm.is_active = true
		AND (
			(m.status = 'scheduled' AND m.scheduled_at > NOW() - INTERVAL '1 day')
			OR (m.status = 'active')
			OR (m.created_at > NOW() - INTERVAL '7 days')
		)
		ORDER BY m.scheduled_at DESC
	`

	rows, err := db.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var notifications []map[string]interface{}
	for rows.Next() {
		var (
			id, chamaID, title, meetingType, status, createdAt string
			chamaName, creatorFirstName, creatorLastName       string
			description, scheduledAt                           *string
		)

		err := rows.Scan(
			&id, &chamaID, &title, &description, &scheduledAt,
			&meetingType, &status, &createdAt,
			&chamaName, &creatorFirstName, &creatorLastName,
		)
		if err != nil {
			continue
		}

		creatorName := fmt.Sprintf("%s %s", creatorFirstName, creatorLastName)

		var notificationTitle, messageText, notificationType string

		switch status {
		case "scheduled":
			notificationTitle = fmt.Sprintf("Upcoming Meeting: %s", title)
			messageText = fmt.Sprintf("Meeting '%s' in %s is scheduled", title, chamaName)
			notificationType = "meeting_scheduled"
		case "active":
			notificationTitle = fmt.Sprintf("Meeting Started: %s", title)
			messageText = fmt.Sprintf("Meeting '%s' in %s has started", title, chamaName)
			notificationType = "meeting_started"
		default:
			notificationTitle = fmt.Sprintf("Meeting Created: %s", title)
			messageText = fmt.Sprintf("%s created a new meeting '%s'  in %s", creatorName, title, chamaName)
			notificationType = "meeting_created"
		}

		notificationMap := map[string]interface{}{
			"id":        fmt.Sprintf("meeting_%s", id),
			"userId":    userID,
			"title":     notificationTitle,
			"message":   messageText,
			"type":      notificationType,
			"isRead":    false,
			"createdAt": createdAt,
			"source":    "meeting",
			"data": map[string]interface{}{
				"meetingId":    id,
				"chamaId":      chamaID,
				"chamaName":    chamaName,
				"meetingTitle": title,
				"description":  description,
				"scheduledAt":  scheduledAt,
				"meetingType":  meetingType,
				"status":       status,
				"creatorName":  creatorName,
			},
		}

		notifications = append(notifications, notificationMap)
	}

	return notifications, nil
}

// getFinancialNotifications retrieves financial-related notifications
func getFinancialNotifications(db *sql.DB, userID string) ([]map[string]interface{}, error) {
	var notifications []map[string]interface{}

	// 1. Get loan notifications (applications, approvals, disbursements)
	// 2. Get welfare request notifications
	// 3. Get transaction notifications (contributions, payments)
	// These are independent, so fan them out.
	var (
		wg sync.WaitGroup

		loanNotifs, welfareNotifs, transactionNotifs []map[string]interface{}

		loanErr, welfareErr, transactionErr error
	)

	wg.Add(3)
	go func() {
		defer wg.Done()
		loanNotifs, loanErr = getLoanNotifications(db, userID)
	}()
	go func() {
		defer wg.Done()
		welfareNotifs, welfareErr = getWelfareNotifications(db, userID)
	}()
	go func() {
		defer wg.Done()
		transactionNotifs, transactionErr = getTransactionNotifications(db, userID)
	}()
	wg.Wait()

	if loanErr == nil {
		notifications = append(notifications, loanNotifs...)
	}
	if welfareErr == nil {
		notifications = append(notifications, welfareNotifs...)
	}
	if transactionErr == nil {
		notifications = append(notifications, transactionNotifs...)
	}

	return notifications, nil
}

// getGuarantorRefereeNotifications builds the guarantor / referee loan-backing
// requests for a user LIVE from the guarantors and loan_referees tables — the
// exact same pattern getChamaInvitationNotifications uses for chama invites:
// only PENDING requests are returned, and the moment the user accepts/declines
// (the row's status changes) the request drops off the list. Nothing is ever
// written to the notifications table for these, so they cannot be lost to
// schema drift or a failed insert.
func getGuarantorRefereeNotifications(db *sql.DB, userID string) ([]map[string]interface{}, error) {
	var out []map[string]interface{}
	if db == nil || userID == "" {
		return out, nil
	}

	// Insurance: if the loan-backing migration never ran, referees would be
	// invisible forever. Cheap idempotent guard.
	_, _ = db.Exec(`
		CREATE TABLE IF NOT EXISTS loan_referees (
			id TEXT PRIMARY KEY,
			loan_id TEXT NOT NULL,
			user_id TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'pending',
			message TEXT,
			responded_at TIMESTAMP,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(loan_id, user_id)
		)`)

	collect := func(query, role, idKey, notifType, title string, msg func(borrower string, amount float64, chama string) string) {
		rows, err := db.Query(query, userID)
		if err != nil {
			fmt.Printf("getGuarantorRefereeNotifications: %s query failed: %v\n", role, err)
			return
		}
		defer rows.Close()
		for rows.Next() {
			var (
				recordID, loanID, createdAt    string
				amount                         float64
				borrowerID, chamaID            string
				firstName, lastName, chamaName string
			)
			if err := rows.Scan(&recordID, &loanID, &createdAt, &amount,
				&borrowerID, &chamaID, &firstName, &lastName, &chamaName); err != nil {
				continue
			}
			borrower := strings.TrimSpace(firstName + " " + lastName)
			if borrower == "" {
				borrower = "A member"
			}
			// data as a map (not a hand-built JSON string) so record ids that
			// contain quotes/backslashes can never break the payload.
			data := map[string]interface{}{
				"loan_id":      loanID,
				idKey:          recordID,
				"role":         role,
				"amount":       amount,
				"chama_id":     chamaID,
				"requester_id": borrowerID,
			}
			out = append(out, map[string]interface{}{
				"id":         role + "_req_" + recordID,
				"user_id":    userID,
				"title":      title,
				"message":    msg(borrower, amount, chamaName),
				"type":       notifType,
				"is_read":    false,
				"isRead":     false,
				"createdAt":  createdAt,
				"created_at": createdAt,
				"source":     "loan_backing",
				"data":       data,
			})
		}
	}

	collect(`
		SELECT g.id, g.loan_id, g.created_at, l.amount, l.borrower_id, l.chama_id,
		       COALESCE(u.first_name, ''), COALESCE(u.last_name, ''), COALESCE(c.name, 'a chama')
		FROM guarantors g
		JOIN loans l ON l.id = g.loan_id
		LEFT JOIN users u ON u.id = l.borrower_id
		LEFT JOIN chamas c ON c.id = l.chama_id
		WHERE g.user_id = $1 AND lower(g.status) = 'pending'
		ORDER BY g.created_at DESC
	`, "guarantor", "guarantor_id", "guarantor_request", "Guarantor Request",
		func(b string, a float64, ch string) string {
			return fmt.Sprintf("%s has asked you to guarantee a loan of KES %.2f in %s.", b, a, ch)
		})

	// loan_referees may not exist on a very old schema — collect() swallows the error.
	collect(`
		SELECT r.id, r.loan_id, r.created_at, l.amount, l.borrower_id, l.chama_id,
		       COALESCE(u.first_name, ''), COALESCE(u.last_name, ''), COALESCE(c.name, 'a chama')
		FROM loan_referees r
		JOIN loans l ON l.id = r.loan_id
		LEFT JOIN users u ON u.id = l.borrower_id
		LEFT JOIN chamas c ON c.id = l.chama_id
		WHERE r.user_id = $1 AND lower(r.status) = 'pending'
		ORDER BY r.created_at DESC
	`, "referee", "referee_id", "referee_request", "Referee Request",
		func(b string, a float64, ch string) string {
			return fmt.Sprintf("%s has listed you as a referee for a loan of KES %.2f in %s. Being a referee carries no financial liability.", b, a, ch)
		})

	return out, nil
}

// getLoanNotifications retrieves loan-related notifications
func getLoanNotifications(db *sql.DB, userID string) ([]map[string]interface{}, error) {
	query := `
		SELECT
			l.id, l.chama_id, l.applicant_id, l.amount, l.purpose,
			l.status, l.created_at, l.approved_at, l.disbursed_at,
			c.name as chama_name,
			u.first_name as applicant_first_name, u.last_name as applicant_last_name
		FROM loans l
		INNER JOIN chamas c ON l.chama_id = c.id
		INNER JOIN users u ON l.applicant_id = u.id
		INNER JOIN chama_members cm ON c.id = cm.chama_id
		WHERE (cm.user_id = $1 OR l.applicant_id = $2) AND cm.is_active = true
		AND l.created_at > NOW() - INTERVAL '30 days'
		ORDER BY l.created_at DESC
	`

	rows, err := db.Query(query, userID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var notifications []map[string]interface{}
	for rows.Next() {
		var (
			id, chamaID, applicantID, purpose, status, createdAt string
			chamaName, applicantFirstName, applicantLastName     string
			amount                                               float64
			approvedAt, disbursedAt                              *string
		)

		err := rows.Scan(
			&id, &chamaID, &applicantID, &amount, &purpose,
			&status, &createdAt, &approvedAt, &disbursedAt,
			&chamaName, &applicantFirstName, &applicantLastName,
		)
		if err != nil {
			continue
		}

		applicantName := fmt.Sprintf("%s %s", applicantFirstName, applicantLastName)

		var notificationTitle, messageText, notificationType string

		if applicantID == userID {
			// Notifications for the loan applicant
			switch status {
			case "pending":
				notificationTitle = "Loan Application Submitted"
				messageText = fmt.Sprintf("Your loan application for KES %.2f in %s is under review", amount, chamaName)
				notificationType = "loan_application_submitted"
			case "approved":
				notificationTitle = "Loan Application Approved"
				messageText = fmt.Sprintf("Your loan application for KES %.2f in %s has been approved", amount, chamaName)
				notificationType = "loan_approved"
			case "disbursed":
				notificationTitle = "Loan Disbursed"
				messageText = fmt.Sprintf("Your loan of KES %.2f from %s has been disbursed", amount, chamaName)
				notificationType = "loan_disbursed"
			case "rejected":
				notificationTitle = "Loan Application Rejected"
				messageText = fmt.Sprintf("Your loan application for KES %.2f in %s was rejected", amount, chamaName)
				notificationType = "loan_rejected"
			default:
				continue
			}
		} else {
			// Notifications for other chama members
			switch status {
			case "pending":
				notificationTitle = "New Loan Application"
				messageText = fmt.Sprintf("%s applied for a loan of KES %.2f in %s", applicantName, amount, chamaName)
				notificationType = "loan_application_new"
			case "approved":
				notificationTitle = "Loan Application Approved"
				messageText = fmt.Sprintf("%s's loan application for KES %.2f in %s was approved", applicantName, amount, chamaName)
				notificationType = "loan_approved_member"
			default:
				continue
			}
		}

		notificationMap := map[string]interface{}{
			"id":        fmt.Sprintf("loan_%s", id),
			"userId":    userID,
			"title":     notificationTitle,
			"message":   messageText,
			"type":      notificationType,
			"isRead":    false,
			"createdAt": createdAt,
			"source":    "loan",
			"data": map[string]interface{}{
				"loanId":        id,
				"chamaId":       chamaID,
				"chamaName":     chamaName,
				"applicantName": applicantName,
				"amount":        amount,
				"purpose":       purpose,
				"status":        status,
				"approvedAt":    approvedAt,
				"disbursedAt":   disbursedAt,
			},
		}

		notifications = append(notifications, notificationMap)
	}

	return notifications, nil
}

// getWelfareNotifications retrieves welfare-related notifications
func getWelfareNotifications(db *sql.DB, userID string) ([]map[string]interface{}, error) {
	query := `
		SELECT
			wr.id, wr.chama_id, wr.beneficiary_id, wr.amount, wr.reason,
			wr.status, wr.created_at, wr.approved_at,
			c.name as chama_name,
			u.first_name as beneficiary_first_name, u.last_name as beneficiary_last_name,
			creator.first_name as creator_first_name, creator.last_name as creator_last_name
		FROM welfare_requests wr
		INNER JOIN chamas c ON wr.chama_id = c.id
		INNER JOIN users u ON wr.beneficiary_id = u.id
		INNER JOIN users creator ON wr.created_by = creator.id
		INNER JOIN chama_members cm ON c.id = cm.chama_id
		WHERE (cm.user_id = $1 OR wr.beneficiary_id = $2 OR wr.created_by = $3) AND cm.is_active = true
		AND wr.created_at > NOW() - INTERVAL '30 days'
		ORDER BY wr.created_at DESC
	`

	rows, err := db.Query(query, userID, userID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var notifications []map[string]interface{}
	for rows.Next() {
		var (
			id, chamaID, beneficiaryID, reason, status, createdAt string
			chamaName, beneficiaryFirstName, beneficiaryLastName  string
			creatorFirstName, creatorLastName                     string
			amount                                                float64
			approvedAt                                            *string
		)

		err := rows.Scan(
			&id, &chamaID, &beneficiaryID, &amount, &reason,
			&status, &createdAt, &approvedAt,
			&chamaName, &beneficiaryFirstName, &beneficiaryLastName,
			&creatorFirstName, &creatorLastName,
		)
		if err != nil {
			continue
		}

		beneficiaryName := fmt.Sprintf("%s %s", beneficiaryFirstName, beneficiaryLastName)
		creatorName := fmt.Sprintf("%s %s", creatorFirstName, creatorLastName)

		var notificationTitle, messageText, notificationType string

		if beneficiaryID == userID {
			// Notifications for the beneficiary
			switch status {
			case "pending":
				notificationTitle = "Welfare Request Created"
				messageText = fmt.Sprintf("A welfare request for KES %.2f has been created for you in %s", amount, chamaName)
				notificationType = "welfare_request_created"
			case "approved":
				notificationTitle = "Welfare Request Approved"
				messageText = fmt.Sprintf("Your welfare request for KES %.2f in %s has been approved", amount, chamaName)
				notificationType = "welfare_approved"
			case "rejected":
				notificationTitle = "Welfare Request Rejected"
				messageText = fmt.Sprintf("Your welfare request for KES %.2f in %s was rejected", amount, chamaName)
				notificationType = "welfare_rejected"
			default:
				continue
			}
		} else {
			// Notifications for other chama members
			switch status {
			case "pending":
				notificationTitle = "New Welfare Request"
				messageText = fmt.Sprintf("%s created a welfare request for %s (KES %.2f) in %s", creatorName, beneficiaryName, amount, chamaName)
				notificationType = "welfare_request_new"
			case "approved":
				notificationTitle = "Welfare Request Approved"
				messageText = fmt.Sprintf("Welfare request for %s (KES %.2f) in %s was approved", beneficiaryName, amount, chamaName)
				notificationType = "welfare_approved_member"
			default:
				continue
			}
		}

		notificationMap := map[string]interface{}{
			"id":        fmt.Sprintf("welfare_%s", id),
			"userId":    userID,
			"title":     notificationTitle,
			"message":   messageText,
			"type":      notificationType,
			"isRead":    false,
			"createdAt": createdAt,
			"source":    "welfare",
			"data": map[string]interface{}{
				"welfareId":       id,
				"chamaId":         chamaID,
				"chamaName":       chamaName,
				"beneficiaryName": beneficiaryName,
				"creatorName":     creatorName,
				"amount":          amount,
				"reason":          reason,
				"status":          status,
				"approvedAt":      approvedAt,
			},
		}

		notifications = append(notifications, notificationMap)
	}

	return notifications, nil
}

// getTransactionNotifications retrieves transaction-related notifications
func getTransactionNotifications(db *sql.DB, userID string) ([]map[string]interface{}, error) {
	query := `
		SELECT
			t.id, t.chama_id, t.user_id, t.amount, t.type, t.description,
			t.status, t.created_at,
			c.name as chama_name,
			u.first_name as user_first_name, u.last_name as user_last_name
		FROM transactions t
		INNER JOIN chamas c ON t.chama_id = c.id
		INNER JOIN users u ON t.user_id = u.id
		INNER JOIN chama_members cm ON c.id = cm.chama_id
		WHERE cm.user_id = $1 AND cm.is_active = true
		AND t.created_at > NOW() - INTERVAL '7 days'
		AND t.type IN ('contribution', 'welfare_contribution', 'loan_payment')
		ORDER BY t.created_at DESC
	`

	rows, err := db.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var notifications []map[string]interface{}
	for rows.Next() {
		var (
			id, chamaID, transactionUserID, transactionType, status, createdAt string
			chamaName, userFirstName, userLastName                             string
			amount                                                             float64
			description                                                        *string
		)

		err := rows.Scan(
			&id, &chamaID, &transactionUserID, &amount, &transactionType, &description,
			&status, &createdAt,
			&chamaName, &userFirstName, &userLastName,
		)
		if err != nil {
			continue
		}

		userName := fmt.Sprintf("%s %s", userFirstName, userLastName)

		var notificationTitle, messageText, notificationType string

		if transactionUserID == userID {
			// Notifications for the transaction creator
			switch transactionType {
			case "contribution":
				notificationTitle = "Contribution Recorded"
				messageText = fmt.Sprintf("Your contribution of KES %.2f to %s has been recorded", amount, chamaName)
				notificationType = "contribution_recorded"
			case "welfare_contribution":
				notificationTitle = "Welfare Contribution Recorded"
				messageText = fmt.Sprintf("Your welfare contribution of KES %.2f to %s has been recorded", amount, chamaName)
				notificationType = "welfare_contribution_recorded"
			case "loan_payment":
				notificationTitle = "Loan Payment Recorded"
				messageText = fmt.Sprintf("Your loan payment of KES %.2f to %s has been recorded", amount, chamaName)
				notificationType = "loan_payment_recorded"
			default:
				continue
			}
		} else {
			// Notifications for other chama members (only for significant transactions)
			if amount >= 1000 { // Only notify for transactions >= 1000 KES
				switch transactionType {
				case "contribution":
					notificationTitle = "Member Contribution"
					messageText = fmt.Sprintf("%s made a contribution of KES %.2f to %s", userName, amount, chamaName)
					notificationType = "member_contribution"
				case "welfare_contribution":
					notificationTitle = "Welfare Contribution"
					messageText = fmt.Sprintf("%s made a welfare contribution of KES %.2f to %s", userName, amount, chamaName)
					notificationType = "member_welfare_contribution"
				default:
					continue
				}
			} else {
				continue
			}
		}

		notificationMap := map[string]interface{}{
			"id":        fmt.Sprintf("transaction_%s", id),
			"userId":    userID,
			"title":     notificationTitle,
			"message":   messageText,
			"type":      notificationType,
			"isRead":    false,
			"createdAt": createdAt,
			"source":    "transaction",
			"data": map[string]interface{}{
				"transactionId":   id,
				"chamaId":         chamaID,
				"chamaName":       chamaName,
				"userName":        userName,
				"amount":          amount,
				"transactionType": transactionType,
				"description":     description,
				"status":          status,
			},
		}

		notifications = append(notifications, notificationMap)
	}

	return notifications, nil
}

// getChamaActivityNotifications retrieves chama activity notifications (member joins, role changes, etc.)
func getChamaActivityNotifications(db *sql.DB, userID string) ([]map[string]interface{}, error) {
	query := `
		SELECT
			cm.id, cm.chama_id, cm.user_id, cm.role, cm.joined_at,
			c.name as chama_name,
			u.first_name as user_first_name, u.last_name as user_last_name
		FROM chama_members cm
		INNER JOIN chamas c ON cm.chama_id = c.id
		INNER JOIN users u ON cm.user_id = u.id
		INNER JOIN chama_members my_membership ON c.id = my_membership.chama_id
		WHERE my_membership.user_id = $1 AND my_membership.is_active = true
		AND cm.user_id != $2 -- Don't notify about own activities
		AND cm.joined_at > NOW() - INTERVAL '7 days'
		AND cm.is_active = true
		ORDER BY cm.joined_at DESC
	`

	rows, err := db.Query(query, userID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var notifications []map[string]interface{}
	for rows.Next() {
		var (
			id, chamaID, memberUserID, role, joinedAt string
			chamaName, userFirstName, userLastName    string
		)

		err := rows.Scan(
			&id, &chamaID, &memberUserID, &role, &joinedAt,
			&chamaName, &userFirstName, &userLastName,
		)
		if err != nil {
			continue
		}

		userName := fmt.Sprintf("%s %s", userFirstName, userLastName)

		notificationTitle := "New Member Joined"
		messageText := fmt.Sprintf("%s joined %s", userName, chamaName)
		if role != "member" {
			messageText = fmt.Sprintf("%s joined %s as %s", userName, chamaName, role)
		}

		notificationMap := map[string]interface{}{
			"id":        fmt.Sprintf("chama_activity_%s", id),
			"userId":    userID,
			"title":     notificationTitle,
			"message":   messageText,
			"type":      "member_joined",
			"isRead":    false,
			"createdAt": joinedAt,
			"source":    "chama_activity",
			"data": map[string]interface{}{
				"chamaId":    chamaID,
				"chamaName":  chamaName,
				"memberName": userName,
				"memberRole": role,
				"joinedAt":   joinedAt,
			},
		}

		notifications = append(notifications, notificationMap)
	}

	return notifications, nil
}

// getSupportRequestNotifications retrieves support request related notifications
func getSupportRequestNotifications(db *sql.DB, userID string) ([]map[string]interface{}, error) {
	var notifications []map[string]interface{}

	// Get user role to determine what notifications to show
	var userRole string
	err := db.QueryRow("SELECT role FROM users WHERE id = $1", userID).Scan(&userRole)
	if err != nil {
		return notifications, err
	}

	if userRole == "admin" {
		// Admins get notifications about new support requests
		query := `
			SELECT
				sr.id, sr.user_id, sr.category, sr.subject, sr.priority, sr.created_at,
				u.first_name, u.last_name, u.email
			FROM support_requests sr
			LEFT JOIN users u ON sr.user_id = u.id
			WHERE sr.created_at >= NOW() - INTERVAL '7 days'
			AND sr.status = 'open'
			ORDER BY sr.created_at DESC
		`

		rows, err := db.Query(query)
		if err != nil {
			return notifications, err
		}
		defer rows.Close()

		for rows.Next() {
			var requestID, requestUserID, category, subject, priority, createdAt string
			var firstName, lastName, email *string

			err := rows.Scan(&requestID, &requestUserID, &category, &subject, &priority, &createdAt, &firstName, &lastName, &email)
			if err != nil {
				continue
			}

			// Create virtual notification ID
			notificationID := fmt.Sprintf("support_new_%s", requestID)

			userName := "Unknown User"
			if firstName != nil && lastName != nil {
				userName = fmt.Sprintf("%s %s", *firstName, *lastName)
			} else if email != nil {
				userName = *email
			}

			notification := map[string]interface{}{
				"id":         notificationID,
				"type":       "new_support_request",
				"title":      "New Support Request",
				"message":    fmt.Sprintf("New %s support request from %s: %s", category, userName, subject),
				"data":       fmt.Sprintf(`{"supportRequestId": "%s", "category": "%s", "priority": "%s"}`, requestID, category, priority),
				"is_read":    false,
				"created_at": createdAt,
				"user_id":    userID,
				"is_virtual": true,
			}

			notifications = append(notifications, notification)
		}
	} else {
		// Regular users get notifications about updates to their support requests
		query := `
			SELECT
				sr.id, sr.category, sr.subject, sr.description, sr.status, sr.priority,
				sr.updated_at, sr.admin_notes, sr.created_at
			FROM support_requests sr
			WHERE sr.user_id = $1
			AND sr.updated_at >= NOW() - INTERVAL '30 days'
			AND sr.status != 'open'
			ORDER BY sr.updated_at DESC
		`

		rows, err := db.Query(query, userID)
		if err != nil {
			return notifications, err
		}
		defer rows.Close()

		for rows.Next() {
			var requestID, category, subject, description, status, priority, updatedAt, createdAt string
			var adminNotes *string

			err := rows.Scan(&requestID, &category, &subject, &description, &status, &priority, &updatedAt, &adminNotes, &createdAt)
			if err != nil {
				continue
			}

			// Create virtual notification ID
			notificationID := fmt.Sprintf("support_update_%s_%s", requestID, status)

			// Create detailed status message
			statusMessage := getStatusDisplayText(status)

			// Create comprehensive message with status and details
			message := fmt.Sprintf("Your %s support request has been %s", category, statusMessage)

			// Add subject for context
			if subject != "" {
				message += fmt.Sprintf("\n\nSubject: %s", subject)
			}

			// Add current status
			message += fmt.Sprintf("\nStatus: %s", strings.ToUpper(status))

			// Add admin notes if available
			if adminNotes != nil && *adminNotes != "" && *adminNotes != "Status updated to "+status+" via quick action" {
				message += fmt.Sprintf("\n\nAdmin Response: %s", *adminNotes)
			}

			// Add priority if high or urgent
			if priority == "high" || priority == "urgent" {
				message += fmt.Sprintf("\nPriority: %s", strings.ToUpper(priority))
			}

			notification := map[string]interface{}{
				"id":         notificationID,
				"type":       "support_update",
				"title":      fmt.Sprintf("Support Request %s", strings.Title(statusMessage)),
				"message":    message,
				"data":       fmt.Sprintf(`{"supportRequestId": "%s", "status": "%s", "category": "%s", "priority": "%s", "subject": "%s"}`, requestID, status, category, priority, subject),
				"is_read":    false,
				"created_at": updatedAt,
				"user_id":    userID,
				"is_virtual": true,
			}

			notifications = append(notifications, notification)
		}
	}

	return notifications, nil
}
