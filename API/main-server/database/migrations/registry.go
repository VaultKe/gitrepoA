package migrations

import (
	"database/sql"
	"fmt"
)

func MigrateAll(db *sql.DB) error {
	if err := MigrateMisc(db); err != nil {
		return fmt.Errorf("misc: %w", err)
	}
	if err := MigrateCore(db); err != nil {
		return fmt.Errorf("core: %w", err)
	}
	if err := MigrateChamas(db); err != nil {
		return fmt.Errorf("chamas: %w", err)
	}
	if err := MigrateWallets(db); err != nil {
		return fmt.Errorf("wallets: %w", err)
	}
	if err := MigrateLoans(db); err != nil {
		return fmt.Errorf("loans: %w", err)
	}
	if err := MigrateWelfare(db); err != nil {
		return fmt.Errorf("welfare: %w", err)
	}
	if err := MigrateMerryGoRound(db); err != nil {
		return fmt.Errorf("merry_go_round: %w", err)
	}
	if err := MigrateSharesDividends(db); err != nil {
		return fmt.Errorf("shares_dividends: %w", err)
	}
	if err := MigrateChat(db); err != nil {
		return fmt.Errorf("chat: %w", err)
	}
	if err := MigrateChatPerformanceIndexes(db); err != nil {
		return fmt.Errorf("chat_perf: %w", err)
	}
	if err := MigrateMeetings(db); err != nil {
		return fmt.Errorf("meetings: %w", err)
	}
	if err := MigratePollsVotes(db); err != nil {
		return fmt.Errorf("polls_votes: %w", err)
	}
	if err := MigrateNotifications(db); err != nil {
		return fmt.Errorf("notifications: %w", err)
	}
	if err := MigrateDisbursements(db); err != nil {
		return fmt.Errorf("disbursements: %w", err)
	}
	if err := MigrateReminders(db); err != nil {
		return fmt.Errorf("reminders: %w", err)
	}
	if err := MigrateMerryGoRoundPayments(db); err != nil {
		return fmt.Errorf("merry_go_round_payments: %w", err)
	}
	if err := MigrateStatisticsIndexes(db); err != nil {
		return fmt.Errorf("statistics_indexes: %w", err)
	}
	return nil
}
