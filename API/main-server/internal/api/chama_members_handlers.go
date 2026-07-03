package api

import (
	"database/sql"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"vaultke-backend/internal/services"
	"vaultke-backend/internal/utils"

	"github.com/gin-gonic/gin"
)

func GetChamaMembers(c *gin.Context) {
	chamaID := c.Param("id")
	if chamaID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Chama ID is required",
		})
		return
	}

	// Get database connection
	dbInterface, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}
	db := dbInterface.(*sql.DB)

	// Get real chama members from database with comprehensive information
	query := `
				SELECT
					cm.id, cm.chama_id, cm.user_id, cm.role, cm.joined_at, cm.is_active,
					cm.total_contributions, cm.last_contribution, cm.rating, cm.total_ratings,
					u.first_name, u.last_name, u.email, u.phone, u.avatar, u.status,
					u.is_email_verified, u.is_phone_verified, u.business_type, u.county, u.town,
					u.bio, u.occupation, u.id_number, u.created_at as user_created_at,
					COALESCE(w.balance, 0) as savings_balance,
					COALESCE(loan_balance.balance, 0) as loan_balance,
					COALESCE(contrib_stats.monthly_average, 0) as monthly_average,
					COALESCE(contrib_stats.consistency_rate, 0) as consistency_rate,
					COALESCE(meeting_stats.meetings_attended, 0) as meetings_attended,
					COALESCE(meeting_stats.total_meetings, 0) as total_meetings,
					COALESCE(contrib_stats.contributions_made, 0) as contributions_made,
					(SELECT COUNT(*) FROM loans WHERE borrower_id = u.id AND chama_id = $1) as loans_taken,
					(SELECT COUNT(*) FROM guarantors g INNER JOIN loans l ON g.loan_id = l.id WHERE g.user_id = u.id AND l.chama_id = $1) as guarantor_requests
				FROM chama_members cm
				INNER JOIN users u ON cm.user_id = u.id
				LEFT JOIN wallets w ON u.id = w.owner_id AND w.type = 'personal'
				LEFT JOIN (
					SELECT
						borrower_id,
						SUM(CASE WHEN status IN ('approved', 'disbursed', 'active') THEN remaining_amount ELSE 0 END) as balance
					FROM loans
					WHERE chama_id = $1
					GROUP BY borrower_id
				) loan_balance ON u.id = loan_balance.borrower_id
				LEFT JOIN (
					SELECT
						t.initiated_by,
						AVG(t.amount) as monthly_average,
						(COUNT(*) * 100.0 / 12) as consistency_rate,
						COUNT(*) as contributions_made
					FROM transactions t
					WHERE t.type = 'contribution'
					AND t.created_at >= NOW() - INTERVAL '12 months'
					GROUP BY t.initiated_by
				) contrib_stats ON u.id = contrib_stats.initiated_by
				LEFT JOIN (
					SELECT
						cm.user_id,
						COUNT(*) as meetings_attended,
						(SELECT COUNT(*) FROM meetings WHERE chama_id = $2) as total_meetings
					FROM chama_members cm
					WHERE cm.chama_id = $3
					GROUP BY cm.user_id
				) meeting_stats ON u.id = meeting_stats.user_id
				WHERE cm.chama_id = $4 AND cm.is_active = true
				ORDER BY cm.joined_at ASC
			`

	rows, err := db.Query(query, chamaID, chamaID, chamaID, chamaID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to fetch chama members: " + err.Error(),
		})
		return
	}
	defer rows.Close()

	var members []map[string]interface{}
	activeMembers := 0
	pendingMembers := 0

	for rows.Next() {
		var (
			id, chamaID, userID, role, firstName, lastName, email, phone, userStatus                        string
			joinedAt, userCreatedAt                                                                         string
			isActive, isEmailVerified, isPhoneVerified                                                      bool
			totalContributions, rating, savingsBalance, loanBalance, monthlyAverage, consistencyRate        float64
			totalRatings, meetingsAttended, totalMeetings, contributionsMade, loansTaken, guarantorRequests int
			avatar, lastContribution, businessType, county, town, bio, occupation, idNumber                          *string
		)

		err := rows.Scan(
			&id, &chamaID, &userID, &role, &joinedAt, &isActive,
			&totalContributions, &lastContribution, &rating, &totalRatings,
			&firstName, &lastName, &email, &phone, &avatar, &userStatus,
			&isEmailVerified, &isPhoneVerified, &businessType, &county, &town,
			&bio, &occupation, &idNumber, &userCreatedAt,
			&savingsBalance, &loanBalance, &monthlyAverage, &consistencyRate,
			&meetingsAttended, &totalMeetings, &contributionsMade, &loansTaken, &guarantorRequests,
		)
		if err != nil {
			continue // Skip invalid rows
		}

		// Calculate attendance rate
		attendanceRate := 0.0
		if totalMeetings > 0 {
			attendanceRate = (float64(meetingsAttended) / float64(totalMeetings)) * 100
		}

		// Determine online status (mock for now - would need real-time tracking)
		isOnline := userStatus == "active" && (id == "user-1" || id == "user-3" || id == "user-4")

		// Calculate last contribution amount (mock for now)
		lastContributionAmount := 5000.0
		if totalContributions > 0 {
			lastContributionAmount = monthlyAverage
		}

		// Build member object with real data
		member := map[string]interface{}{
			"id":                       id,
			"user_id":                  userID,
			"chama_id":                 chamaID,
			"role":                     role,
			"joined_at":                joinedAt,
			"status":                   userStatus,
			"total_contributions":      totalContributions,
			"last_contribution_date":   lastContribution,
			"last_contribution_amount": lastContributionAmount,
			"attendance_rate":          attendanceRate,
			"loan_balance":             loanBalance,
			"savings_balance":          savingsBalance,
			"reputation_score":         rating,
			"business_type":            businessType,
			"location":                 fmt.Sprintf("%s, %s", getStringValue(town), getStringValue(county)),
			"phone_verified":           isPhoneVerified,
			"email_verified":           isEmailVerified,
		"user": map[string]interface{}{
			"id":         userID,
			"first_name": firstName,
			"last_name":  lastName,
			"email":      utils.MaskEmail(email),
			"phone":      utils.MaskPhone(phone),
			"id_number":  utils.MaskID(utils.DerefString(idNumber)),
			"avatar_url": avatar,
			"bio":        bio,
			"occupation": occupation,
			"created_at": userCreatedAt,
			"last_seen":  joinedAt, // Mock - would need real tracking
			"is_online":  isOnline,
		},
			"contributions_summary": map[string]interface{}{
				"total_amount":     totalContributions,
				"monthly_average":  monthlyAverage,
				"consistency_rate": consistencyRate,
				"last_12_months":   generateMockMonthlyData(monthlyAverage), // Mock historical data
			},
			"activity_summary": map[string]interface{}{
				"meetings_attended":  meetingsAttended,
				"total_meetings":     totalMeetings,
				"last_activity":      joinedAt,
				"contributions_made": contributionsMade,
				"loans_taken":        loansTaken,
				"guarantor_requests": guarantorRequests,
			},
		}

		members = append(members, member)

		// Count member statuses
		if userStatus == "active" {
			activeMembers++
		} else {
			pendingMembers++
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    members,
		"message": "Chama members retrieved successfully",
		"meta": map[string]interface{}{
			"total_members":   len(members),
			"active_members":  activeMembers,
			"pending_members": pendingMembers,
			"last_updated":    time.Now().Format(time.RFC3339),
		},
	})
}

