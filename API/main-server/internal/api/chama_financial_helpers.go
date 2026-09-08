package api

import (
	"database/sql"
	"fmt"
	"regexp"
	"strings"
	"time"

	"vaultke-backend/internal/models"
	"vaultke-backend/internal/services"
)

// notifyChamaOfficers sends a notification to every active secretary / treasurer
// / chairperson of a chama (skipping excludeUserID). Best-effort.
func notifyChamaOfficers(db *sql.DB, chamaID, excludeUserID, title, message, data string) {
	if db == nil || chamaID == "" {
		return
	}
	rows, err := db.Query(`
		SELECT user_id FROM chama_members
		WHERE chama_id = $1 AND lower(role) IN ('secretary','treasurer','chairperson')
		  AND COALESCE(is_active, true)
	`, chamaID)
	if err != nil {
		return
	}
	defer rows.Close()
	for rows.Next() {
		var uid string
		if rows.Scan(&uid) != nil || uid == "" || uid == excludeUserID {
			continue
		}
		nid := fmt.Sprintf("notif-%d", time.Now().UnixNano())
		_ = createNotification(db, nid, uid, "chama", title, message, data, "loan", nil)
	}
}

// disbursementOfficerRoles are the chama roles permitted to move chama funds.
var disbursementOfficerRoles = map[string]bool{
	"chairperson": true,
	"treasurer":   true,
	"secretary":   true,
	"admin":       true,
}

// requireActiveChamaOfficer verifies the caller is an active member of the chama
// holding a role permitted to authorise disbursements. Returns the caller's role.
// Every disbursement-creating handler must call this before touching money.
func requireActiveChamaOfficer(db *sql.DB, chamaID, userID string) (string, error) {
	if chamaID == "" || userID == "" {
		return "", fmt.Errorf("chama and user are required")
	}
	var role string
	err := db.QueryRow(`
		SELECT role FROM chama_members
		WHERE chama_id = $1 AND user_id = $2 AND is_active = true
	`, chamaID, userID).Scan(&role)
	if err != nil {
		if err == sql.ErrNoRows {
			return "", fmt.Errorf("you are not an active member of this chama")
		}
		return "", fmt.Errorf("failed to verify chama membership: %w", err)
	}
	if !disbursementOfficerRoles[role] {
		return "", fmt.Errorf("only the chairperson, treasurer or secretary can authorise disbursements")
	}
	return role, nil
}

// walletBalance returns the current balance of a wallet by id.
func walletBalance(db *sql.DB, walletID string) (float64, error) {
	var bal float64
	if err := db.QueryRow("SELECT balance FROM wallets WHERE id = $1", walletID).Scan(&bal); err != nil {
		return 0, fmt.Errorf("failed to read wallet balance: %w", err)
	}
	return bal, nil
}

// validateDisbursementAmount rejects non-positive amounts and amounts that exceed
// the funds actually available in the source subwallet.
func validateDisbursementAmount(db *sql.DB, sourceWalletID string, amount float64) error {
	if amount <= 0 {
		return fmt.Errorf("disbursement amount must be greater than zero")
	}
	bal, err := walletBalance(db, sourceWalletID)
	if err != nil {
		return err
	}
	if amount > bal+0.0001 {
		return fmt.Errorf("insufficient funds: source wallet holds KES %.2f, requested KES %.2f", bal, amount)
	}
	return nil
}

// LoanableFunds describes a chama's lending capacity at a moment in time.
type LoanableFunds struct {
	WalletBalance float64 `json:"walletBalance"` // combined total of every sub-wallet
	Welfare       float64 `json:"welfare"`       // restricted
	MerryGoRound  float64 `json:"merryGoRound"`  // restricted
	Reserved      float64 `json:"reserved"`      // approved-but-not-yet-disbursed loans
	Loanable      float64 `json:"loanable"`      // balance - welfare - MGR - reserved
}

