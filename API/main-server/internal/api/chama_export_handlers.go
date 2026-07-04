package api

import (
	"database/sql"
	"fmt"
	"net/http"
	"time"

	"vaultke-backend/internal/services"
	"vaultke-backend/internal/utils"

	"github.com/gin-gonic/gin"
	"github.com/xuri/excelize/v2"
)

// ExportChamaMembers exports chama members as an Excel file
func ExportChamaMembers(c *gin.Context) {
	chamaID := c.Param("id")
	if chamaID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Chama ID is required",
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

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	chamaService := services.NewChamaService(db.(*sql.DB))

	// Check if user is a member of this chama and has permission to export
	userRole, err := chamaService.GetUserRoleInChama(chamaID, userID.(string))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "You are not a member of this chama",
		})
		return
	}

	// Only chairperson, secretary, and treasurer can export
	if userRole != "chairperson" && userRole != "secretary" && userRole != "treasurer" {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "You do not have permission to export members",
		})
		return
	}

	// Query to get members with their details
	members, err := getChamaMembersForExport(db.(*sql.DB), chamaID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to fetch chama members: " + err.Error(),
		})
		return
	}

	// Create Excel file
	f := excelize.NewFile()
	defer f.Close()

	// Create a new sheet
	sheetName := "Members"
	index, err := f.NewSheet(sheetName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create Excel sheet",
		})
		return
	}

	// Set headers - includes Shares and Dividends
	headers := []string{"No.", "Full Name", "Role", "Phone Number", "National ID", "Join Date", "Savings Balance", "Loan Balance", "Shares Owned", "Dividends Received", "Contributions Made", "Meetings Attended"}
	for i, header := range headers {
		cell := fmt.Sprintf("%s%d", string(rune('A'+i)), 1)
		f.SetCellValue(sheetName, cell, header)
	}

	// Calculate last header column for styling
	lastHeaderCol := string(rune('A' + len(headers) - 1))

	// Set column widths
	widths := []float64{6.0, 20.0, 12.0, 15.0, 18.0, 12.0, 15.0, 12.0, 12.0, 15.0, 15.0, 15.0}
	for i, width := range widths {
		col, _ := excelize.ColumnNumberToName(i + 1)
		f.SetColWidth(sheetName, col, col, width)
	}

	// Style for header row
	headerStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Color: "FFFFFF"},
		Fill:      excelize.Fill{Type: "pattern", Color: []string{"4472C4"}, Pattern: 1},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
	})
	f.SetCellStyle(sheetName, "A1", lastHeaderCol+fmt.Sprintf("%d", 1), headerStyle)

	// Populate data rows
	for i, member := range members {
		row := i + 2
		fullName := fmt.Sprintf("%s %s", member.FirstName, member.LastName)
		_ = f.SetCellValue(sheetName, fmt.Sprintf("A%d", row), i+1)
		_ = f.SetCellValue(sheetName, fmt.Sprintf("B%d", row), fullName)
		_ = f.SetCellValue(sheetName, fmt.Sprintf("C%d", row), member.Role)
		_ = f.SetCellValue(sheetName, fmt.Sprintf("D%d", row), member.Phone)
		_ = f.SetCellValue(sheetName, fmt.Sprintf("E%d", row), member.NationalID)
		_ = f.SetCellValue(sheetName, fmt.Sprintf("F%d", row), member.JoinedAt[:10])
		_ = f.SetCellValue(sheetName, fmt.Sprintf("G%d", row), member.SavingsBalance)
		_ = f.SetCellValue(sheetName, fmt.Sprintf("H%d", row), member.LoanBalance)
		_ = f.SetCellValue(sheetName, fmt.Sprintf("I%d", row), member.SharesOwned)
		_ = f.SetCellValue(sheetName, fmt.Sprintf("J%d", row), member.DividendsReceived)
		_ = f.SetCellValue(sheetName, fmt.Sprintf("K%d", row), member.ContributionsMade)
		_ = f.SetCellValue(sheetName, fmt.Sprintf("L%d", row), member.MeetingsAttended)
	}

	// Set active sheet
	f.SetActiveSheet(index)

	// Generate filename with timestamp
	fileName := fmt.Sprintf("ChamaMembers_%s_%s.xlsx", chamaID[:8], time.Now().Format("2006-01-02"))

	// Write to buffer
	buffer, err := f.WriteToBuffer()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to generate Excel file",
		})
		return
	}

	// Set response headers for file download
	c.Header("Access-Control-Allow-Origin", "*")
	c.Header("Access-Control-Expose-Headers", "Content-Disposition, Content-Length")
	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", fileName))
	c.Header("Content-Length", fmt.Sprintf("%d", buffer.Len()))

	// Write file
	c.Writer.Write(buffer.Bytes())
}

