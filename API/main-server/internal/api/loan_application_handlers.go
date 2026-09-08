package api

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"

	"vaultke-backend/internal/services"
)

var relaxNotifTypeOnce sync.Once

// reconstructBackerRow rebuilds a missing guarantors / loan_referees row for a
// backer whose request notification exists but whose backing row was never
// written (older builds inserted it best-effort). role is "guarantor" or
// "referee"; recordID is the intended row id; userID is the backer. Returns true
// when a row now exists for (recordID, userID).
func reconstructBackerRow(db *sql.DB, role, recordID, userID string) bool {
	if db == nil || recordID == "" || userID == "" {
		return false
	}
	idKey := role + "_id"

	var loanID string
	err := db.QueryRow(fmt.Sprintf(`
		SELECT data::text::json ->> 'loan_id'
		FROM notifications
		WHERE type = '%s_request' AND user_id = $1
		  AND data IS NOT NULL AND data::text LIKE '{%%'
		  AND data::text::json ->> '%s' = $2
		LIMIT 1
	`, role, idKey), userID, recordID).Scan(&loanID)
	if err != nil || loanID == "" {
		return false
	}

	var loanExists bool
	if e := db.QueryRow(`SELECT EXISTS(SELECT 1 FROM loans WHERE id = $1)`, loanID).Scan(&loanExists); e != nil || !loanExists {
		return false
	}

	if role == "referee" {
		_, e := db.Exec(`
			INSERT INTO loan_referees (id, loan_id, user_id, status, created_at)
			VALUES ($1, $2, $3, 'pending', CURRENT_TIMESTAMP)
			ON CONFLICT DO NOTHING`, recordID, loanID, userID)
		return e == nil
	}

	var amount float64
	_ = db.QueryRow(`SELECT COALESCE(amount, 0) FROM loans WHERE id = $1`, loanID).Scan(&amount)
	_, e := db.Exec(`
		INSERT INTO guarantors (id, loan_id, user_id, amount, status, created_at)
		VALUES ($1, $2, $3, $4, 'pending', CURRENT_TIMESTAMP)
		ON CONFLICT DO NOTHING`, recordID, loanID, userID, amount)
	return e == nil
}

// relaxNotificationTypeConstraint strips the narrow CHECK on notifications.type
// (which only allowed 'chama','transaction','reminder','system','alert') so that
// types like 'guarantor_request' / 'referee_request' can be stored. This is a
// safety net for a database where the startup migration has not yet run — the
// notifications table is rebuilt with the CHECK on every boot.
func relaxNotificationTypeConstraint(db *sql.DB) {
	rows, err := db.Query(`
		SELECT con.conname
		FROM pg_constraint con
		JOIN pg_class rel ON rel.oid = con.conrelid
		WHERE rel.relname = 'notifications' AND con.contype = 'c'
	`)
	if err != nil {
		return
	}
	var names []string
	for rows.Next() {
		var n string
		if rows.Scan(&n) == nil {
			names = append(names, n)
		}
	}
	rows.Close()
	for _, n := range names {
		_, _ = db.Exec(`ALTER TABLE notifications DROP CONSTRAINT IF EXISTS "` + n + `"`)
	}
	_, _ = db.Exec("ALTER TABLE notifications ALTER COLUMN type TYPE VARCHAR(64)")
}

// createNotificationTx inserts a notification with all required fields using a transaction
func createNotificationTx(tx *sql.Tx, _ string, userID, notificationType, title, message, data string, referenceType string, referenceID interface{}) error {
	_, err := tx.Exec(`
		INSERT INTO notifications (
			user_id, title, message, type, priority, category,
			reference_type, reference_id, status, is_read, data,
			scheduled_for, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6,
			$7, $8, 'pending', false, $9,
			CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`, userID, title, message, notificationType,
		getNotificationPriority(notificationType),
		getNotificationCategory(notificationType),
		referenceType,
		referenceID,
		data)
	return err
}

