package api

import (
	"encoding/base64"
	"fmt"
	"job-executor/internal/broadcast"
	"job-executor/internal/models"
	"log/slog"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func (api *API) SubmitJob(c *gin.Context) {
	var req models.JobRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate that the server exists and is active
	var server models.Server
	if err := api.db.First(&server, "id = ? AND is_active = ?", req.ServerID, true).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Server not found or inactive"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate server"})
		return
	}

	// Set default timeout if not provided
	if req.Timeout <= 0 {
		req.Timeout = 300 // 5 minutes default
	}

	// Create job
	job := &models.Job{
		Command:  req.Command,
		Args:     req.Args,
		ServerID: req.ServerID,
		Timeout:  req.Timeout,
		Status:   models.StatusQueued,
	}

	// Save to database
	if err := api.db.Create(job).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create job"})
		return
	}

	// Add to queue
	if err := api.queue.Push(job); err != nil {
		// Update job status to failed if can't queue
		job.Status = models.StatusFailed
		job.Error = "Failed to queue job: " + err.Error()
		api.db.Save(job)

		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Job queue is full"})
		return
	}

	response := &models.JobResponse{Job: *job}
	c.JSON(http.StatusCreated, response)
}

// SubmitScriptJob handles shell script execution
func (api *API) SubmitScriptJob(c *gin.Context) {
	var req models.ScriptJobRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate that the server exists and is active
	var server models.Server
	if err := api.db.First(&server, "id = ? AND is_active = ?", req.ServerID, true).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Server not found or inactive"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate server"})
		return
	}

	// Set default timeout if not provided
	if req.Timeout <= 0 {
		req.Timeout = 300 // 5 minutes default
	}

	// Set default shell if not provided
	shell := req.Shell
	if shell == "" {
		shell = "/bin/bash"
	}

	// Create a temporary script file name
	scriptFileName := fmt.Sprintf("/tmp/script_%s.sh", time.Now().Format("20060102_150405"))

	// Encode the script content to base64 to safely pass it through the command
	scriptB64 := base64.StdEncoding.EncodeToString([]byte(req.Script))

	// Create command to write script to file and execute it
	// We use base64 to avoid issues with special characters and quotes
	command := shell
	args := fmt.Sprintf(`-c "echo '%s' | base64 -d > %s && chmod +x %s && %s %s; rm -f %s"`,
		scriptB64, scriptFileName, scriptFileName, scriptFileName, req.Args, scriptFileName)

	// Create job
	job := &models.Job{
		Command:  command,
		Args:     args,
		ServerID: req.ServerID,
		Timeout:  req.Timeout,
		Status:   models.StatusQueued,
	}

	// Save to database
	if err := api.db.Create(job).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create script job"})
		return
	}

	// Add to queue
	if err := api.queue.Push(job); err != nil {
		// Update job status to failed if can't queue
		job.Status = models.StatusFailed
		job.Error = "Failed to queue script job: " + err.Error()
		api.db.Save(job)

		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Job queue is full"})
		return
	}

	response := &models.JobResponse{Job: *job}
	c.JSON(http.StatusCreated, response)
}

// DuplicateJob creates a new job based on an existing job
func (api *API) DuplicateJob(c *gin.Context) {
	jobID := c.Param("id")

	// Get the original job
	var originalJob models.Job
	if err := api.db.Preload("Server").First(&originalJob, "id = ?", jobID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Job not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch job"})
		return
	}

	// Parse optional modifications
	var req models.DuplicateJobRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Determine server ID (use override if provided, otherwise use original)
	serverID := originalJob.ServerID
	if req.ServerID != nil {
		serverID = *req.ServerID
	}

	// Validate that the target server exists and is active
	var server models.Server
	if err := api.db.First(&server, "id = ? AND is_active = ?", serverID, true).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Target server not found or inactive"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate target server"})
		return
	}

	// Determine timeout (use override if provided, otherwise use original)
	timeout := originalJob.Timeout
	if req.Timeout != nil {
		timeout = *req.Timeout
	}

	// Create duplicated job
	duplicatedJob := &models.Job{
		Command:  originalJob.Command,
		Args:     originalJob.Args,
		ServerID: serverID,
		Timeout:  timeout,
		Status:   models.StatusQueued,
		LogLevel: originalJob.LogLevel,
	}

	// Save to database
	if err := api.db.Create(duplicatedJob).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create duplicated job"})
		return
	}

	// Add to queue
	if err := api.queue.Push(duplicatedJob); err != nil {
		// Update job status to failed if can't queue
		duplicatedJob.Status = models.StatusFailed
		duplicatedJob.Error = "Failed to queue duplicated job: " + err.Error()
		api.db.Save(duplicatedJob)

		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Job queue is full"})
		return
	}

	response := &models.JobResponse{Job: *duplicatedJob}
	c.JSON(http.StatusCreated, gin.H{
		"message":      "Job duplicated successfully",
		"original_job": originalJob.ID,
		"new_job":      response,
	})
}

