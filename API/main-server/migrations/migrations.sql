-- Migration: Update notifications table to match Go model (2025-09-11)
-- This migration adds missing columns to the notifications table to match the Go Notification model

-- Create notifications table if it doesn't exist
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL,
    data TEXT, -- JSON data
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Add missing columns to notifications table
-- Columns for new notification service (services/notification_service.go)
ALTER TABLE notifications ADD COLUMN priority TEXT DEFAULT 'normal';
ALTER TABLE notifications ADD COLUMN category TEXT NULL;
ALTER TABLE notifications ADD COLUMN reference_type TEXT NULL;
ALTER TABLE notifications ADD COLUMN reference_id INTEGER NULL;
ALTER TABLE notifications ADD COLUMN status TEXT DEFAULT 'pending';
ALTER TABLE notifications ADD COLUMN scheduled_for TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE notifications ADD COLUMN sent_at TIMESTAMP NULL;
ALTER TABLE notifications ADD COLUMN delivered_at TIMESTAMP NULL;
ALTER TABLE notifications ADD COLUMN sound_played INTEGER DEFAULT 0;
ALTER TABLE notifications ADD COLUMN retry_count INTEGER DEFAULT 0;
ALTER TABLE notifications ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Columns for old notification service (internal/services/notification_service.go)
ALTER TABLE notifications ADD COLUMN is_push INTEGER DEFAULT 0;
ALTER TABLE notifications ADD COLUMN is_email INTEGER DEFAULT 0;
ALTER TABLE notifications ADD COLUMN is_sms INTEGER DEFAULT 0;

-- Create additional tables for complete notification system
CREATE TABLE IF NOT EXISTS user_notification_preferences (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    notification_sound_id INTEGER NULL,
    sound_enabled INTEGER DEFAULT 1,
    vibration_enabled INTEGER DEFAULT 1,
    volume_level INTEGER DEFAULT 80,
    chama_notifications INTEGER DEFAULT 1,
    transaction_notifications INTEGER DEFAULT 1,
    reminder_notifications INTEGER DEFAULT 1,
    system_notifications INTEGER DEFAULT 1,
    quiet_hours_enabled INTEGER DEFAULT 0,
    quiet_hours_start TEXT DEFAULT '22:00:00',
    quiet_hours_end TEXT DEFAULT '07:00:00',
    timezone TEXT DEFAULT 'Africa/Nairobi',
    notification_frequency TEXT DEFAULT 'immediate',
    priority_only_during_quiet INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notification_sounds (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    duration_seconds REAL DEFAULT 0,
    is_default INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notification_templates (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL,
    category TEXT NOT NULL,
    title_template TEXT NOT NULL,
    message_template TEXT NOT NULL,
    default_priority TEXT DEFAULT 'normal',
    requires_sound INTEGER DEFAULT 0,
    requires_vibration INTEGER DEFAULT 0,
    variables TEXT NULL,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notification_delivery_log (
    id SERIAL PRIMARY KEY,
    notification_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    delivery_method TEXT NOT NULL,
    status TEXT NOT NULL,
    attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    delivered_at TIMESTAMP NULL,
    error_message TEXT NULL,
    retry_count INTEGER DEFAULT 0,
    device_info TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Insert default notification sounds
INSERT INTO notification_sounds (name, file_path, file_size, duration_seconds, is_default, is_active) 
SELECT 'Alert', '/notification_sound/alert.mp3', 102400, 2.5, 0, 1
WHERE NOT EXISTS (SELECT 1 FROM notification_sounds WHERE name = 'Alert');

INSERT INTO notification_sounds (name, file_path, file_size, duration_seconds, is_default, is_active) 
SELECT 'Bell', '/notification_sound/bell.mp3', 153600, 3.2, 1, 1
WHERE NOT EXISTS (SELECT 1 FROM notification_sounds WHERE name = 'Bell');

INSERT INTO notification_sounds (name, file_path, file_size, duration_seconds, is_default, is_active) 
SELECT 'Chime', '/notification_sound/chime.mp3', 204800, 4.1, 0, 1
WHERE NOT EXISTS (SELECT 1 FROM notification_sounds WHERE name = 'Chime');

INSERT INTO notification_sounds (name, file_path, file_size, duration_seconds, is_default, is_active) 
SELECT 'Ring', '/notification_sound/ring.mp3', 256000, 5.0, 0, 1
WHERE NOT EXISTS (SELECT 1 FROM notification_sounds WHERE name = 'Ring');

INSERT INTO notification_sounds (name, file_path, file_size, duration_seconds, is_default, is_active) 
SELECT 'Vibrate', '/notification_sound/vibrate.mp3', 51200, 1.8, 0, 1
WHERE NOT EXISTS (SELECT 1 FROM notification_sounds WHERE name = 'Vibrate');

-- Insert default notification templates
INSERT INTO notification_templates (name, type, category, title_template, message_template, default_priority, requires_sound, requires_vibration) 
SELECT 'chama_invitation', 'chama', 'invitation', 'Chama Invitation', 'You have been invited to join {chamaName} chama', 'normal', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM notification_templates WHERE name = 'chama_invitation');

INSERT INTO notification_templates (name, type, category, title_template, message_template, default_priority, requires_sound, requires_vibration) 
SELECT 'chama_member_joined', 'chama', 'member', 'New Member Joined', '{memberName} has joined {chamaName}', 'normal', 1, 0
WHERE NOT EXISTS (SELECT 1 FROM notification_templates WHERE name = 'chama_member_joined');

INSERT INTO notification_templates (name, type, category, title_template, message_template, default_priority, requires_sound, requires_vibration) 
SELECT 'contribution_received', 'transaction', 'contribution', 'Contribution Received', 'Your contribution of KES {amount} has been received', 'normal', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM notification_templates WHERE name = 'contribution_received');

INSERT INTO notification_templates (name, type, category, title_template, message_template, default_priority, requires_sound, requires_vibration) 
SELECT 'loan_application', 'transaction', 'loan', 'Loan Application Submitted', 'Your loan application for KES {amount} has been submitted', 'high', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM notification_templates WHERE name = 'loan_application');

INSERT INTO notification_templates (name, type, category, title_template, message_template, default_priority, requires_sound, requires_vibration) 
SELECT 'meeting_reminder', 'reminder', 'meeting', 'Meeting Reminder', 'You have a meeting scheduled for {meetingTime}', 'high', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM notification_templates WHERE name = 'meeting_reminder');

