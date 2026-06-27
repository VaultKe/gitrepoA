package migrations

import (
	"database/sql"
	"fmt"
	"log"
)

func MigrateDisbursements(db *sql.DB) error {
	queries := []string{
		createDisbursementTables,
	}
	for _, q := range queries {
		if _, err := db.Exec(q); err != nil {
			return fmt.Errorf("disbursements migration failed: %w", err)
		}
	}

	log.Println("Disbursements migrations completed successfully")
	return nil
}

const createDisbursementTables = `
-- Disbursement batches table (for mass distributions)
CREATE TABLE IF NOT EXISTS disbursement_batches (
    id TEXT PRIMARY KEY,
    chama_id TEXT NOT NULL,
    batch_type TEXT NOT NULL, -- 'dividend', 'shares', 'savings', 'loan'
    title TEXT NOT NULL,
    description TEXT,
    total_amount REAL NOT NULL,
    total_recipients INTEGER NOT NULL,
    initiated_by TEXT NOT NULL,
    approved_by TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'processing', 'completed', 'failed'
    approval_required BOOLEAN DEFAULT TRUE,
    scheduled_date TIMESTAMP,
    processed_date TIMESTAMP,
    metadata TEXT, -- JSON for batch-specific data
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chama_id) REFERENCES chamas(id) ON DELETE CASCADE,
    FOREIGN KEY (initiated_by) REFERENCES users(id),
    FOREIGN KEY (approved_by) REFERENCES users(id)
);

-- Individual disbursements table
CREATE TABLE IF NOT EXISTS disbursements (
    id TEXT PRIMARY KEY,
    batch_id TEXT,
    recipient_id TEXT NOT NULL,
    disbursement_type TEXT NOT NULL, -- 'dividend', 'share_redemption', 'savings_withdrawal', 'loan_disbursement', 'shares', 'savings_withdrawal', 'other'
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'KES',
    payment_method TEXT NOT NULL, -- 'bank_transfer', 'mobile_money', 'cash'
    account_details TEXT, -- JSON with payment details
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    transaction_reference TEXT,
    processed_date TIMESTAMP,
    failure_reason TEXT,
    retry_count INTEGER DEFAULT 0,
    metadata TEXT, -- JSON for disbursement-specific data
    chama_id TEXT NOT NULL,
    initiated_by TEXT NOT NULL,
    initiated_by_id TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    transaction_id TEXT NOT NULL,
    security_hash TEXT NOT NULL,
    purpose TEXT,
    private_note TEXT,
    from_account TEXT,
    to_account TEXT,
    member_name TEXT,
    member_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES disbursement_batches(id) ON DELETE CASCADE,
    FOREIGN KEY (recipient_id) REFERENCES users(id),
    FOREIGN KEY (chama_id) REFERENCES chamas(id) ON DELETE CASCADE,
    FOREIGN KEY (initiated_by_id) REFERENCES users(id)
);

-- Bulk disbursements table for dividends
CREATE TABLE IF NOT EXISTS bulk_disbursements (
    id TEXT PRIMARY KEY,
    chama_id TEXT NOT NULL,
    type TEXT NOT NULL,
    category TEXT NOT NULL,
    dividend_per_share REAL,
    total_amount REAL NOT NULL,
    description TEXT,
    from_account TEXT NOT NULL,
    initiated_by TEXT NOT NULL,
    initiated_by_id TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    status TEXT NOT NULL,
    transaction_id TEXT NOT NULL,
    security_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chama_id) REFERENCES chamas(id) ON DELETE CASCADE,
    FOREIGN KEY (initiated_by_id) REFERENCES users(id)
);

-- Dividends table for individual dividend payments
CREATE TABLE IF NOT EXISTS dividends (
    id TEXT PRIMARY KEY,
    bulk_disbursement_id TEXT,
    chama_id TEXT NOT NULL,
    member_id TEXT NOT NULL,
    member_name TEXT NOT NULL,
    shares_owned INTEGER NOT NULL,
    dividend_per_share REAL NOT NULL,
    amount REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bulk_disbursement_id) REFERENCES bulk_disbursements(id) ON DELETE CASCADE,
    FOREIGN KEY (chama_id) REFERENCES chamas(id) ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES users(id)
);

-- Share offerings table
CREATE TABLE IF NOT EXISTS share_offerings (
    id TEXT PRIMARY KEY,
    chama_id TEXT NOT NULL,
    name TEXT NOT NULL,
    share_type TEXT NOT NULL,
    total_shares INTEGER NOT NULL,
    price_per_share REAL NOT NULL,
    minimum_purchase INTEGER DEFAULT 1,
    description TEXT,
    eligibility_criteria TEXT,
    approval_required BOOLEAN DEFAULT FALSE,
    total_value REAL NOT NULL,
    created_by TEXT NOT NULL,
    created_by_id TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    transaction_id TEXT NOT NULL,
    security_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chama_id) REFERENCES chamas(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by_id) REFERENCES users(id)
);

-- Financial transparency log table
CREATE TABLE IF NOT EXISTS financial_transparency_log (
    id TEXT PRIMARY KEY,
    chama_id TEXT NOT NULL,
    activity_type TEXT NOT NULL, -- 'disbursement', 'revenue', 'expense', 'contribution'
    title TEXT NOT NULL,
    description TEXT,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'KES',
    transaction_type TEXT NOT NULL, -- 'debit', 'credit'
    reference_id TEXT, -- Reference to related transaction/disbursement
    reference_type TEXT, -- 'disbursement_batch', 'transaction', 'contribution'
    performed_by TEXT NOT NULL,
    affected_members TEXT, -- JSON array of affected member IDs
    visibility TEXT NOT NULL DEFAULT 'all_members', -- 'all_members', 'officials_only'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chama_id) REFERENCES chamas(id) ON DELETE CASCADE,
    FOREIGN KEY (performed_by) REFERENCES users(id)
);

-- Reports and invoices table
CREATE TABLE IF NOT EXISTS financial_reports (
    id TEXT PRIMARY KEY,
    chama_id TEXT NOT NULL,
    report_type TEXT NOT NULL, -- 'monthly_statement', 'dividend_report', 'disbursement_report', 'transparency_report'
    title TEXT NOT NULL,
    description TEXT,
    report_period_start TIMESTAMP,
    report_period_end TIMESTAMP,
    generated_by TEXT NOT NULL,
    file_path TEXT, -- Path to generated PDF/document
    file_size INTEGER,
    status TEXT NOT NULL DEFAULT 'generating', -- 'generating', 'ready', 'failed'
    download_count INTEGER DEFAULT 0,
    is_public BOOLEAN DEFAULT FALSE,
    metadata TEXT, -- JSON for report-specific data
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chama_id) REFERENCES chamas(id) ON DELETE CASCADE,
    FOREIGN KEY (generated_by) REFERENCES users(id)
);`
