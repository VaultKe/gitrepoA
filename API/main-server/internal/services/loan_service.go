package services

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"

	"vaultke-backend/internal/models"
	"vaultke-backend/internal/utils"
)

// LoanService handles loan-related business logic
type LoanService struct {
	db *sql.DB
}

// NewLoanService creates a new loan service
func NewLoanService(db *sql.DB) *LoanService {
	return &LoanService{db: db}
}

// ApplyForLoan creates a new loan application
func (s *LoanService) ApplyForLoan(application *models.LoanApplication, borrowerID, chamaID string) (*models.Loan, error) {
	// Validate input
	if err := utils.ValidateStruct(application); err != nil {
		return nil, fmt.Errorf("validation error: %w", err)
	}

	// Check if user is a member of the chama
	chamaService := NewChamaService(s.db)
	isMember, err := chamaService.IsUserMember(chamaID, borrowerID)
	if err != nil {
		return nil, err
	}
	if !isMember {
		return nil, fmt.Errorf("user is not a member of this chama")
	}

	// Check if user has any active loans
	hasActiveLoan, err := s.hasActiveLoan(borrowerID, chamaID)
	if err != nil {
		return nil, err
	}
	if hasActiveLoan {
		return nil, fmt.Errorf("user already has an active loan in this chama")
	}

	// Create loan
	loan := &models.Loan{
		ID:                 uuid.New().String(),
		BorrowerID:         borrowerID,
		ChamaID:            chamaID,
		Type:               application.Type,
		Amount:             application.Amount,
		InterestRate:       0, // Will be set during approval
		Duration:           application.Duration,
		Purpose:            application.Purpose,
		Status:             models.LoanStatusPending,
		TotalAmount:        0, // Will be calculated during approval
		PaidAmount:         0,
		RemainingAmount:    0,
		RequiredGuarantors: application.RequiredGuarantors,
		ApprovedGuarantors: 0,
		CreatedAt:          time.Now(),
		UpdatedAt:          time.Now(),
	}

	// Start transaction
	tx, err := s.db.Begin()
	if err != nil {
		return nil, fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback()

	// Insert loan
	loanQuery := `
		INSERT INTO loans (
			id, borrower_id, chama_id, type, amount, interest_rate, duration,
			purpose, status, total_amount, paid_amount, remaining_amount,
			required_guarantors, approved_guarantors, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
	`

	_, err = tx.Exec(loanQuery,
		loan.ID, loan.BorrowerID, loan.ChamaID, loan.Type, loan.Amount,
		loan.InterestRate, loan.Duration, loan.Purpose, loan.Status,
		loan.TotalAmount, loan.PaidAmount, loan.RemainingAmount,
		loan.RequiredGuarantors, loan.ApprovedGuarantors,
		loan.CreatedAt, loan.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create loan: %w", err)
	}

	// Add guarantors
	for _, guarantorUserID := range application.GuarantorUserIDs {
		// Check if guarantor is a chama member
		isGuarantorMember, err := chamaService.IsUserMember(chamaID, guarantorUserID)
		if err != nil {
			return nil, err
		}
		if !isGuarantorMember {
			return nil, fmt.Errorf("guarantor %s is not a member of this chama", guarantorUserID)
		}

		guarantor := &models.Guarantor{
			ID:        uuid.New().String(),
			LoanID:    loan.ID,
			UserID:    guarantorUserID,
			Amount:    application.Amount / float64(len(application.GuarantorUserIDs)),
			Status:    models.GuarantorStatusPending,
			CreatedAt: time.Now(),
		}

		guarantorQuery := `
			INSERT INTO guarantors (id, loan_id, user_id, amount, status, created_at)
			VALUES ($1, $2, $3, $4, $5, $6)
		`

		_, err = tx.Exec(guarantorQuery,
			guarantor.ID, guarantor.LoanID, guarantor.UserID,
			guarantor.Amount, guarantor.Status, guarantor.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to add guarantor: %w", err)
		}
	}

	// Commit transaction
	if err = tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	// Send notifications to guarantors
	notificationService := NewNotificationService(s.db, nil)
	for _, guarantorUserID := range application.GuarantorUserIDs {
		go func(userID string) {
			title := "Loan Guarantee Request"
			message := fmt.Sprintf("You have been requested to guarantee a loan of KSh %.2f", application.Amount)
			data := map[string]interface{}{
				"type":   "loan_guarantee_request",
				"loanId": loan.ID,
				"amount": application.Amount,
			}
			notificationService.CreateNotification(userID, "loan", title, message, data, true, true, false)
		}(guarantorUserID)
	}

	return loan, nil
}

// RespondToGuaranteeRequest handles guarantor response
func (s *LoanService) RespondToGuaranteeRequest(loanID, guarantorUserID string, response *models.GuarantorResponse) error {
	// Get guarantor record
	guarantor, err := s.getGuarantor(loanID, guarantorUserID)
	if err != nil {
		return err
	}

	if guarantor.HasResponded() {
		return fmt.Errorf("guarantor has already responded")
	}

	// Start transaction
	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback()

	// Update guarantor status
	now := time.Now()
	status := models.GuarantorStatusRejected
	if response.Accept {
		status = models.GuarantorStatusAccepted
	}

	updateQuery := `
		UPDATE guarantors
		SET status = $1, message = $2, responded_at = $3
		WHERE id = $4
	`

	_, err = tx.Exec(updateQuery, status, response.Message, now, guarantor.ID)
	if err != nil {
		return fmt.Errorf("failed to update guarantor: %w", err)
	}

	// Update loan's approved guarantors count if accepted
	if response.Accept {
		_, err = tx.Exec(
			"UPDATE loans SET approved_guarantors = approved_guarantors + 1, updated_at = $1 WHERE id = $2",
			now, loanID,
		)
		if err != nil {
			return fmt.Errorf("failed to update loan guarantors count: %w", err)
		}
	}

	// Commit transaction
	if err = tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	// Check if loan now has sufficient guarantors
	loan, err := s.GetLoanByID(loanID)
	if err != nil {
		return err
	}

	if loan.CanBeApproved() {
		// Notify chama leaders that loan is ready for approval
		s.notifyLoanReadyForApproval(loan)
	}

	return nil
}

// ApproveLoan approves or rejects a loan
func (s *LoanService) ApproveLoan(loanID, approverID string, approval *models.LoanApproval) error {
	// Get loan
	loan, err := s.GetLoanByID(loanID)
	if err != nil {
		return err
	}

	if !loan.IsPending() {
		return fmt.Errorf("loan is not pending approval")
	}

	// Check if approver has permission (chairperson or treasurer)
	chamaService := NewChamaService(s.db)
	member, err := chamaService.GetChamaMember(loan.ChamaID, approverID)
	if err != nil {
		return err
	}

	if !member.CanManageFinances() {
		return fmt.Errorf("user does not have permission to approve loans")
	}

	// Start transaction
	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback()

	now := time.Now()
	var newStatus models.LoanStatus
	var totalAmount, remainingAmount float64

	if approval.Approved {
		newStatus = models.LoanStatusApproved
		loan.InterestRate = approval.InterestRate
		totalAmount = loan.CalculateTotalAmount()
		remainingAmount = totalAmount
	} else {
		newStatus = models.LoanStatusRejected
		totalAmount = 0
		remainingAmount = 0
	}

	// Update loan
	updateQuery := `
		UPDATE loans
		SET status = $1, interest_rate = $2, total_amount = $3, remaining_amount = $4,
			approved_by = $5, approved_at = $6, updated_at = $7
		WHERE id = $8
	`

	_, err = tx.Exec(updateQuery,
		newStatus, loan.InterestRate, totalAmount, remainingAmount,
		approverID, now, now, loanID,
	)
	if err != nil {
		return fmt.Errorf("failed to update loan: %w", err)
	}

	// If approved, disburse funds
	if approval.Approved {
		err = s.disburseLoan(tx, loan, totalAmount)
		if err != nil {
			return fmt.Errorf("failed to disburse loan: %w", err)
		}
	}

	// Commit transaction
	if err = tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	// Send notification to borrower
	notificationService := NewNotificationService(s.db, nil)
	go notificationService.NotifyLoanApproval(loan.BorrowerID, loan.Amount, approval.Approved)

	return nil
}

// MakeLoanPayment processes a loan payment
func (s *LoanService) MakeLoanPayment(loanID, payerID string, amount float64, paymentMethod string) (*models.LoanPayment, error) {
	// Get loan
	loan, err := s.GetLoanByID(loanID)
	if err != nil {
		return nil, err
	}

	if !loan.IsActive() {
		return nil, fmt.Errorf("loan is not active")
	}

	if loan.BorrowerID != payerID {
		return nil, fmt.Errorf("only the borrower can make payments")
	}

	if amount <= 0 {
		return nil, fmt.Errorf("payment amount must be positive")
	}

	if amount > loan.RemainingAmount {
		return nil, fmt.Errorf("payment amount exceeds remaining balance")
	}

	// Calculate principal and interest portions
	interestPortion := (loan.TotalAmount - loan.Amount) * (amount / loan.TotalAmount)
	principalPortion := amount - interestPortion

	payment := &models.LoanPayment{
		ID:              uuid.New().String(),
		LoanID:          loanID,
		Amount:          amount,
		PrincipalAmount: principalPortion,
		InterestAmount:  interestPortion,
		PaymentMethod:   paymentMethod,
		PaidAt:          time.Now(),
		CreatedAt:       time.Now(),
	}

	// Start transaction
	tx, err := s.db.Begin()
	if err != nil {
		return nil, fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback()

	// Insert payment
	paymentQuery := `
		INSERT INTO loan_payments (
			id, loan_id, amount, principal_amount, interest_amount,
			payment_method, reference, paid_at, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`

	_, err = tx.Exec(paymentQuery,
		payment.ID, payment.LoanID, payment.Amount, payment.PrincipalAmount,
		payment.InterestAmount, payment.PaymentMethod, payment.Reference,
		payment.PaidAt, payment.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to record payment: %w", err)
	}

	// Update loan
	newPaidAmount := loan.PaidAmount + amount
	newRemainingAmount := loan.RemainingAmount - amount
	newStatus := loan.Status

	if newRemainingAmount <= 0 {
		newStatus = models.LoanStatusCompleted
		newRemainingAmount = 0
	}

	updateLoanQuery := `
		UPDATE loans
		SET paid_amount = $1, remaining_amount = $2, status = $3, updated_at = $4
		WHERE id = $5
	`

	_, err = tx.Exec(updateLoanQuery,
		newPaidAmount, newRemainingAmount, newStatus, time.Now(), loanID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update loan: %w", err)
	}

	// Commit transaction
	if err = tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return payment, nil
}

// GetLoanByID retrieves a loan by ID
func (s *LoanService) GetLoanByID(loanID string) (*models.Loan, error) {
	query := `
		SELECT id, borrower_id, chama_id, type, amount, interest_rate, duration,
			   purpose, status, approved_by, approved_at, disbursed_at, due_date,
			   total_amount, paid_amount, remaining_amount, required_guarantors,
			   approved_guarantors, created_at, updated_at,
			   secretary_approved_by, secretary_approved_at, secretary_comment,
			   treasurer_approved_by, treasurer_approved_at, treasurer_comment,
			   chairperson_approved_by, chairperson_approved_at, chairperson_comment,
			   approval_stage, rejected_by, rejected_reason, rejected_at
		FROM loans WHERE id = $1
	`

	loan := &models.Loan{}
	err := s.db.QueryRow(query, loanID).Scan(
		&loan.ID, &loan.BorrowerID, &loan.ChamaID, &loan.Type, &loan.Amount,
		&loan.InterestRate, &loan.Duration, &loan.Purpose, &loan.Status,
		&loan.ApprovedBy, &loan.ApprovedAt, &loan.DisbursedAt, &loan.DueDate,
		&loan.TotalAmount, &loan.PaidAmount, &loan.RemainingAmount,
		&loan.RequiredGuarantors, &loan.ApprovedGuarantors,
		&loan.CreatedAt, &loan.UpdatedAt,
		&loan.SecretaryApprovedBy, &loan.SecretaryApprovedAt, &loan.SecretaryComment,
		&loan.TreasurerApprovedBy, &loan.TreasurerApprovedAt, &loan.TreasurerComment,
		&loan.ChairpersonApprovedBy, &loan.ChairpersonApprovedAt, &loan.ChairpersonComment,
		&loan.ApprovalStage, &loan.RejectedBy, &loan.RejectedReason, &loan.RejectedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("loan not found")
		}
		return nil, fmt.Errorf("failed to get loan: %w", err)
	}

	return loan, nil
}

// GetChamaLoans retrieves loans for a chama
func (s *LoanService) GetChamaLoans(chamaID string, status *models.LoanStatus, limit, offset int) ([]*models.Loan, error) {
	query := `
		SELECT l.id, l.borrower_id, l.chama_id, l.type, l.amount, l.interest_rate,
			   l.duration, l.purpose, l.status, l.approved_by, l.approved_at,
			   l.disbursed_at, l.due_date, l.total_amount, l.paid_amount,
			   l.remaining_amount, l.required_guarantors, l.approved_guarantors,
			   l.created_at, l.updated_at,
			   l.approval_stage, l.secretary_approved_by, l.secretary_approved_at,
			   l.treasurer_approved_by, l.treasurer_approved_at,
			   l.chairperson_approved_by, l.chairperson_approved_at,
			   l.rejected_by, l.rejected_reason, l.rejected_at,
			   u.first_name, u.last_name, u.avatar
		FROM loans l
		INNER JOIN users u ON l.borrower_id = u.id
		WHERE l.chama_id = $1
	`
	args := []interface{}{chamaID}

	if status != nil {
		query += " AND l.status = $2"
		args = append(args, *status)
	}

	query += " ORDER BY l.created_at DESC LIMIT $3 OFFSET $4"
	args = append(args, limit, offset)

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to get chama loans: %w", err)
	}
	defer rows.Close()

	var loans []*models.Loan
	for rows.Next() {
		loan := &models.Loan{}
		borrower := &models.User{}

		err := rows.Scan(
			&loan.ID, &loan.BorrowerID, &loan.ChamaID, &loan.Type, &loan.Amount,
			&loan.InterestRate, &loan.Duration, &loan.Purpose, &loan.Status,
			&loan.ApprovedBy, &loan.ApprovedAt, &loan.DisbursedAt, &loan.DueDate,
			&loan.TotalAmount, &loan.PaidAmount, &loan.RemainingAmount,
			&loan.RequiredGuarantors, &loan.ApprovedGuarantors,
			&loan.CreatedAt, &loan.UpdatedAt,
			&loan.ApprovalStage, &loan.SecretaryApprovedBy, &loan.SecretaryApprovedAt,
			&loan.TreasurerApprovedBy, &loan.TreasurerApprovedAt,
			&loan.ChairpersonApprovedBy, &loan.ChairpersonApprovedAt,
			&loan.RejectedBy, &loan.RejectedReason, &loan.RejectedAt,
			&borrower.FirstName, &borrower.LastName, &borrower.Avatar,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan loan: %w", err)
		}

		borrower.ID = loan.BorrowerID
		loan.Borrower = borrower
		loans = append(loans, loan)
	}

	return loans, nil
}