func (api *API) GetJob(c *gin.Context) {
	jobID := c.Param("id")

	var job models.Job
	if err := api.db.Preload("Server").First(&job, "id = ?", jobID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Job not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch job"})
		return
	}

	response := &models.JobResponse{Job: job}
	response.CalculateDuration()

	c.JSON(http.StatusOK, response)
}

func (api *API) CancelJob(c *gin.Context) {
	jobID := c.Param("id")

	var job models.Job
	if err := api.db.First(&job, "id = ?", jobID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Job not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch job"})
		return
	}

	// Check if job can be canceled
	if job.Status != models.StatusQueued && job.Status != models.StatusRunning {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Job cannot be canceled"})
		return
	}

	// Try to cancel running job first
	if job.Status == models.StatusRunning {
		if err := api.worker.CancelJob(jobID); err != nil {
			// If cancellation fails, still update status in database
			job.Status = models.StatusCanceled
			if err := api.db.Save(&job).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to cancel job"})
				return
			}
		}
	} else {
		// For queued jobs, just update the status
		job.Status = models.StatusCanceled
		if err := api.db.Save(&job).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to cancel job"})
			return
		}
	}

	response := &models.JobResponse{Job: job}
	c.JSON(http.StatusOK, response)
}

func (api *API) GetJobLogs(c *gin.Context) {
	jobID := c.Param("id")

	var job models.Job
	if err := api.db.First(&job, "id = ?", jobID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Job not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch job"})
		return
	}

	// Calculate execution duration if available
	var duration *time.Duration
	if job.StartedAt != nil && job.FinishedAt != nil {
		d := job.FinishedAt.Sub(*job.StartedAt)
		duration = &d
	}

	logs := gin.H{
		"job_id":      job.ID,
		"status":      job.Status,
		"command":     job.Command,
		"args":        job.Args,
		"exit_code":   job.ExitCode,
		"output":      job.Output,     // Combined output (backward compatibility)
		"error":       job.Error,      // Combined error (backward compatibility)
		"stdout":      job.Stdout,     // Explicit stdout
		"stderr":      job.Stderr,     // Explicit stderr
		"started_at":  job.StartedAt,
		"finished_at": job.FinishedAt,
		"duration":    duration,
		"timeout":     job.Timeout,
		"created_at":  job.CreatedAt,
		"updated_at":  job.UpdatedAt,
	}

	// Add metadata about log sizes
	logs["metadata"] = gin.H{
		"stdout_length": len(job.Stdout),
		"stderr_length": len(job.Stderr),
		"has_output":    len(job.Stdout) > 0,
		"has_errors":    len(job.Stderr) > 0,
	}

	c.JSON(http.StatusOK, logs)
}

func (api *API) GetJobStdout(c *gin.Context) {
	jobID := c.Param("id")

	var job models.Job
	if err := api.db.First(&job, "id = ?", jobID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Job not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch job"})
		return
	}

	// Return stdout as plain text for easier consumption
	c.Header("Content-Type", "text/plain; charset=utf-8")
	c.String(http.StatusOK, job.Stdout)
}

