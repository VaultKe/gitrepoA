-- rooms table
CREATE TABLE IF NOT EXISTS rooms (
	id TEXT PRIMARY KEY,
	chama_id TEXT NOT NULL,
	name TEXT NOT NULL,
	type TEXT NOT NULL DEFAULT 'virtual',
	status TEXT NOT NULL DEFAULT 'waiting',
	max_participants INTEGER NOT NULL DEFAULT 150,
	created_by TEXT NOT NULL,
	created_at TIMESTAMP NOT NULL DEFAULT NOW(),
	ended_at TIMESTAMP,
	recording_enabled BOOLEAN DEFAULT FALSE,
	recording_path TEXT,
	metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_rooms_chama_id ON rooms(chama_id);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_rooms_created_at ON rooms(created_at);

-- participants table
CREATE TABLE IF NOT EXISTS participants (
	id TEXT PRIMARY KEY,
	room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
	user_id TEXT NOT NULL,
	display_name TEXT NOT NULL,
	role TEXT NOT NULL DEFAULT 'participant',
	is_muted BOOLEAN DEFAULT FALSE,
	is_video_on BOOLEAN DEFAULT FALSE,
	is_screen_sharing BOOLEAN DEFAULT FALSE,
	joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
	left_at TIMESTAMP,
	metadata JSONB DEFAULT '{}'::jsonb,
	UNIQUE(room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_participants_room_id ON participants(room_id);
CREATE INDEX IF NOT EXISTS idx_participants_user_id ON participants(user_id);
CREATE INDEX IF NOT EXISTS idx_participants_joined_at ON participants(joined_at);

-- room_chat_messages table
CREATE TABLE IF NOT EXISTS room_chat_messages (
	id TEXT PRIMARY KEY,
	room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
	user_id TEXT NOT NULL,
	content TEXT NOT NULL,
	message_type TEXT DEFAULT 'text',
	created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_room_chat_messages_room_id ON room_chat_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_room_chat_messages_created_at ON room_chat_messages(created_at);

-- webrtc_sessions table for connection tracking
CREATE TABLE IF NOT EXISTS webrtc_sessions (
	id TEXT PRIMARY KEY,
	room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
	user_id TEXT NOT NULL,
	participant_id TEXT NOT NULL,
	connection_id TEXT NOT NULL,
	state TEXT NOT NULL DEFAULT 'connecting',
	ice_connection_state TEXT DEFAULT 'new',
	signaling_state TEXT DEFAULT 'stable',
	created_at TIMESTAMP NOT NULL DEFAULT NOW(),
	ended_at TIMESTAMP,
	metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_webrtc_sessions_room_id ON webrtc_sessions(room_id);
CREATE INDEX IF NOT EXISTS idx_webrtc_sessions_user_id ON webrtc_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_webrtc_sessions_connection_id ON webrtc_sessions(connection_id);