// Helper methods

func (s *LoanService) hasActiveLoan(borrowerID, chamaID string) (bool, error) {
	query := `
		SELECT COUNT(*) FROM loans
		WHERE borrower_id = $1 AND chama_id = $2 AND status IN ($3, $4)
	`
	var count int
	err := s.db.QueryRow(query, borrowerID, chamaID, models.LoanStatusApproved, models.LoanStatusActive).Scan(&count)
	if err != nil {
		return false, fmt.Errorf("failed to check active loans: %w", err)
	}
	return count > 0, nil
}

func (s *LoanService) getGuarantor(loanID, userID string) (*models.Guarantor, error) {
	query := `
		SELECT id, loan_id, user_id, amount, status, message, responded_at, created_at
		FROM guarantors WHERE loan_id = $1 AND user_id = $2
	`

	guarantor := &models.Guarantor{}
	err := s.db.QueryRow(query, loanID, userID).Scan(
		&guarantor.ID, &guarantor.LoanID, &guarantor.UserID, &guarantor.Amount,
		&guarantor.Status, &guarantor.Message, &guarantor.RespondedAt, &guarantor.CreatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("guarantor not found")
		}
		return nil, fmt.Errorf("failed to get guarantor: %w", err)
	}

	return guarantor, nil
}

func (s *LoanService) disburseLoan(tx *sql.Tx, loan *models.Loan, _ float64) error {
	now := time.Now()
	dueDate := now.AddDate(0, loan.Duration, 0)

	// Update loan with disbursement details
	_, err := tx.Exec(
		"UPDATE loans SET status = $1, disbursed_at = $2, due_date = $3 WHERE id = $4",
		models.LoanStatusActive, now, dueDate, loan.ID,
	)
	if err != nil {
		return fmt.Errorf("failed to update loan disbursement: %w", err)
	}

	// Transfer funds from chama wallet to borrower's wallet
	// This would integrate with the wallet service
	// For now, we'll just log the transaction

	return nil
}

