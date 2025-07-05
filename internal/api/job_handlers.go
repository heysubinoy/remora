package api

import (
	"job-executor/internal/models"
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

	logs := gin.H{
		"job_id": job.ID,
		"output": job.Output,
		"error":  job.Error,
	}

	c.JSON(http.StatusOK, logs)
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
	c.Header("Access-Control-Allow-Origin", "*")
	c.Header("Access-Control-Allow-Headers", "Cache-Control")

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
	c.SSEvent("status", response)
	c.Writer.Flush()

	// If job is already finished, send complete event and return
	if job.Status == models.StatusCompleted || job.Status == models.StatusFailed || job.Status == models.StatusCanceled {
		c.SSEvent("complete", response)
		return
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
		case <-ticker.C:
			// Fetch updated job status
			if err := api.db.Preload("Server").First(&job, "id = ?", jobID).Error; err != nil {
				c.SSEvent("error", gin.H{"error": "Failed to fetch job update"})
				return
			}

			response := &models.JobResponse{Job: job}
			response.CalculateDuration()

			// Send status update
			c.SSEvent("status", response)
			c.Writer.Flush()

			// If job finished, send complete event and stop streaming
			if job.Status == models.StatusCompleted || job.Status == models.StatusFailed || job.Status == models.StatusCanceled {
				c.SSEvent("complete", response)
				return
			}
		}
	}
}