// GetMemberRole gets a member's role in a chama
func GetMemberRole(c *gin.Context) {
	chamaID := c.Param("id")
	memberID := c.Param("memberId")

	if chamaID == "" || memberID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Chama ID and Member ID are required",
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

	// Query member role
	query := `SELECT role FROM chama_members WHERE chama_id = $1 AND user_id = $2 AND is_active = TRUE`
	var role string
	err := db.(*sql.DB).QueryRow(query, chamaID, memberID).Scan(&role)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"error":   "Member not found in this chama",
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to get member role",
			})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"role": role,
		},
	})
}

// GetChamaMemberStatistics returns statistics for a specific chama member
func GetChamaMemberStatistics(c *gin.Context) {
	chamaID := c.Param("id")
	memberID := c.Param("memberId")

	if chamaID == "" || memberID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Chama ID and Member ID are required",
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

	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}

	chamaService := services.NewChamaService(db.(*sql.DB))

	_, err := chamaService.GetUserRoleInChama(chamaID, userID.(string))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "You are not a member of this chama",
		})
		return
	}

	memberStats, err := chamaService.GetMemberStatistics(chamaID, memberID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to get member statistics: " + err.Error(),
		})
		return
	}

	if role, ok := memberStats["role"].(string); !ok || role == "not_member" {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Member not found in this chama",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    memberStats,
	})
}