func (s *LoanService) notifyLoanReadyForApproval(loan *models.Loan) {
	query := `
		SELECT user_id FROM chama_members
		WHERE chama_id = $1 AND role IN ($2, $3) AND is_active = true
	`
	rows, err := s.db.Query(query, loan.ChamaID, models.ChamaRoleChairperson, models.ChamaRoleTreasurer)
	if err != nil {
		return
	}
	defer rows.Close()

	notificationService := NewNotificationService(s.db, nil)
	for rows.Next() {
		var userID string
		if err := rows.Scan(&userID); err != nil {
			continue
		}

		go func(uid string) {
			title := "Loan Ready for Approval"
			message := fmt.Sprintf("A loan application for KSh %.2f is ready for your approval", loan.Amount)
			data := map[string]interface{}{
				"type":   "loan_approval_needed",
				"loanId": loan.ID,
				"amount": loan.Amount,
			}
			notificationService.CreateNotification(uid, "loan", title, message, data, true, true, false)
		}(userID)
	}
}

// canManageLoanTypes checks whether a user may administer loan types in a chama
func (s *LoanService) canManageLoanTypes(userID, chamaID string) bool {
	query := `
		SELECT role FROM chama_members
		WHERE user_id = $1 AND chama_id = $2 AND is_active = true
	`
	var role string
	err := s.db.QueryRow(query, userID, chamaID).Scan(&role)
	if err != nil {
		log.Printf("Loan type permission denied for user %s in chama %s: %v", userID, chamaID, err)
		return false
	}
	if role != "chairperson" && role != "secretary" && role != "treasurer" {
		log.Printf("Loan type permission denied: user %s has role '%s' in chama %s (requires chairperson/secretary/treasurer)", userID, role, chamaID)
		return false
	}
	return true
}

