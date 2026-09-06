package services

import (
	"database/sql"
	"fmt"
	"log"
	"time"
)

// DeriveMeetingStatus answers what a meeting's status should read as *right
// now*, for a read handler to apply on top of whatever's in the database --
// a safety net for the window between two runs of the status ticker (up to
// ~30s either side of a meeting's actual start/end), not a replacement for
// it: the ticker is what makes this true in the database itself, which is
// what everything other than these handlers' own responses reads. A
// terminal dbStatus ('completed', 'cancelled', or any legacy 'ended') is
// never overridden -- once a meeting is explicitly over, time-based
// guessing has nothing useful to add.
func DeriveMeetingStatus(scheduledAt time.Time, durationMinutes int, dbStatus string) string {
	switch dbStatus {
	case "completed", "cancelled", "ended":
		return dbStatus
	}

	if durationMinutes <= 0 {
		durationMinutes = 60
	}
	now := time.Now()
	end := scheduledAt.Add(time.Duration(durationMinutes) * time.Minute)

	if !end.After(now) {
		return "completed"
	}
	if !scheduledAt.After(now) {
		return "ongoing"
	}
	return dbStatus
}

// UpdateMeetingStatuses is the single place that writes a meeting's status
// transition to the database on schedule: 'scheduled' -> 'ongoing' the
// instant its scheduled_at time arrives, and 'scheduled'/'ongoing' ->
// 'completed' the instant scheduled_at + duration elapses.
//
// Before this, nothing ever wrote a status transition to the meetings table
// at all: GetMeetings derived "completed" on the fly for its own response
// only (never "ongoing", and never persisted), GetUserMeetings returned the
// raw column with no derivation whatsoever, so the same meeting could show
// a different status depending on which endpoint answered -- and the
// database itself never reflected reality, which matters for anything that
// reads status directly (attendance, minutes eligibility, admin views).
//
// Entirely guarded by each query's WHERE clause, so this is safe to run on
// a ticker indefinitely and concurrently with any manual status change: a
// meeting a chairperson has already cancelled (or completed early) never
// matches either clause again and is left alone.
func UpdateMeetingStatuses(db *sql.DB) error {
	startedResult, err := db.Exec(`
		UPDATE meetings
		SET status = 'ongoing', started_at = COALESCE(started_at, NOW()), updated_at = NOW()
		WHERE status = 'scheduled'
		  AND scheduled_at <= NOW()
		  AND scheduled_at + (COALESCE(duration, 60) * INTERVAL '1 minute') > NOW()
	`)
	if err != nil {
		return fmt.Errorf("failed to mark meetings ongoing: %w", err)
	}

	endedResult, err := db.Exec(`
		UPDATE meetings
		SET status = 'completed', ended_at = COALESCE(ended_at, NOW()), updated_at = NOW()
		WHERE status IN ('scheduled', 'ongoing')
		  AND scheduled_at + (COALESCE(duration, 60) * INTERVAL '1 minute') <= NOW()
	`)
	if err != nil {
		return fmt.Errorf("failed to mark meetings completed: %w", err)
	}

	startedCount, _ := startedResult.RowsAffected()
	endedCount, _ := endedResult.RowsAffected()
	if startedCount > 0 || endedCount > 0 {
		log.Printf("[MeetingStatus] started=%d ended=%d", startedCount, endedCount)
	}
	return nil
}

// StartMeetingStatusTicker runs UpdateMeetingStatuses on a fixed interval for
// the lifetime of the process. 30s keeps a meeting's status accurate to
// within about that same window on either side of its actual start/end time
// without polling the table more often than matters.
func StartMeetingStatusTicker(db *sql.DB, interval time.Duration) {
	ticker := time.NewTicker(interval)
	go func() {
		for range ticker.C {
			if err := UpdateMeetingStatuses(db); err != nil {
				log.Printf("[MeetingStatus] update failed: %v", err)
			}
		}
	}()
}
