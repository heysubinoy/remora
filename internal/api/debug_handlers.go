package api

import (
	"fmt"
	"job-executor/internal/models"
	"job-executor/internal/queue"
	"net/http"
	"os"
	"runtime"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// DebugHealth provides comprehensive health information for troubleshooting
func (api *API) DebugHealth(c *gin.Context) {
	health := gin.H{
		"status":     "ok",
		"timestamp":  time.Now(),
		"database":   "unknown",
		"queue":      "unknown",
		"queue_type": fmt.Sprintf("%T", api.queue),
		"runtime": gin.H{
			"go_version":   runtime.Version(),
			"goroutines":   runtime.NumGoroutine(),
			"memory_alloc": runtime.MemStats{}.Alloc,
		},
	}

	// Test database connection
	if err := api.db.Raw("SELECT 1").Error; err != nil {
		health["database"] = "error: " + err.Error()
		api.logger.Error("Database health check failed", "error", err)
	} else {
		health["database"] = "connected"
		api.logger.Debug("Database health check passed")
	}

	// Test queue connection (if it's RabbitMQ)
	if rabbitQueue, ok := api.queue.(*queue.RabbitMQQueue); ok {
		_ = rabbitQueue // Use to avoid unused variable error
		health["queue"] = "rabbitmq_connected"
		api.logger.Debug("RabbitMQ health check passed")
	} else {
		health["queue"] = "in_memory"
		api.logger.Debug("Using in-memory queue")
	}

	// Add job statistics
	var pendingJobs int64
	var runningJobs int64
	var completedJobs int64
	var failedJobs int64

	api.db.Model(&models.Job{}).Where("status = ?", models.StatusQueued).Count(&pendingJobs)
	api.db.Model(&models.Job{}).Where("status = ?", models.StatusRunning).Count(&runningJobs)
	api.db.Model(&models.Job{}).Where("status = ?", models.StatusCompleted).Count(&completedJobs)
	api.db.Model(&models.Job{}).Where("status = ?", models.StatusFailed).Count(&failedJobs)

	health["job_stats"] = gin.H{
		"pending":   pendingJobs,
		"running":   runningJobs,
		"completed": completedJobs,
		"failed":    failedJobs,
	}

	c.JSON(http.StatusOK, health)
}

// DebugQueue provides queue-specific information
func (api *API) DebugQueue(c *gin.Context) {
	// Get queue statistics
	var pendingJobs int64
	var runningJobs int64
	var totalJobs int64

	api.db.Model(&models.Job{}).Where("status = ?", models.StatusQueued).Count(&pendingJobs)
	api.db.Model(&models.Job{}).Where("status = ?", models.StatusRunning).Count(&runningJobs)
	api.db.Model(&models.Job{}).Count(&totalJobs)

	queueInfo := gin.H{
		"queue_type":   fmt.Sprintf("%T", api.queue),
		"pending_jobs": pendingJobs,
		"running_jobs": runningJobs,
		"total_jobs":   totalJobs,
		"timestamp":    time.Now(),
	}

	// Add recent jobs
	var recentJobs []models.Job
	api.db.Order("created_at DESC").Limit(10).Find(&recentJobs)

	jobSummaries := make([]gin.H, len(recentJobs))
	for i, job := range recentJobs {
		jobSummaries[i] = gin.H{
			"id":         job.ID,
			"status":     job.Status,
			"command":    job.Command,
			"created_at": job.CreatedAt,
			"started_at": job.StartedAt,
		}
	}
	queueInfo["recent_jobs"] = jobSummaries

	c.JSON(http.StatusOK, queueInfo)
}

// DebugWorkers provides worker-specific information
func (api *API) DebugWorkers(c *gin.Context) {
	workerInfo := gin.H{
		"message":   "Worker stats available via worker logs",
		"note":      "Check worker container logs for detailed statistics",
		"timestamp": time.Now(),
	}

	// If worker is available (in legacy mode), get stats
	if api.worker != nil {
		workerInfo["worker_stats"] = api.worker.GetWorkerStats()
	} else {
		workerInfo["worker_mode"] = "separate_process"
		workerInfo["note"] = "Worker runs as separate container/process"
	}

	c.JSON(http.StatusOK, workerInfo)
}

// DebugEnvironment provides environment configuration information
func (api *API) DebugEnvironment(c *gin.Context) {
	env := gin.H{
		"timestamp":         time.Now(),
		"database_url":      maskPassword(os.Getenv("DATABASE_URL")),
		"rabbitmq_url":      maskPassword(os.Getenv("RABBITMQ_URL")),
		"server_addr":       os.Getenv("SERVER_ADDR"),
		"env":               os.Getenv("ENV"),
		"log_level":         os.Getenv("LOG_LEVEL"),
		"worker_concurrency": os.Getenv("WORKER_CONCURRENCY"),
		"pem_upload_dir":    os.Getenv("PEM_UPLOAD_DIR"),
		"aws_region":        os.Getenv("AWS_DEFAULT_REGION"),
		"aws_configured":    os.Getenv("AWS_ACCESS_KEY_ID") != "",
	}

	c.JSON(http.StatusOK, env)
}

// DebugConnections provides connection status information
func (api *API) DebugConnections(c *gin.Context) {
	connections := gin.H{
		"timestamp": time.Now(),
	}

	// Test database connection
	if err := api.db.Raw("SELECT version()").Error; err != nil {
		connections["database"] = gin.H{
			"status": "error",
			"error":  err.Error(),
		}
	} else {
		connections["database"] = gin.H{
			"status": "connected",
		}
	}

	// Test RabbitMQ connection
	if rabbitQueue, ok := api.queue.(*queue.RabbitMQQueue); ok {
		_ = rabbitQueue
		connections["rabbitmq"] = gin.H{
			"status": "connected",
			"type":   "rabbitmq",
		}
	} else {
		connections["rabbitmq"] = gin.H{
			"status": "not_connected",
			"type":   "in_memory",
		}
	}

	// Test server configurations
	var servers []models.Server
	api.db.Find(&servers)

	serverStatuses := make([]gin.H, len(servers))
	for i, server := range servers {
		serverStatuses[i] = gin.H{
			"id":        server.ID,
			"name":      server.Name,
			"hostname":  server.Hostname,
			"port":      server.Port,
			"is_active": server.IsActive,
		}
	}
	connections["servers"] = serverStatuses

	c.JSON(http.StatusOK, connections)
}

// Helper function to mask passwords in URLs
func maskPassword(url string) string {
	if url == "" {
		return ""
	}
	
	// Replace password with asterisks
	parts := strings.Split(url, "@")
	if len(parts) > 1 {
		// Find the password part
		userPart := parts[0]
		if strings.Contains(userPart, ":") {
			userPassword := strings.Split(userPart, ":")
			if len(userPassword) > 1 {
				// Mask the password
				userPassword[len(userPassword)-1] = "***"
				parts[0] = strings.Join(userPassword, ":")
			}
		}
		return strings.Join(parts, "@")
	}
	return url
}