// CreateLoanType inserts a new chama loan type
func (s *LoanService) CreateLoanType(chamaID, createdBy string, req *models.LoanProductRequest) (*models.LoanProduct, error) {
	if !s.canManageLoanTypes(createdBy, chamaID) {
		return nil, fmt.Errorf("user does not have permission to create loan types")
	}

	id := uuid.New().String()
	now := time.Now()

	approvalRequired := true
	if req.ApprovalRequired != nil {
		approvalRequired = *req.ApprovalRequired
	}
	requiresCollateral := false
	if req.RequiresCollateral != nil {
		requiresCollateral = *req.RequiresCollateral
	}
	requiresGuarantors := false
	if req.RequiresGuarantors != nil {
		requiresGuarantors = *req.RequiresGuarantors
	}
	status := "active"
	if req.Status != "" {
		status = req.Status
	}

	query := `
		INSERT INTO loan_types (
			id, chama_id, name, description, exact_amount,
			interest_rate, term_months, eligibility_criteria, approval_required,
			grace_period_days, penalty_rate, max_loans_per_member, requires_collateral,
			requires_guarantors, collateral_description, net_disbursement, current_loans,
			default_threshold_days, installment_penalty_type,
			installment_penalty_amount, loan_penalty_amount,
			status, created_by, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
	`
	_, err := s.db.Exec(query,
		id, chamaID, req.Name, req.Description, req.ExactAmount,
		req.InterestRate, req.TermMonths, req.EligibilityCriteria, approvalRequired,
		req.GracePeriodDays, req.PenaltyRate, req.MaxLoansPerMember, requiresCollateral,
		requiresGuarantors, req.CollateralDesc, req.NetDisbursement, req.CurrentLoans,
		req.DefaultThresholdDays, req.InstallmentPenaltyType,
		req.InstallmentPenaltyAmount, req.LoanPenaltyAmount,
		status, createdBy, now, now, now,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create loan type: %w", err)
	}

	return &models.LoanProduct{
		ID:                       id,
		ChamaID:                  chamaID,
		Name:                     req.Name,
		Description:              req.Description,
		ExactAmount:               req.ExactAmount,
		InterestRate:             req.InterestRate,
		TermMonths:               req.TermMonths,
		EligibilityCriteria:      req.EligibilityCriteria,
		ApprovalRequired:         approvalRequired,
		GracePeriodDays:          req.GracePeriodDays,
		PenaltyRate:              req.PenaltyRate,
		MaxLoansPerMember:        req.MaxLoansPerMember,
		RequiresCollateral:       requiresCollateral,
		RequiresGuarantors:       requiresGuarantors,
		CollateralDesc:           req.CollateralDesc,
		NetDisbursement:          req.NetDisbursement,
		CurrentLoans:             req.CurrentLoans,
		DefaultThresholdDays:     req.DefaultThresholdDays,
		InstallmentPenaltyType:   req.InstallmentPenaltyType,
		InstallmentPenaltyAmount: req.InstallmentPenaltyAmount,
		LoanPenaltyAmount:        req.LoanPenaltyAmount,
		Status:                   status,
		CreatedBy:                createdBy,
		CreatedAt:                now,
		UpdatedAt:                now,
	}, nil
}