// createNotification inserts a notification row for the user. It is defensive
// about schema drift: the full insert is tried first, then a constraint-relax +
// retry, then a minimal insert using only columns guaranteed to exist. Whatever
// path succeeds, the notification lands in the notifications table so the
// notifications screen (getSystemNotifications) shows it.
func createNotification(db *sql.DB, _ string, userID, notificationType, title, message, data string, referenceType string, referenceID interface{}) error {
	fullInsert := func() error {
		_, err := db.Exec(`
			INSERT INTO notifications (
				user_id, title, message, type, priority, category,
				reference_type, reference_id, status, is_read, data,
				scheduled_for, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, $6,
				$7, $8, 'pending', false, $9,
				CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		`, userID, title, message, notificationType,
			getNotificationPriority(notificationType),
			getNotificationCategory(notificationType),
			referenceType, referenceID, data)
		return err
	}

	err := fullInsert()
	if err != nil {
		// Most likely the narrow CHECK on notifications.type. Relax it once and retry.
		relaxNotifTypeOnce.Do(func() { relaxNotificationTypeConstraint(db) })
		if err2 := fullInsert(); err2 == nil {
			err = nil
		} else {
			// Last resort: minimal column set (present since the very first schema).
			if _, err3 := db.Exec(`
				INSERT INTO notifications (user_id, title, message, type, is_read, data, created_at, updated_at)
				VALUES ($1, $2, $3, $4, false, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
			`, userID, title, message, notificationType, data); err3 == nil {
				err = nil
			} else {
				fmt.Printf("createNotification: all inserts failed for user %s type %s: %v / %v / %v\n", userID, notificationType, err, err2, err3)
				err = err3
			}
		}
	}
	if err != nil {
		return err
	}

	// Deliver to the OS notification tray / lock screen too (best-effort).
	payload := map[string]interface{}{"type": notificationType}
	if data != "" {
		var parsed map[string]interface{}
		if json.Unmarshal([]byte(data), &parsed) == nil {
			for k, v := range parsed {
				payload[k] = v
			}
		}
	}
	go services.PushToUser(db, userID, title, message, payload)

	return nil
}

// Helper functions to determine notification properties based on type
func getNotificationPriority(notificationType string) string {
	switch notificationType {
	case "guarantor_request", "referee_request", "loan_status_update":
		return "high"
	default:
		return "normal"
	}
}

func getNotificationCategory(notificationType string) string {
	switch notificationType {
	case "guarantor_request", "referee_request", "loan_status_update", "guarantor_response", "referee_response":
		return "financial"
	case "meeting_created", "meeting_updated":
		return "meetings"
	case "member_joined", "member_left":
		return "members"
	default:
		return "system"
	}
}

func getNotificationPushEnabled(notificationType string) int {
	switch notificationType {
	case "guarantor_request", "loan_status_update", "meeting_created", "member_joined":
		return 1
	default:
		return 0
	}
}

func getNotificationEmailEnabled(notificationType string) int {
	switch notificationType {
	case "guarantor_request", "loan_status_update":
		return 1
	default:
		return 0
	}
}

func getNotificationSMSEnabled(notificationType string) int {
	switch notificationType {
	case "guarantor_request":
		return 1
	default:
		return 0
	}
}

// nullTimeRFC3339 renders a nullable timestamp, or "" when NULL.
func nullTimeRFC3339(t sql.NullTime) string {
	if !t.Valid {
		return ""
	}
	return t.Time.Format(time.RFC3339)
}

// parseFlexBool interprets the assorted truthy encodings a boolean-ish column
// may hold ("true"/"t"/"1"/"yes") across TEXT and BOOLEAN column types.
func parseFlexBool(s string) bool {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "true", "t", "1", "yes", "y", "on":
		return true
	default:
		return false
	}
}

// columnExists reports whether a column is present on a table (Postgres).
func columnExists(db *sql.DB, table, column string) bool {
	var exists bool
	err := db.QueryRow(
		"SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2)",
		table, column,
	).Scan(&exists)
	return err == nil && exists
}

