package api

import (
	"database/sql"
	"log"
	"net/http"
	"strconv"
	"vaultke-backend/internal/models"
	"vaultke-backend/internal/services"

	"github.com/gin-gonic/gin"
)

// Wallet handlers
func GetWallets(c *gin.Context) {
	// Get user ID from context
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

	// Create wallet service
	walletService := services.NewWalletService(db.(*sql.DB))

	// Get user's wallets
	wallets, err := walletService.GetWalletsByOwner(userID.(string))
	if err != nil {
		log.Printf("Failed to get wallets: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to retrieve wallets",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    wallets,
	})
}

func GetWalletBalance(c *gin.Context) {
	// Get user ID from context
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

	// Create wallet service
	walletService := services.NewWalletService(db.(*sql.DB))

	// Get user's personal wallet
	wallet, err := walletService.GetWalletByOwnerAndType(userID.(string), models.WalletTypePersonal)
	if err != nil {
		// If wallet not found, create a new personal wallet with zero balance
		if err.Error() == "wallet not found" {
			wallet, err = walletService.CreateWallet(userID.(string), models.WalletTypePersonal)
			if err != nil {
				log.Printf("Failed to create wallet for user %s: %v", userID, err)
				c.JSON(http.StatusInternalServerError, gin.H{
					"success": false,
					"error":   "Failed to create wallet",
				})
				return
			}
		} else {
			log.Printf("Failed to get user wallet: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to retrieve wallet",
			})
			return
		}
	}

	// For now, just use the stored balance since it's being updated correctly by the contribution handler
	// The transaction-based calculation needs to be fixed to include contribution transactions
	calculatedBalance := wallet.Balance

	// Update stored balance if different
	if calculatedBalance != wallet.Balance {
		_, err = db.(*sql.DB).Exec("UPDATE wallets SET balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", calculatedBalance, wallet.ID)
		if err != nil {
		} else {
		}
	} else {
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"balance":  calculatedBalance,
			"currency": wallet.Currency,
			"walletId": wallet.ID,
		},
	})
}

func GetWallet(c *gin.Context) {
	walletID := c.Param("id")
	if walletID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Wallet ID is required",
		})
		return
	}

	// Get user ID from context
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

	// Create wallet service
	walletService := services.NewWalletService(db.(*sql.DB))

	// Get wallet
	wallet, err := walletService.GetWalletByID(walletID)
	if err != nil {
		log.Printf("Failed to get wallet: %v", err)
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Wallet not found",
		})
		return
	}

	// Check if user owns this wallet
	if wallet.OwnerID != userID.(string) {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "Access denied",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    wallet,
	})
}

func GetWalletTransactions(c *gin.Context) {
	walletID := c.Param("id")
	if walletID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Wallet ID is required",
		})
		return
	}

	// Get user ID from context
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

	// Parse pagination parameters
	limit := 50
	offset := 0
	if limitStr := c.Query("limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
			limit = l
		}
	}
	if offsetStr := c.Query("offset"); offsetStr != "" {
		if o, err := strconv.Atoi(offsetStr); err == nil && o >= 0 {
			offset = o
		}
	}

	// Create wallet service
	walletService := services.NewWalletService(db.(*sql.DB))

	// Verify wallet ownership
	wallet, err := walletService.GetWalletByID(walletID)
	if err != nil {
		log.Printf("Failed to get wallet: %v", err)
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Wallet not found",
		})
		return
	}

	if wallet.OwnerID != userID.(string) {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "Access denied",
		})
		return
	}

	// Get wallet transactions
	transactions, err := walletService.GetWalletTransactions(walletID, limit, offset)
	if err != nil {
		log.Printf("Failed to get wallet transactions: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to retrieve transactions",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    transactions,
		"meta": map[string]interface{}{
			"limit":  limit,
			"offset": offset,
			"count":  len(transactions),
		},
	})
}