// GetChamaLoanTypes retrieves loan types for a chama, optionally filtered by status
func (s *LoanService) GetChamaLoanTypes(chamaID string, status string) ([]models.LoanProduct, error) {
	query := `
		SELECT id, chama_id, name, description, exact_amount,
		       interest_rate, term_months, eligibility_criteria, approval_required,
		       grace_period_days, penalty_rate, max_loans_per_member, requires_collateral,
		       requires_guarantors, collateral_description, net_disbursement, current_loans,
		       default_threshold_days, installment_penalty_type,
		       installment_penalty_amount, loan_penalty_amount,
		       status, created_by, created_at, updated_at
		FROM loan_types
		WHERE chama_id = $1
	`
	args := []interface{}{chamaID}
	if status != "" {
		query += " AND status = $2"
		args = append(args, status)
	}
	query += " ORDER BY created_at DESC"

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query loan types: %w", err)
	}
	defer rows.Close()

	var out []models.LoanProduct
	for rows.Next() {
		var lt models.LoanProduct
		err := rows.Scan(
			&lt.ID, &lt.ChamaID, &lt.Name, &lt.Description, &lt.ExactAmount,
			&lt.InterestRate, &lt.TermMonths, &lt.EligibilityCriteria, &lt.ApprovalRequired,
			&lt.GracePeriodDays, &lt.PenaltyRate, &lt.MaxLoansPerMember, &lt.RequiresCollateral,
			&lt.RequiresGuarantors, &lt.CollateralDesc, &lt.NetDisbursement, &lt.CurrentLoans,
			&lt.DefaultThresholdDays, &lt.InstallmentPenaltyType,
			&lt.InstallmentPenaltyAmount, &lt.LoanPenaltyAmount,
			&lt.Status, &lt.CreatedBy, &lt.CreatedAt, &lt.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan loan type: %w", err)
		}
		out = append(out, lt)
	}
	return out, nil
}