// Loan application handlers
func GetLoanApplications(c *gin.Context) {
	startTime := time.Now()
	chamaID := c.Query("chamaId")
	if chamaID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "chamaId parameter is required",
		})
		return
	}

	// Get database connection
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}

	// Check loans for this specific chama
	var chamaLoans int
	err := db.(*sql.DB).QueryRow("SELECT COUNT(*) FROM loans WHERE chama_id = $1", chamaID).Scan(&chamaLoans)
	if err != nil {
		// fmt.Printf("❌ Failed to count loans for chama: %v\n", err)
	} else {
		// fmt.Printf("🔍 Loans for chamaId %s: %d\n", chamaID, chamaLoans)
	}

	// Debug: Show all unique chama_ids in loans table
	chamaRows, err := db.(*sql.DB).Query("SELECT DISTINCT chama_id, COUNT(*) FROM loans GROUP BY chama_id")
	if err == nil {
		// fmt.Printf("🔍 All chamaIds with loans:\n")
		for chamaRows.Next() {
			var cid string
			var count int
			if chamaRows.Scan(&cid, &count) == nil {
				fmt.Printf("   - %s: %d loans\n", cid, count)
			}
		}
		chamaRows.Close()
	}

	// Query loan applications. Referee columns are read defensively so a database
	// that has not yet run the referee migration still works.
	refCols := "COALESCE(l.required_referees, 0), COALESCE(l.approved_referees, 0)"
	if !columnExists(db.(*sql.DB), "loans", "required_referees") {
		refCols = "0, 0"
	}
	rows, err := db.(*sql.DB).Query(fmt.Sprintf(`
		SELECT
			l.id, l.borrower_id, l.chama_id, l.amount, l.interest_rate,
			l.duration, l.purpose, l.status, l.total_amount, l.remaining_amount,
			l.required_guarantors, l.approved_guarantors, l.due_date, l.created_at,
			u.first_name, u.last_name, u.email,
			%s,
			COALESCE(l.approval_stage, '')
		FROM loans l
		JOIN users u ON l.borrower_id = u.id
		WHERE l.chama_id = $1
		ORDER BY l.created_at DESC
	`, refCols), chamaID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to fetch loan applications: " + err.Error(),
		})
		return
	}
	defer rows.Close()

	var loans []map[string]interface{}
	for rows.Next() {
		var loan struct {
			ID                 string
			BorrowerID         string
			ChamaID            string
			Amount             float64
			InterestRate       float64
			Duration           int
			Purpose            string
			Status             string
			TotalAmount        float64
			RemainingAmount    float64
			RequiredGuarantors int
			ApprovedGuarantors int
			DueDate            sql.NullTime
			CreatedAt          sql.NullTime
			BorrowerFirstName  string
			BorrowerLastName   string
			BorrowerEmail      string
			RequiredReferees   int
			ApprovedReferees   int
			ApprovalStage      string
		}

		err := rows.Scan(
			&loan.ID, &loan.BorrowerID, &loan.ChamaID, &loan.Amount, &loan.InterestRate,
			&loan.Duration, &loan.Purpose, &loan.Status, &loan.TotalAmount, &loan.RemainingAmount,
			&loan.RequiredGuarantors, &loan.ApprovedGuarantors, &loan.DueDate, &loan.CreatedAt,
			&loan.BorrowerFirstName, &loan.BorrowerLastName, &loan.BorrowerEmail,
			&loan.RequiredReferees, &loan.ApprovedReferees, &loan.ApprovalStage,
		)
		if err != nil {
			fmt.Printf("GetLoanApplications: skipped loan row: %v\n", err)
			continue // Skip invalid rows
		}

		loanMap := map[string]interface{}{
			"id":                 loan.ID,
			"borrowerId":         loan.BorrowerID,
			"chamaId":            loan.ChamaID,
			"amount":             loan.Amount,
			"interestRate":       loan.InterestRate,
			"duration":           loan.Duration,
			"purpose":            loan.Purpose,
			"status":             loan.Status,
			"totalAmount":        loan.TotalAmount,
			"remainingAmount":    loan.RemainingAmount,
			"requiredGuarantors": loan.RequiredGuarantors,
			"approvedGuarantors": loan.ApprovedGuarantors,
			"requiredReferees":   loan.RequiredReferees,
			"approvedReferees":   loan.ApprovedReferees,
			"approvalStage":      loan.ApprovalStage,
			"dueDate":            nullTimeRFC3339(loan.DueDate),
			"createdAt":          nullTimeRFC3339(loan.CreatedAt),
			"borrower": map[string]interface{}{
				"id":        loan.BorrowerID,
				"firstName": loan.BorrowerFirstName,
				"lastName":  loan.BorrowerLastName,
				"email":     loan.BorrowerEmail,
				"fullName":  loan.BorrowerFirstName + " " + loan.BorrowerLastName,
			},
		}

		loans = append(loans, loanMap)
	}

	duration := time.Since(startTime)
	fmt.Printf("GetLoanApplications completed in %v for chamaId: %s\n", duration, chamaID)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    loans,
		"message": fmt.Sprintf("Found %d loan applications", len(loans)),
		"meta": map[string]interface{}{
			"total":   len(loans),
			"chamaId": chamaID,
		},
	})
	c.Abort()
}

