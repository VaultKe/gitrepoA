package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// MakeContribution records a contribution to a chama using the requested
// payment method (wallet, mpesa, cash, or pay_for).
func MakeContribution(c *gin.Context) {
	userID, ok := requireUserID(c)
	if !ok {
		return
	}

	var req MakeContributionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request data: " + err.Error(),
		})
		return
	}

	if req.Amount <= 0 || req.Amount > 10000000 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Amount must be between 1 and 10,000,000 KES",
		})
		return
	}

	validTypes := map[string]bool{
		"regular":        true,
		"penalty":        true,
		"special":        true,
		"merry-go-round": true,
		"savings":        true,
		"":               true,
	}
	if !validTypes[req.Type] {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid contribution type. Must be 'regular', 'penalty', 'special', or 'merry-go-round'",
		})
		return
	}

	// Sanitize inputs
	req.ChamaID = sanitizeInput(req.ChamaID)
	req.Description = sanitizeInput(req.Description)
	req.Type = sanitizeInput(req.Type)
	req.PaymentMethod = sanitizeInput(req.PaymentMethod)

	db := dbFromContext(c)
	if db == nil {
		return
	}

	merryGoRoundID, currentRound, currentRecipientID, abort := resolveMerryGoRound(c, db, userID, &req)
	if abort {
		return
	}

	// Set default payment method if not provided
	if req.PaymentMethod == "" {
		req.PaymentMethod = "wallet"
	}

	validPaymentMethods := map[string]bool{
		"wallet":  true,
		"mpesa":   true,
		"cash":    true,
		"pay_for": true,
	}
	if !validPaymentMethods[req.PaymentMethod] {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid payment method. Must be 'wallet', 'mpesa', 'cash', or 'pay_for'",
		})
		return
	}

	// For cash and pay_for contributions, validate treasurer role and fields
	if req.PaymentMethod == "cash" || req.PaymentMethod == "pay_for" {
		if abort := validateCashPayment(c, db, userID, &req); abort {
			return
		}
	}

	// Transaction shared by the wallet and cash branches.
	tx, err := db.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to start transaction",
		})
		return
	}
	defer tx.Rollback()

	switch req.PaymentMethod {
	case "wallet", "pay_for":
		makeWalletContribution(c, db, tx, &req, userID, merryGoRoundID, currentRound, currentRecipientID)
	case "mpesa":
		makeMpesaContribution(c, db, &req, userID, merryGoRoundID, currentRound, currentRecipientID)
	case "cash":
		makeCashContribution(c, db, tx, &req, userID, merryGoRoundID, currentRound, currentRecipientID)
	}
}