// GetLoanTypeByID fetches a single loan type
func (s *LoanService) GetLoanTypeByID(loanTypeID string) (*models.LoanProduct, error) {
	query := `
		SELECT id, chama_id, name, description, exact_amount,
		       interest_rate, term_months, eligibility_criteria, approval_required,
		       grace_period_days, penalty_rate, max_loans_per_member, requires_collateral,
		       requires_guarantors, collateral_description, net_disbursement, current_loans,
		       default_threshold_days, installment_penalty_type,
		       installment_penalty_amount, loan_penalty_amount,
		       status, created_by, created_at, updated_at
		FROM loan_types WHERE id = $1
	`
	var lt models.LoanProduct
	err := s.db.QueryRow(query, loanTypeID).Scan(
		&lt.ID, &lt.ChamaID, &lt.Name, &lt.Description, &lt.ExactAmount,
		&lt.InterestRate, &lt.TermMonths, &lt.EligibilityCriteria, &lt.ApprovalRequired,
		&lt.GracePeriodDays, &lt.PenaltyRate, &lt.MaxLoansPerMember, &lt.RequiresCollateral,
		&lt.RequiresGuarantors, &lt.CollateralDesc, &lt.NetDisbursement, &lt.CurrentLoans,
		&lt.DefaultThresholdDays, &lt.InstallmentPenaltyType,
		&lt.InstallmentPenaltyAmount, &lt.LoanPenaltyAmount,
		&lt.Status, &lt.CreatedBy, &lt.CreatedAt, &lt.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("loan type not found: %w", err)
	}
	return &lt, nil
}

// UpdateLoanType updates an existing loan type
func (s *LoanService) UpdateLoanType(loanTypeID string, req *models.LoanProductRequest) (*models.LoanProduct, error) {
	existing, err := s.GetLoanTypeByID(loanTypeID)
	if err != nil {
		return nil, err
	}
	if !s.canManageLoanTypes(existing.CreatedBy, existing.ChamaID) {
		return nil, fmt.Errorf("user does not have permission to update loan types")
	}

	approvalRequired := existing.ApprovalRequired
	if req.ApprovalRequired != nil {
		approvalRequired = *req.ApprovalRequired
	}
	requiresCollateral := existing.RequiresCollateral
	if req.RequiresCollateral != nil {
		requiresCollateral = *req.RequiresCollateral
	}
	requiresGuarantors := existing.RequiresGuarantors
	if req.RequiresGuarantors != nil {
		requiresGuarantors = *req.RequiresGuarantors
	}
	status := existing.Status
	if req.Status != "" {
		status = req.Status
	}
	now := time.Now()

	query := `
		UPDATE loan_types SET
			name = $1, description = $2, exact_amount = $3,
			interest_rate = $4, term_months = $5, eligibility_criteria = $6,
			approval_required = $7, grace_period_days = $8, penalty_rate = $9,
			max_loans_per_member = $10, requires_collateral = $11, requires_guarantors = $12,
			collateral_description = $13, net_disbursement = $14, current_loans = $15,
			default_threshold_days = $16, installment_penalty_type = $17,
			installment_penalty_amount = $18, loan_penalty_amount = $19,
			status = $20, updated_at = $21
		WHERE id = $22
	`
	_, err = s.db.Exec(query,
		req.Name, req.Description, req.ExactAmount, req.InterestRate,
		req.TermMonths, req.EligibilityCriteria, approvalRequired, req.GracePeriodDays,
		req.PenaltyRate, req.MaxLoansPerMember, requiresCollateral, requiresGuarantors,
		req.CollateralDesc, req.NetDisbursement, req.CurrentLoans,
		req.DefaultThresholdDays, req.InstallmentPenaltyType,
		req.InstallmentPenaltyAmount, req.LoanPenaltyAmount,
		status, now, loanTypeID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update loan type: %w", err)
	}
	existing.Name = req.Name
	existing.Description = req.Description
	existing.ExactAmount = req.ExactAmount
	existing.InterestRate = req.InterestRate
	existing.TermMonths = req.TermMonths
	existing.EligibilityCriteria = req.EligibilityCriteria
	existing.ApprovalRequired = approvalRequired
	existing.GracePeriodDays = req.GracePeriodDays
	existing.PenaltyRate = req.PenaltyRate
	existing.MaxLoansPerMember = req.MaxLoansPerMember
	existing.RequiresCollateral = requiresCollateral
	existing.RequiresGuarantors = requiresGuarantors
	existing.CollateralDesc = req.CollateralDesc
	existing.NetDisbursement = req.NetDisbursement
	existing.CurrentLoans = req.CurrentLoans
	existing.DefaultThresholdDays = req.DefaultThresholdDays
	existing.InstallmentPenaltyType = req.InstallmentPenaltyType
	existing.InstallmentPenaltyAmount = req.InstallmentPenaltyAmount
	existing.LoanPenaltyAmount = req.LoanPenaltyAmount
	existing.Status = status
	existing.UpdatedAt = now
	return existing, nil
}

