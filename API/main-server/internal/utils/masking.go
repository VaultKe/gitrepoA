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
func MaskID(id string) string {
    if id == "" {
        return id
    }
    if len(id) <= 4 {
        return strings.Repeat("*", len(id))
    }
    masked := strings.Repeat("*", len(id)-4) + id[len(id)-4:]
    return masked
}
