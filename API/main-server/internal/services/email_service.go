package services

import (
	"fmt"
	"net/smtp"
	"os"
	"vaultke-backend/internal/utils"
)

// EmailService handles email sending functionality
type EmailService struct {
	smtpHost     string
	smtpPort     string
	smtpUsername string
	smtpPassword string
	fromEmail    string
}

// NewEmailService creates a new email service
func NewEmailService() *EmailService {
	smtpHost := os.Getenv("SMTP_HOST")
	smtpPort := os.Getenv("SMTP_PORT")
	smtpUsername := os.Getenv("SMTP_USERNAME")
	password := os.Getenv("SMTP_PASSWORD")

	if len(password) >= 2 && password[0] == '"' && password[len(password)-1] == '"' {
		password = password[1 : len(password)-1]
	}

	emailService := &EmailService{
		smtpHost:     smtpHost,
		smtpPort:     smtpPort,
		smtpUsername: smtpUsername,
		smtpPassword: password,
		fromEmail:    smtpUsername,
	}

	return emailService
}

// maskPassword masks a password for logging purposes
func maskPassword(password string) string {
	if len(password) == 0 {
		return "<empty>"
	}
	if len(password) <= 4 {
		return "****"
	}
	return password[:2] + "****" + password[len(password)-2:]
}

// SendPasswordResetEmail sends a password reset email to the user
func (s *EmailService) SendPasswordResetEmail(toEmail, resetToken, userName string) error {
	if s.smtpHost == "" || s.smtpPort == "" || s.smtpUsername == "" || s.smtpPassword == "" {
		return nil
	}

	resetURL := fmt.Sprintf("https://vaultke.com/reset-password?token=%s", resetToken)
	subject := "VaultKe - Password Reset Request"
	body := s.generatePasswordResetEmailBody(userName, resetURL, resetToken)
	message := fmt.Sprintf("To: %s\r\nSubject: %s\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n%s",
		toEmail, subject, body)

	err := s.sendEmail(toEmail, message)
	if err != nil {
		return err
	}
	return nil
}

// sendEmail sends an email using SMTP
func (s *EmailService) sendEmail(toEmail, message string) error {
	auth := smtp.PlainAuth("", s.smtpUsername, s.smtpPassword, s.smtpHost)
	addr := fmt.Sprintf("%s:%s", s.smtpHost, s.smtpPort)

	err := smtp.SendMail(addr, auth, s.fromEmail, []string{toEmail}, []byte(message))
	if err != nil {
		return fmt.Errorf("failed to send email: %w", err)
	}
	return nil
}

// SendHTMLEmail sends an HTML email using SMTP
func (s *EmailService) SendHTMLEmail(toEmail, subject, htmlBody string) error {
	if s.smtpHost == "" || s.smtpPort == "" || s.smtpUsername == "" || s.smtpPassword == "" {
		return nil
	}

	message := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n%s",
		s.fromEmail, toEmail, subject, htmlBody)

	return s.sendEmail(toEmail, message)
}

// SendChamaInvitationEmail sends a chama invitation email to the invitee
func (s *EmailService) SendChamaInvitationEmail(toEmail, chamaName, inviterName, message, invitationToken string) error {
	if toEmail == "" || chamaName == "" || inviterName == "" || invitationToken == "" {
		return fmt.Errorf("missing required parameters")
	}

	if s.smtpHost == "" || s.smtpPort == "" || s.smtpUsername == "" || s.smtpPassword == "" {
		return nil
	}

	invitationURL := fmt.Sprintf("https://vaultke.com/chama-invitation?token=%s", invitationToken)
	subject := fmt.Sprintf("VaultKe - Invitation to Join %s Chama", chamaName)
	body := s.generateChamaInvitationEmailBody(chamaName, inviterName, message, invitationURL, invitationToken)
	emailMessage := fmt.Sprintf("To: %s\r\nSubject: %s\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n%s",
		toEmail, subject, body)

	return s.sendEmail(toEmail, emailMessage)
}

// generatePasswordResetEmailBody generates the HTML email body for password reset
func (s *EmailService) generatePasswordResetEmailBody(userName, resetURL, resetToken string) string {
	if userName == "" {
		userName = "VaultKe User"
	}
	content := fmt.Sprintf(`
		<p style="font-size: 18px; color: #1e293b; margin-bottom: 24px;">Hello <span class="highlight">%s</span>,</p>
		<p>We received a request to reset your password for your VaultKe account. Use the verification code below to complete the process:</p>
		<div style="text-align: center; margin: 30px 0;">
			<div style="display: inline-block; background: linear-gradient(135deg, #f0fdf4 0%%, #dcfce7 100%%); border: 2px solid #00D4AA; border-radius: 12px; padding: 20px 30px;">
				<p style="font-size: 14px; color: #64748b; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Verification Code</p>
				<div style="font-size: 32px; font-weight: 800; color: #00D4AA; letter-spacing: 3px; font-family: 'Courier New', monospace;">%s</div>
			</div>
		</div>
		<div class="security-notice">
			<p style="margin: 0; font-size: 14px; color: #92400e;"><strong>⚠️ Security Notice:</strong> This code expires in <strong>2 minutes</strong>. If you didn't request this reset, please ignore this email - your account remains secure.</p>
		</div>
		<p>For your security, never share this code with anyone. Our team will never ask for your verification code.</p>
		<p style="margin-top: 30px;">Best regards,<br><span class="highlight">The VaultKe Team</span></p>
	`, userName, resetToken)
	return utils.GetEmailTemplate("Password Reset Request", content, "", "")
}

