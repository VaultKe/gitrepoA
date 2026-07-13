package api

import (
	"database/sql"
	"fmt"
	"strings"

	"vaultke-backend/internal/models"
	"vaultke-backend/internal/services"
)

// getDisbursementSourceWalletID resolves the chama subwallet that funds for a
// given disbursement category should be drawn from, validating it first.
func getDisbursementSourceWalletID(db *sql.DB, chamaID, category string) (string, error) {
	var subwalletType models.ChamaWalletType
	if category == "welfare" {
		subwalletType = models.ChamaWalletTypeWelfare
	} else if category == "merry_go_round" {
		subwalletType = models.ChamaWalletTypeMerryGo
	} else {
		return "", fmt.Errorf("unsupported disbursement category: %s", category)
	}

	sourceWalletID := fmt.Sprintf("wallet-%s-%s", chamaID, subwalletType)
	paybillService := services.NewPaybillTrackingService(db)
	if _, err := paybillService.ValidateDisbursementSource(sourceWalletID, chamaID); err != nil {
		return "", err
	}

	return sourceWalletID, nil
}

// normalizePhoneNumber converts a local phone number to the 254... format
// expected by M-Pesa B2C disbursements.
func normalizePhoneNumber(phone string) (string, error) {
	if strings.HasPrefix(phone, "07") {
		return "254" + phone[1:], nil
	}
	if strings.HasPrefix(phone, "+254") {
		return phone[1:], nil
	}
	if strings.HasPrefix(phone, "254") {
		return phone, nil
	}
	return "", fmt.Errorf("invalid phone number format. must start with 254 or 07")
}