// GetLoanPayments retrieves payment records for a loan
func (s *LoanService) GetLoanPayments(loanID string) ([]*models.LoanPayment, error) {
	query := `
		SELECT id, loan_id, amount, principal_amount, interest_amount,
			   payment_method, reference, paid_at, created_at
		FROM loan_payments
		WHERE loan_id = $1
		ORDER BY paid_at ASC
	`

	rows, err := s.db.Query(query, loanID)
	if err != nil {
		return nil, fmt.Errorf("failed to query loan payments: %w", err)
	}
	defer rows.Close()

	var payments []*models.LoanPayment
	for rows.Next() {
		var p models.LoanPayment
		err := rows.Scan(
			&p.ID, &p.LoanID, &p.Amount, &p.PrincipalAmount,
			&p.InterestAmount, &p.PaymentMethod, &p.Reference, &p.PaidAt, &p.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan loan payment: %w", err)
		}
		payments = append(payments, &p)
	}

	return payments, nil
}

// GetLoanGuarantors retrieves guarantors for a loan
func (s *LoanService) GetLoanGuarantors(loanID string) ([]*models.Guarantor, error) {
	query := `
		SELECT g.id, g.loan_id, g.user_id, g.amount, g.status, g.message,
			   g.responded_at, g.created_at,
			   u.first_name, u.last_name, u.email, u.phone
		FROM guarantors g
		LEFT JOIN users u ON g.user_id = u.id
		WHERE g.loan_id = $1
		ORDER BY g.created_at ASC
	`

	rows, err := s.db.Query(query, loanID)
	if err != nil {
		return nil, fmt.Errorf("failed to query loan guarantors: %w", err)
	}
	defer rows.Close()

	var guarantors []*models.Guarantor
	for rows.Next() {
		var g models.Guarantor
		var user models.User
		err := rows.Scan(
			&g.ID, &g.LoanID, &g.UserID, &g.Amount, &g.Status, &g.Message,
			&g.RespondedAt, &g.CreatedAt,
			&user.FirstName, &user.LastName, &user.Email, &user.Phone,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan guarantor: %w", err)
		}
		user.ID = g.UserID
		g.User = &user
		guarantors = append(guarantors, &g)
	}

	return guarantors, nil
}

// GetLoanFines retrieves fines for a loan
func (s *LoanService) GetLoanFines(loanID string) ([]*models.LoanFine, error) {
	query := `
		SELECT id, loan_id, amount, reason, status, paid_at, created_at
		FROM loan_fines
		WHERE loan_id = $1
		ORDER BY created_at DESC
	`

	rows, err := s.db.Query(query, loanID)
	if err != nil {
		return nil, fmt.Errorf("failed to query loan fines: %w", err)
	}
	defer rows.Close()

	var fines []*models.LoanFine
	for rows.Next() {
		var f models.LoanFine
		err := rows.Scan(
			&f.ID, &f.LoanID, &f.Amount, &f.Reason, &f.Status, &f.PaidAt, &f.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan loan fine: %w", err)
		}
		fines = append(fines, &f)
	}

	return fines, nil
}

// DeleteLoanType removes a loan type
func (s *LoanService) DeleteLoanType(loanTypeID string) error {
	lt, err := s.GetLoanTypeByID(loanTypeID)
	if err != nil {
		return err
	}
	if !s.canManageLoanTypes(lt.CreatedBy, lt.ChamaID) {
		return fmt.Errorf("user does not have permission to delete loan types")
	}
	_, err = s.db.Exec(`DELETE FROM loan_types WHERE id = $1`, loanTypeID)
	if err != nil {
		return fmt.Errorf("failed to delete loan type: %w", err)
	}
	return nil
}