// generateChamaInvitationEmailBody generates the HTML email body for chama invitation
func (s *EmailService) generateChamaInvitationEmailBody(chamaName, inviterName, message, invitationURL, invitationToken string) string {
	if message == "" {
		message = fmt.Sprintf("You have been invited to join %s chama. Join us to start saving and investing together!", chamaName)
	}
	content := fmt.Sprintf(`
		<p style="font-size: 18px; color: #1e293b; margin-bottom: 24px;">Hello there,</p>
		<p><span class="highlight">%s</span> has invited you to join <strong>%s</strong> chama on VaultKe. Use the invitation code below to join this chama:</p>
		<div style="text-align: center; margin: 30px 0;">
			<div style="display: inline-block; background: linear-gradient(135deg, #f0fdf4 0%%, #dcfce7 100%%); border: 2px solid #00D4AA; border-radius: 12px; padding: 20px 30px;">
				<p style="font-size: 14px; color: #64748b; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Invitation Code</p>
				<div style="font-size: 32px; font-weight: 800; color: #00D4AA; letter-spacing: 3px; font-family: 'Courier New', monospace;">%s</div>
			</div>
		</div>
		<div class="security-notice">
			<p style="margin: 0; font-size: 14px; color: #92400e;"><strong>⚠️ Security Notice:</strong> This invitation code expires in <strong>7 days</strong>. If you don't know %s, please ignore this email - your account remains secure.</p>
		</div>
		<p><strong>Personal Message from %s:</strong><br>"%s"</p>
		<p>For your security, never share this invitation code with anyone. Our team will never ask for your invitation code.</p>
		<p style="margin-top: 30px;">Ready to join the chama?<br><span class="highlight">The VaultKe Team</span></p>
	`, inviterName, chamaName, invitationToken, inviterName, inviterName, message)
	return utils.GetEmailTemplate(fmt.Sprintf("Join %s Chama", chamaName), content, "Accept Invitation", invitationURL)
}

// SendTestEmail sends a test email to verify configuration
func (s *EmailService) SendTestEmail(toEmail string) error {
	subject := "VaultKe - Email Service Test"
	content := `
		<p style="font-size: 18px; color: #1e293b; margin-bottom: 24px;">Hello <span class="highlight">VaultKe Team</span>,</p>
		<p>This is a test email from VaultKe to verify that our email service is configured correctly.</p>
		<p style="margin-top: 30px;">Email system operational!<br><span class="highlight">The VaultKe Development Team</span></p>
	`
	body := utils.GetEmailTemplate("Email Service Test", content, "", "")
	message := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n%s", s.fromEmail, toEmail, subject, body)
	return s.sendEmail(toEmail, message)
}

// SendEmailVerificationEmail sends an email verification email
func (s *EmailService) SendEmailVerificationEmail(to, verificationCode, userName string) error {
	if s.smtpHost == "" || s.smtpPort == "" || s.smtpUsername == "" || s.smtpPassword == "" {
		return nil
	}

	subject := "Verify Your Email - VaultKe"
	content := fmt.Sprintf(`
		<p style="font-size: 18px; color: #1e293b; margin-bottom: 24px;">Hello <span class="highlight">%s</span>,</p>
		<p>Welcome to <strong>VaultKe</strong>! To complete your registration, please verify your email using the code below:</p>
		<div style="text-align: center; margin: 30px 0;">
			<div style="display: inline-block; background: linear-gradient(135deg, #f0fdf4 0%%, #dcfce7 100%%); border: 2px solid #00D4AA; border-radius: 12px; padding: 20px 30px;">
				<p style="font-size: 14px; color: #64748b; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Verification Code</p>
				<div style="font-size: 32px; font-weight: 800; color: #00D4AA; letter-spacing: 3px; font-family: 'Courier New', monospace;">%s</div>
			</div>
		</div>
		<div class="security-notice">
			<p style="margin: 0; font-size: 14px; color: #92400e;"><strong>⚠️ Security Notice:</strong> This code expires in <strong>2 minutes</strong>.</p>
		</div>
		<p style="margin-top: 30px;">Welcome!<br><span class="highlight">The VaultKe Team</span></p>
	`, userName, verificationCode)
	htmlBody := utils.GetEmailTemplate("Verify Your Email Address", content, "", "")
	message := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n%s", s.fromEmail, to, subject, htmlBody)
	return s.sendEmail(to, message)
}
