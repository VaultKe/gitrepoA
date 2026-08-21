package phone

import (
	"fmt"

	"github.com/nyaruka/phonenumbers/v2"
)

// NormalizeKenyanPhone parses a Kenyan phone number supplied in any common
// input form and returns its canonical E.164 representation, e.g.
// "+254712345678".
//
// Accepted inputs include:
//
//	0712345678       → +254712345678
//	0112345678       → +254112345678
//	254712345678     → +254712345678
//	+254712345678    → +254712345678
//
// It is backed by Google's libphonenumber (via nyaruka/phonenumbers), so the
// numbering-plan rules are handled by maintained country metadata rather than
// hand-written regex. An error is returned if the value cannot be parsed or is
// not a valid Kenyan number.
func NormalizeKenyanPhone(input string) (string, error) {
	number, err := phonenumbers.Parse(input, "KE")
	if err != nil {
		return "", fmt.Errorf("could not parse phone number: %w", err)
	}

	if !phonenumbers.IsValidNumber(number) {
		return "", fmt.Errorf("invalid Kenyan phone number")
	}

	return phonenumbers.Format(number, phonenumbers.E164), nil
}
