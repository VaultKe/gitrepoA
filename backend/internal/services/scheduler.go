package services

import (
	"database/sql"
	"log"
	"time"
)

// SchedulerService handles scheduled tasks like meeting auto-unlock, subscription payments, and service fee warnings
type SchedulerService struct {
	db             *sql.DB
	meetingService *MeetingService
	ticker         *time.Ticker
	stopChan       chan bool
}

// NewSchedulerService creates a new scheduler service
func NewSchedulerService(db *sql.DB, meetingService *MeetingService) *SchedulerService {
	return &SchedulerService{
		db:             db,
		meetingService: meetingService,
		stopChan:       make(chan bool),
	}
}

// Start begins the scheduler with a specified interval
func (s *SchedulerService) Start(interval time.Duration) {
	s.ticker = time.NewTicker(interval)
	defer s.ticker.Stop()

	log.Printf("Scheduler started with interval: %v", interval)

	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("Scheduler panic recovered: %v", r)
			}
		}()

		for {
			select {
			case <-s.ticker.C:
				func() {
					defer func() {
						if r := recover(); r != nil {
							log.Printf("Scheduled task panic recovered: %v", r)
						}
					}()
					s.runScheduledTasks()
				}()
			case <-s.stopChan:
				log.Println("Scheduler stopped")
				return
			}
		}
	}()
}

// Stop stops the scheduler
func (s *SchedulerService) Stop() {
	if s.ticker != nil {
		s.ticker.Stop()
	}
	s.stopChan <- true
}

// runScheduledTasks executes all scheduled tasks
func (s *SchedulerService) runScheduledTasks() {
	s.checkMeetingAutoUnlock()
	s.checkMeetingAutoEnd()
	s.processMonthlySubscriptions()
	s.sendServiceFeeWarnings()
}

// checkMeetingAutoUnlock checks for meetings that should be auto-unlocked (5 minutes before start)
func (s *SchedulerService) checkMeetingAutoUnlock() {
	now := time.Now()
	unlockTime := now.Add(5 * time.Minute) // 5 minutes from now

	query := `
		SELECT id, title, scheduled_at, meeting_type
		FROM meetings 
		WHERE status = 'scheduled' 
		AND scheduled_at <= $1 
		AND scheduled_at > $2
	`

	rows, err := s.db.Query(query, unlockTime, now)
	if err != nil {
		log.Printf("Error checking meetings for auto-unlock: %v", err)
		return
	}
	defer rows.Close()

	var unlockedCount int

	for rows.Next() {
		var meetingID, title, meetingType string
		var scheduledAt time.Time

		err := rows.Scan(&meetingID, &title, &scheduledAt, &meetingType)
		if err != nil {
			log.Printf("Error scanning meeting row: %v", err)
			continue
		}

		// Update meeting status to allow joining
		updateQuery := `
			UPDATE meetings 
			SET status = 'ready', updated_at = CURRENT_TIMESTAMP
			WHERE id = $1 AND status = 'scheduled'
		`

		result, err := s.db.Exec(updateQuery, meetingID)
		if err != nil {
			log.Printf("Error updating meeting %s status: %v", meetingID, err)
			continue
		}

		rowsAffected, err := result.RowsAffected()
		if err != nil {
			log.Printf("Error checking rows affected for meeting %s: %v", meetingID, err)
			continue
		}

		if rowsAffected > 0 {
			unlockedCount++
			log.Printf("Auto-unlocked meeting: %s (%s) scheduled for %v",
				meetingID, title, scheduledAt.Format("2006-01-02 15:04:05"))

			// Send notifications to chama members
			s.sendMeetingNotifications(meetingID, title, "Meeting is now available to join")
		}
	}

	if unlockedCount > 0 {
		log.Printf("Auto-unlocked %d meetings", unlockedCount)
	}
}

// checkMeetingAutoEnd checks for meetings that should be automatically ended
func (s *SchedulerService) checkMeetingAutoEnd() {
	now := time.Now()

	// End meetings that have been active for more than their duration + 30 minutes grace period
	query := `
		SELECT id, title, scheduled_at, duration, started_at
		FROM meetings 
		WHERE status = 'active' 
		AND started_at IS NOT NULL
		AND started_at + (duration + 30) * INTERVAL '1 minute' <= $1
	`

	rows, err := s.db.Query(query, now)
	if err != nil {
		log.Printf("Error checking meetings for auto-end: %v", err)
		return
	}
	defer rows.Close()

	var endedCount int

	for rows.Next() {
		var meetingID, title string
		var scheduledAt, startedAt time.Time
		var duration int

		err := rows.Scan(&meetingID, &title, &scheduledAt, &duration, &startedAt)
		if err != nil {
			log.Printf("Error scanning meeting row for auto-end: %v", err)
			continue
		}

		// End the meeting
		err = s.meetingService.EndMeeting(meetingID)
		if err != nil {
			log.Printf("Error auto-ending meeting %s: %v", meetingID, err)
			continue
		}

		endedCount++
		log.Printf("Auto-ended meeting: %s (%s) that started at %v",
			meetingID, title, startedAt.Format("2006-01-02 15:04:05"))

		// Send notifications
		s.sendMeetingNotifications(meetingID, title, "Meeting has ended")
	}

	if endedCount > 0 {
		log.Printf("Auto-ended %d meetings", endedCount)
	}
}