// InitiateLoanApproval creates an OTP for the next required approver
func (s *LoanService) InitiateLoanApproval(loanID, userID, role, comment string) (string, error) {
	loan, err := s.GetLoanByID(loanID)
	if err != nil {
		return "", fmt.Errorf("loan not found: %w", err)
	}

	if loan.Status != models.LoanStatusPending && loan.Status != models.LoanStatusApproved {
		return "", fmt.Errorf("loan cannot be approved in current status: %s", loan.Status)
	}

	// Determine next required role
	nextRole, err := s.getNextApprovalRole(loan)
	if err != nil {
		return "", err
	}

	if role != nextRole {
		return "", fmt.Errorf("approval must follow the correct order. Next approver is: %s", nextRole)
	}

	// Check if user has the correct role in the chama
	var userRole string
	err = s.db.QueryRow("SELECT role FROM chama_members WHERE chama_id = $1 AND user_id = $2", loan.ChamaID, userID).Scan(&userRole)
	if err != nil {
		return "", fmt.Errorf("failed to verify user role: %w", err)
	}

	if userRole != role {
		return "", fmt.Errorf("you are not authorized as %s for this chama", role)
	}

	// Check if already approved by this role
	switch role {
	case "secretary":
		if loan.SecretaryApprovedBy != nil {
			return "", fmt.Errorf("loan has already been approved by secretary")
		}
	case "treasurer":
		if loan.TreasurerApprovedBy != nil {
			return "", fmt.Errorf("loan has already been approved by treasurer")
		}
	case "chairperson":
		if loan.ChairpersonApprovedBy != nil {
			return "", fmt.Errorf("loan has already been approved by chairperson")
		}
	}

	// Generate OTP
	otp := utils.GenerateOTP(6)
	otpID := "otp-" + uuid.New().String()
	expiresAt := time.Now().Add(10 * time.Minute)

	_, err = s.db.Exec(`
		INSERT INTO loan_approval_otps (id, loan_id, user_id, role, otp, comment, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, otpID, loanID, userID, role, otp, comment, expiresAt)
	if err != nil {
		return "", fmt.Errorf("failed to create approval OTP: %w", err)
	}

	// Send OTP via SMS/notification
	go func() {
		var phone string
		if err := s.db.QueryRow("SELECT phone FROM users WHERE id = $1", userID).Scan(&phone); err == nil {
			fmt.Printf("Sending loan approval OTP to %s for %s: %s\n", phone, role, otp)
		}
	}()

	return otpID, nil
}

// ConfirmLoanApproval verifies OTP and records the approval
func (s *LoanService) ConfirmLoanApproval(loanID, userID, role, otp, comment string) error {
	// Validate OTP
	var otpRecord struct {
		id        string
		verified  bool
		expiresAt time.Time
	}
	err := s.db.QueryRow(`
		SELECT id, verified, expires_at FROM loan_approval_otps
		WHERE loan_id = $1 AND user_id = $2 AND role = $3 AND otp = $4
		ORDER BY created_at DESC LIMIT 1
	`, loanID, userID, role, otp).Scan(&otpRecord.id, &otpRecord.verified, &otpRecord.expiresAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("invalid or expired OTP")
		}
		return fmt.Errorf("failed to verify OTP: %w", err)
	}

	if otpRecord.verified {
		return fmt.Errorf("OTP has already been used")
	}

	if time.Now().After(otpRecord.expiresAt) {
		return fmt.Errorf("OTP has expired")
	}

	// Start transaction
	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback()

	// Mark OTP as verified
	_, err = tx.Exec("UPDATE loan_approval_otps SET verified = TRUE WHERE id = $1", otpRecord.id)
	if err != nil {
		return fmt.Errorf("failed to mark OTP as verified: %w", err)
	}

	// Record approval based on role
	now := time.Now()
	switch role {
	case "secretary":
		_, err = tx.Exec(`
			UPDATE loans SET secretary_approved_by = $1, secretary_approved_at = $2, secretary_comment = $3, approval_stage = 'secretary_approved', updated_at = $4
			WHERE id = $5
		`, userID, now, comment, now, loanID)
	case "treasurer":
		_, err = tx.Exec(`
			UPDATE loans SET treasurer_approved_by = $1, treasurer_approved_at = $2, treasurer_comment = $3, approval_stage = 'treasurer_approved', updated_at = $4
			WHERE id = $5
		`, userID, now, comment, now, loanID)
	case "chairperson":
		_, err = tx.Exec(`
			UPDATE loans SET chairperson_approved_by = $1, chairperson_approved_at = $2, chairperson_comment = $3, approval_stage = 'fully_approved', status = 'approved', approved_by = $1, approved_at = $4, updated_at = $4
			WHERE id = $5
		`, userID, now, comment, now, loanID)
	default:
		return fmt.Errorf("invalid approval role: %s", role)
	}

	if err != nil {
		return fmt.Errorf("failed to record approval: %w", err)
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit approval transaction: %w", err)
	}

	// After chairperson approval, the handler will trigger disbursement
	return nil
}

func (s *LoanService) getNextApprovalRole(loan *models.Loan) (string, error) {
	if loan.SecretaryApprovedBy == nil {
		return "secretary", nil
	}
	if loan.TreasurerApprovedBy == nil {
		return "treasurer", nil
	}
	if loan.ChairpersonApprovedBy == nil {
		return "chairperson", nil
	}
	return "", fmt.Errorf("loan has already been fully approved")
}