func CreateLoanApplication(c *gin.Context) {
	// Get user ID from context (set by auth middleware)
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	var req struct {
		ChamaID         string                 `json:"chamaId" binding:"required"`
		LoanTypeID      string                 `json:"loanTypeId"`
		LoanTypeName    string                 `json:"loanTypeName"`
		Amount          float64                `json:"amount" binding:"required"`
		Purpose         string                 `json:"purpose" binding:"required"`
		RepaymentPeriod int                    `json:"repaymentPeriod" binding:"required"`
		InterestRate    float64                `json:"interestRate" binding:"required"`
		Guarantors      []string               `json:"guarantors"`
		Referees        []string               `json:"referees"`
		Security        map[string]interface{} `json:"security"`
		BusinessPlan    string                 `json:"businessPlan"`
		MonthlyIncome   float64                `json:"monthlyIncome" binding:"required"`
		OtherLoans      string                 `json:"otherLoans"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request data: " + err.Error(),
		})
		return
	}

	// Validate amount
	if req.Amount <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Amount must be greater than 0",
		})
		return
	}

	// Get database connection
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}
	sqlDB := db.(*sql.DB)

	// Funding gate: the chama must have enough LOANABLE funds
	// (combined wallet balance − welfare − merry-go-round − already-approved
	// undisbursed loans) to cover this request before it enters the approval
	// workflow. Re-checked again just before disbursement.
	if lf, lerr := chamaLoanableFunds(sqlDB, req.ChamaID, ""); lerr == nil {
		if req.Amount > lf.Loanable+0.0001 {
			c.JSON(http.StatusUnprocessableEntity, gin.H{
				"success":  false,
				"error":    fmt.Sprintf("The chama currently has KES %.2f available for loans. This request (KES %.2f) exceeds that.", lf.Loanable, req.Amount),
				"loanable": lf,
			})
			return
		}
	}

	// Resolve the loan type's backing requirements (guarantors and/or referees).
	// Read each column independently and cast to text: on older databases
	// `requires_guarantors` may be a TEXT column ('0'/'1'), and the referee
	// columns may not exist at all yet.
	requiresGuarantors := false
	requiresReferees := false
	minGuarantors := 0
	minReferees := 0
	if req.LoanTypeID != "" {
		readBool := func(col string) bool {
			if !columnExists(sqlDB, "loan_types", col) {
				return false
			}
			var raw sql.NullString
			if err := sqlDB.QueryRow(fmt.Sprintf("SELECT %s::text FROM loan_types WHERE id = $1", col), req.LoanTypeID).Scan(&raw); err != nil {
				return false
			}
			return parseFlexBool(raw.String)
		}
		readInt := func(col string) int {
			if !columnExists(sqlDB, "loan_types", col) {
				return 0
			}
			var n sql.NullInt64
			if err := sqlDB.QueryRow(fmt.Sprintf("SELECT %s FROM loan_types WHERE id = $1", col), req.LoanTypeID).Scan(&n); err != nil {
				return 0
			}
			return int(n.Int64)
		}
		requiresGuarantors = readBool("requires_guarantors")
		requiresReferees = readBool("requires_referees")
		minGuarantors = readInt("min_guarantors")
		minReferees = readInt("min_referees")
	}

	// Dedupe and drop the borrower from either list.
	req.Guarantors = uniqueStringsExcluding(req.Guarantors, userID.(string))
	req.Referees = uniqueStringsExcluding(req.Referees, userID.(string))

	if requiresGuarantors {
		need := minGuarantors
		if need < 1 {
			need = 2
		}
		if len(req.Guarantors) < need {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error":   fmt.Sprintf("This loan type requires at least %d guarantor(s)", need),
			})
			return
		}
	}
	if requiresReferees {
		need := minReferees
		if need < 1 {
			need = 1
		}
		if len(req.Referees) < need {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error":   fmt.Sprintf("This loan type requires at least %d referee(s)", need),
			})
			return
		}
	}
	// A guarantor cannot also be a referee on the same loan.
	if s := intersectStrings(req.Guarantors, req.Referees); s != "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "A person cannot be both a guarantor and a referee on the same loan",
		})
		return
	}

	// Start transaction
	tx, err := sqlDB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to start transaction",
		})
		return
	}
	defer tx.Rollback()

	// Generate loan ID with year-month prefix for easy identification
	loanID := fmt.Sprintf("%s%02d-%d", time.Now().Format("2006"), time.Now().Month(), time.Now().UnixNano()%1000000)

	// Calculate total amount with interest
	totalAmount := req.Amount * (1 + req.InterestRate/100)

	// Resolve a chama-member id ("cm-...") or raw user id to a real user id.
	resolveBacker := func(id string) (string, error) {
		if strings.HasPrefix(id, "cm-") {
			var realID string
			if err := tx.QueryRow(`SELECT user_id FROM chama_members WHERE id = $1 AND chama_id = $2`, id, req.ChamaID).Scan(&realID); err != nil {
				return "", err
			}
			return realID, nil
		}
		return id, nil
	}

	type backerInfo struct {
		userID   string
		recordID string
	}
	resolvedGuarantorIDs := make([]string, 0, len(req.Guarantors))
	guarantorRecords := make([]backerInfo, 0, len(req.Guarantors))
	for _, gID := range req.Guarantors {
		realID, rerr := resolveBacker(gID)
		if rerr != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": fmt.Sprintf("Invalid guarantor %s: %v", gID, rerr)})
			return
		}
		resolvedGuarantorIDs = append(resolvedGuarantorIDs, realID)
		guarantorRecords = append(guarantorRecords, backerInfo{userID: realID, recordID: fmt.Sprintf("guarantor-%d-%s", time.Now().UnixNano(), realID)})
	}

	resolvedRefereeIDs := make([]string, 0, len(req.Referees))
	refereeRecords := make([]backerInfo, 0, len(req.Referees))
	for _, rID := range req.Referees {
		realID, rerr := resolveBacker(rID)
		if rerr != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": fmt.Sprintf("Invalid referee %s: %v", rID, rerr)})
			return
		}
		resolvedRefereeIDs = append(resolvedRefereeIDs, realID)
		refereeRecords = append(refereeRecords, backerInfo{userID: realID, recordID: fmt.Sprintf("referee-%d-%s", time.Now().UnixNano(), realID)})
	}

	// Insert loan application. The referee columns are set separately below so a
	// database that has not yet run the referee migration still accepts the loan.
	_, err = tx.Exec(`
		INSERT INTO loans (
			id, borrower_id, chama_id, loan_type_id, type, amount, interest_rate,
			duration, purpose, status, total_amount, remaining_amount,
			required_guarantors, approved_guarantors,
			created_at, updated_at
		) VALUES ($1, $2, $3, $4, COALESCE(NULLIF($5, ''), 'regular'), $6, $7, $8, $9, 'pending', $10, $10, $11, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`, loanID, userID, req.ChamaID, req.LoanTypeID, req.LoanTypeName, req.Amount, req.InterestRate, req.RepaymentPeriod, req.Purpose, totalAmount, len(guarantorRecords))
	if err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{
			"success": false,
			"error":   "Failed to create loan application: " + err.Error(),
		})
		return
	}

	// Guarantors carry a liability figure; it starts as an equal split of the
	// outstanding amount and is kept live by RecalculateGuarantorExposure.
	if len(guarantorRecords) > 0 {
		startingExposure := totalAmount / float64(len(guarantorRecords))
		for _, info := range guarantorRecords {
			if _, err = tx.Exec(`
				INSERT INTO guarantors (id, loan_id, user_id, amount, status, created_at)
				VALUES ($1, $2, $3, $4, 'pending', CURRENT_TIMESTAMP)
			`, info.recordID, loanID, info.userID, startingExposure); err != nil {
				c.JSON(http.StatusUnprocessableEntity, gin.H{"success": false, "error": "Failed to add guarantor: " + err.Error()})
				return
			}
		}
	}

	// Commit transaction
	if err = tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to commit transaction",
		})
		return
	}

	// Referees vouch for character only — no amount is ever stored against them.
	// Recorded outside the loan transaction and best-effort so a lagging schema
	// cannot block loan creation.
	if len(refereeRecords) > 0 {
		if _, uerr := sqlDB.Exec("UPDATE loans SET required_referees = $1, approved_referees = 0 WHERE id = $2", len(refereeRecords), loanID); uerr != nil {
			fmt.Printf("Failed to set required_referees for loan %s: %v\n", loanID, uerr)
		}
		for _, info := range refereeRecords {
			if _, rerr := sqlDB.Exec(`
				INSERT INTO loan_referees (id, loan_id, user_id, status, created_at)
				VALUES ($1, $2, $3, 'pending', CURRENT_TIMESTAMP)
			`, info.recordID, loanID, info.userID); rerr != nil {
				fmt.Printf("Failed to add referee %s to loan %s: %v\n", info.userID, loanID, rerr)
			}
		}
	}

	// The in-app notification for guarantors / referees is generated live from
	// the guarantors / loan_referees tables by getGuarantorRefereeNotifications
	// (see notification_fetchers_handlers.go) — nothing to write here. Just fire
	// the OS push so backed members are alerted immediately.
	for _, info := range guarantorRecords {
		data := map[string]interface{}{
			"loan_id": loanID, "guarantor_id": info.recordID, "role": "guarantor",
			"amount": req.Amount, "chama_id": req.ChamaID,
		}
		go services.PushToUser(sqlDB, info.userID, "Guarantor Request",
			fmt.Sprintf("You have been requested to guarantee a loan of KES %.2f", req.Amount), data)
	}
	for _, info := range refereeRecords {
		data := map[string]interface{}{
			"loan_id": loanID, "referee_id": info.recordID, "role": "referee",
			"amount": req.Amount, "chama_id": req.ChamaID,
		}
		go services.PushToUser(sqlDB, info.userID, "Referee Request",
			fmt.Sprintf("You have been listed as a referee for a loan of KES %.2f. Being a referee carries no financial liability.", req.Amount), data)
	}

	backerMsg := "Loan application submitted successfully."
	if len(guarantorRecords) > 0 && len(refereeRecords) > 0 {
		backerMsg += " Guarantors and referees will be notified."
	} else if len(guarantorRecords) > 0 {
		backerMsg += " Guarantors will be notified."
	} else if len(refereeRecords) > 0 {
		backerMsg += " Referees will be notified."
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"message": backerMsg,
		"data": map[string]interface{}{
			"id":                 loanID,
			"chamaId":            req.ChamaID,
			"borrowerId":         userID,
			"amount":             req.Amount,
			"purpose":            req.Purpose,
			"repaymentPeriod":    req.RepaymentPeriod,
			"interestRate":       req.InterestRate,
			"guarantors":         resolvedGuarantorIDs,
			"referees":           resolvedRefereeIDs,
			"totalAmount":        totalAmount,
			"remainingAmount":    totalAmount,
			"status":             "pending",
			"requiredGuarantors": len(guarantorRecords),
			"approvedGuarantors": 0,
			"requiredReferees":   len(refereeRecords),
			"approvedReferees":   0,
			"createdAt":          time.Now().Format(time.RFC3339),
		},
	})
}

// uniqueStringsExcluding returns the distinct non-empty entries of in, dropping
// any that equal exclude, preserving order.
func uniqueStringsExcluding(in []string, exclude string) []string {
	seen := make(map[string]bool, len(in))
	out := make([]string, 0, len(in))
	for _, v := range in {
		v = strings.TrimSpace(v)
		if v == "" || v == exclude || seen[v] {
			continue
		}
		seen[v] = true
		out = append(out, v)
	}
	return out
}

// intersectStrings returns the first element present in both slices, or "".
func intersectStrings(a, b []string) string {
	set := make(map[string]bool, len(a))
	for _, v := range a {
		set[v] = true
	}
	for _, v := range b {
		if set[v] {
			return v
		}
	}
	return ""
}

func GetLoanApplication(c *gin.Context) {
	loanID := c.Param("id")
	if loanID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Loan ID is required",
		})
		return
	}

	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}

	loan, err := services.NewLoanService(db.(*sql.DB)).GetLoanByID(loanID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Loan not found",
		})
		return
	}

	var borrowerFirstName, borrowerLastName, borrowerEmail string
	err = db.(*sql.DB).QueryRow(
		"SELECT first_name, last_name, email FROM users WHERE id = $1",
		loan.BorrowerID,
	).Scan(&borrowerFirstName, &borrowerLastName, &borrowerEmail)
	if err != nil {
		borrowerFirstName = "Unknown"
		borrowerLastName = "User"
		borrowerEmail = ""
	}

	// Extra fields not in the shared GetLoanByID scan — best effort (columns may
	// be absent on an un-migrated DB). Referee counts come straight from the
	// live table so the loan-details screen's approval gating is always correct.
	var loanTypeID sql.NullString
	_ = db.(*sql.DB).QueryRow("SELECT loan_type_id FROM loans WHERE id = $1", loan.ID).Scan(&loanTypeID)

	var requiredReferees, approvedReferees int
	_ = db.(*sql.DB).QueryRow(`
		SELECT
			(SELECT COUNT(*) FROM loan_referees WHERE loan_id = $1),
			(SELECT COUNT(*) FROM loan_referees WHERE loan_id = $1 AND lower(status) = 'accepted')
	`, loan.ID).Scan(&requiredReferees, &approvedReferees)

	// Re-derive the guarantor accept count from the live table too (don't trust a
	// possibly-stale denormalised counter).
	var acceptedGuarantors, totalGuarantors int
	_ = db.(*sql.DB).QueryRow(`
		SELECT
			(SELECT COUNT(*) FROM guarantors WHERE loan_id = $1),
			(SELECT COUNT(*) FROM guarantors WHERE loan_id = $1 AND lower(status) = 'accepted')
	`, loan.ID).Scan(&totalGuarantors, &acceptedGuarantors)
	requiredGuarantors := loan.RequiredGuarantors
	if totalGuarantors > requiredGuarantors {
		requiredGuarantors = totalGuarantors
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": map[string]interface{}{
			"id":                    loan.ID,
			"borrowerId":            loan.BorrowerID,
			"chamaId":               loan.ChamaID,
			"loanTypeId":            loanTypeID.String,
			"type":                  loan.Type,
			"amount":                loan.Amount,
			"interestRate":          loan.InterestRate,
			"duration":              loan.Duration,
			"purpose":               loan.Purpose,
			"status":                loan.Status,
			"approvedBy":            loan.ApprovedBy,
			"approvedAt":            loan.ApprovedAt,
			"disbursedAt":           loan.DisbursedAt,
			"dueDate":               loan.DueDate,
			"totalAmount":           loan.TotalAmount,
			"paidAmount":            loan.PaidAmount,
			"remainingAmount":       loan.RemainingAmount,
			"requiredGuarantors":    requiredGuarantors,
			"approvedGuarantors":    acceptedGuarantors,
			"requiredReferees":      requiredReferees,
			"approvedReferees":      approvedReferees,
			"approvalStage":         loan.ApprovalStage,
			"secretaryApprovedBy":   loan.SecretaryApprovedBy,
			"secretaryApprovedAt":   loan.SecretaryApprovedAt,
			"secretaryComment":      loan.SecretaryComment,
			"treasurerApprovedBy":   loan.TreasurerApprovedBy,
			"treasurerApprovedAt":   loan.TreasurerApprovedAt,
			"treasurerComment":      loan.TreasurerComment,
			"chairpersonApprovedBy": loan.ChairpersonApprovedBy,
			"chairpersonApprovedAt": loan.ChairpersonApprovedAt,
			"chairpersonComment":    loan.ChairpersonComment,
			"rejectedBy":            loan.RejectedBy,
			"rejectedReason":        loan.RejectedReason,
			"rejectedAt":            loan.RejectedAt,
			"createdAt":             loan.CreatedAt,
			"updatedAt":             loan.UpdatedAt,
			"borrower": map[string]interface{}{
				"id":        loan.BorrowerID,
				"firstName": borrowerFirstName,
				"lastName":  borrowerLastName,
				"email":     borrowerEmail,
				"fullName":  borrowerFirstName + " " + borrowerLastName,
			},
		},
	})
	c.Abort()
}

// GetLoanRepaymentHistory returns disbursement info, installment schedule,
// and repayment history (successful and failed) for a loan.
func GetLoanRepaymentHistory(c *gin.Context) {
	loanID := c.Param("id")
	if loanID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Loan ID is required",
		})
		return
	}

	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}
	sqlDB := db.(*sql.DB)

	loanService := services.NewLoanService(sqlDB)

	loan, err := loanService.GetLoanByID(loanID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Loan not found",
		})
		return
	}

	payments, err := loanService.GetLoanPayments(loanID)
	if err != nil {
		payments = nil
	}

	type disbursementInfo struct {
		ID          string     `json:"id"`
		Status      string     `json:"status"`
		Amount      float64    `json:"amount"`
		Description string     `json:"description"`
		Reference   string     `json:"reference"`
		CreatedAt   time.Time  `json:"createdAt"`
		UpdatedAt   *time.Time `json:"updatedAt,omitempty"`
	}

	var dB disbursementInfo
	disbursementTx := interface{}(nil)
	err = sqlDB.QueryRow(`
		SELECT id, status, amount, description, reference, created_at, updated_at
		FROM transactions
		WHERE reference ILIKE $1 AND type = 'loan'
		ORDER BY created_at DESC LIMIT 1
	`, "LOAN-DISB-%-"+loanID).Scan(
		&dB.ID, &dB.Status, &dB.Amount, &dB.Description,
		&dB.Reference, &dB.CreatedAt, &dB.UpdatedAt,
	)
	if err == nil {
		disbursementTx = dB
	} else if err != sql.ErrNoRows {
		fmt.Printf("Error fetching disbursement transaction for loan %s: %v\n", loanID, err)
	}

	type installment struct {
		Number    int     `json:"number"`
		DueDate   string  `json:"dueDate"`
		Amount    float64 `json:"amount"`
		Principal float64 `json:"principal"`
		Interest  float64 `json:"interest"`
		Status    string  `json:"status"`
	}

	var schedule []installment
	if loan.DisbursedAt != nil && loan.Duration > 0 && loan.TotalAmount > 0 {
		monthlyPayment := loan.TotalAmount / float64(loan.Duration)
		monthlyInterest := 0.0
		monthlyPrincipal := monthlyPayment
		if loan.TotalAmount > loan.Amount {
			monthlyInterest = (loan.TotalAmount - loan.Amount) / float64(loan.Duration)
			monthlyPrincipal = monthlyPayment - monthlyInterest
		}

		startDate := *loan.DisbursedAt
		paidInstallments := 0
		if monthlyPayment > 0 {
			paidInstallments = int(loan.PaidAmount / monthlyPayment)
		}
		if paidInstallments > loan.Duration {
			paidInstallments = loan.Duration
		}

		// Round to 2 decimal places
		round := func(v float64) float64 {
			return float64(int64(v*100+0.5)) / 100
		}

		for i := 1; i <= loan.Duration; i++ {
			dueDate := startDate.AddDate(0, i, 0)
			status := "pending"
			if i <= paidInstallments {
				status = "paid"
			} else if loan.Status == "completed" {
				status = "paid"
			}

			schedule = append(schedule, installment{
				Number:    i,
				DueDate:   dueDate.Format(time.RFC3339),
				Amount:    round(monthlyPayment),
				Principal: round(monthlyPrincipal),
				Interest:  round(monthlyInterest),
				Status:    status,
			})
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": map[string]interface{}{
			"loan": map[string]interface{}{
				"id":                    loan.ID,
				"status":                loan.Status,
				"amount":                loan.Amount,
				"totalAmount":           loan.TotalAmount,
				"paidAmount":            loan.PaidAmount,
				"remainingAmount":       loan.RemainingAmount,
				"duration":              loan.Duration,
				"interestRate":          loan.InterestRate,
				"disbursedAt":           loan.DisbursedAt,
				"dueDate":               loan.DueDate,
				"approvalStage":         loan.ApprovalStage,
				"secretaryApprovedBy":   loan.SecretaryApprovedBy,
				"secretaryApprovedAt":   loan.SecretaryApprovedAt,
				"secretaryComment":      loan.SecretaryComment,
				"treasurerApprovedBy":   loan.TreasurerApprovedBy,
				"treasurerApprovedAt":   loan.TreasurerApprovedAt,
				"treasurerComment":      loan.TreasurerComment,
				"chairpersonApprovedBy": loan.ChairpersonApprovedBy,
				"chairpersonApprovedAt": loan.ChairpersonApprovedAt,
				"chairpersonComment":    loan.ChairpersonComment,
				"rejectedBy":            loan.RejectedBy,
				"rejectedReason":        loan.RejectedReason,
				"rejectedAt":            loan.RejectedAt,
			},
			"disbursement": disbursementTx,
			"schedule":     schedule,
			"payments":     payments,
		},
	})
	c.Abort()
}

// RecordLoanPayment records a manual repayment for an active loan.
func RecordLoanPayment(c *gin.Context) {
	loanID := c.Param("id")
	if loanID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Loan ID is required",
		})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	var req struct {
		Amount        float64 `json:"amount" binding:"required,gt=0"`
		PaymentMethod string  `json:"paymentMethod" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request data: " + err.Error(),
		})
		return
	}

	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}

	payment, err := services.NewLoanService(db.(*sql.DB)).MakeLoanPayment(loanID, userID.(string), req.Amount, req.PaymentMethod)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"message": "Loan payment recorded successfully",
		"data":    payment,
	})
}

// GetLoanGuarantors returns guarantors for a loan
func GetLoanGuarantors(c *gin.Context) {
	loanID := c.Param("id")
	if loanID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Loan ID is required",
		})
		return
	}

	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}

	guarantors, err := services.NewLoanService(db.(*sql.DB)).GetLoanGuarantors(loanID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to get guarantors: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    guarantors,
	})
	c.Abort()
}

// GetLoanFines returns fines for a loan
func GetLoanFines(c *gin.Context) {
	loanID := c.Param("id")
	if loanID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Loan ID is required",
		})
		return
	}

	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}

	fines, err := services.NewLoanService(db.(*sql.DB)).GetLoanFines(loanID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to get fines: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    fines,
	})
	c.Abort()
}

func UpdateLoanApplication(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Update loan application endpoint - coming soon",
	})
	c.Abort()
}

func DeleteLoanApplication(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Delete loan application endpoint - coming soon",
	})
	c.Abort()
}
