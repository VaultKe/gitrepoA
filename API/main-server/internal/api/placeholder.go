package api

import (
	"strings"
)

// sanitizeInput removes dangerous characters from user input
func sanitizeInput(input string) string {
	// Remove null bytes and control characters
	result := ""
	for _, char := range input {
		if char >= 32 && char != 127 { // Keep printable characters except DEL
			result += string(char)
		}
	}

	// Remove dangerous patterns
	dangerous := []string{
		"<script", "</script", "javascript:", "vbscript:", "onload=", "onerror=",
		"onclick=", "onmouseover=", "onfocus=", "onblur=", "onchange=", "onsubmit=",
		"<iframe", "<object", "<embed", "<link", "<meta", "data:text/html",
		"eval(", "expression(", "url(javascript:", "&#", "&#x", "<svg", "<img",
		"union", "select", "insert", "update", "delete", "drop", "create", "alter",
		"truncate", "exec", "execute", "declare", "cast", "convert", "grant", "revoke",
		"'", "\"", ";", "--", "/*", "*/",
	}

	for _, pattern := range dangerous {
		result = strings.ReplaceAll(strings.ToLower(result), pattern, "")
	}

	return result
}
