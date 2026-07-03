package utils

import (
    "regexp"
    "strings"
)

// MaskPhone masks a phone number for display, keeping a small prefix and suffix.
func MaskPhone(phone string) string {
    if phone == "" {
        return phone
    }
    // Keep only digits for masking logic
    cleaned := regexp.MustCompile(`\D`).ReplaceAllString(phone, "")
    n := len(cleaned)
    if n <= 4 {
        return strings.Repeat("*", n)
    }

    prefix := 3
    suffix := 2
    if n <= prefix+suffix {
        return strings.Repeat("*", n)
    }

    maskedMiddle := strings.Repeat("*", n-prefix-suffix)
    masked := cleaned[:prefix] + maskedMiddle + cleaned[n-suffix:]

    // Preserve leading + if present in original
    if strings.HasPrefix(phone, "+") {
        return "+" + masked
    }
    return masked
}

// MaskEmail masks the local part of an email, keeping first character and the domain.
func MaskEmail(email string) string {
    if email == "" {
        return email
    }
    parts := strings.SplitN(email, "@", 2)
    if len(parts) != 2 {
        return email
    }
    local := parts[0]
    domain := parts[1]
    if len(local) <= 1 {
        return "*@" + domain
    }
    maskedLocal := local[:1] + strings.Repeat("*", len(local)-1)
    return maskedLocal + "@" + domain
}

// MaskID masks an identifier, showing only the last 4 characters.
// For National IDs, extracts digits and shows first 2 + last 4 digits.
// Returns "N/A" for empty or non-numeric values.
func MaskID(id string) string {
	if id == "" {
		return "N/A"
	}
	// Extract only digits for National ID masking
	cleaned := regexp.MustCompile(`\D`).ReplaceAllString(id, "")
	if cleaned == "" {
		// No numeric value found - National ID should be numeric
		return "N/A"
	}
	n := len(cleaned)
	if n >= 8 {
		// Long ID: show first 2 + asterisks + last 4
		return cleaned[:2] + "****" + cleaned[n-4:]
	}
	// Short ID (5-7 digits): show first 2 + asterisks + last 4
	if n >= 6 {
		return cleaned[:2] + "***" + cleaned[n-4:]
	}
	// Very short ID (5 or less): mask with asterisks
	return strings.Repeat("*", n-1) + cleaned[n-1:]
}