// Helper function to check if role can send invitations
func isLeadershipRole(role string) bool {
	return role == "chairperson" || role == "secretary" || role == "treasurer"
}

// InviteToChama is an alias for SendChamaInvitation for test compatibility
func InviteToChama(c *gin.Context) {
	SendChamaInvitation(c)
}

// UpdateChamaMember updates a chama member's role or status
func UpdateChamaMember(c *gin.Context) {
	// Get chama ID and member ID from URL
	chamaID := c.Param("id")
	memberID := c.Param("memberId")
	if chamaID == "" || memberID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Chama ID and Member ID are required",
		})
		return
	}

	// Get user ID from context (set by auth middleware)
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
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

	// Parse request body
	var req struct {
		Role   string `json:"role"`
		Status string `json:"status"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request data: " + err.Error(),
		})
		return
	}

	// Create chama service
	chamaService := services.NewChamaService(db.(*sql.DB))

	// Check if user has permission to update members (chairperson only)
	userRole, err := chamaService.GetUserRoleInChama(chamaID, userID.(string))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "You are not a member of this chama",
		})
		return
	}

	if userRole != "chairperson" {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "Only chairperson can update member details",
		})
		return
	}

	// Update member role if provided
	if req.Role != "" {
		err = chamaService.UpdateMemberRoleSimple(chamaID, memberID, req.Role)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to update member role: " + err.Error(),
			})
			return
		}
	}

	// Update member status if provided
	if req.Status != "" {
		err = chamaService.UpdateMemberStatus(chamaID, memberID, req.Status)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to update member status: " + err.Error(),
			})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Member updated successfully",
	})
}

// RemoveChamaMember removes a member from a chama
func RemoveChamaMember(c *gin.Context) {
	// Get chama ID and member ID from URL
	chamaID := c.Param("id")
	memberID := c.Param("memberId")
	if chamaID == "" || memberID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Chama ID and Member ID are required",
		})
		return
	}

	// Get user ID from context (set by auth middleware)
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
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
	database := db.(*sql.DB)

	// Create chama service
	chamaService := services.NewChamaService(database)

	// Check if user has permission to remove members (chairperson only)
	userRole, err := chamaService.GetUserRoleInChama(chamaID, userID.(string))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "You are not a member of this chama",
		})
		return
	}

	if userRole != "chairperson" {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "Only chairperson can remove members",
		})
		return
	}

	// Remove member from chama
	err = chamaService.RemoveUserFromChama(chamaID, memberID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to remove member: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Member removed successfully",
	})
}

// GetChamaStatistics returns statistics for a chama
func GetChamaStatistics(c *gin.Context) {
	// Get chama ID from URL
	chamaID := c.Param("id")
	if chamaID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Chama ID is required",
		})
		return
	}

	// Get user ID from context (set by auth middleware)
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
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
	database := db.(*sql.DB)

	// Create chama service
	chamaService := services.NewChamaService(database)

	// Check if user is a member of this chama
	_, err := chamaService.GetUserRoleInChama(chamaID, userID.(string))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "You are not a member of this chama",
		})
		return
	}

	// Get chama statistics with user-specific data
	stats, err := chamaService.GetChamaStatistics(chamaID, userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to get chama statistics: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    stats,
	})
}

// GetChamaTransactions retrieves all transactions for a chama
func GetChamaTransactions(c *gin.Context) {
	// Get chama ID from URL parameter
	chamaID := c.Param("id")
	if chamaID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Chama ID is required",
		})
		return
	}

	// Get user ID from context (set by auth middleware)
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	// Get query parameters
	limitStr := c.DefaultQuery("limit", "50")
	offsetStr := c.DefaultQuery("offset", "0")

	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 {
		limit = 50
	}

	offset, err := strconv.Atoi(offsetStr)
	if err != nil || offset < 0 {
		offset = 0
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
	database := db.(*sql.DB)

	// Create chama service
	chamaService := services.NewChamaService(database)

	// Check if user is a member of this chama
	_, err = chamaService.GetUserRoleInChama(chamaID, userID.(string))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "You are not a member of this chama",
		})
		return
	}

	// Get chama transactions
	transactions, err := chamaService.GetChamaTransactions(chamaID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to get chama transactions: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    transactions,
		"count":   len(transactions),
	})
}