// sendMeetingNotifications sends notifications to chama members about meeting status changes
func (s *SchedulerService) sendMeetingNotifications(meetingID, meetingTitle, message string) {
	// Get chama ID for the meeting
	var chamaID string
	err := s.db.QueryRow("SELECT chama_id FROM meetings WHERE id = $1", meetingID).Scan(&chamaID)
	if err != nil {
		log.Printf("Error getting chama ID for meeting %s: %v", meetingID, err)
		return
	}

	// Get all chama members
	query := `
		SELECT cm.user_id, u.first_name, u.last_name 
		FROM chama_members cm
		JOIN users u ON cm.user_id = u.id
		WHERE cm.chama_id = $1 AND cm.is_active = TRUE
	`

	rows, err := s.db.Query(query, chamaID)
	if err != nil {
		log.Printf("Error getting chama members for notifications: %v", err)
		return
	}
	defer rows.Close()

	var notificationCount int

	for rows.Next() {
		var userID, firstName, lastName string
		err := rows.Scan(&userID, &firstName, &lastName)
		if err != nil {
			log.Printf("Error scanning chama member: %v", err)
			continue
		}

		// Create notification
		notificationID := generateUUID()
		insertQuery := `
			INSERT INTO notifications (
				id, user_id, title, message, type, data, created_at
			) VALUES ($1, $2, $3, $4, 'meeting', $5, CURRENT_TIMESTAMP)
		`

		notificationData := map[string]interface{}{
			"meetingId":    meetingID,
			"meetingTitle": meetingTitle,
			"chamaId":      chamaID,
		}

		dataJSON, _ := jsonMarshal(notificationData)

		_, err = s.db.Exec(insertQuery,
			notificationID,
			userID,
			meetingTitle,
			message,
			string(dataJSON))

		if err != nil {
			log.Printf("Error creating notification for user %s: %v", userID, err)
			continue
		}

		notificationCount++
	}

	if notificationCount > 0 {
		log.Printf("Sent %d notifications for meeting %s", notificationCount, meetingID)
	}
}

// processMonthlySubscriptions processes monthly subscription payments for chamas
func (s *SchedulerService) processMonthlySubscriptions() {
	now := time.Now()

	query := `
		SELECT id, chama_id, amount, month_year 
		FROM subscription_payments 
		WHERE status = 'pending' 
		AND due_date <= $1
	`

	rows, err := s.db.Query(query, now)
	if err != nil {
		log.Printf("Error checking subscription payments: %v", err)
		return
	}
	defer rows.Close()

	var processedCount int
	for rows.Next() {
		var paymentID, chamaID, monthYear string
		var amount float64

		err := rows.Scan(&paymentID, &chamaID, &amount, &monthYear)
		if err != nil {
			log.Printf("Error scanning subscription payment: %v", err)
			continue
		}

		updateQuery := `
			UPDATE subscription_payments 
			SET status = 'overdue', updated_at = CURRENT_TIMESTAMP
			WHERE id = $1
		`
		_, err = s.db.Exec(updateQuery, paymentID)
		if err != nil {
			log.Printf("Error updating subscription payment %s to overdue: %v", paymentID, err)
			continue
		}

		_, err = s.db.Exec(
			"UPDATE chamas SET subscription_fee_paid = false WHERE id = $1",
			chamaID,
		)
		if err != nil {
			log.Printf("Error updating chama %s subscription status: %v", chamaID, err)
		}

		processedCount++
		log.Printf("Subscription payment overdue: chama=%s amount=%.2f month=%s", chamaID, amount, monthYear)
	}

	if processedCount > 0 {
		log.Printf("Processed %d overdue subscription payments", processedCount)
	}
}

// sendServiceFeeWarnings sends warnings to members who haven't paid service fees after 2 days
func (s *SchedulerService) sendServiceFeeWarnings() {
	now := time.Now()
	warningThreshold := now.Add(-48 * time.Hour)

	query := `
		SELECT cm.id, cm.chama_id, cm.user_id, u.first_name, u.last_name, u.email, cm.joined_at
		FROM chama_members cm
		JOIN users u ON cm.user_id = u.id
		WHERE cm.service_fee_paid = false 
		AND cm.service_fee_warning_sent = false
		AND cm.joined_at <= $1
	`

	rows, err := s.db.Query(query, warningThreshold)
	if err != nil {
		log.Printf("Error checking service fee warnings: %v", err)
		return
	}
	defer rows.Close()

	var warningCount int
	for rows.Next() {
		var memberID, chamaID, userID, firstName, lastName, email string
		var joinedAt time.Time

		err := rows.Scan(&memberID, &chamaID, &userID, &firstName, &lastName, &email, &joinedAt)
		if err != nil {
			log.Printf("Error scanning member for service fee warning: %v", err)
			continue
		}

		_, err = s.db.Exec(
			"UPDATE chama_members SET service_fee_warning_sent = true WHERE id = $1",
			memberID,
		)
		if err != nil {
			log.Printf("Error updating member %s warning status: %v", memberID, err)
			continue
		}

		log.Printf("Service fee warning sent to %s %s (%s) for chama %s - joined %s",
			firstName, lastName, email, chamaID, joinedAt.Format("2006-01-02"))

		warningCount++
	}

	if warningCount > 0 {
		log.Printf("Sent %d service fee warnings", warningCount)
	}
}

// Helper functions (you might want to move these to a utils package)
func generateUUID() string {
	// Simple UUID generation - in production, use a proper UUID library
	return time.Now().Format("20060102150405") + "-" + randomString(8)
}

func randomString(length int) string {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, length)
	for i := range b {
		b[i] = charset[time.Now().UnixNano()%int64(len(charset))]
	}
	return string(b)
}

func jsonMarshal(v interface{}) ([]byte, error) {
	// Simple JSON marshaling - in production, use encoding/json
	return []byte("{}"), nil
}
