package migrations

import (
	"database/sql"
	"fmt"
	"log"
	"strings"
)

func MigrateLoans(db *sql.DB) error {
	queries := []string{
		createLoansTable,
		createGuarantorsTable,
		createLoanPaymentsTable,
		createLoanFinesTable,
		createLoanTypesTable,
		createLoanApprovalOTPsTable,
		"CREATE INDEX IF NOT EXISTS idx_loan_types_chama ON loan_types(chama_id)",
		"CREATE INDEX IF NOT EXISTS idx_loan_types_status ON loan_types(status)",
	}
	for _, q := range queries {
		if _, err := db.Exec(q); err != nil {
			return fmt.Errorf("loans migration failed: %w", err)
		}
	}

	if err := addLoanTypeIdColumn(db); err != nil {
		return err
	}
	if err := EnsureLoanTypesTable(db); err != nil {
		return err
	}
	if err := addLoanApprovalStagesColumns(db); err != nil {
		return err
	}
	if err := addLoanTypeProductColumns(db); err != nil {
		return err
	}

	log.Println("Loans migrations completed successfully")
	return nil
}

const createLoansTable = `
CREATE TABLE IF NOT EXISTS loans (
    id TEXT PRIMARY KEY,
    borrower_id TEXT NOT NULL,
    chama_id TEXT NOT NULL,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    interest_rate REAL DEFAULT 0,
    duration INTEGER NOT NULL,
    purpose TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    approved_by TEXT,
    approved_at TIMESTAMP,
    disbursed_at TIMESTAMP,
    due_date TIMESTAMP,
    total_amount REAL DEFAULT 0,
    paid_amount REAL DEFAULT 0,
    remaining_amount REAL DEFAULT 0,
    required_guarantors INTEGER NOT NULL,
    approved_guarantors INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (borrower_id) REFERENCES users(id),
    FOREIGN KEY (chama_id) REFERENCES chamas(id),
    FOREIGN KEY (approved_by) REFERENCES users(id)
);`

const createGuarantorsTable = `
CREATE TABLE IF NOT EXISTS guarantors (
    id TEXT PRIMARY KEY,
    loan_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    amount REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    message TEXT,
    responded_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (loan_id) REFERENCES loans(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(loan_id, user_id)
);`

const createLoanPaymentsTable = `
CREATE TABLE IF NOT EXISTS loan_payments (
    id TEXT PRIMARY KEY,
    loan_id TEXT NOT NULL,
    amount REAL NOT NULL,
    principal_amount REAL NOT NULL,
    interest_amount REAL NOT NULL,
    payment_method TEXT NOT NULL,
    reference TEXT,
    paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (loan_id) REFERENCES loans(id)
);`

const createLoanFinesTable = `
CREATE TABLE IF NOT EXISTS loan_fines (
    id TEXT PRIMARY KEY,
    loan_id TEXT NOT NULL,
    amount REAL NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (loan_id) REFERENCES loans(id)
);`

const createLoanTypesTable = `
CREATE TABLE IF NOT EXISTS loan_types (
    id TEXT PRIMARY KEY,
    chama_id TEXT NOT NULL REFERENCES chamas(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    max_amount NUMERIC NOT NULL,
    min_amount NUMERIC DEFAULT 0,
    interest_rate NUMERIC NOT NULL,
    term_months INTEGER NOT NULL,
    eligibility_criteria TEXT DEFAULT 'active_members',
    approval_required BOOLEAN DEFAULT TRUE,
    grace_period_days INTEGER DEFAULT 0,
    penalty_rate NUMERIC DEFAULT 0,
    max_loans_per_member INTEGER DEFAULT 1,
    requires_collateral BOOLEAN DEFAULT FALSE,
    collateral_description TEXT,
    net_disbursement NUMERIC DEFAULT 0,
    current_loans INTEGER DEFAULT 0,
    default_threshold_days INTEGER DEFAULT 30,
    installment_penalty_type TEXT DEFAULT 'fixed',
    installment_penalty_amount NUMERIC DEFAULT 0,
    loan_penalty_amount NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`

const createLoanApprovalOTPsTable = `
CREATE TABLE IF NOT EXISTS loan_approval_otps (
    id TEXT PRIMARY KEY,
    loan_id TEXT NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id),
    role TEXT NOT NULL,
    otp TEXT NOT NULL,
    comment TEXT,
    verified BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`

func addLoanTypeIdColumn(db *sql.DB) error {
	var exists bool
	query := `SELECT COUNT(*) > 0 FROM information_schema.columns WHERE table_name = 'loans' AND column_name = 'loan_type_id'`
	err := db.QueryRow(query).Scan(&exists)
	if err != nil {
		return fmt.Errorf("failed to check if loan_type_id column exists: %w", err)
	}
	if !exists {
		if _, err := db.Exec("ALTER TABLE loans ADD COLUMN loan_type_id TEXT REFERENCES loan_types(id)"); err != nil {
			return fmt.Errorf("failed to add loan_type_id column: %w", err)
		}
		log.Println("Added loan_type_id column to loans table")
	} else {
		log.Println("Column loan_type_id already exists in loans table")
	}
	return nil
}