INSERT INTO notification_templates (name, type, category, title_template, message_template, default_priority, requires_sound, requires_vibration) 
SELECT 'system_maintenance', 'system', 'maintenance', 'System Maintenance', 'Scheduled maintenance will begin at {startTime}', 'normal', 0, 0
WHERE NOT EXISTS (SELECT 1 FROM notification_templates WHERE name = 'system_maintenance');


-- Migration: Add name column to shares table (2025-09-25)
-- This migration adds the required "name" column to the shares table to match the Go model

-- Add name column to shares table
ALTER TABLE shares ADD COLUMN name TEXT NOT NULL;

-- Migration: Add dividend_type column to dividend_declarations table (2025-09-26)
-- This migration adds the required "dividend_type" column to match the API payload

-- Add dividend_type column to dividend_declarations table
ALTER TABLE dividend_declarations ADD COLUMN dividend_type TEXT DEFAULT 'cash';

-- E2EE Tables for military-grade encryption
CREATE TABLE IF NOT EXISTS e2ee_key_bundles (
    user_id TEXT PRIMARY KEY,
    identity_key TEXT NOT NULL,
    signed_pre_key TEXT NOT NULL,
    pre_key_signature TEXT NOT NULL,
    one_time_pre_keys TEXT NOT NULL, -- JSON array
    registration_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS e2ee_sessions (
    id TEXT PRIMARY KEY,
    user_a_id TEXT NOT NULL,
    user_b_id TEXT NOT NULL,
    shared_secret TEXT NOT NULL,
    sending_chain TEXT NOT NULL,
    receiving_chain TEXT NOT NULL,
    message_number INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_a_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (user_b_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_notification_preferences_user_id ON user_notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_sounds_is_default ON notification_sounds(is_default);
CREATE INDEX IF NOT EXISTS idx_notification_sounds_is_active ON notification_sounds(is_active);
CREATE INDEX IF NOT EXISTS idx_notification_templates_name ON notification_templates(name);
CREATE INDEX IF NOT EXISTS idx_notification_templates_type ON notification_templates(type);
CREATE INDEX IF NOT EXISTS idx_notification_delivery_log_notification_id ON notification_delivery_log(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_delivery_log_user_id ON notification_delivery_log(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_delivery_log_status ON notification_delivery_log(status);
CREATE INDEX IF NOT EXISTS idx_notification_delivery_log_attempted_at ON notification_delivery_log(attempted_at);

-- Migration: Create reminders table (2025-11-27)
-- This migration creates the reminders table for the reminder system

CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NULL,
    reminder_type TEXT NOT NULL CHECK (reminder_type IN ('once', 'daily', 'weekly', 'monthly')),
    scheduled_at TIMESTAMP NOT NULL,
    is_enabled BOOLEAN DEFAULT TRUE,
    is_completed BOOLEAN DEFAULT FALSE,
    notification_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for reminders table
CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_scheduled_at ON reminders(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_reminders_is_enabled ON reminders(is_enabled);
CREATE INDEX IF NOT EXISTS idx_reminders_is_completed ON reminders(is_completed);
CREATE INDEX IF NOT EXISTS idx_reminders_notification_sent ON reminders(notification_sent);
