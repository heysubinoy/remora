package worker

import (
	"context"
	"fmt"
	"job-executor/internal/config"
	"job-executor/internal/models"
	"job-executor/internal/queue"
	"job-executor/internal/ssh"
	"job-executor/internal/storage"
	"log/slog"
	"strings"
	"sync"
	"time"

	"gorm.io/gorm"
)

type Worker struct {
	db      *gorm.DB
	queue   queue.Queue
	storage storage.StorageService
	running map[string]context.CancelFunc
	mu      sync.RWMutex
}

func New(db *gorm.DB, queue queue.Queue, storage storage.StorageService) *Worker {
	return &Worker{
		db:      db,
		queue:   queue,
		storage: storage,
		running: make(map[string]context.CancelFunc),
	}
}

func (w *Worker) Start(ctx context.Context) {
	slog.Info("Starting job worker")

	// Start consuming jobs from RabbitMQ queue
	if err := w.queue.StartConsumer(ctx, w.processJobWrapper); err != nil {
		slog.Error("Failed to start queue consumer", "error", err)
		return
	}

	// Start consuming cancellation messages
	if err := w.queue.StartCancelConsumer(ctx, w.handleCancelMessage); err != nil {
		slog.Error("Failed to start cancel consumer", "error", err)
		// Continue without cancellation support
	}

	// Keep worker alive until context is cancelled
	<-ctx.Done()
	slog.Info("Worker shutting down")
}

func (w *Worker) processJobWrapper(job *models.Job) {
	ctx := context.Background()
	go w.processJob(ctx, job)
}

func (w *Worker) processJob(ctx context.Context, job *models.Job) {
	slog.Info("Processing job", 
		"job_id", job.ID, 
		"command", job.Command, 
		"args", job.Args,
		"server_id", job.ServerID,
		"timeout", job.Timeout)

	// Check if job was already canceled while in queue
	// Refresh job status from database to get latest state
	var currentJob models.Job
	if err := w.db.First(&currentJob, "id = ?", job.ID).Error; err != nil {
		slog.Error("Failed to fetch current job status", "job_id", job.ID, "error", err)
		return
	}

	if currentJob.Status == models.StatusCanceled {
		slog.Info("Job was canceled while in queue, skipping execution", "job_id", job.ID)
		return
	}

	// Update job status to running
	now := time.Now()
	job.Status = models.StatusRunning
	job.StartedAt = &now
	w.updateJob(job)

	slog.Info("Job started", 
		"job_id", job.ID, 
		"started_at", job.StartedAt.Format(time.RFC3339))

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
		
		slog.Error("Failed to fetch server configuration", 
			"job_id", job.ID, 
			"server_id", job.ServerID,
			"error", err,
			"duration", finishedAt.Sub(*job.StartedAt))
		
		w.updateJob(job)
		w.removeRunningJob(job.ID)
		return
	}

	slog.Info("Server configuration loaded", 
		"job_id", job.ID, 
		"server_name", server.Name,
		"hostname", server.Hostname,
		"port", server.Port,
		"user", server.User)

	// Create SSH client with server configuration
	sshConfig := &config.SSHConfig{
		Host:       server.Hostname,
		Port:       fmt.Sprintf("%d", server.Port),
		User:       server.User,
		Password:   server.Password,
		PrivateKey: server.PrivateKey,
		PemFileURL: server.PemFileURL,
	}
	
	// Use PEM file if provided (legacy support)
	if server.PemFile != "" {
		sshConfig.PrivateKey = server.PemFile
		slog.Debug("Using PEM file for authentication", "job_id", job.ID)
	}

	// Create SSH client with storage service for PEM file URL support
	var sshClient *ssh.Client
	if server.PemFileURL != "" {
		sshClient = ssh.NewClientWithStorage(sshConfig, w.storage)
		slog.Debug("Using PEM file URL for authentication", "job_id", job.ID, "pem_file_url", server.PemFileURL)
	} else {
		sshClient = ssh.NewClient(sshConfig)
	}

	// Build full command
	fullCommand := job.Command
	if job.Args != "" {
		fullCommand = fmt.Sprintf("%s %s", job.Command, job.Args)
	}

	slog.Info("Executing command", 
		"job_id", job.ID, 
		"full_command", fullCommand)

	// Set timeout
	timeout := time.Duration(job.Timeout) * time.Second
	if job.Timeout <= 0 {
		timeout = 5 * time.Minute // default timeout
	}

	slog.Debug("Command timeout set", 
		"job_id", job.ID, 
		"timeout", timeout)

	// Track output for database storage
	var outputBuilder strings.Builder
	var errorBuilder strings.Builder
	var lineCount int

	// Streaming callback for real-time output
	streamCallback := func(output string, isStderr bool) {
		lineCount++
		
		// Store in builders for final database update
		if isStderr {
			errorBuilder.WriteString(output)
		} else {
			outputBuilder.WriteString(output)
		}

		// Publish output event to RabbitMQ for real-time streaming
		// This replaces the old broadcast system and supports multiple SSE clients
		if err := w.queue.PublishOutputEvent(job.ID, output, isStderr, lineCount); err != nil {
			slog.Warn("Failed to publish output event", "job_id", job.ID, "error", err)
		}
		
		// Also update the job's output field incrementally for live monitoring
		if isStderr {
			job.Stderr = errorBuilder.String()
		} else {
			job.Stdout = outputBuilder.String()
			job.Output = outputBuilder.String() // Keep for backward compatibility
		}
		
		// Update job in database periodically (every 10 lines or every 2 seconds)
		if lineCount%10 == 0 {
			w.updateJob(job)
		}
	}

	// Execute command via SSH with streaming
	result, err := sshClient.ExecuteStreaming(jobCtx, fullCommand, timeout, streamCallback)

	// Update job with results
	finishedAt := time.Now()
	job.FinishedAt = &finishedAt
	duration := finishedAt.Sub(*job.StartedAt)

	if err != nil {
		if strings.Contains(err.Error(), "timeout") || strings.Contains(err.Error(), "context canceled") {
			job.Status = models.StatusCanceled
			slog.Warn("Job execution canceled/timeout", 
				"job_id", job.ID, 
				"error", err,
				"duration", duration)
		} else {
			job.Status = models.StatusFailed
			slog.Error("Job execution failed", 
				"job_id", job.ID, 
				"error", err,
				"duration", duration)
		}
		job.Error = err.Error()
	} else {
		// Store the accumulated output from streaming
		finalOutput := outputBuilder.String()
		finalError := errorBuilder.String()
		
		job.Output = finalOutput  // Keep for backward compatibility
		job.Stdout = finalOutput
		job.Stderr = finalError
		job.Error = finalError   // Keep for backward compatibility
		job.ExitCode = &result.ExitCode

		if result.ExitCode == 0 {
			job.Status = models.StatusCompleted
			slog.Info("Job completed successfully", 
				"job_id", job.ID, 
				"exit_code", result.ExitCode,
				"duration", duration,
				"stdout_length", len(finalOutput),
				"stderr_length", len(finalError))
		} else {
			job.Status = models.StatusFailed
			slog.Warn("Job completed with non-zero exit code", 
				"job_id", job.ID, 
				"exit_code", result.ExitCode,
				"duration", duration,
				"stdout_length", len(finalOutput),
				"stderr_length", len(finalError))
		}

		// Log output summary (first 200 chars) for debugging
		if len(finalOutput) > 0 {
			outputSummary := finalOutput
			if len(outputSummary) > 200 {
				outputSummary = outputSummary[:200] + "..."
			}
			slog.Debug("Job stdout summary", 
				"job_id", job.ID, 
				"stdout_preview", outputSummary)
		}

		if len(finalError) > 0 {
			errorSummary := finalError
			if len(errorSummary) > 200 {
				errorSummary = errorSummary[:200] + "..."
			}
			slog.Debug("Job stderr summary", 
				"job_id", job.ID, 
				"stderr_preview", errorSummary)
		}
	}

	slog.Info("Job processing completed", 
		"job_id", job.ID, 
		"final_status", job.Status,
		"exit_code", job.ExitCode,
		"duration", duration)

	w.updateJob(job)
	w.removeRunningJob(job.ID)
}

