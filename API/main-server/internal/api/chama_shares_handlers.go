package api

import (
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// CreateChamaShares creates a new share offering for a chama.
func CreateChamaShares(c *gin.Context) {
	chamaID, ok := requireParam(c, "id", "Chama ID is required")
	if !ok {
		return
	}

	var req struct {
		Name          string  `json:"name" binding:"required"`
		TotalShares   int     `json:"totalShares" binding:"required"`
		PricePerShare float64 `json:"pricePerShare" binding:"required"`
		OpenDate      string  `json:"openDate"`
		CloseDate     string  `json:"closeDate"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request data: " + err.Error(),
		})
		return
	}

	database := dbFromContext(c)
	if database == nil {
		return
	}

	now := time.Now()
	offeringID := fmt.Sprintf("SHARE_OFFER_%d", time.Now().UnixNano())

	userID, _ := c.Get("userID")
	if userID == "" || userID == nil {
		userID = "system"
	}
	userIDStr := fmt.Sprintf("%v", userID)

	transactionID := fmt.Sprintf("TXN_%d", time.Now().UnixNano())
	securityHash := fmt.Sprintf("SHA256_%d", time.Now().UnixNano())

	if _, err := database.Exec(
		"INSERT INTO share_offerings (id, chama_id, name, share_type, total_shares, price_per_share, minimum_purchase, description, eligibility_criteria, approval_required, total_value, created_by, created_by_id, timestamp, status, transaction_id, security_hash, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)",
		offeringID, chamaID, req.Name, "ordinary", req.TotalShares, req.PricePerShare, 1, "", "", false, float64(req.TotalShares)*req.PricePerShare, userIDStr, userIDStr, now, "active", transactionID, securityHash, now, now,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create share offering: " + err.Error(),
		})
		return
	}

	_, _ = database.Exec(
		"INSERT INTO wallets (id, type, owner_id, subwallet_type, chama_id, balance, currency, is_active, is_locked, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT (id) DO NOTHING",
		fmt.Sprintf("wallet-%s-shares", chamaID), "chama", chamaID, "shares", chamaID, 0, "KES", true, false, now, now,
	)

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"message": "Share offering created successfully",
		"data": gin.H{
			"id":            offeringID,
			"name":          req.Name,
			"totalShares":   req.TotalShares,
			"pricePerShare": req.PricePerShare,
		},
	})
}

// GetChamaShareOfferingsList retrieves all share offerings for a chama.
func GetChamaShareOfferingsList(c *gin.Context) {
	chamaID, ok := requireParam(c, "id", "Chama ID is required")
	if !ok {
		return
	}

	database := dbFromContext(c)
	if database == nil {
		return
	}

	query := `
		SELECT id, chama_id, name, share_type, total_shares, price_per_share, minimum_purchase, description, eligibility_criteria, approval_required, total_value, status, created_by, created_by_id, timestamp, transaction_id, security_hash, created_at, updated_at
		FROM share_offerings
		WHERE chama_id = $1
		ORDER BY created_at DESC
	`

	rows, err := database.Query(query, chamaID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to fetch share offerings: " + err.Error(),
		})
		return
	}
	defer rows.Close()

	var offerings []map[string]interface{}
	for rows.Next() {
		var id, chamaIDCol, name, shareType, createdBy, createdByID, transactionID, securityHash, status, description, eligibilityCriteria string
		var totalShares, minimumPurchase int
		var pricePerShare, totalValue float64
		var approvalRequired bool
		var timestamp, createdAt, updatedAt interface{}

		if err := rows.Scan(&id, &chamaIDCol, &name, &shareType, &totalShares, &pricePerShare, &minimumPurchase, &description, &eligibilityCriteria, &approvalRequired, &totalValue, &status, &createdBy, &createdByID, &timestamp, &transactionID, &securityHash, &createdAt, &updatedAt); err != nil {
			continue
		}

		offerings = append(offerings, map[string]interface{}{
			"id":                  id,
			"chamaId":             chamaIDCol,
			"name":                name,
			"shareType":           shareType,
			"totalShares":         totalShares,
			"pricePerShare":       pricePerShare,
			"minimumPurchase":     minimumPurchase,
			"description":         description,
			"eligibilityCriteria": eligibilityCriteria,
			"approvalRequired":    approvalRequired,
			"totalValue":          totalValue,
			"status":              status,
			"createdBy":           createdBy,
			"createdById":         createdByID,
			"timestamp":           timestamp,
			"transactionId":       transactionID,
			"securityHash":        securityHash,
			"createdAt":           createdAt,
			"updatedAt":           updatedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    offerings,
	})
}

// DeclareChamaDividends creates a dividend declaration for a chama.
func DeclareChamaDividends(c *gin.Context) {
	chamaID, ok := requireParam(c, "id", "Chama ID is required")
	if !ok {
		return
	}

	var req struct {
		Type             string                   `json:"type" binding:"required"`
		Category         string                   `json:"category" binding:"required"`
		DividendPerShare float64                  `json:"dividendPerShare" binding:"required"`
		TotalAmount      float64                  `json:"totalAmount" binding:"required"`
		Description      string                   `json:"description"`
		EligibleMembers  []map[string]interface{} `json:"eligibleMembers" binding:"required"`
		FromAccount      string                   `json:"fromAccount"`
		InitiatedBy      string                   `json:"initiatedBy" binding:"required"`
		InitiatedByID    string                   `json:"initiatedById" binding:"required"`
		Timestamp        string                   `json:"timestamp"`
		TransactionID    string                   `json:"transactionId" binding:"required"`
		SecurityHash     string                   `json:"securityHash" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request data: " + err.Error(),
		})
		return
	}

	database := dbFromContext(c)
	if database == nil {
		return
	}

	userID, _ := c.Get("userID")
	if userID == "" || userID == nil {
		userID = "system"
	}
	userIDStr := fmt.Sprintf("%v", userID)

	now := time.Now()
	timestamp := now
	if req.Timestamp != "" {
		if parsed, err := time.Parse(time.RFC3339, req.Timestamp); err == nil {
			timestamp = parsed
		}
	}

	declarationID := fmt.Sprintf("DIV_DEC_%d", time.Now().UnixNano())
	fromAccount := req.FromAccount
	if fromAccount == "" {
		fromAccount = fmt.Sprintf("wallet-%s-dividends", chamaID)
	}

	if _, err := database.Exec(
		"INSERT INTO dividend_declarations (id, chama_id, dividend_per_share, total_amount, status, description, created_by, created_by_id, timestamp, transaction_id, security_hash, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)",
		declarationID, chamaID, req.DividendPerShare, req.TotalAmount, "declared", req.Description, req.InitiatedBy, userIDStr, timestamp, req.TransactionID, req.SecurityHash, now, now,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create dividend declaration: " + err.Error(),
		})
		return
	}

	// Ensure dividends subwallet exists
	_, _ = database.Exec(
		"INSERT INTO wallets (id, type, owner_id, subwallet_type, chama_id, balance, currency, is_active, is_locked, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT (id) DO NOTHING",
		fromAccount, "chama", chamaID, "dividends", chamaID, 0, "KES", true, false, now, now,
	)

	// Create individual dividend records using dividends table
	dividendQuery := "INSERT INTO dividends (id, bulk_disbursement_id, chama_id, member_id, member_name, shares_owned, dividend_per_share, amount, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)"

	for _, member := range req.EligibleMembers {
		memberID, _ := member["id"].(string)
		memberName, _ := member["name"].(string)
		sharesOwned, _ := member["sharesOwned"].(float64)

		dividendID := fmt.Sprintf("DIV_%d_%s", time.Now().UnixNano(), memberID)
		amount := sharesOwned * req.DividendPerShare

		if _, err := database.Exec(
			dividendQuery,
			dividendID, declarationID, chamaID, memberID, memberName, int(sharesOwned), req.DividendPerShare, amount, "pending", now, now,
		); err != nil {
			log.Printf("Failed to create dividend record for member %s: %v", memberID, err)
		}
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"message": "Dividend declaration created successfully",
		"data": gin.H{
			"id": declarationID,
		},
	})
}

