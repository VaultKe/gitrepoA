package migrations

import (
	"database/sql"
	"fmt"
	"log"
)

func MigratePollsVotes(db *sql.DB) error {
	queries := []string{
		`DROP TABLE IF EXISTS user_votes CASCADE`,
		`DROP TABLE IF EXISTS vote_options CASCADE`,
		`DROP TABLE IF EXISTS votes CASCADE`,
		createVotesTable,
		createVoteOptionsTable,
		createUserVotesTable,
		createPollsAndVotingTables,
	}
	for _, q := range queries {
		if _, err := db.Exec(q); err != nil {
			return fmt.Errorf("polls_votes migration failed: %w", err)
		}
	}

	log.Println("Polls and votes migrations completed successfully")
	return nil
}

const createVotesTable = `
CREATE TABLE IF NOT EXISTS votes (
    id TEXT PRIMARY KEY,
    chama_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL DEFAULT 'single', -- 'single', 'multiple'
    status TEXT NOT NULL DEFAULT 'active',
    starts_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ends_at TIMESTAMP NOT NULL,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chama_id) REFERENCES chamas(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);`

const createVoteOptionsTable = `
CREATE TABLE IF NOT EXISTS vote_options (
    id TEXT PRIMARY KEY,
    vote_id TEXT NOT NULL,
    option_text TEXT NOT NULL,
    vote_count INTEGER DEFAULT 0,
    FOREIGN KEY (vote_id) REFERENCES votes(id)
);`

const createUserVotesTable = `
CREATE TABLE IF NOT EXISTS user_votes (
    id TEXT PRIMARY KEY,
    vote_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    option_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vote_id) REFERENCES votes(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (option_id) REFERENCES vote_options(id),
    UNIQUE(vote_id, user_id, option_id)
);`

const createPollsAndVotingTables = `
-- Polls table for voting and role escalation
CREATE TABLE IF NOT EXISTS polls (
    id TEXT PRIMARY KEY,
    chama_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    poll_type TEXT NOT NULL, -- 'general', 'role_escalation', 'financial_decision'
    created_by TEXT NOT NULL,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'completed', 'cancelled'
    is_anonymous BOOLEAN DEFAULT TRUE,
    requires_majority BOOLEAN DEFAULT TRUE,
    majority_percentage REAL DEFAULT 50.0,
    total_eligible_voters INTEGER DEFAULT 0,
    total_votes_cast INTEGER DEFAULT 0,
    result TEXT, -- 'passed', 'failed', 'pending'
    result_declared_at TIMESTAMP,
    metadata TEXT, -- JSON for additional poll-specific data
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chama_id) REFERENCES chamas(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Poll options table
CREATE TABLE IF NOT EXISTS poll_options (
    id TEXT PRIMARY KEY,
    poll_id TEXT NOT NULL,
    option_text TEXT NOT NULL,
    option_order INTEGER NOT NULL DEFAULT 0,
    vote_count INTEGER DEFAULT 0,
    metadata TEXT, -- JSON for option-specific data (e.g., candidate info for role escalation)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE
);

-- Anonymous votes table for polls (separate from chama votes table)
CREATE TABLE IF NOT EXISTS poll_votes (
    id TEXT PRIMARY KEY,
    poll_id TEXT NOT NULL,
    option_id TEXT NOT NULL,
    voter_hash TEXT NOT NULL, -- Hashed voter ID for anonymity
    vote_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_valid BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE,
    FOREIGN KEY (option_id) REFERENCES poll_options(id) ON DELETE CASCADE,
    UNIQUE(poll_id, voter_hash) -- One vote per voter per poll
);

-- Role escalation requests table
CREATE TABLE IF NOT EXISTS voting_requests (
    id TEXT PRIMARY KEY,
    chama_id TEXT NOT NULL,
    candidate_id TEXT NOT NULL,
    existing_role TEXT NOT NULL,
    requested_role TEXT NOT NULL,
    requested_by TEXT NOT NULL,
    poll_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'voting'
    justification TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chama_id) REFERENCES chamas(id) ON DELETE CASCADE,
    FOREIGN KEY (candidate_id) REFERENCES users(id),
    FOREIGN KEY (requested_by) REFERENCES users(id),
    FOREIGN KEY (poll_id) REFERENCES polls(id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_polls_chama ON polls(chama_id);
CREATE INDEX IF NOT EXISTS idx_polls_status ON polls(status);
CREATE INDEX IF NOT EXISTS idx_polls_type ON polls(poll_type);
CREATE INDEX IF NOT EXISTS idx_polls_dates ON polls(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_poll_options_poll ON poll_options(poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_poll ON poll_votes(poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_option ON poll_votes(option_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_hash ON poll_votes(voter_hash);
CREATE INDEX IF NOT EXISTS idx_voting_requests_chama ON voting_requests(chama_id);
CREATE INDEX IF NOT EXISTS idx_voting_requests_candidate ON voting_requests(candidate_id);
CREATE INDEX IF NOT EXISTS idx_voting_requests_status ON voting_requests(status);
`
