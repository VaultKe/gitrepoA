package models

import (
	"time"
)

type LearningCategory struct {
	ID        string    `json:"id" db:"id"`
	Name      string    `json:"name" db:"name"`
	Description *string `json:"description,omitempty" db:"description"`
	Icon      *string   `json:"icon,omitempty" db:"icon"`
	Order     int       `json:"order" db:"order"`
	IsActive  bool      `json:"isActive" db:"is_active"`
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
}

type LearningCourse struct {
	ID          string    `json:"id" db:"id"`
	CategoryID  string    `json:"categoryId" db:"category_id"`
	Title       string    `json:"title" db:"title"`
	Description *string   `json:"description,omitempty" db:"description"`
	Instructor  *string   `json:"instructor,omitempty" db:"instructor"`
	Duration    *int      `json:"duration,omitempty" db:"duration"`
	Difficulty  string    `json:"difficulty" db:"difficulty"`
	ImageURL    *string   `json:"imageUrl,omitempty" db:"image_url"`
	IsPublished bool      `json:"isPublished" db:"is_published"`
	CreatedAt   time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt   time.Time `json:"updatedAt" db:"updated_at"`
}

type LearningLesson struct {
	ID        string    `json:"id" db:"id"`
	CourseID  string    `json:"courseId" db:"course_id"`
	Title     string    `json:"title" db:"title"`
	Content   *string   `json:"content,omitempty" db:"content"`
	VideoURL  *string   `json:"videoUrl,omitempty" db:"video_url"`
	Duration  *int      `json:"duration,omitempty" db:"duration"`
	Order     int       `json:"order" db:"order"`
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
}

type UserCourseProgress struct {
	ID          string     `json:"id" db:"id"`
	UserID      string     `json:"userId" db:"user_id"`
	CourseID    string     `json:"courseId" db:"course_id"`
	Progress    float64    `json:"progress" db:"progress"`
	IsCompleted bool       `json:"isCompleted" db:"is_completed"`
	CompletedAt *time.Time `json:"completedAt,omitempty" db:"completed_at"`
	CreatedAt   time.Time  `json:"createdAt" db:"created_at"`
	UpdatedAt   time.Time  `json:"updatedAt" db:"updated_at"`
}

type UserLessonProgress struct {
	ID         string     `json:"id" db:"id"`
	UserID     string     `json:"userId" db:"user_id"`
	LessonID   string     `json:"lessonId" db:"lesson_id"`
	IsCompleted bool      `json:"isCompleted" db:"is_completed"`
	CompletedAt *time.Time `json:"completedAt,omitempty" db:"completed_at"`
	CreatedAt  time.Time  `json:"createdAt" db:"created_at"`
}

type LearningCourseReview struct {
	ID        string    `json:"id" db:"id"`
	CourseID  string    `json:"courseId" db:"course_id"`
	UserID    string    `json:"userId" db:"user_id"`
	Rating    int       `json:"rating" db:"rating"`
	Review    *string   `json:"review,omitempty" db:"review"`
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
}

type LearningAchievement struct {
	ID        string     `json:"id" db:"id"`
	UserID    string     `json:"userId" db:"user_id"`
	Title     string     `json:"title" db:"title"`
	Description *string  `json:"description,omitempty" db:"description"`
	BadgeURL  *string    `json:"badgeUrl,omitempty" db:"badge_url"`
	EarnedAt  time.Time  `json:"earnedAt" db:"earned_at"`
}

type QuizResult struct {
	ID              string `json:"id" db:"id"`
	UserID          string `json:"userId" db:"user_id"`
	LessonID        string `json:"lessonId" db:"lesson_id"`
	Score           int    `json:"score" db:"score"`
	TotalQuestions  int    `json:"totalQuestions" db:"total_questions"`
	CorrectAnswers  int    `json:"correctAnswers" db:"correct_answers"`
	Passed          bool   `json:"passed" db:"passed"`
	CreatedAt       time.Time `json:"createdAt" db:"created_at"`
}