// getChamaMembersForExport retrieves members from the database for Excel export
func getChamaMembersForExport(db *sql.DB, chamaID string) ([]MemberExportRow, error) {
	query := `
		SELECT
			cm.id, cm.user_id, cm.role, cm.joined_at,
			u.first_name, u.last_name, u.phone, u.id_number,
			COALESCE(w.balance, 0) as savings_balance,
			COALESCE(loan_balance.balance, 0) as loan_balance,
			COALESCE(shares.shares_total, 0) as shares_owned,
			COALESCE(dividends.total_dividends, 0) as dividends_received,
			COALESCE(contrib_stats.contributions_made, 0) as contributions_made,
			COALESCE(meeting_stats.meetings_attended, 0) as meetings_attended
		FROM chama_members cm
		INNER JOIN users u ON cm.user_id = u.id
		LEFT JOIN wallets w ON u.id = w.owner_id AND w.type = 'personal'
		LEFT JOIN (
			SELECT
				borrower_id,
				COALESCE(SUM(remaining_amount), 0) as balance
			FROM loans
			WHERE chama_id = $1 AND status IN ('approved', 'disbursed', 'active')
			GROUP BY borrower_id
		) loan_balance ON u.id = loan_balance.borrower_id
		LEFT JOIN (
			SELECT
				member_id,
				COALESCE(SUM(shares_owned), 0) as shares_total
			FROM shares
			WHERE chama_id = $2 AND status = 'active'
			GROUP BY member_id
		) shares ON u.id = shares.member_id
		LEFT JOIN (
			SELECT
				member_id,
				COALESCE(SUM(dividend_amount), 0) as total_dividends
			FROM dividend_payments
			WHERE payment_status = 'paid'
			GROUP BY member_id
		) dividends ON u.id = dividends.member_id
		LEFT JOIN (
			SELECT
				initiated_by,
				COUNT(*) as contributions_made
			FROM transactions
			WHERE type = 'contribution' AND chama_id = $3
			GROUP BY initiated_by
		) contrib_stats ON u.id = contrib_stats.initiated_by
		LEFT JOIN (
			SELECT
				cm.user_id,
				COUNT(*) as meetings_attended
			FROM chama_members cm
			INNER JOIN meeting_attendance ma ON cm.user_id = ma.user_id
			INNER JOIN meetings m ON ma.meeting_id = m.id
			WHERE m.chama_id = $4
			GROUP BY cm.user_id
		) meeting_stats ON u.id = meeting_stats.user_id
		WHERE cm.chama_id = $5 AND cm.is_active = true
		ORDER BY cm.joined_at ASC
	`

	rows, err := db.Query(query, chamaID, chamaID, chamaID, chamaID, chamaID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var members []MemberExportRow
	for rows.Next() {
		var m MemberExportRow
		var phone, idNumber sql.NullString
		var sharesOwned sql.NullInt64
		var dividendsReceived sql.NullFloat64
		if err := rows.Scan(
			&m.ID, &m.UserID, &m.Role, &m.JoinedAt,
			&m.FirstName, &m.LastName, &phone, &idNumber,
			&m.SavingsBalance, &m.LoanBalance, &sharesOwned, &dividendsReceived,
			&m.ContributionsMade, &m.MeetingsAttended,
		); err != nil {
			continue
		}
		m.Phone = maskPhoneForDisplay(phone.String)
		if idNumber.Valid {
			m.NationalID = maskIDForDisplay(idNumber.String)
		} else {
			m.NationalID = "N/A"
		}
		if sharesOwned.Valid {
			m.SharesOwned = int(sharesOwned.Int64)
		}
		if dividendsReceived.Valid {
			m.DividendsReceived = dividendsReceived.Float64
		}
		members = append(members, m)
	}

	return members, nil
}

// MemberExportRow represents a member row for Excel export
type MemberExportRow struct {
	ID               string
	UserID           string
	Role             string
	FirstName        string
	LastName         string
	Phone            string
	NationalID       string
	JoinedAt         string
	SavingsBalance   float64
	LoanBalance      float64
	SharesOwned      int
	DividendsReceived float64
	ContributionsMade int
	MeetingsAttended  int
}

// maskPhoneForDisplay masks phone number for export (privacy)
func maskPhoneForDisplay(phone string) string {
	if phone == "" {
		return "N/A"
	}
	// Use the existing MaskPhone function for consistent masking
	return utils.MaskPhone(phone)
}

// maskIDForDisplay returns the national ID for export using utils.MaskID
func maskIDForDisplay(id string) string {
	return utils.MaskID(id)
}

// ExportSavingsTransactions exports savings transactions as an Excel file
func ExportSavingsTransactions(c *gin.Context) {
	chamaID := c.Param("id")
	if chamaID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Chama ID is required",
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

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	chamaService := services.NewChamaService(db.(*sql.DB))

	// Check if user is a member of this chama and has permission to export
	userRole, err := chamaService.GetUserRoleInChama(chamaID, userID.(string))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "You are not a member of this chama",
		})
		return
	}

	// Only chairperson, secretary, and treasurer can export
	if userRole != "chairperson" && userRole != "secretary" && userRole != "treasurer" {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "You do not have permission to export savings transactions",
		})
		return
	}

	savingsWalletID := fmt.Sprintf("wallet-%s-savings", chamaID)

	// Query savings transactions
	query := `
		SELECT
			t.id, t.amount, t.description, t.status, t.payment_method,
			t.created_at, u.first_name, u.last_name, u.phone
		FROM transactions t
		JOIN users u ON t.initiated_by = u.id
		WHERE t.to_wallet_id = $1 AND t.status = 'completed'
		ORDER BY t.created_at DESC
	`

	rows, err := db.(*sql.DB).Query(query, savingsWalletID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to fetch savings transactions: " + err.Error(),
		})
		return
	}
	defer rows.Close()

	var transactions []SavingsTransactionExport
	for rows.Next() {
		var t SavingsTransactionExport
		var phone sql.NullString
		if err := rows.Scan(
			&t.ID, &t.Amount, &t.Description, &t.Status, &t.PaymentMethod,
			&t.CreatedAt, &t.FirstName, &t.LastName, &phone,
		); err != nil {
			continue
		}
		t.MemberName = fmt.Sprintf("%s %s", t.FirstName, t.LastName)
		if phone.Valid {
			t.Phone = utils.MaskPhone(phone.String)
		}
		transactions = append(transactions, t)
	}

	// Create Excel file
	f := excelize.NewFile()
	defer f.Close()

	sheetName := "Savings Transactions"
	index, err := f.NewSheet(sheetName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create Excel sheet",
		})
		return
	}

	headers := []string{"No.", "Transaction ID", "Member", "Phone", "Amount (KES)", "Description", "Payment Method", "Date", "Status"}
	for i, header := range headers {
		cell := fmt.Sprintf("%s%d", string(rune('A'+i)), 1)
		f.SetCellValue(sheetName, cell, header)
	}

	lastHeaderCol := string(rune('A' + len(headers) - 1))

	widths := []float64{6.0, 20.0, 20.0, 15.0, 15.0, 25.0, 15.0, 20.0, 10.0}
	for i, width := range widths {
		col, _ := excelize.ColumnNumberToName(i + 1)
		f.SetColWidth(sheetName, col, col, width)
	}

	headerStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Color: "FFFFFF"},
		Fill:      excelize.Fill{Type: "pattern", Color: []string{"28A745"}, Pattern: 1},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
	})
	f.SetCellStyle(sheetName, "A1", lastHeaderCol+fmt.Sprintf("%d", 1), headerStyle)

	for i, txn := range transactions {
		row := i + 2
		f.SetCellValue(sheetName, fmt.Sprintf("A%d", row), i+1)
		f.SetCellValue(sheetName, fmt.Sprintf("B%d", row), txn.ID)
		f.SetCellValue(sheetName, fmt.Sprintf("C%d", row), txn.MemberName)
		f.SetCellValue(sheetName, fmt.Sprintf("D%d", row), txn.Phone)
		f.SetCellValue(sheetName, fmt.Sprintf("E%d", row), txn.Amount)
		f.SetCellValue(sheetName, fmt.Sprintf("F%d", row), txn.Description)
		f.SetCellValue(sheetName, fmt.Sprintf("G%d", row), txn.PaymentMethod)
		f.SetCellValue(sheetName, fmt.Sprintf("H%d", row), txn.CreatedAt[:10])
		f.SetCellValue(sheetName, fmt.Sprintf("I%d", row), txn.Status)
	}

	f.SetActiveSheet(index)

	fileName := fmt.Sprintf("SavingsTransactions_%s_%s.xlsx", chamaID[:8], time.Now().Format("2006-01-02"))

	buffer, err := f.WriteToBuffer()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to generate Excel file",
		})
		return
	}

	c.Header("Access-Control-Allow-Origin", "*")
	c.Header("Access-Control-Expose-Headers", "Content-Disposition, Content-Length")
	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", fileName))
	c.Header("Content-Length", fmt.Sprintf("%d", buffer.Len()))

	c.Writer.Write(buffer.Bytes())
}

// SavingsTransactionExport represents a savings transaction row for Excel export
type SavingsTransactionExport struct {
	ID            string
	Amount        float64
	Description   string
	Status        string
	PaymentMethod string
	CreatedAt     string
	FirstName     string
	LastName      string
	MemberName    string
	Phone         string
}