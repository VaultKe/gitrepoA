package api

import (
	"database/sql"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jung-kurt/gofpdf"

	"vaultke-backend/internal/models"
	"vaultke-backend/internal/services"
)

// loanReportAppName is the platform that owns the copyright on generated
// reports. The chama is the issuing party; the app is the generator.
const loanReportAppName = "VaultKe"

// palette
var (
	rpInk    = [3]int{17, 24, 39}
	rpMuted  = [3]int{107, 114, 128}
	rpAccent = [3]int{0, 150, 136}
	rpHair   = [3]int{226, 232, 240}
	rpBand   = [3]int{15, 23, 42}
	rpZebra  = [3]int{247, 249, 251}
	rpOK     = [3]int{5, 150, 105}
	rpBad    = [3]int{220, 38, 38}
	rpWarn   = [3]int{202, 138, 4}
)

// DownloadLoanReport streams a full, formatted PDF dossier for a loan.
func DownloadLoanReport(c *gin.Context) {
	loanID := c.Param("id")
	if loanID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Loan ID is required"})
		return
	}

	dbVal, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Database connection not available"})
		return
	}
	db := dbVal.(*sql.DB)
	svc := services.NewLoanService(db)

	loan, err := svc.GetLoanByID(loanID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "Loan not found"})
		return
	}

	rd := gatherLoanReport(db, svc, loan)
	pdf := renderLoanReportPDF(rd)

	var buf strings.Builder
	if perr := pdf.Output(strWriter{&buf}); perr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to render report"})
		return
	}
	body := []byte(buf.String())

	filename := fmt.Sprintf("loan-report-%s.pdf", strings.ReplaceAll(loan.ID, "/", "-"))
	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	c.Data(http.StatusOK, "application/pdf", body)
}

type strWriter struct{ b *strings.Builder }

func (w strWriter) Write(p []byte) (int, error) { return w.b.Write(p) }

/* ---------------------------------------------------------------- *
 *  Data gathering
 * ---------------------------------------------------------------- */

type lrBacker struct {
	Name   string
	Amount float64
	Status string
}
type lrApproval struct {
	Role    string
	Name    string
	At      *time.Time
	Comment string
}
type lrInstallment struct {
	Number  int
	DueDate time.Time
	Amount  float64
	Status  string
}
type lrPayment struct {
	Amount    float64
	Method    string
	Reference string
	PaidAt    time.Time
}
type lrFine struct {
	Reason    string
	Amount    float64
	Status    string
	CreatedAt time.Time
}

type loanReportData struct {
	L *models.Loan

	ChamaName     string
	BorrowerName  string
	BorrowerEmail string
	LoanTypeName  string

	Guarantors []lrBacker
	Referees   []lrBacker
	Approvals  []lrApproval
	Schedule   []lrInstallment
	Payments   []lrPayment
	Fines      []lrFine

	DisbAmount    float64
	DisbStatus    string
	DisbReference string
	DisbAt        *time.Time
}

