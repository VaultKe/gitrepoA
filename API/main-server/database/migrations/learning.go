package migrations

import (
	"database/sql"
	"fmt"
	"log"
)

func MigrateLearning(db *sql.DB) error {
	queries := []string{
		createLearningTables,
		createQuizResultsTable,
	}
	for _, q := range queries {
		if _, err := db.Exec(q); err != nil {
			return fmt.Errorf("learning migration failed: %w", err)
		}
	}

	if err := addMissingEnhancedLearningContentFields(db); err != nil {
		return err
	}

	log.Println("Learning migrations completed successfully")
	return nil
}

const addEnhancedLearningContentFields = "SELECT 1"

const createLearningTables = `
-- Learning categories table
CREATE TABLE IF NOT EXISTS learning_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    icon TEXT,
    color TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Learning courses table
CREATE TABLE IF NOT EXISTS learning_courses (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category_id TEXT NOT NULL,
    level TEXT NOT NULL CHECK (level IN ('beginner', 'intermediate', 'advanced')),
    type TEXT NOT NULL CHECK (type IN ('article', 'video', 'course', 'quiz')),
    content TEXT, -- Main content (markdown for articles, video URL for videos)
    thumbnail_url TEXT,
    duration_minutes INTEGER,
    estimated_read_time TEXT,
    tags TEXT, -- JSON array of tags
    prerequisites TEXT, -- JSON array of prerequisite course IDs
    learning_objectives TEXT, -- JSON array of learning objectives
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    is_featured BOOLEAN DEFAULT false,
    -- Enhanced content fields for new system
    video_url TEXT, -- Direct video URL for video courses
    quiz_questions TEXT, -- JSON array of quiz questions with answers
    article_content TEXT, -- JSON object with headline_image and sections
    course_structure TEXT, -- JSON object with topics, subtopics, and outline
    view_count INTEGER DEFAULT 0,
    rating REAL DEFAULT 0,
    total_ratings INTEGER DEFAULT 0,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES learning_categories(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Learning course lessons table (for multi-lesson courses)
CREATE TABLE IF NOT EXISTS learning_lessons (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    content TEXT NOT NULL,
    lesson_order INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('text', 'video', 'quiz', 'assignment')),
    duration_minutes INTEGER,
    video_url TEXT,
    attachments TEXT, -- JSON array of attachment URLs
    is_required BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES learning_courses(id) ON DELETE CASCADE,
    UNIQUE(course_id, lesson_order)
);

-- User course progress table
CREATE TABLE IF NOT EXISTS user_course_progress (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
    progress_percentage REAL DEFAULT 0,
    current_lesson_id TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    last_accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    time_spent_minutes INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES learning_courses(id) ON DELETE CASCADE,
    FOREIGN KEY (current_lesson_id) REFERENCES learning_lessons(id),
    UNIQUE(user_id, course_id)
);

-- User lesson progress table
CREATE TABLE IF NOT EXISTS user_lesson_progress (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    lesson_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    time_spent_minutes INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (lesson_id) REFERENCES learning_lessons(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES learning_courses(id) ON DELETE CASCADE,
    UNIQUE(user_id, lesson_id)
);

-- Course ratings and reviews table
CREATE TABLE IF NOT EXISTS learning_course_reviews (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    is_verified BOOLEAN DEFAULT false, -- true if user completed the course
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES learning_courses(id) ON DELETE CASCADE,
    UNIQUE(user_id, course_id)
);

-- Learning achievements/certificates table
CREATE TABLE IF NOT EXISTS learning_achievements (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    achievement_type TEXT NOT NULL CHECK (achievement_type IN ('completion', 'excellence', 'speed', 'consistency')),
    title TEXT NOT NULL,
    description TEXT,
    badge_url TEXT,
    certificate_url TEXT,
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES learning_courses(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_learning_courses_category ON learning_courses(category_id);
CREATE INDEX IF NOT EXISTS idx_learning_courses_status ON learning_courses(status);
CREATE INDEX IF NOT EXISTS idx_learning_courses_level ON learning_courses(level);
CREATE INDEX IF NOT EXISTS idx_learning_courses_type ON learning_courses(type);
CREATE INDEX IF NOT EXISTS idx_learning_courses_featured ON learning_courses(is_featured);
CREATE INDEX IF NOT EXISTS idx_learning_lessons_course ON learning_lessons(course_id);
CREATE INDEX IF NOT EXISTS idx_user_course_progress_user ON user_course_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_course_progress_course ON user_course_progress(course_id);
CREATE INDEX IF NOT EXISTS idx_user_lesson_progress_user ON user_lesson_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_lesson_progress_lesson ON user_lesson_progress(lesson_id);
CREATE INDEX IF NOT EXISTS idx_learning_course_reviews_course ON learning_course_reviews(course_id);
CREATE INDEX IF NOT EXISTS idx_learning_achievements_user ON learning_achievements(user_id);
`

const createQuizResultsTable = `
CREATE TABLE IF NOT EXISTS quiz_results (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    score INTEGER NOT NULL,
    correct_answers INTEGER NOT NULL,
    total_questions INTEGER NOT NULL,
    passed BOOLEAN NOT NULL DEFAULT false,
    time_taken INTEGER, -- in seconds
    detailed_results TEXT, -- JSON string with detailed results
    created_at TIMESTAMP NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES learning_courses(id) ON DELETE CASCADE
);`

func createQuizResultsTableFunc(db *sql.DB) error {
	_, err := db.Exec(createQuizResultsTable)
	return err
}

func addMissingEnhancedLearningContentFields(db *sql.DB) error {
	var tableExists bool
	query := `SELECT COUNT(*) FROM information_schema.tables WHERE table_name='learning_courses'`
	err := db.QueryRow(query).Scan(&tableExists)
	if err != nil {
		return fmt.Errorf("failed to check if learning_courses table exists: %w", err)
	}

	if !tableExists {
		log.Printf("learning_courses table does not exist, skipping enhanced learning content fields migration")
		return nil
	}

	columns := []struct {
		name     string
		dataType string
	}{
		{"video_url", "TEXT"},
		{"quiz_questions", "TEXT"},
		{"article_content", "TEXT"},
		{"course_structure", "TEXT"},
	}

	for _, col := range columns {
		var exists bool
		query := `SELECT COUNT(*) > 0 FROM information_schema.columns WHERE table_name = 'learning_courses' AND column_name = $1`
		err := db.QueryRow(query, col.name).Scan(&exists)
		if err != nil {
			return fmt.Errorf("failed to check if column %s exists: %w", col.name, err)
		}

		if !exists {
			alterQuery := fmt.Sprintf("ALTER TABLE learning_courses ADD COLUMN %s %s", col.name, col.dataType)
			if _, err := db.Exec(alterQuery); err != nil {
				return fmt.Errorf("failed to add column %s: %w", col.name, err)
			}
			log.Printf("Added column %s to learning_courses table", col.name)
		} else {
			log.Printf("Column %s already exists in learning_courses table", col.name)
		}
	}

	return nil
}
