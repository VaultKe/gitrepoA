package services

import (
	"database/sql"
	"time"
)

// SchedulerService handles scheduled tasks like subscription payments and service fee warnings
type SchedulerService struct {
	db       *sql.DB
	ticker   *time.Ticker
	stopChan chan bool
}

// NewSchedulerService creates a new scheduler service
func NewSchedulerService(db *sql.DB) *SchedulerService {
	return &SchedulerService{
		db:       db,
		stopChan: make(chan bool),
	}
}

// Start begins the scheduler with a specified interval
func (s *SchedulerService) Start(interval time.Duration) {
	s.ticker = time.NewTicker(interval)
	defer s.ticker.Stop()

	for {
		select {
		case <-s.stopChan:
			return
		case <-s.ticker.C:
			// Physical meetings are scheduled as normal; no online meeting auto-unlock/end needed
			// Future: add subscription and service fee checks here
		}
	}
}

// Stop stops the scheduler
func (s *SchedulerService) Stop() {
	if s.stopChan != nil {
		close(s.stopChan)
	}
}