// chamaLoanableFunds computes how much a chama can actually lend right now:
//
//	Loanable = ΣwalletBalances − Welfare − MerryGoRound − Reserved
//
// "Reserved" is the total principal of loans that are already approved but not
// yet disbursed, so two approved loans can never both see the same money.
// `excludeLoanID` (may be "") drops one loan from the reserved figure — used
// when re-checking that very loan's own disbursement.
func chamaLoanableFunds(db *sql.DB, chamaID, excludeLoanID string) (LoanableFunds, error) {
	var lf LoanableFunds
	if chamaID == "" {
		return lf, fmt.Errorf("chama is required")
	}

	if err := db.QueryRow(`
		SELECT
			COALESCE(SUM(balance), 0),
			COALESCE(SUM(CASE WHEN COALESCE(subwallet_type,'') IN ('welfare')                          THEN balance ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN COALESCE(subwallet_type,'') IN ('merry_go_round','merry-go-round')  THEN balance ELSE 0 END), 0)
		FROM wallets
		WHERE owner_id = $1 AND type = 'chama'
	`, chamaID).Scan(&lf.WalletBalance, &lf.Welfare, &lf.MerryGoRound); err != nil {
		return lf, fmt.Errorf("failed to read chama wallets: %w", err)
	}

	// Approved-but-undisbursed loan principal is committed money.
	if err := db.QueryRow(`
		SELECT COALESCE(SUM(COALESCE(NULLIF(amount,0), total_amount, 0)), 0)
		FROM loans
		WHERE chama_id = $1
		  AND disbursed_at IS NULL
		  AND id <> $2
		  AND (lower(COALESCE(approval_stage,'')) = 'fully_approved' OR lower(COALESCE(status,'')) IN ('approved','disbursing'))
		  AND lower(COALESCE(status,'')) NOT IN ('rejected','cancelled','completed')
	`, chamaID, excludeLoanID).Scan(&lf.Reserved); err != nil {
		return lf, fmt.Errorf("failed to read reserved loan funds: %w", err)
	}

	lf.Loanable = lf.WalletBalance - lf.Welfare - lf.MerryGoRound - lf.Reserved
	if lf.Loanable < 0 {
		lf.Loanable = 0
	}
	return lf, nil
}

// memberActiveShares returns the total active shares a member holds in a chama.
func memberActiveShares(db *sql.DB, chamaID, memberID string) (int, error) {
	var shares int
	err := db.QueryRow(`
		SELECT COALESCE(SUM(shares_owned), 0) FROM shares
		WHERE chama_id = $1 AND member_id = $2 AND status = 'active'
	`, chamaID, memberID).Scan(&shares)
	if err != nil {
		return 0, fmt.Errorf("failed to read member shareholding: %w", err)
	}
	return shares, nil
}

// transactionExists reports whether a transaction row with the given id is already
// present — used to make disbursement creation idempotent on the client-supplied
// transaction id so a retried request cannot pay twice.
func transactionExists(db *sql.DB, transactionID string) (bool, error) {
	if transactionID == "" {
		return false, nil
	}
	var exists bool
	err := db.QueryRow("SELECT EXISTS(SELECT 1 FROM transactions WHERE id = $1)", transactionID).Scan(&exists)
	return exists, err
}

// getDisbursementSourceWalletID resolves the chama subwallet that funds for a
// given disbursement category should be drawn from, validating it first.
func getDisbursementSourceWalletID(db *sql.DB, chamaID, category string) (string, error) {
	var subwalletType models.ChamaWalletType
	if category == "welfare" {
		subwalletType = models.ChamaWalletTypeWelfare
	} else if category == "merry_go_round" {
		subwalletType = models.ChamaWalletTypeMerryGo
	} else {
		return "", fmt.Errorf("unsupported disbursement category: %s", category)
	}

	sourceWalletID := fmt.Sprintf("wallet-%s-%s", chamaID, subwalletType)
	paybillService := services.NewPaybillTrackingService(db)
	if _, err := paybillService.ValidateDisbursementSource(sourceWalletID, chamaID); err != nil {
		return "", err
	}

	return sourceWalletID, nil
}

// normalizePhoneNumber converts a local phone number to the 254... format
// expected by M-Pesa B2C disbursements. It first strips any non-digit characters.
func normalizePhoneNumber(phone string) (string, error) {
	cleaned := regexp.MustCompile(`\D`).ReplaceAllString(phone, "")
	if cleaned == "" {
		return "", fmt.Errorf("invalid phone number format. must start with 254 or 07")
	}
	if strings.HasPrefix(cleaned, "07") || strings.HasPrefix(cleaned, "01") {
		return "254" + cleaned[1:], nil
	}
	if strings.HasPrefix(cleaned, "254") {
		return cleaned, nil
	}
	return "", fmt.Errorf("invalid phone number format. must start with 254 or 07")
}
