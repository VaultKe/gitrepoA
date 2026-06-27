package api

import (
	"database/sql"
	"net/http"

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
		LEFT JOIN shares s ON cm.user_id = s.member_id AND s.chama_id = cm.chama_id AND s.status = 'active'
		WHERE cm.chama_id = $1 AND cm.is_active = true
		GROUP BY cm.user_id, u.first_name, u.last_name
		HAVING shares_owned > 0
		ORDER BY shares_owned DESC
	`

	rows, err := db.(*sql.DB).Query(query, chamaID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to fetch eligible dividend members",
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

	// Query eligible savings members (members with savings balance)
	query := `
		SELECT DISTINCT cm.user_id, u.first_name, u.last_name,
			   COALESCE(w.balance, 0) as available_savings,
			   COALESCE(SUM(t.amount), 0) as total_deposits
		FROM chama_members cm
		INNER JOIN users u ON cm.user_id = u.id
		LEFT JOIN wallets w ON u.id = w.owner_id AND w.type = 'personal'
		LEFT JOIN transactions t ON cm.user_id = t.initiated_by AND t.type = 'savings_deposit'
		WHERE cm.chama_id = $1 AND cm.is_active = true
		GROUP BY cm.user_id, u.first_name, u.last_name, w.balance
		HAVING available_savings > 0
		ORDER BY available_savings DESC
	`

	rows, err := db.(*sql.DB).Query(query, chamaID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to fetch eligible savings members",
		})
		return
	}
	defer rows.Close()

	var members []map[string]interface{}
	for rows.Next() {
		var userID, firstName, lastName string
		var availableSavings, totalDeposits float64

		err := rows.Scan(&userID, &firstName, &lastName, &availableSavings, &totalDeposits)
		if err != nil {
			continue
		}

		member := map[string]interface{}{
			"id":               userID,
			"name":             firstName + " " + lastName,
			"availableSavings": availableSavings,
			"totalDeposits":    totalDeposits,
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
