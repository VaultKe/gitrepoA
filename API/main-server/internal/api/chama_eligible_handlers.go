package api

import (
	"database/sql"
	"log"
	"net/http"
	"fmt"
	"github.com/gin-gonic/gin"
)

// GetEligibleLoanMembers retrieves members eligible for loan disbursements
func GetEligibleLoanMembers(c *gin.Context) {
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

	// Query eligible loan members (approved but not yet disbursed)
	query := `
		SELECT DISTINCT cm.user_id, u.first_name, u.last_name,
			   l.amount as approved_amount, l.status, l.created_at
		FROM chama_members cm
		INNER JOIN users u ON cm.user_id = u.id
		INNER JOIN loans l ON cm.user_id = l.borrower_id AND l.chama_id = cm.chama_id
			WHERE cm.chama_id = $1 AND cm.is_active = true
			AND l.status = 'approved'
		AND NOT EXISTS (
			SELECT 1 FROM disbursements d
			WHERE d.chama_id = cm.chama_id AND d.member_id = cm.user_id
			AND d.disbursement_type = 'loan_disbursement' AND d.status IN ('completed', 'processing')
		)
		ORDER BY l.created_at ASC
	`

	rows, err := db.(*sql.DB).Query(query, chamaID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to fetch eligible loan members",
		})
		return
	}
	defer rows.Close()

	var members []map[string]interface{}
	for rows.Next() {
		var userID, firstName, lastName, status string
		var approvedAmount float64
		var createdAt string

		err := rows.Scan(&userID, &firstName, &lastName, &approvedAmount, &status, &createdAt)
		if err != nil {
			continue
		}

		member := map[string]interface{}{
			"id":              userID,
			"name":            firstName + " " + lastName,
			"approvedAmount":  approvedAmount,
			"status":          status,
			"applicationDate": createdAt,
		}
		members = append(members, member)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    members,
	})
}

// GetEligibleWelfareMembers retrieves members eligible for welfare disbursements
func GetEligibleWelfareMembers(c *gin.Context) {
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

	// Query eligible welfare members (completed contribution period)
	query := `
		SELECT DISTINCT cm.user_id, u.first_name, u.last_name,
			   COALESCE(SUM(t.amount), 0) as contribution_amount,
			   COUNT(t.id) as contribution_count,
			   MAX(t.created_at) as last_contribution
		FROM chama_members cm
		INNER JOIN users u ON cm.user_id = u.id
		LEFT JOIN transactions t ON cm.user_id = t.initiated_by AND t.type = 'contribution'
		WHERE cm.chama_id = $1 AND cm.is_active = true
		GROUP BY cm.user_id, u.first_name, u.last_name
		HAVING contribution_count >= 6  -- At least 6 months of contributions
		ORDER BY contribution_amount DESC
	`

	rows, err := db.(*sql.DB).Query(query, chamaID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to fetch eligible welfare members",
		})
		return
	}
	defer rows.Close()

	var members []map[string]interface{}
	for rows.Next() {
		var userID, firstName, lastName string
		var contributionAmount float64
		var contributionCount int
		var lastContribution sql.NullString

		err := rows.Scan(&userID, &firstName, &lastName, &contributionAmount, &contributionCount, &lastContribution)
		if err != nil {
			continue
		}

		member := map[string]interface{}{
			"id":                 userID,
			"name":               firstName + " " + lastName,
			"contributionAmount": contributionAmount,
			"contributionCount":  contributionCount,
		}
		if lastContribution.Valid {
			member["lastContribution"] = lastContribution.String
		}
		members = append(members, member)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    members,
	})
}

// GetEligibleDividendMembers retrieves members eligible for dividend disbursements
func GetEligibleDividendMembers(c *gin.Context) {
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

	// Query eligible dividend members (shareholders)
	query := `
		SELECT DISTINCT cm.user_id, u.first_name, u.last_name,
			   COALESCE(SUM(s.shares_owned), 0) as shares_owned,
			   COALESCE(SUM(s.total_value), 0) as total_value
		FROM chama_members cm
		INNER JOIN users u ON cm.user_id = u.id
		LEFT JOIN shares s ON s.member_id = cm.user_id AND s.chama_id = cm.chama_id AND s.status = 'active'
		WHERE cm.chama_id = $1 AND cm.is_active = true
		GROUP BY cm.user_id, u.first_name, u.last_name
		HAVING COALESCE(SUM(s.shares_owned), 0) > 0
		ORDER BY shares_owned DESC
	`

	rows, err := db.(*sql.DB).Query(query, chamaID)
	if err != nil {
		log.Printf("Error fetching eligible dividend members: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to fetch eligible dividend members: " + err.Error(),
		})
		return
	}
	defer rows.Close()

	var members []map[string]interface{}
	for rows.Next() {
		var userID, firstName, lastName string
		var sharesOwned int
		var totalValue float64

		err := rows.Scan(&userID, &firstName, &lastName, &sharesOwned, &totalValue)
		if err != nil {
			continue
		}

		member := map[string]interface{}{
			"id":          userID,
			"name":        firstName + " " + lastName,
			"sharesOwned": sharesOwned,
			"totalValue":  totalValue,
		}
		members = append(members, member)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    members,
	})
}

