package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type JobStatus string

const (
	StatusQueued    JobStatus = "queued"
	StatusRunning   JobStatus = "running"
	StatusCompleted JobStatus = "completed"
	StatusFailed    JobStatus = "failed"
	StatusCanceled  JobStatus = "canceled"
)

type Job struct {
	ID        string    `json:"id" gorm:"type:uuid;primaryKey;default:uuid_generate_v4()"`
	Command   string    `json:"command" gorm:"not null"`
	Args      string    `json:"args"`
	ServerID  string    `json:"server_id" gorm:"type:uuid"`
	Status    JobStatus `json:"status" gorm:"default:queued"`
	Priority  int       `json:"priority" gorm:"default:5;check:priority >= 1 AND priority <= 10"` // priority 1-10 (10 is highest)
	Output    string    `json:"output" gorm:"type:text"`    // stdout - using TEXT for large outputs
	Error     string    `json:"error" gorm:"type:text"`     // stderr - using TEXT for large outputs
	Stdout    string    `json:"stdout" gorm:"type:text"`    // explicit stdout field
	Stderr    string    `json:"stderr" gorm:"type:text"`    // explicit stderr field
	OriginalScript string `json:"original_script" gorm:"type:text"` // original script content for script jobs
	ExitCode  *int      `json:"exit_code"`
	Timeout   int       `json:"timeout" gorm:"default:300"` // timeout in seconds
	LogLevel  string    `json:"log_level" gorm:"default:info"` // log level for this job
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	StartedAt *time.Time `json:"started_at"`
	FinishedAt *time.Time `json:"finished_at"`
	
	// Relations
	Server    *Server `json:"server,omitempty" gorm:"foreignKey:ServerID;constraint:OnDelete:RESTRICT"`
}

func (j *Job) BeforeCreate(tx *gorm.DB) error {
	if j.ID == "" {
		j.ID = uuid.New().String()
	}
	return nil
}

type JobRequest struct {
	Command  string `json:"command" binding:"required"`
	Args     string `json:"args"`
	ServerID string `json:"server_id" binding:"required"`
	Timeout  int    `json:"timeout,omitempty"`
	Priority int    `json:"priority,omitempty"` // priority 1-10 (10 is highest), defaults to 5
}

// ScriptJobRequest handles shell script execution
type ScriptJobRequest struct {
	Script   string `json:"script" binding:"required"`          // The shell script content
	Args     string `json:"args"`                               // Arguments to pass to the script
	ServerID string `json:"server_id" binding:"required"`       // Target server
	Timeout  int    `json:"timeout,omitempty"`                  // Execution timeout
	Shell    string `json:"shell,omitempty"`                    // Shell to use (default: /bin/bash)
	Priority int    `json:"priority,omitempty"`                 // priority 1-10 (10 is highest), defaults to 5
}

// DuplicateJobRequest handles job duplication
type DuplicateJobRequest struct {
	ServerID *string `json:"server_id,omitempty"`               // Optional: change server
	Timeout  *int    `json:"timeout,omitempty"`                 // Optional: change timeout
	Priority *int    `json:"priority,omitempty"`                // Optional: change priority
}

type JobResponse struct {
	Job
	Duration *time.Duration `json:"duration,omitempty"`
}

func (jr *JobResponse) CalculateDuration() {
	if jr.StartedAt != nil && jr.FinishedAt != nil {
		duration := jr.FinishedAt.Sub(*jr.StartedAt)
		jr.Duration = &duration
	}
}
