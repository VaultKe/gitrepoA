package services

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"vaultke-backend/internal/models"
)

// AuthService handles authentication-related business logic
type AuthService struct {
	jwtSecret     string
	jwtExpiration time.Duration
	db            *sql.DB
	// In-memory blacklist for immediate JWT revocation (short-lived only)
	blacklistedTokens map[string]time.Time
	blacklistMutex    sync.RWMutex
}

// NewAuthService creates a new auth service
func NewAuthService(db *sql.DB, jwtSecret string, jwtExpirationSeconds int) *AuthService {
	return &AuthService{
		db:                db,
		jwtSecret:         jwtSecret,
		jwtExpiration:     time.Duration(jwtExpirationSeconds) * time.Second,
		blacklistedTokens: make(map[string]time.Time),
	}
}

// JWTClaims represents JWT token claims
type JWTClaims struct {
	UserID string `json:"userId"`
	Email  string `json:"email"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

// GenerateToken generates a JWT access token for a user
func (s *AuthService) GenerateToken(user *models.User) (string, error) {
	now := time.Now()
	claims := &JWTClaims{
		UserID: user.ID,
		Email:  user.Email,
		Role:   string(user.Role),
		RegisteredClaims: jwt.RegisteredClaims{
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(s.jwtExpiration)),
			NotBefore: jwt.NewNumericDate(now),
			Issuer:    "vaultke",
			Subject:   user.ID,
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(s.jwtSecret))
	if err != nil {
		return "", fmt.Errorf("failed to sign token: %w", err)
	}

	return tokenString, nil
}

// ValidateToken validates a JWT token and returns the claims
func (s *AuthService) ValidateToken(tokenString string) (*JWTClaims, error) {
	// Check if token is blacklisted first
	if s.IsTokenBlacklisted(tokenString) {
		return nil, fmt.Errorf("token has been revoked")
	}

	token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		// Validate signing method
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(s.jwtSecret), nil
	})
	if err != nil {
		return nil, fmt.Errorf("failed to parse token: %w", err)
	}

	if !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}

	claims, ok := token.Claims.(*JWTClaims)
	if !ok {
		return nil, fmt.Errorf("invalid token claims")
	}

	return claims, nil
}

// hashToken returns SHA-256 hash of the token for safe storage
func (s *AuthService) hashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}

// hashUserAgent returns a short hash of the user agent for device binding
func (s *AuthService) hashUserAgent(userAgent string) string {
	if userAgent == "" {
		return ""
	}
	h := sha256.Sum256([]byte(userAgent))
	return hex.EncodeToString(h[:16])
}

// GenerateRefreshToken creates a new refresh token, stores it hashed in DB, and returns the plaintext token
func (s *AuthService) GenerateRefreshToken(userID, userAgent, ipAddress string) (string, *models.RefreshToken, error) {
	rawToken := make([]byte, 32)
	if _, err := rand.Read(rawToken); err != nil {
		return "", nil, fmt.Errorf("failed to generate random token: %w", err)
	}
	plainToken := hex.EncodeToString(rawToken)
	tokenHash := s.hashToken(plainToken)
	uaHash := s.hashUserAgent(userAgent)

	expiresAt := time.Now().Add(30 * 24 * time.Hour) // 30 days

	rt := &models.RefreshToken{
		UserID:        userID,
		TokenHash:     tokenHash,
		UserAgentHash: &uaHash,
		IPAddress:     &ipAddress,
		ExpiresAt:     expiresAt,
		Revoked:       false,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	query := `
		INSERT INTO refresh_tokens (user_id, token_hash, user_agent_hash, ip_address, expires_at, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id
	`
	var id int
	err := s.db.QueryRow(query, rt.UserID, rt.TokenHash, rt.UserAgentHash, rt.IPAddress, rt.ExpiresAt, rt.CreatedAt, rt.UpdatedAt).Scan(&id)
	if err != nil {
		return "", nil, fmt.Errorf("failed to store refresh token: %w", err)
	}
	rt.ID = id

	return plainToken, rt, nil
}

// ValidateRefreshToken checks if a refresh token is valid and returns the stored record
func (s *AuthService) ValidateRefreshToken(plainToken string) (*models.RefreshToken, error) {
	tokenHash := s.hashToken(plainToken)

	rt := &models.RefreshToken{}
	query := `
		SELECT id, user_id, token_hash, user_agent_hash, ip_address, expires_at, last_used_at, revoked, replaced_by_token_hash, created_at, updated_at
		FROM refresh_tokens
		WHERE token_hash = $1
	`
	err := s.db.QueryRow(query, tokenHash).Scan(
		&rt.ID, &rt.UserID, &rt.TokenHash, &rt.UserAgentHash, &rt.IPAddress,
		&rt.ExpiresAt, &rt.LastUsedAt, &rt.Revoked, &rt.ReplacedByTokenHash,
		&rt.CreatedAt, &rt.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("refresh token not found")
	}
	if err != nil {
		return nil, fmt.Errorf("failed to query refresh token: %w", err)
	}

	if rt.Revoked {
		// THEFT DETECTION: if a revoked token is presented, suspect theft
		// Revoke ALL tokens for this user immediately
		s.RevokeAllUserTokens(rt.UserID)
		return nil, fmt.Errorf("refresh token has been revoked - all sessions terminated due to suspected token theft")
	}

	if time.Now().After(rt.ExpiresAt) {
		return nil, fmt.Errorf("refresh token has expired")
	}

	return rt, nil
}

// RefreshAccessToken validates the refresh token, rotates it, and returns a new JWT + new refresh token
func (s *AuthService) RefreshAccessToken(plainRefreshToken, userAgent, ipAddress string) (string, string, error) {
	rt, err := s.ValidateRefreshToken(plainRefreshToken)
	if err != nil {
		return "", "", err
	}

	// Get user for token generation
	user, err := s.getUserByID(rt.UserID)
	if err != nil {
		return "", "", fmt.Errorf("failed to get user: %w", err)
	}

	// Generate new access token
	accessToken, err := s.GenerateToken(user)
	if err != nil {
		return "", "", err
	}

	// ROTATE: Generate new refresh token and revoke the old one
	newPlainToken, newRT, err := s.GenerateRefreshToken(rt.UserID, userAgent, ipAddress)
	if err != nil {
		return "", "", err
	}

	// Mark old token as revoked and link to new
	now := time.Now()
	_, err = s.db.Exec(
		`UPDATE refresh_tokens SET revoked = TRUE, replaced_by_token_hash = $1, updated_at = $2 WHERE id = $3`,
		newRT.TokenHash, now, rt.ID,
	)
	if err != nil {
		return "", "", fmt.Errorf("failed to revoke old refresh token: %w", err)
	}

	// Update last_used_at for the new token
	_, err = s.db.Exec(`UPDATE refresh_tokens SET last_used_at = $1 WHERE id = $2`, now, newRT.ID)
	if err != nil {
		return "", "", fmt.Errorf("failed to update refresh token usage: %w", err)
	}

	return accessToken, newPlainToken, nil
}

// RevokeRefreshToken revokes a specific refresh token
func (s *AuthService) RevokeRefreshToken(plainToken string) error {
	tokenHash := s.hashToken(plainToken)
	_, err := s.db.Exec(`UPDATE refresh_tokens SET revoked = TRUE, updated_at = $1 WHERE token_hash = $2`, time.Now(), tokenHash)
	return err
}

// RevokeAllUserTokens revokes all refresh tokens for a user (e.g. logout all devices)
func (s *AuthService) RevokeAllUserTokens(userID string) error {
	_, err := s.db.Exec(`UPDATE refresh_tokens SET revoked = TRUE, updated_at = $1 WHERE user_id = $2 AND revoked = FALSE`, time.Now(), userID)
	return err
}

// CleanupExpiredRefreshTokens removes expired tokens from DB
func (s *AuthService) CleanupExpiredRefreshTokens() error {
	_, err := s.db.Exec(`DELETE FROM refresh_tokens WHERE expires_at < NOW() AND revoked = TRUE`)
	return err
}

// getUserByID fetches a user by ID
func (s *AuthService) getUserByID(userID string) (*models.User, error) {
	user := &models.User{}
	query := `
		SELECT id, email, phone, first_name, last_name, password_hash, avatar, role, status,
		       is_email_verified, is_phone_verified, language, theme, county, town,
		       latitude, longitude, business_type, business_description, bio, occupation,
		       date_of_birth, gender, rating, total_ratings, created_at, updated_at
		FROM users WHERE id = $1
	`
	err := s.db.QueryRow(query, userID).Scan(
		&user.ID, &user.Email, &user.Phone, &user.FirstName, &user.LastName, &user.PasswordHash,
		&user.Avatar, &user.Role, &user.Status, &user.IsEmailVerified, &user.IsPhoneVerified,
		&user.Language, &user.Theme, &user.County, &user.Town, &user.Latitude, &user.Longitude,
		&user.BusinessType, &user.BusinessDescription, &user.Bio, &user.Occupation,
		&user.DateOfBirth, &user.Gender, &user.Rating, &user.TotalRatings,
		&user.CreatedAt, &user.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("user not found")
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}
	return user, nil
}

// BlacklistToken adds a JWT to the in-memory blacklist for immediate revocation
func (s *AuthService) BlacklistToken(tokenString string) error {
	expiryTime, err := s.GetTokenExpiryTime(tokenString)
	if err != nil {
		expiryTime = time.Now().Add(s.jwtExpiration)
	}

	s.blacklistMutex.Lock()
	defer s.blacklistMutex.Unlock()

	s.blacklistedTokens[tokenString] = expiryTime
	return nil
}

// IsTokenBlacklisted checks if a JWT is blacklisted
func (s *AuthService) IsTokenBlacklisted(tokenString string) bool {
	s.blacklistMutex.RLock()
	defer s.blacklistMutex.RUnlock()

	expiryTime, exists := s.blacklistedTokens[tokenString]
	if !exists {
		return false
	}

	if time.Now().After(expiryTime) {
		s.blacklistMutex.RUnlock()
		s.blacklistMutex.Lock()
		delete(s.blacklistedTokens, tokenString)
		s.blacklistMutex.Unlock()
		s.blacklistMutex.RLock()
		return false
	}

	return true
}

// GetTokenExpiryTime returns the expiry time of a JWT
func (s *AuthService) GetTokenExpiryTime(tokenString string) (time.Time, error) {
	claims, err := s.ValidateToken(tokenString)
	if err != nil {
		return time.Time{}, err
	}
	return claims.ExpiresAt.Time, nil
}

// ExtractUserIDFromToken extracts user ID from token without full validation
func (s *AuthService) ExtractUserIDFromToken(tokenString string) (string, error) {
	claims, err := s.ValidateToken(tokenString)
	if err != nil {
		return "", err
	}
	return claims.UserID, nil
}

// IsTokenExpired checks if a token is expired
func (s *AuthService) IsTokenExpired(tokenString string) bool {
	claims, err := s.ValidateToken(tokenString)
	if err != nil {
		return true
	}
	return time.Now().After(claims.ExpiresAt.Time)
}

// CleanupExpiredTokens removes expired tokens from the in-memory blacklist
func (s *AuthService) CleanupExpiredTokens() {
	s.blacklistMutex.Lock()
	defer s.blacklistMutex.Unlock()

	now := time.Now()
	for token, expiryTime := range s.blacklistedTokens {
		if now.After(expiryTime) {
			delete(s.blacklistedTokens, token)
		}
	}
}
