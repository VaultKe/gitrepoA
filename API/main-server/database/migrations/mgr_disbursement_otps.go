package migrations

import (
	"database/sql"
	"fmt"
	"log"
)

// MigrateMerryGoRoundDisbursementOTPs creates the table backing the two-signature
// merry-go-round payout flow: the treasurer initiates a payout (which snapshots
// the amount actually collected for the round and e-mails a code to the
// chairperson) and the chairperson confirms with that code, at which point the
// B2C payment to the recipient's M-Pesa is fired immediately.
func MigrateMerryGoRoundDisbursementOTPs(db *sql.DB) error {
	if _, err := db.Exec(createMerryGoRoundDisbursementOTPsTable); err != nil {
		return fmt.Errorf("mgr_disbursement_otps migration failed: %w", err)
	}
	log.Println("Merry go round disbursement OTP migrations completed successfully")
	return nil
}

const createMerryGoRoundDisbursementOTPsTable = `
CREATE TABLE IF NOT EXISTS mgr_disbursement_otps (
    id TEXT PRIMARY KEY,
    merry_go_round_id TEXT NOT NULL,
    chama_id TEXT NOT NULL,
    round_number INTEGER NOT NULL,
    recipient_id TEXT NOT NULL,
    recipient_name TEXT,
    amount REAL NOT NULL DEFAULT 0,
    collected REAL NOT NULL DEFAULT 0,
    description TEXT,
    initiated_by TEXT NOT NULL,
    approver_id TEXT NOT NULL,
    otp TEXT NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    consumed BOOLEAN DEFAULT FALSE,
    transaction_id TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mgr_disb_otps_mgr ON mgr_disbursement_otps(merry_go_round_id);
CREATE INDEX IF NOT EXISTS idx_mgr_disb_otps_chama ON mgr_disbursement_otps(chama_id);
CREATE INDEX IF NOT EXISTS idx_mgr_disb_otps_open ON mgr_disbursement_otps(merry_go_round_id, round_number) WHERE consumed = FALSE;
`
