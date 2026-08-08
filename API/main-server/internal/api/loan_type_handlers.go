package api

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"

	"vaultke-backend/internal/models"
	"vaultke-backend/internal/services"
)

func CreateLoanType(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "Unauthorized"})
		return
	}

	chamaID := c.Param("id")
	if chamaID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "chamaId is required"})
		return
	}

	var req models.LoanProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid request: " + err.Error()})
		return
	}

	db, _ := c.Get("db")
	loanType, err := services.NewLoanService(db.(*sql.DB)).CreateLoanType(chamaID, userID, &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    loanType,
		"message": "Loan type created successfully",
	})
		c.Abort()
}

func GetChamaLoanTypes(c *gin.Context) {
	chamaID := c.Param("id")
	if chamaID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "chamaId is required"})
		return
	}

	status := c.DefaultQuery("status", "")

	db, _ := c.Get("db")
	types, err := services.NewLoanService(db.(*sql.DB)).GetChamaLoanTypes(chamaID, status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    types,
		"count":   len(types),
	})
		c.Abort()
}

func GetLoanType(c *gin.Context) {
	loanTypeID := c.Param("loanTypeId")
	if loanTypeID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "loanTypeId is required"})
		return
	}

	db, _ := c.Get("db")
	lt, err := services.NewLoanService(db.(*sql.DB)).GetLoanTypeByID(loanTypeID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    lt,
	})
		c.Abort()
}

func UpdateLoanType(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "Unauthorized"})
		return
	}

	loanTypeID := c.Param("loanTypeId")
	if loanTypeID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "loanTypeId is required"})
		return
	}

	var req models.LoanProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid request: " + err.Error()})
		return
	}

	db, _ := c.Get("db")
	loanType, err := services.NewLoanService(db.(*sql.DB)).UpdateLoanType(loanTypeID, &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    loanType,
		"message": "Loan type updated successfully",
	})
		c.Abort()
}

func DeleteLoanType(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "Unauthorized"})
		return
	}

	loanTypeID := c.Param("loanTypeId")
	if loanTypeID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "loanTypeId is required"})
		return
	}

	db, _ := c.Get("db")
	if err := services.NewLoanService(db.(*sql.DB)).DeleteLoanType(loanTypeID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Loan type deleted successfully",
	})
		c.Abort()
}

func containsRole(role string, roles ...string) bool {
	for _, r := range roles {
		if role == r {
			return true
		}
	}
	return false
}