func EnsureLoanTypesTable(db *sql.DB) error {
	queries := []string{
		"CREATE TABLE IF NOT EXISTS loan_types (id TEXT PRIMARY KEY, chama_id TEXT NOT NULL REFERENCES chamas(id) ON DELETE CASCADE, name TEXT NOT NULL, description TEXT, exact_amount NUMERIC NOT NULL DEFAULT 0, interest_rate NUMERIC NOT NULL, term_months INTEGER NOT NULL, eligibility_criteria TEXT DEFAULT 'active_members', approval_required BOOLEAN DEFAULT TRUE, grace_period_days INTEGER DEFAULT 0, penalty_rate NUMERIC DEFAULT 0, max_loans_per_member INTEGER DEFAULT 1, requires_collateral BOOLEAN DEFAULT FALSE, requires_guarantors BOOLEAN DEFAULT FALSE, collateral_description TEXT, net_disbursement NUMERIC DEFAULT 0, current_loans INTEGER DEFAULT 0, default_threshold_days INTEGER DEFAULT 30, installment_penalty_type TEXT DEFAULT 'fixed', installment_penalty_amount NUMERIC DEFAULT 0, loan_penalty_amount NUMERIC DEFAULT 0, status TEXT DEFAULT 'active', created_by TEXT NOT NULL REFERENCES users(id), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
		"CREATE INDEX IF NOT EXISTS idx_loan_types_chama ON loan_types(chama_id)",
		"CREATE INDEX IF NOT EXISTS idx_loan_types_status ON loan_types(status)",
	}
	for _, q := range queries {
		if _, err := db.Exec(q); err != nil {
			return fmt.Errorf("failed to create loan_types table/index: %w", err)
		}
	}
	log.Println("loan_types schema ready")
	return nil
}

func addLoanTypeProductColumns(db *sql.DB) error {
	columns := []string{
		"net_disbursement",
		"current_loans",
		"default_threshold_days",
		"installment_penalty_type",
		"installment_penalty_amount",
		"loan_penalty_amount",
		"requires_guarantors",
		"exact_amount",
	}
	for _, col := range columns {
		var exists bool
		query := fmt.Sprintf("SELECT COUNT(*) > 0 FROM information_schema.columns WHERE table_name = 'loan_types' AND column_name = '%s'", col)
		if err := db.QueryRow(query).Scan(&exists); err != nil {
			return fmt.Errorf("failed to check if %s column exists: %w", col, err)
		}
		if !exists {
			if _, err := db.Exec("ALTER TABLE loan_types ADD COLUMN " + col + " TEXT DEFAULT '0'"); err != nil {
				return fmt.Errorf("failed to add %s column: %w", col, err)
			}
			log.Printf("Added %s column to loan_types table", col)
		}
	}
	return nil
}

func addLoanApprovalStagesColumns(db *sql.DB) error {
	columns := []string{
		"secretary_approved_by TEXT",
		"secretary_approved_at TIMESTAMP",
		"secretary_comment TEXT",
		"treasurer_approved_by TEXT",
		"treasurer_approved_at TIMESTAMP",
		"treasurer_comment TEXT",
		"chairperson_approved_by TEXT",
		"chairperson_approved_at TIMESTAMP",
		"chairperson_comment TEXT",
		"approval_stage TEXT DEFAULT 'pending'",
		"rejected_by TEXT",
		"rejected_reason TEXT",
		"rejected_at TIMESTAMP",
	}

	for _, col := range columns {
		var exists bool
		colName := col[:strings.Index(col, " ")]
		query := fmt.Sprintf("SELECT COUNT(*) > 0 FROM information_schema.columns WHERE table_name = 'loans' AND column_name = '%s'", colName)
		if err := db.QueryRow(query).Scan(&exists); err != nil {
			return fmt.Errorf("failed to check if %s column exists: %w", colName, err)
		}
		if !exists {
			if _, err := db.Exec("ALTER TABLE loans ADD COLUMN " + col); err != nil {
				return fmt.Errorf("failed to add %s column: %w", colName, err)
			}
			log.Printf("Added %s column to loans table", colName)
		}
	}

	// Add foreign keys for approval columns if they don't exist
	fks := []string{
		"FOREIGN KEY (secretary_approved_by) REFERENCES users(id)",
		"FOREIGN KEY (treasurer_approved_by) REFERENCES users(id)",
		"FOREIGN KEY (chairperson_approved_by) REFERENCES users(id)",
		"FOREIGN KEY (rejected_by) REFERENCES users(id)",
	}
	for _, fk := range fks {
		if _, err := db.Exec("ALTER TABLE loans ADD CONSTRAINT " + fk); err != nil {
			// Ignore if constraint already exists
			if !strings.Contains(err.Error(), "already exists") {
				log.Printf("Note: could not add constraint %s: %v", fk, err)
			}
		}
	}

	return nil
}