// GetChamaDividendDeclarations retrieves dividend declarations for a chama.
func GetChamaDividendDeclarations(c *gin.Context) {
	chamaID, ok := requireParam(c, "id", "Chama ID is required")
	if !ok {
		return
	}

	database := dbFromContext(c)
	if database == nil {
		return
	}

	query := `
		SELECT id, chama_id, dividend_per_share, total_amount, status, description, 
			   created_by, created_by_id, timestamp, created_at, updated_at
		FROM dividend_declarations 
		WHERE chama_id = $1 
		ORDER BY created_at DESC
	`

	rows, err := database.Query(query, chamaID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to retrieve dividend declarations: " + err.Error(),
		})
		return
	}
	defer rows.Close()

	var declarations []map[string]interface{}
	for rows.Next() {
		var id, chamaId, status, description, createdBy, createdByID string
		var dividendPerShare, totalAmount float64
		var timestamp, createdAt, updatedAt time.Time

		if err := rows.Scan(&id, &chamaId, &dividendPerShare, &totalAmount, &status, &description, &createdBy, &createdByID, &timestamp, &createdAt, &updatedAt); err != nil {
			log.Printf("Failed to scan dividend declaration: %v", err)
			continue
		}

		declarations = append(declarations, map[string]interface{}{
			"id":               id,
			"chamaId":          chamaId,
			"dividendPerShare": dividendPerShare,
			"totalAmount":      totalAmount,
			"status":           status,
			"description":      description,
			"createdBy":        createdBy,
			"createdAt":        createdAt,
			"updatedAt":        updatedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    declarations,
	})
}