// GetEligibleSavingsMembers retrieves members eligible for savings withdrawals
func GetEligibleSavingsMembers(c *gin.Context) {
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

	// Get all active chama members with their savings balance in the chama's savings subwallet
	savingsWalletID := fmt.Sprintf("wallet-%s-savings", chamaID)

	// Ensure savings subwallet exists (auto-creates if missing)
	_, walletErr := db.(*sql.DB).Exec(
		"INSERT INTO wallets (id, type, owner_id, subwallet_type, chama_id, balance, currency, is_active, is_locked, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()) ON CONFLICT (id) DO NOTHING",
		savingsWalletID, "chama", chamaID, "savings", chamaID, 0, "KES", true, false,
	)
	if walletErr != nil {
		log.Printf("Failed to create/ensure savings wallet: %v", walletErr)
	}

	query := `
		SELECT cm.user_id, u.first_name, u.last_name,
			   COALESCE(SUM(t.amount), 0) as savings_balance,
			   COALESCE(MAX(t.created_at)::text, '') as last_activity
		FROM chama_members cm
		INNER JOIN users u ON cm.user_id = u.id
		LEFT JOIN transactions t ON t.initiated_by = cm.user_id
			AND t.to_wallet_id = $2
			AND t.status = 'completed'
		WHERE cm.chama_id = $1 AND cm.is_active = true
		GROUP BY cm.user_id, u.first_name, u.last_name
		ORDER BY savings_balance DESC
	`

	rows, err := db.(*sql.DB).Query(query, chamaID, savingsWalletID)
	if err != nil {
		log.Printf("Error fetching eligible savings members: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to fetch eligible savings members: " + err.Error(),
		})
		return
	}
	defer rows.Close()

	var members []map[string]interface{}
	for rows.Next() {
		var userID, firstName, lastName string
		var savingsBalance float64
		var lastActivity sql.NullString

		scanErr := rows.Scan(&userID, &firstName, &lastName, &savingsBalance, &lastActivity)
		if scanErr != nil {
			continue
		}

		member := map[string]interface{}{
			"id":      userID,
			"name":    firstName + " " + lastName,
			"balance": savingsBalance,
		}
		if lastActivity.Valid {
			member["lastActivity"] = lastActivity.String
		}
		members = append(members, member)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    members,
	})
}

// GetEligibleOtherMembers retrieves members eligible for other disbursements
func GetEligibleOtherMembers(c *gin.Context) {
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

	// Query eligible other members (active members in good standing)
	query := `
		SELECT DISTINCT cm.user_id, u.first_name, u.last_name,
			   COALESCE(SUM(t.amount), 0) as total_contributions,
			   COUNT(t.id) as contribution_count,
			   cm.joined_at
		FROM chama_members cm
		INNER JOIN users u ON cm.user_id = u.id
		LEFT JOIN transactions t ON cm.user_id = t.initiated_by AND t.type = 'contribution'
		WHERE cm.chama_id = $1 AND cm.is_active = true
		GROUP BY cm.user_id, u.first_name, u.last_name, cm.joined_at
		HAVING contribution_count >= 1  -- At least 1 contribution
		ORDER BY total_contributions DESC
	`

	rows, err := db.(*sql.DB).Query(query, chamaID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to fetch eligible other members",
		})
		return
	}
	defer rows.Close()

	var members []map[string]interface{}
	for rows.Next() {
		var userID, firstName, lastName, joinedAt string
		var totalContributions float64
		var contributionCount int

		err := rows.Scan(&userID, &firstName, &lastName, &totalContributions, &contributionCount, &joinedAt)
		if err != nil {
			continue
		}

		// Calculate eligible amount (10% of total contributions)
		eligibleAmount := totalContributions * 0.1

		member := map[string]interface{}{
			"id":                 userID,
			"name":               firstName + " " + lastName,
			"eligibleAmount":     eligibleAmount,
			"totalContributions": totalContributions,
			"contributionCount":  contributionCount,
			"joinedAt":           joinedAt,
		}
		members = append(members, member)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    members,
	})
}

// GetChamaSharesOfferings retrieves share holdings for a chama
func GetChamaSharesOfferings(c *gin.Context) {
	chamaID := c.Param("id")
	if chamaID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Chama ID is required",
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

	// Query share holdings for members in the chama
	query := `
		SELECT s.id, s.chama_id, s.member_id, u.first_name, u.last_name, s.shares_owned, s.total_value
		FROM shares s
		JOIN users u ON s.member_id = u.id
		WHERE s.chama_id = $1 AND s.status = 'active'
		ORDER BY s.created_at DESC
	`

	rows, err := db.(*sql.DB).Query(query, chamaID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to fetch share holdings: " + err.Error(),
		})
		return
	}
	defer rows.Close()

	var holdings []map[string]interface{}
	for rows.Next() {
		var id, chamaID, memberID, firstName, lastName string
		var sharesOwned int
		var totalValue float64

		err := rows.Scan(&id, &chamaID, &memberID, &firstName, &lastName, &sharesOwned, &totalValue)
		if err != nil {
			continue
		}

		holding := map[string]interface{}{
			"id":          id,
			"chamaId":     chamaID,
			"memberId":    memberID,
			"member_name": firstName + " " + lastName,
			"sharesOwned": sharesOwned,
			"totalValue":  totalValue,
		}
		holdings = append(holdings, holding)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    holdings,
	})
}