func deref(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

func userName(db *sql.DB, id string) string {
	if id == "" {
		return ""
	}
	var f, l string
	if err := db.QueryRow("SELECT COALESCE(first_name,''), COALESCE(last_name,'') FROM users WHERE id = $1", id).Scan(&f, &l); err != nil {
		return "—"
	}
	n := strings.TrimSpace(f + " " + l)
	if n == "" {
		return "—"
	}
	return n
}

func gatherLoanReport(db *sql.DB, svc *services.LoanService, loan *models.Loan) *loanReportData {
	rd := &loanReportData{L: loan}

	{
		var f, ln, em string
		if err := db.QueryRow(`SELECT COALESCE(first_name,''), COALESCE(last_name,''), COALESCE(email,'') FROM users WHERE id = $1`, loan.BorrowerID).Scan(&f, &ln, &em); err == nil {
			rd.BorrowerName = strings.TrimSpace(f + " " + ln)
			rd.BorrowerEmail = em
		}
	}
	if rd.BorrowerName == "" {
		rd.BorrowerName = "Unknown Borrower"
	}

	_ = db.QueryRow(`SELECT COALESCE(name,'') FROM chamas WHERE id = $1`, loan.ChamaID).Scan(&rd.ChamaName)
	if rd.ChamaName == "" {
		rd.ChamaName = "Chama"
	}

	_ = db.QueryRow(`
		SELECT COALESCE(lt.name,'')
		FROM loans l JOIN loan_types lt ON lt.id = l.loan_type_id
		WHERE l.id = $1`, loan.ID).Scan(&rd.LoanTypeName)

	// Guarantors
	if rows, err := db.Query(`
		SELECT COALESCE(u.first_name,''), COALESCE(u.last_name,''), COALESCE(g.amount,0), COALESCE(g.status,'pending')
		FROM guarantors g LEFT JOIN users u ON u.id = g.user_id
		WHERE g.loan_id = $1 ORDER BY g.created_at`, loan.ID); err == nil {
		for rows.Next() {
			var f, ln, st string
			var amt float64
			if rows.Scan(&f, &ln, &amt, &st) == nil {
				rd.Guarantors = append(rd.Guarantors, lrBacker{Name: strings.TrimSpace(f + " " + ln), Amount: amt, Status: st})
			}
		}
		rows.Close()
	}

	// Referees
	if rows, err := db.Query(`
		SELECT COALESCE(u.first_name,''), COALESCE(u.last_name,''), COALESCE(r.status,'pending')
		FROM loan_referees r LEFT JOIN users u ON u.id = r.user_id
		WHERE r.loan_id = $1 ORDER BY r.created_at`, loan.ID); err == nil {
		for rows.Next() {
			var f, ln, st string
			if rows.Scan(&f, &ln, &st) == nil {
				rd.Referees = append(rd.Referees, lrBacker{Name: strings.TrimSpace(f + " " + ln), Status: st})
			}
		}
		rows.Close()
	}

	// Approval trail
	add := func(role string, by *string, at *time.Time, comment *string) {
		if deref(by) == "" && at == nil {
			return
		}
		rd.Approvals = append(rd.Approvals, lrApproval{Role: role, Name: userName(db, deref(by)), At: at, Comment: deref(comment)})
	}
	add("Secretary", loan.SecretaryApprovedBy, loan.SecretaryApprovedAt, loan.SecretaryComment)
	add("Treasurer", loan.TreasurerApprovedBy, loan.TreasurerApprovedAt, loan.TreasurerComment)
	add("Chairperson", loan.ChairpersonApprovedBy, loan.ChairpersonApprovedAt, loan.ChairpersonComment)

	// Payments
	if pays, err := svc.GetLoanPayments(loan.ID); err == nil {
		for _, p := range pays {
			rd.Payments = append(rd.Payments, lrPayment{Amount: p.Amount, Method: p.PaymentMethod, Reference: deref(p.Reference), PaidAt: p.PaidAt})
		}
	}

	// Fines
	if rows, err := db.Query(`SELECT COALESCE(reason,''), COALESCE(amount,0), COALESCE(status,''), created_at FROM loan_fines WHERE loan_id = $1 ORDER BY created_at`, loan.ID); err == nil {
		for rows.Next() {
			var f lrFine
			if rows.Scan(&f.Reason, &f.Amount, &f.Status, &f.CreatedAt) == nil {
				rd.Fines = append(rd.Fines, f)
			}
		}
		rows.Close()
	}

	// Disbursement transaction
	var dAt sql.NullTime
	_ = db.QueryRow(`
		SELECT COALESCE(amount,0), COALESCE(status,''), COALESCE(reference,''), updated_at
		FROM transactions
		WHERE (reference ILIKE $1 OR description ILIKE $1) AND type = 'loan'
		ORDER BY created_at DESC LIMIT 1`, "%"+loan.ID+"%").
		Scan(&rd.DisbAmount, &rd.DisbStatus, &rd.DisbReference, &dAt)
	if dAt.Valid {
		rd.DisbAt = &dAt.Time
	}

	// Amortised schedule
	if loan.DisbursedAt != nil && loan.Duration > 0 && loan.TotalAmount > 0 {
		monthly := loan.TotalAmount / float64(loan.Duration)
		paid := 0
		if monthly > 0 {
			paid = int(loan.PaidAmount / monthly)
		}
		if paid > loan.Duration {
			paid = loan.Duration
		}
		for i := 1; i <= loan.Duration; i++ {
			st := "Pending"
			if i <= paid || string(loan.Status) == "completed" {
				st = "Paid"
			}
			rd.Schedule = append(rd.Schedule, lrInstallment{Number: i, DueDate: loan.DisbursedAt.AddDate(0, i, 0), Amount: monthly, Status: st})
		}
	}

	return rd
}

/* ---------------------------------------------------------------- *
 *  Rendering
 * ---------------------------------------------------------------- */

func renderLoanReportPDF(rd *loanReportData) *gofpdf.Fpdf {
	l := rd.L
	pdf := gofpdf.New(gofpdf.OrientationPortrait, "mm", "A4", "")
	pdf.SetMargins(16, 18, 16)
	pdf.SetAutoPageBreak(true, 22)
	genAt := time.Now()

	pdf.SetFooterFunc(func() {
		pdf.SetY(-15)
		pdf.SetDrawColor(rpHair[0], rpHair[1], rpHair[2])
		pdf.SetLineWidth(0.2)
		pdf.Line(16, pdf.GetY(), 194, pdf.GetY())
		pdf.Ln(2)
		pdf.SetFont("Helvetica", "", 7)
		pdf.SetTextColor(rpMuted[0], rpMuted[1], rpMuted[2])
		left := fmt.Sprintf("(c) %d %s. Generated by the %s platform on behalf of %s.", genAt.Year(), loanReportAppName, loanReportAppName, sanitize(rd.ChamaName))
		pdf.CellFormat(150, 4, left, "", 0, "L", false, 0, "")
		pdf.CellFormat(28, 4, fmt.Sprintf("Page %d of {nb}", pdf.PageNo()), "", 0, "R", false, 0, "")
	})
	pdf.AliasNbPages("{nb}")
	pdf.AddPage()

	// Header band
	pdf.SetFillColor(rpBand[0], rpBand[1], rpBand[2])
	pdf.Rect(0, 0, 210, 30, "F")
	pdf.SetXY(16, 7)
	pdf.SetFont("Helvetica", "B", 16)
	pdf.SetTextColor(255, 255, 255)
	pdf.CellFormat(120, 8, sanitize(rd.ChamaName), "", 2, "L", false, 0, "")
	pdf.SetFont("Helvetica", "", 9)
	pdf.SetTextColor(190, 200, 214)
	pdf.CellFormat(120, 5, "Loan Report", "", 2, "L", false, 0, "")
	pdf.SetXY(120, 9)
	pdf.SetFont("Helvetica", "", 8)
	pdf.CellFormat(74, 4, "Generated "+genAt.Format("2 Jan 2006, 15:04"), "", 2, "R", false, 0, "")
	pdf.CellFormat(74, 4, "Ref "+shortRef(l.ID), "", 2, "R", false, 0, "")

	pdf.SetY(38)
	pdf.SetTextColor(rpInk[0], rpInk[1], rpInk[2])

	pdf.SetFont("Helvetica", "B", 13)
	pdf.CellFormat(120, 8, "Loan "+shortRef(l.ID), "", 0, "L", false, 0, "")
	statusChip(pdf, strings.ToUpper(orDash(string(l.Status))))
	pdf.Ln(11)

	sectionTitle(pdf, "Loan Summary")
	kvGrid(pdf, [][2]string{
		{"Borrower", orDash(rd.BorrowerName)},
		{"Loan product", orDash(rd.LoanTypeName)},
		{"Principal", money(l.Amount)},
		{"Interest rate", fmt.Sprintf("%.2f%%", l.InterestRate)},
		{"Total repayable", money(l.TotalAmount)},
		{"Term", fmt.Sprintf("%d months", l.Duration)},
		{"Repaid to date", money(l.PaidAmount)},
		{"Outstanding", money(l.RemainingAmount)},
		{"Applied on", dateOrDash(&l.CreatedAt)},
		{"Disbursed on", dateOrDash(l.DisbursedAt)},
		{"Due date", dateOrDash(l.DueDate)},
		{"Approval stage", orDash(title(l.ApprovalStage))},
	})
	if strings.TrimSpace(l.Purpose) != "" {
		pdf.Ln(1)
		pdf.SetFont("Helvetica", "B", 7.5)
		pdf.SetTextColor(rpMuted[0], rpMuted[1], rpMuted[2])
		pdf.CellFormat(0, 4.5, "PURPOSE", "", 1, "L", false, 0, "")
		pdf.SetFont("Helvetica", "", 9.5)
		pdf.SetTextColor(rpInk[0], rpInk[1], rpInk[2])
		pdf.MultiCell(0, 5, sanitize(l.Purpose), "", "L", false)
	}
	if string(l.Status) == "rejected" && deref(l.RejectedReason) != "" {
		pdf.Ln(1)
		pdf.SetFont("Helvetica", "B", 9)
		pdf.SetTextColor(rpBad[0], rpBad[1], rpBad[2])
		pdf.MultiCell(0, 5, "Rejected: "+sanitize(deref(l.RejectedReason)), "", "L", false)
		pdf.SetTextColor(rpInk[0], rpInk[1], rpInk[2])
	}
	pdf.Ln(3)

	sectionTitle(pdf, "Approval Trail")
	if len(rd.Approvals) == 0 {
		emptyLine(pdf, "No officer approvals recorded yet.")
	} else {
		w := []float64{28, 45, 30, 75}
		tableHeader(pdf, []string{"Role", "Officer", "Date", "Comment"}, w)
		for i, a := range rd.Approvals {
			tableRow(pdf, []string{a.Role, orDash(a.Name), dateOrDash(a.At), orDash(a.Comment)}, w, i%2 == 1)
		}
	}
	pdf.Ln(3)

	sectionTitle(pdf, "Guarantors")
	if len(rd.Guarantors) == 0 {
		emptyLine(pdf, "This loan has no guarantors.")
	} else {
		w := []float64{85, 45, 48}
		tableHeader(pdf, []string{"Name", "Current exposure", "Status"}, w)
		for i, g := range rd.Guarantors {
			exp := "—"
			if strings.EqualFold(g.Status, "accepted") {
				exp = money(g.Amount)
			}
			tableRow(pdf, []string{orDash(g.Name), exp, title(g.Status)}, w, i%2 == 1)
		}
	}
	pdf.Ln(3)

	sectionTitle(pdf, "Referees")
	if len(rd.Referees) == 0 {
		emptyLine(pdf, "This loan has no referees.")
	} else {
		w := []float64{120, 58}
		tableHeader(pdf, []string{"Name", "Status"}, w)
		for i, r := range rd.Referees {
			tableRow(pdf, []string{orDash(r.Name), title(r.Status)}, w, i%2 == 1)
		}
	}
	pdf.Ln(3)

	sectionTitle(pdf, "Disbursement")
	if rd.DisbAt == nil && rd.DisbStatus == "" && l.DisbursedAt == nil {
		emptyLine(pdf, "Not yet disbursed.")
	} else {
		kvGrid(pdf, [][2]string{
			{"Method", "M-Pesa B2C"},
			{"Amount", money(pickF(rd.DisbAmount, l.Amount))},
			{"Status", title(orDash(rd.DisbStatus))},
			{"Reference", orDash(rd.DisbReference)},
			{"Date", dateOrDash(pickT(rd.DisbAt, l.DisbursedAt))},
			{"", ""},
		})
	}
	pdf.Ln(3)

	if len(rd.Schedule) > 0 {
		sectionTitle(pdf, "Repayment Schedule")
		w := []float64{14, 48, 60, 56}
		tableHeader(pdf, []string{"#", "Due date", "Instalment", "Status"}, w)
		for i, s := range rd.Schedule {
			tableRow(pdf, []string{fmt.Sprintf("%d", s.Number), s.DueDate.Format("2 Jan 2006"), money(s.Amount), s.Status}, w, i%2 == 1)
		}
		pdf.Ln(3)
	}

	sectionTitle(pdf, "Payment History")
	if len(rd.Payments) == 0 {
		emptyLine(pdf, "No repayments recorded.")
	} else {
		w := []float64{34, 34, 40, 70}
		tableHeader(pdf, []string{"Date", "Amount", "Method", "Reference"}, w)
		for i, p := range rd.Payments {
			tableRow(pdf, []string{p.PaidAt.Format("2 Jan 2006"), money(p.Amount), title(orDash(p.Method)), orDash(p.Reference)}, w, i%2 == 1)
		}
	}
	pdf.Ln(3)

	sectionTitle(pdf, "Fines & Penalties")
	if len(rd.Fines) == 0 {
		emptyLine(pdf, "No fines on this loan.")
	} else {
		w := []float64{30, 78, 34, 36}
		tableHeader(pdf, []string{"Date", "Reason", "Amount", "Status"}, w)
		for i, f := range rd.Fines {
			tableRow(pdf, []string{f.CreatedAt.Format("2 Jan 2006"), orDash(f.Reason), money(f.Amount), title(orDash(f.Status))}, w, i%2 == 1)
		}
	}

	pdf.Ln(7)
	pdf.SetFont("Helvetica", "I", 7.5)
	pdf.SetTextColor(rpMuted[0], rpMuted[1], rpMuted[2])
	pdf.MultiCell(0, 4,
		fmt.Sprintf("This report is issued by %s and reflects the loan record as at %s. It is a computer-generated document and does not require a signature. \"%s\" and the %s wordmark are the property of the %s platform.",
			sanitize(rd.ChamaName), genAt.Format("2 Jan 2006 15:04 MST"), loanReportAppName, loanReportAppName, loanReportAppName),
		"", "L", false)

	return pdf
}

/* ------------------------------ helpers ------------------------------ */

func sectionTitle(pdf *gofpdf.Fpdf, s string) {
	if pdf.GetY() > 255 {
		pdf.AddPage()
	}
	pdf.SetFont("Helvetica", "B", 10.5)
	pdf.SetTextColor(rpInk[0], rpInk[1], rpInk[2])
	pdf.CellFormat(0, 6, s, "", 1, "L", false, 0, "")
	y := pdf.GetY()
	pdf.SetDrawColor(rpAccent[0], rpAccent[1], rpAccent[2])
	pdf.SetLineWidth(0.6)
	pdf.Line(16, y, 30, y)
	pdf.SetDrawColor(rpHair[0], rpHair[1], rpHair[2])
	pdf.SetLineWidth(0.2)
	pdf.Line(30, y, 194, y)
	pdf.Ln(2.5)
}

func kvGrid(pdf *gofpdf.Fpdf, pairs [][2]string) {
	colW := 89.0
	for i := 0; i < len(pairs); i += 2 {
		x := 16.0
		y := pdf.GetY()
		draw := func(cx float64, k, v string) {
			if k == "" {
				return
			}
			pdf.SetXY(cx, y)
			pdf.SetFont("Helvetica", "", 7)
			pdf.SetTextColor(rpMuted[0], rpMuted[1], rpMuted[2])
			pdf.CellFormat(colW, 3.4, strings.ToUpper(k), "", 2, "L", false, 0, "")
			pdf.SetFont("Helvetica", "B", 9.5)
			pdf.SetTextColor(rpInk[0], rpInk[1], rpInk[2])
			pdf.CellFormat(colW, 4.4, truncate(sanitize(v), colW), "", 0, "L", false, 0, "")
		}
		draw(x, pairs[i][0], pairs[i][1])
		if i+1 < len(pairs) {
			draw(x+colW, pairs[i+1][0], pairs[i+1][1])
		}
		pdf.SetXY(x, y+8.4)
	}
	pdf.Ln(0.5)
}

func tableHeader(pdf *gofpdf.Fpdf, cols []string, w []float64) {
	if pdf.GetY() > 258 {
		pdf.AddPage()
	}
	pdf.SetX(16)
	pdf.SetFont("Helvetica", "B", 7.5)
	pdf.SetFillColor(rpBand[0], rpBand[1], rpBand[2])
	pdf.SetTextColor(255, 255, 255)
	for i, ccol := range cols {
		pdf.CellFormat(w[i], 6.6, strings.ToUpper(ccol), "", 0, "L", true, 0, "")
	}
	pdf.Ln(-1)
}

func tableRow(pdf *gofpdf.Fpdf, cells []string, w []float64, zebra bool) {
	if pdf.GetY() > 264 {
		pdf.AddPage()
	}
	pdf.SetX(16)
	pdf.SetFont("Helvetica", "", 8.5)
	pdf.SetTextColor(rpInk[0], rpInk[1], rpInk[2])
	fill := false
	if zebra {
		pdf.SetFillColor(rpZebra[0], rpZebra[1], rpZebra[2])
		fill = true
	}
	for i, ctext := range cells {
		pdf.CellFormat(w[i], 6, truncate(sanitize(ctext), w[i]), "", 0, "L", fill, 0, "")
	}
	pdf.Ln(-1)
	total := 0.0
	for _, x := range w {
		total += x
	}
	pdf.SetDrawColor(rpHair[0], rpHair[1], rpHair[2])
	pdf.SetLineWidth(0.15)
	pdf.Line(16, pdf.GetY(), 16+total, pdf.GetY())
}

func emptyLine(pdf *gofpdf.Fpdf, s string) {
	pdf.SetX(16)
	pdf.SetFont("Helvetica", "I", 8.5)
	pdf.SetTextColor(rpMuted[0], rpMuted[1], rpMuted[2])
	pdf.CellFormat(0, 5.5, s, "", 1, "L", false, 0, "")
	pdf.SetTextColor(rpInk[0], rpInk[1], rpInk[2])
}

func statusChip(pdf *gofpdf.Fpdf, label string) {
	col := rpMuted
	switch {
	case strings.Contains(label, "COMPLET"), strings.Contains(label, "DISBURS"), strings.Contains(label, "APPROV"), strings.Contains(label, "ACTIVE"):
		col = rpOK
	case strings.Contains(label, "REJECT"), strings.Contains(label, "DEFAULT"), strings.Contains(label, "FAIL"):
		col = rpBad
	case strings.Contains(label, "PENDING"), strings.Contains(label, "PROCESS"), strings.Contains(label, "DECLIN"):
		col = rpWarn
	}
	w := pdf.GetStringWidth(label) + 8
	x := 194 - w
	y := pdf.GetY()
	pdf.SetFillColor(col[0], col[1], col[2])
	pdf.RoundedRect(x, y, w, 6.5, 3.25, "1234", "F")
	pdf.SetXY(x, y+0.7)
	pdf.SetFont("Helvetica", "B", 7.5)
	pdf.SetTextColor(255, 255, 255)
	pdf.CellFormat(w, 5, label, "", 0, "C", false, 0, "")
	pdf.SetTextColor(rpInk[0], rpInk[1], rpInk[2])
}

func money(v float64) string {
	neg := v < 0
	if neg {
		v = -v
	}
	s := fmt.Sprintf("%.2f", v)
	parts := strings.SplitN(s, ".", 2)
	ip := parts[0]
	var b strings.Builder
	for i, ch := range ip {
		if i > 0 && (len(ip)-i)%3 == 0 {
			b.WriteByte(',')
		}
		b.WriteRune(ch)
	}
	out := "KES " + b.String() + "." + parts[1]
	if neg {
		out = "-" + out
	}
	return out
}

func orDash(s string) string {
	if strings.TrimSpace(s) == "" {
		return "—"
	}
	return strings.TrimSpace(s)
}

func dateOrDash(t *time.Time) string {
	if t == nil || t.IsZero() {
		return "—"
	}
	return t.Format("2 Jan 2006")
}

func title(s string) string {
	s = strings.TrimSpace(strings.ReplaceAll(s, "_", " "))
	if s == "" {
		return "—"
	}
	return strings.Title(strings.ToLower(s))
}

func shortRef(id string) string {
	if strings.TrimSpace(id) == "" {
		return "—"
	}
	return "#" + id
}

func sanitize(s string) string {
	var b strings.Builder
	for _, r := range s {
		if r < 256 {
			b.WriteRune(r)
		} else {
			b.WriteByte(' ')
		}
	}
	return strings.TrimSpace(b.String())
}

func truncate(s string, widthMM float64) string {
	max := int(widthMM / 1.75)
	if max < 4 {
		max = 4
	}
	if len(s) <= max {
		return s
	}
	if max <= 1 {
		return s[:max]
	}
	return s[:max-1] + "."
}

func pickF(a, b float64) float64 {
	if a > 0 {
		return a
	}
	return b
}

func pickT(a, b *time.Time) *time.Time {
	if a != nil && !a.IsZero() {
		return a
	}
	return b
}
