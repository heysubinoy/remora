package worker

import (
	"context"
	"fmt"
	"job-executor/internal/config"
	"job-executor/internal/models"
	"job-executor/internal/queue"
	"job-executor/internal/ssh"
	"log/slog"
	"strings"
	"sync"
	"time"

	"gorm.io/gorm"
)

type Worker struct {
	db      *gorm.DB
	queue   *queue.Queue
	running map[string]context.CancelFunc
	mu      sync.RWMutex
}

func New(db *gorm.DB, queue *queue.Queue, sshConfig config.SSHConfig) *Worker {
	return &Worker{
		db:      db,
		queue:   queue,
		running: make(map[string]context.CancelFunc),
	}
}

func (w *Worker) Start(ctx context.Context) {
	slog.Info("Starting job worker")

	for {
		select {
		case <-ctx.Done():
			slog.Info("Worker shutting down")
			return
		case job := <-w.queue.Pop():
			go w.processJob(ctx, job)
		}
	}
}

func (w *Worker) processJob(ctx context.Context, job *models.Job) {
	slog.Info("Processing job", "job_id", job.ID, "command", job.Command)

	// Update job status to running
	now := time.Now()
	job.Status = models.StatusRunning
	job.StartedAt = &now
	w.updateJob(job)

	// Create cancelable context for this job
	jobCtx, cancel := context.WithCancel(ctx)
	defer cancel()

	// Store cancel function for potential cancellation
	w.mu.Lock()
	w.running[job.ID] = cancel
	w.mu.Unlock()

	// Fetch server configuration for this job
	var server models.Server
	if err := w.db.First(&server, "id = ?", job.ServerID).Error; err != nil {
		finishedAt := time.Now()
		job.Status = models.StatusFailed
		job.Error = fmt.Sprintf("Failed to fetch server configuration: %v", err)
		job.FinishedAt = &finishedAt
		w.updateJob(job)
		w.removeRunningJob(job.ID)
		return
	}

	// Create SSH client with server configuration
	sshConfig := &config.SSHConfig{
		Host:       server.Hostname,
		Port:       fmt.Sprintf("%d", server.Port),
		User:       server.User,
		Password:   server.Password,
		PrivateKey: server.PrivateKey,
	}
	
	// Use PEM file if provided
	if server.PemFile != "" {
		sshConfig.PrivateKey = server.PemFile
	}

	sshClient := ssh.NewClient(sshConfig)

	// Build full command
	fullCommand := job.Command
	if job.Args != "" {
		fullCommand = fmt.Sprintf("%s %s", job.Command, job.Args)
	}

	// Set timeout
	timeout := time.Duration(job.Timeout) * time.Second
	if job.Timeout <= 0 {
		timeout = 5 * time.Minute // default timeout
	}

	// Execute command via SSH
	result, err := sshClient.Execute(jobCtx, fullCommand, timeout)

	// Update job with results
	finishedAt := time.Now()
	job.FinishedAt = &finishedAt

	if err != nil {
		if strings.Contains(err.Error(), "timeout") || strings.Contains(err.Error(), "context canceled") {
			job.Status = models.StatusCanceled
		} else {
			job.Status = models.StatusFailed
		}
		job.Error = err.Error()
		slog.Error("Job execution failed", "job_id", job.ID, "error", err)
	} else {
		if result.ExitCode == 0 {
			job.Status = models.StatusCompleted
		} else {
			job.Status = models.StatusFailed
		}
		job.Output = result.Output
		job.Error = result.Error
		job.ExitCode = &result.ExitCode
		slog.Info("Job completed", "job_id", job.ID, "exit_code", result.ExitCode)
	}

	w.updateJob(job)
	w.removeRunningJob(job.ID)
}

func (w *Worker) updateJob(job *models.Job) {
	if err := w.db.Save(job).Error; err != nil {
		slog.Error("Failed to update job", "job_id", job.ID, "error", err)
	}
}

func (w *Worker) CancelJob(jobID string) error {
	w.mu.RLock()
	cancel, exists := w.running[jobID]
	w.mu.RUnlock()
	
	if exists {
		cancel()
		
		// Update job status in database
		job := &models.Job{}
		if err := w.db.First(job, "id = ?", jobID).Error; err != nil {
			return err
		}
		
		now := time.Now()
		job.Status = models.StatusCanceled
		job.FinishedAt = &now
		
		return w.db.Save(job).Error
	}
	
	return fmt.Errorf("job %s is not currently running", jobID)
}

func (w *Worker) removeRunningJob(jobID string) {
	w.mu.Lock()
	delete(w.running, jobID)
	w.mu.Unlock()
}