func (w *Worker) updateJob(job *models.Job) {
	if err := w.db.Save(job).Error; err != nil {
		slog.Error("Failed to update job in database", 
			"job_id", job.ID, 
			"status", job.Status,
			"error", err)
	} else {
		slog.Debug("Job updated in database", 
			"job_id", job.ID, 
			"status", job.Status,
			"exit_code", job.ExitCode)
	}
}

func (w *Worker) CancelJob(jobID string) error {
	slog.Info("Attempting to cancel job", "job_id", jobID)
	
	w.mu.RLock()
	cancel, exists := w.running[jobID]
	w.mu.RUnlock()
	
	if exists {
		slog.Info("Canceling running job", "job_id", jobID)
		cancel()
		
		// Update job status in database
		job := &models.Job{}
		if err := w.db.First(job, "id = ?", jobID).Error; err != nil {
			slog.Error("Failed to fetch job for cancellation", "job_id", jobID, "error", err)
			return err
		}
		
		now := time.Now()
		job.Status = models.StatusCanceled
		job.FinishedAt = &now
		
		if err := w.db.Save(job).Error; err != nil {
			slog.Error("Failed to update canceled job status", "job_id", jobID, "error", err)
			return err
		}
		
		slog.Info("Job successfully canceled", 
			"job_id", jobID, 
			"canceled_at", now.Format(time.RFC3339))
		
		return nil
	}
	
	slog.Warn("Attempted to cancel job that is not running", "job_id", jobID)
	return fmt.Errorf("job %s is not currently running", jobID)
}

func (w *Worker) handleCancelMessage(jobID string) {
	slog.Info("Received cancel message", "job_id", jobID)
	
	w.mu.RLock()
	cancel, exists := w.running[jobID]
	w.mu.RUnlock()
	
	if exists {
		slog.Info("Canceling running job via message", "job_id", jobID)
		cancel()
		
		// Update job status in database
		job := &models.Job{}
		if err := w.db.First(job, "id = ?", jobID).Error; err != nil {
			slog.Error("Failed to fetch job for cancellation", "job_id", jobID, "error", err)
			return
		}
		
		now := time.Now()
		job.Status = models.StatusCanceled
		job.FinishedAt = &now
		
		if err := w.db.Save(job).Error; err != nil {
			slog.Error("Failed to update canceled job status", "job_id", jobID, "error", err)
			return
		}
		
		slog.Info("Job successfully canceled via message", 
			"job_id", jobID, 
			"canceled_at", now.Format(time.RFC3339))
	} else {
		slog.Warn("Received cancel message for job that is not running", "job_id", jobID)
	}
}

func (w *Worker) removeRunningJob(jobID string) {
	w.mu.Lock()
	delete(w.running, jobID)
	w.mu.Unlock()
}
