package api

import (
	"context"
	"encoding/base64"
	"fmt"
	"job-executor/internal/models"
	"job-executor/internal/queue"
	"log/slog"
	"math"
	"net/http"
	"strconv"
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

	// Set default priority if not provided or invalid
	if req.Priority < 1 || req.Priority > 10 {
		req.Priority = 5 // default priority
	}

	// Create job
	job := &models.Job{
		Command:  req.Command,
		Args:     req.Args,
		ServerID: req.ServerID,
		Timeout:  req.Timeout,
		Priority: req.Priority,
		Status:   models.StatusQueued,
	}

	// Save to database
	if err := api.db.Create(job).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create job"})
		return
	}

	// Add to queue
	slog.Info("About to push job to queue", "job_id", job.ID, "command", job.Command)
	if err := api.queue.Push(job); err != nil {
		slog.Error("Failed to push job to queue", "job_id", job.ID, "error", err)
		// Update job status to failed if can't queue
		job.Status = models.StatusFailed
		job.Error = "Failed to queue job: " + err.Error()
		api.db.Save(job)

		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Job queue is full"})
		return
	}
	slog.Info("Successfully pushed job to queue", "job_id", job.ID)

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

	// Set default priority if not provided or invalid
	if req.Priority < 1 || req.Priority > 10 {
		req.Priority = 5 // default priority
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
		Command:        command,
		Args:           args,
		ServerID:       req.ServerID,
		Timeout:        req.Timeout,
		Priority:       req.Priority,
		Status:         models.StatusQueued,
		OriginalScript: req.Script, // Store the original script content
	}

	// Save to database
	if err := api.db.Create(job).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create script job"})
		return
	}

	// Add to queue
	slog.Info("About to push script job to queue", "job_id", job.ID, "command", job.Command)
	if err := api.queue.Push(job); err != nil {
		slog.Error("Failed to push script job to queue", "job_id", job.ID, "error", err)
		// Update job status to failed if can't queue
		job.Status = models.StatusFailed
		job.Error = "Failed to queue script job: " + err.Error()
		api.db.Save(job)

		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Job queue is full"})
		return
	}
	slog.Info("Successfully pushed script job to queue", "job_id", job.ID)

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

	// Determine priority (use override if provided, otherwise use original)
	priority := originalJob.Priority
	if req.Priority != nil {
		priority = *req.Priority
		// Validate priority range
		if priority < 1 || priority > 10 {
			priority = 5 // default priority
		}
	}

	// Create duplicated job
	duplicatedJob := &models.Job{
		Command:  originalJob.Command,
		Args:     originalJob.Args,
		ServerID: serverID,
		Timeout:  timeout,
		Priority: priority,
		Status:   models.StatusQueued,
		LogLevel: originalJob.LogLevel,
	}

	// Save to database
	if err := api.db.Create(duplicatedJob).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create duplicated job"})
		return
	}

	// Add to queue
	slog.Info("About to push duplicated job to queue", "job_id", duplicatedJob.ID, "command", duplicatedJob.Command)
	if err := api.queue.Push(duplicatedJob); err != nil {
		slog.Error("Failed to push duplicated job to queue", "job_id", duplicatedJob.ID, "error", err)
		// Update job status to failed if can't queue
		duplicatedJob.Status = models.StatusFailed
		duplicatedJob.Error = "Failed to queue duplicated job: " + err.Error()
		api.db.Save(duplicatedJob)

		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Job queue is full"})
		return
	}
	slog.Info("Successfully pushed duplicated job to queue", "job_id", duplicatedJob.ID)

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

	var response *models.JobResponse
	var statusCode int
	var message string

	// Handle cancellation based on job status
	switch job.Status {
	case models.StatusRunning:
		// For running jobs, send cancellation message to worker via RabbitMQ
		// Let the worker handle the actual cancellation and status update
		if err := api.queue.PublishCancelMessage(jobID); err != nil {
			slog.Error("Failed to publish cancel message", "job_id", jobID, "error", err)
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Failed to send cancellation request"})
			return
		}
		
		slog.Info("Cancellation message sent to worker", "job_id", jobID)
		// Don't update status here - let worker handle it when it actually cancels
		
		response = &models.JobResponse{Job: job}
		statusCode = http.StatusAccepted
		message = "Cancellation request sent to worker"
		
	case models.StatusQueued:
		// For queued jobs, directly update the status since they haven't started yet
		job.Status = models.StatusCanceled
		now := time.Now()
		job.FinishedAt = &now
		
		if err := api.db.Save(&job).Error; err != nil {
			slog.Error("Failed to cancel queued job", "job_id", jobID, "error", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to cancel job"})
			return
		}
		
		slog.Info("Queued job canceled", "job_id", jobID)
		
		response = &models.JobResponse{Job: job}
		statusCode = http.StatusOK
		message = "Job canceled successfully"
		
	default:
		// This should not happen due to the validation above, but good to have
		c.JSON(http.StatusBadRequest, gin.H{"error": "Job cannot be canceled"})
		return
	}

	// Return response with appropriate status and message
	c.JSON(statusCode, gin.H{
		"message": message,
		"job":     response,
	})
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

	// Get query parameters for pagination and filtering
	page := c.DefaultQuery("page", "1")
	limit := c.DefaultQuery("limit", "20")
	status := c.Query("status")
	serverID := c.Query("server_id")
	search := c.Query("search") // New search parameter
	sortBy := c.DefaultQuery("sort_by", "created_at")
	sortOrder := c.DefaultQuery("sort_order", "desc")

	// Convert page and limit to integers
	pageInt := 1
	limitInt := 20
	if p, err := strconv.Atoi(page); err == nil && p > 0 {
		pageInt = p
	}
	if l, err := strconv.Atoi(limit); err == nil && l > 0 && l <= 100 {
		limitInt = l
	}

	// Calculate offset
	offset := (pageInt - 1) * limitInt

	query := api.db.Model(&models.Job{}).Preload("Server")

	// Apply filters
	if status != "" {
		query = query.Where("status = ?", status)
	}

	if serverID != "" {
		query = query.Where("server_id = ?", serverID)
	}

	// Apply search filter (search in command, args, and server name)
	if search != "" {
		searchPattern := "%" + search + "%"
		query = query.Where(
			"command LIKE ? OR args LIKE ? OR EXISTS (SELECT 1 FROM servers WHERE servers.id = jobs.server_id AND servers.name LIKE ?)",
			searchPattern, searchPattern, searchPattern,
		)
	}

	// Get total count before applying pagination
	var totalCount int64
	if err := query.Count(&totalCount).Error; err != nil {
		api.logger.Error("Failed to count jobs", slog.Any("error", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to count jobs"})
		return
	}

	// Apply sorting
	validSortFields := map[string]bool{
		"created_at":  true,
		"updated_at":  true,
		"started_at":  true,
		"finished_at": true,
		"status":      true,
		"command":     true,
		"priority":    true,
	}
	if !validSortFields[sortBy] {
		sortBy = "created_at"
	}
	if sortOrder != "asc" && sortOrder != "desc" {
		sortOrder = "desc"
	}

	orderClause := fmt.Sprintf("%s %s", sortBy, sortOrder)
	query = query.Order(orderClause)

	// Apply pagination
	if err := query.Offset(offset).Limit(limitInt).Find(&jobs).Error; err != nil {
		api.logger.Error("Failed to fetch jobs", slog.Any("error", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch jobs"})
		return
	}

	var responses []models.JobResponse
	for _, job := range jobs {
		response := models.JobResponse{Job: job}
		response.CalculateDuration()
		responses = append(responses, response)
	}

	// Calculate pagination info
	totalPages := int(math.Ceil(float64(totalCount) / float64(limitInt)))
	hasNext := pageInt < totalPages
	hasPrev := pageInt > 1

	c.JSON(http.StatusOK, gin.H{
		"jobs": responses,
		"pagination": gin.H{
			"page":        pageInt,
			"limit":       limitInt,
			"total":       totalCount,
			"total_pages": totalPages,
			"has_next":    hasNext,
			"has_prev":    hasPrev,
		},
		"filters": gin.H{
			"status":     status,
			"server_id":  serverID,
			"search":     search,
			"sort_by":    sortBy,
			"sort_order": sortOrder,
		},
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

	// Create context for this SSE connection that cancels when client disconnects
	ctx, cancel := context.WithCancel(c.Request.Context())
	defer cancel()

	// Start consuming real-time output events from RabbitMQ
	// This creates a unique temporary queue for this SSE client
	var outputStarted bool
	if job.Status == models.StatusRunning {
		outputStarted = true
		if err := api.queue.StartOutputConsumer(ctx, jobID, func(outputEvent queue.OutputEvent) {
			// Send real-time output event to this SSE client
			c.SSEvent("output", gin.H{
				"job_id":      outputEvent.JobID,
				"output":      outputEvent.Output,
				"is_stderr":   outputEvent.IsStderr,
				"line_count":  outputEvent.LineCount,
				"timestamp":   outputEvent.Timestamp,
			})
			c.Writer.Flush()
		}); err != nil {
			slog.Error("Failed to start output consumer", "job_id", jobID, "error", err)
		}
	}

	// Poll for updates every 500ms for running/queued jobs
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	// Create a channel to detect client disconnect
	clientGone := c.Writer.CloseNotify()

	for {
		select {
		case <-clientGone:
			slog.Info("SSE client disconnected", "job_id", jobID)
			return

		case <-ctx.Done():
			slog.Info("SSE context cancelled", "job_id", jobID)
			return

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

			// If job just started running and we haven't started output consumer yet, start it
			if job.Status == models.StatusRunning && !outputStarted {
				outputStarted = true
				if err := api.queue.StartOutputConsumer(ctx, jobID, func(outputEvent queue.OutputEvent) {
					// Send real-time output event to this SSE client
					c.SSEvent("output", gin.H{
						"job_id":      outputEvent.JobID,
						"output":      outputEvent.Output,
						"is_stderr":   outputEvent.IsStderr,
						"line_count":  outputEvent.LineCount,
						"timestamp":   outputEvent.Timestamp,
					})
					c.Writer.Flush()
				}); err != nil {
					slog.Error("Failed to start output consumer", "job_id", jobID, "error", err)
				}
			}
		}
	}
}