func (api *API) GetJobStderr(c *gin.Context) {
	jobID := c.Param("id")

	var job models.Job
	if err := api.db.First(&job, "id = ?", jobID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Job not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch job"})
		return
	}

	// Return stderr as plain text for easier consumption
	c.Header("Content-Type", "text/plain; charset=utf-8")
	c.String(http.StatusOK, job.Stderr)
}

func (api *API) ListJobs(c *gin.Context) {
	var jobs []models.Job

	// Get query parameters for pagination
	page := c.DefaultQuery("page", "1")
	limit := c.DefaultQuery("limit", "10")
	status := c.Query("status")
	serverID := c.Query("server_id")

	query := api.db.Model(&models.Job{}).Preload("Server")

	if status != "" {
		query = query.Where("status = ?", status)
	}

	if serverID != "" {
		query = query.Where("server_id = ?", serverID)
	}

	// Simple pagination (in production, you'd want proper offset/limit handling)
	if err := query.Order("created_at DESC").Limit(10).Find(&jobs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch jobs"})
		return
	}

	var responses []models.JobResponse
	for _, job := range jobs {
		response := models.JobResponse{Job: job}
		response.CalculateDuration()
		responses = append(responses, response)
	}

	c.JSON(http.StatusOK, gin.H{
		"jobs":  responses,
		"page":  page,
		"limit": limit,
	})
}

func (api *API) StreamJob(c *gin.Context) {
	jobID := c.Param("id")

	// Set headers for Server-Sent Events
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no") // Disable nginx buffering if applicable

	// Send initial job status
	var job models.Job
	if err := api.db.Preload("Server").First(&job, "id = ?", jobID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.SSEvent("error", gin.H{"error": "Job not found"})
			return
		}
		c.SSEvent("error", gin.H{"error": "Failed to fetch job"})
		return
	}

	// Calculate duration if available
	response := &models.JobResponse{Job: job}
	response.CalculateDuration()

	// Send initial status
	slog.Info("Starting SSE stream for job", "job_id", jobID, "status", job.Status)
	c.SSEvent("status", response)
	c.Writer.Flush()

	// If job is already finished, send complete event and return
	if job.Status == models.StatusCompleted || job.Status == models.StatusFailed || job.Status == models.StatusCanceled {
		c.SSEvent("complete", response)
		return
	}

	// Subscribe to real-time output if job is running
	var outputChan chan broadcast.OutputEvent
	if job.Status == models.StatusRunning {
		outputChan = broadcast.GlobalBroadcaster.Subscribe(jobID)
		defer broadcast.GlobalBroadcaster.Unsubscribe(jobID, outputChan)
	}

	// Poll for updates every 500ms for running/queued jobs
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	// Create a channel to detect client disconnect
	clientGone := c.Writer.CloseNotify()

	for {
		select {
		case <-clientGone:
			return

		case outputEvent := <-outputChan:
			// Send real-time output event
			c.SSEvent("output", outputEvent)
			c.Writer.Flush()

		case <-ticker.C:
			// Fetch updated job status
			if err := api.db.Preload("Server").First(&job, "id = ?", jobID).Error; err != nil {
				c.SSEvent("error", gin.H{"error": "Failed to fetch job update"})
				return
			}

			response := &models.JobResponse{Job: job}
			response.CalculateDuration()

			// Send status update
			slog.Info("Sending SSE status update", "job_id", jobID, "status", job.Status)
			c.SSEvent("status", response)
			c.Writer.Flush()

			// If job finished, send complete event and stop streaming
			if job.Status == models.StatusCompleted || job.Status == models.StatusFailed || job.Status == models.StatusCanceled {
				slog.Info("Job finished, sending complete event", "job_id", jobID, "status", job.Status)
				c.SSEvent("complete", response)
				return
			}

			// If job just started running and we don't have an output channel yet, subscribe
			if job.Status == models.StatusRunning && outputChan == nil {
				outputChan = broadcast.GlobalBroadcaster.Subscribe(jobID)
				defer broadcast.GlobalBroadcaster.Unsubscribe(jobID, outputChan)
			}
		}
	}
}
