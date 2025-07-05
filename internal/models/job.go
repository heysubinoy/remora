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
	ID        string    `json:"id" gorm:"primaryKey"`
	Command   string    `json:"command" gorm:"not null"`
	Args      string    `json:"args"`
	ServerID  string    `json:"server_id"`
	Status    JobStatus `json:"status" gorm:"default:queued"`
	Output    string    `json:"output" gorm:"type:text"`    // stdout - using TEXT for large outputs
	Error     string    `json:"error" gorm:"type:text"`     // stderr - using TEXT for large outputs
	Stdout    string    `json:"stdout" gorm:"type:text"`    // explicit stdout field
	Stderr    string    `json:"stderr" gorm:"type:text"`    // explicit stderr field
	ExitCode  *int      `json:"exit_code"`
	Timeout   int       `json:"timeout" gorm:"default:300"` // timeout in seconds
	LogLevel  string    `json:"log_level" gorm:"default:info"` // log level for this job
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	StartedAt *time.Time `json:"started_at"`
	FinishedAt *time.Time `json:"finished_at"`
	
	// Relations
	Server    *Server `json:"server,omitempty" gorm:"foreignKey:ServerID"`
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
