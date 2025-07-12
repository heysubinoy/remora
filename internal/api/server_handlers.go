package api

import (
	"fmt"
	"job-executor/internal/config"
	"job-executor/internal/models"
	"job-executor/internal/ssh"
	"log/slog"
	"net/http"
	"os/exec"
	"runtime"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ServerStatus represents the status of a server check
type ServerStatus struct {
	Status    string    `json:"status"`
	Message   string    `json:"message"`
	CheckedAt time.Time `json:"checked_at"`
}

// checkServerReachability checks if a server is reachable using netcat or platform-specific commands
func checkServerReachability(hostname string, port int) ServerStatus {
	checkedAt := time.Now().UTC()

	var cmd *exec.Cmd
	var cmdDesc string

	// Use platform-specific commands
	switch runtime.GOOS {
	case "windows":
		// On Windows, use Test-NetConnection PowerShell command
		psCommand := fmt.Sprintf("Test-NetConnection -ComputerName %s -Port %d -InformationLevel Quiet", hostname, port)
		cmd = exec.Command("powershell", "-Command", psCommand)
		cmdDesc = fmt.Sprintf("powershell Test-NetConnection %s:%d", hostname, port)
	default:
		// On Unix-like systems, use netcat
		cmd = exec.Command("nc", "-z", "-v", "-w", "2", hostname, fmt.Sprintf("%d", port))
		cmdDesc = fmt.Sprintf("nc -z -v -w 2 %s %d", hostname, port)
	}

	// Set a timeout for the command
	timeout := 5 * time.Second
	timer := time.AfterFunc(timeout, func() {
		if cmd.Process != nil {
			cmd.Process.Kill()
		}
	})
	defer timer.Stop()

	// Run the command
	err := cmd.Run()

	if err != nil {
		return ServerStatus{
			Status:    "disconnected",
			Message:   fmt.Sprintf("Server %s:%d is not reachable (%s failed: %v)", hostname, port, cmdDesc, err),
			CheckedAt: checkedAt,
		}
	}

	return ServerStatus{
		Status:    "connected",
		Message:   fmt.Sprintf("Server %s:%d is reachable", hostname, port),
		CheckedAt: checkedAt,
	}
}

// UploadPemFile handles PEM file uploads to object storage
func (api *API) UploadPemFile(c *gin.Context) {
	file, header, err := c.Request.FormFile("pem_file")
	if err != nil {
		api.logger.Error("Failed to get uploaded file", slog.Any("error", err))
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to get uploaded file"})
		return
	}
	defer file.Close()

	// Upload to storage service
	url, err := api.storage.UploadPemFile(c.Request.Context(), file, header.Filename)
	if err != nil {
		api.logger.Error("Failed to upload PEM file", slog.Any("error", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to upload PEM file"})
		return
	}

	api.logger.Info("PEM file uploaded successfully",
		slog.String("filename", header.Filename),
		slog.String("url", url))

	c.JSON(http.StatusOK, gin.H{
		"message":      "PEM file uploaded successfully",
		"pem_file_url": url,
		"filename":     header.Filename,
	})
}

func (api *API) CreateServer(c *gin.Context) {
	var req models.ServerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Set default port if not provided
	if req.Port <= 0 {
		req.Port = 22
	}

	// Set default active status if not provided
	if req.IsActive == nil {
		active := true
		req.IsActive = &active
	}

	// Validate auth type requirements
	if req.AuthType == "password" && req.Password == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Password is required for password authentication"})
		return
	}
	if req.AuthType == "key" && req.PrivateKey == "" && req.PemFile == "" && req.PemFileURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Private key, PEM file content, or PEM file URL is required for key authentication"})
		return
	}

	// Create server
	server := &models.Server{
		Name:       req.Name,
		Hostname:   req.Hostname,
		Port:       req.Port,
		User:       req.User,
		AuthType:   req.AuthType,
		Password:   req.Password,
		PrivateKey: req.PrivateKey,
		PemFile:    req.PemFile,
		PemFileURL: req.PemFileURL,
		IsActive:   *req.IsActive,
	}

	// Save to database
	if err := api.db.Create(server).Error; err != nil {
		if err.Error() == "UNIQUE constraint failed: servers.name" {
			c.JSON(http.StatusConflict, gin.H{"error": "Server name already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create server"})
		return
	}

	response := &models.ServerResponse{Server: *server}
	c.JSON(http.StatusCreated, response)
}

func (api *API) GetServer(c *gin.Context) {
	serverID := c.Param("id")

	var server models.Server
	if err := api.db.First(&server, "id = ?", serverID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Server not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch server"})
		return
	}

	response := &models.ServerResponse{Server: server}
	c.JSON(http.StatusOK, response)
}

func (api *API) UpdateServer(c *gin.Context) {
	serverID := c.Param("id")

	var server models.Server
	if err := api.db.First(&server, "id = ?", serverID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Server not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch server"})
		return
	}

	var req models.ServerUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Update fields if provided
	if req.Name != "" {
		server.Name = req.Name
	}
	if req.Hostname != "" {
		server.Hostname = req.Hostname
	}
	if req.Port != nil {
		server.Port = *req.Port
	}
	if req.User != "" {
		server.User = req.User
	}
	if req.AuthType != "" {
		server.AuthType = req.AuthType
	}
	if req.Password != "" {
		server.Password = req.Password
	}
	if req.PrivateKey != "" {
		server.PrivateKey = req.PrivateKey
	}
	if req.PemFile != "" {
		server.PemFile = req.PemFile
	}
	if req.PemFileURL != "" {
		server.PemFileURL = req.PemFileURL
	}
	if req.IsActive != nil {
		server.IsActive = *req.IsActive
	}

	// Validate auth type requirements after update
	if server.AuthType == "password" && server.Password == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Password is required for password authentication"})
		return
	}
	if server.AuthType == "key" && server.PrivateKey == "" && server.PemFile == "" && server.PemFileURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Private key, PEM file content, or PEM file URL is required for key authentication"})
		return
	}

	// Save changes
	if err := api.db.Save(&server).Error; err != nil {
		if err.Error() == "UNIQUE constraint failed: servers.name" {
			c.JSON(http.StatusConflict, gin.H{"error": "Server name already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update server"})
		return
	}

	response := &models.ServerResponse{Server: server}
	c.JSON(http.StatusOK, response)
}

func (api *API) DeleteServer(c *gin.Context) {
	serverID := c.Param("id")

	// Check if server exists
	var server models.Server
	if err := api.db.First(&server, "id = ?", serverID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Server not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	// Check if there are any active jobs for this server
	var activeJobCount int64
	if err := api.db.Model(&models.Job{}).Where("server_id = ? AND status IN ?", serverID, []string{"queued", "running"}).Count(&activeJobCount).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check active jobs"})
		return
	}

	if activeJobCount > 0 {
		c.JSON(http.StatusConflict, gin.H{
			"error":       "Cannot delete server with active jobs",
			"details":     "This server has jobs that are currently queued or running. Please wait for them to complete or cancel them before deleting the server.",
			"active_jobs": activeJobCount,
		})
		return
	}

	// Check for force deletion parameter
	force := c.Query("force") == "true"

	// Check if there are any completed jobs for this server
	var totalJobCount int64
	if err := api.db.Model(&models.Job{}).Where("server_id = ?", serverID).Count(&totalJobCount).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check job history"})
		return
	}

	if totalJobCount > 0 && !force {
		c.JSON(http.StatusConflict, gin.H{
			"error":      "Server has associated job history",
			"details":    "This server has job history records. Add '?force=true' to delete the server and all associated job records.",
			"total_jobs": totalJobCount,
		})
		return
	}

	// Begin transaction for deletion
	tx := api.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// If force is true, delete all associated jobs first
	if force && totalJobCount > 0 {
		if err := tx.Where("server_id = ?", serverID).Delete(&models.Job{}).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete associated jobs"})
			return
		}
	}

	// Delete the server
	if err := tx.Delete(&server).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete server"})
		return
	}

	// Commit transaction
	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit deletion"})
		return
	}

	responseMessage := "Server deleted successfully"
	if force && totalJobCount > 0 {
		responseMessage = fmt.Sprintf("Server and %d associated job records deleted successfully", totalJobCount)
	}

	c.JSON(http.StatusOK, gin.H{
		"message":      responseMessage,
		"deleted_jobs": totalJobCount,
	})
}

func (api *API) ListServers(c *gin.Context) {
	var servers []models.Server

	// Get query parameters
	active := c.Query("active")

	query := api.db.Model(&models.Server{})

	if active != "" {
		isActive := active == "true"
		query = query.Where("is_active = ?", isActive)
	}

	if err := query.Order("created_at DESC").Find(&servers).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch servers"})
		return
	}

	var responses []models.ServerResponse
	for _, server := range servers {
		response := models.ServerResponse{Server: server}
		responses = append(responses, response)
	}

	c.JSON(http.StatusOK, gin.H{"servers": responses})
}

func (api *API) TestServerConnection(c *gin.Context) {
	serverID := c.Param("id")

	var server models.Server
	if err := api.db.First(&server, "id = ?", serverID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Server not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch server"})
		return
	}

	// Create SSH client configuration
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
	}

	// Create SSH client with storage service if needed
	var sshClient *ssh.Client
	if server.PemFileURL != "" {
		sshClient = ssh.NewClientWithStorage(sshConfig, api.storage)
	} else {
		sshClient = ssh.NewClient(sshConfig)
	}

	// Test the connection
	if err := sshClient.TestConnection(c.Request.Context()); err != nil {
		api.logger.Error("SSH connection test failed",
			slog.String("server_id", server.ID),
			slog.String("hostname", server.Hostname),
			slog.Any("error", err))

		c.JSON(http.StatusServiceUnavailable, gin.H{
			"server_id": server.ID,
			"status":    "connection_failed",
			"error":     err.Error(),
		})
		return
	}

	api.logger.Info("SSH connection test successful",
		slog.String("server_id", server.ID),
		slog.String("hostname", server.Hostname))

	c.JSON(http.StatusOK, gin.H{
		"server_id": server.ID,
		"status":    "connection_successful",
		"message":   "Successfully connected to the server",
	})
}

// CheckServerStatus checks if a server is reachable using netcat (nc) command
func (api *API) CheckServerStatus(c *gin.Context) {
	serverID := c.Param("id")

	var server models.Server
	if err := api.db.First(&server, "id = ?", serverID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Server not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch server"})
		return
	}

	// Use netcat to check if port is open
	status := checkServerReachability(server.Hostname, server.Port)

	api.logger.Info("Server status check completed",
		slog.String("server_id", server.ID),
		slog.String("hostname", server.Hostname),
		slog.Int("port", server.Port),
		slog.String("status", status.Status))

	c.JSON(http.StatusOK, gin.H{
		"server_id":   server.ID,
		"server_name": server.Name,
		"hostname":    server.Hostname,
		"port":        server.Port,
		"status":      status.Status,
		"message":     status.Message,
		"checked_at":  status.CheckedAt,
	})
}

// CheckAllServersStatus checks the status of all servers
func (api *API) CheckAllServersStatus(c *gin.Context) {
	var servers []models.Server

	// Get query parameters
	active := c.Query("active")

	query := api.db.Model(&models.Server{})

	if active != "" {
		isActive := active == "true"
		query = query.Where("is_active = ?", isActive)
	}

	if err := query.Order("created_at DESC").Find(&servers).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch servers"})
		return
	}

	// Check status for each server
	var serverStatuses []gin.H
	for _, server := range servers {
		status := checkServerReachability(server.Hostname, server.Port)

		serverStatuses = append(serverStatuses, gin.H{
			"server_id":   server.ID,
			"server_name": server.Name,
			"hostname":    server.Hostname,
			"port":        server.Port,
			"status":      status.Status,
			"message":     status.Message,
			"checked_at":  status.CheckedAt,
		})
	}

	// Count servers by status
	var connected, disconnected int
	for _, status := range serverStatuses {
		if status["status"] == "connected" {
			connected++
		} else {
			disconnected++
		}
	}

	api.logger.Info("All servers status check completed",
		slog.Int("total_servers", len(servers)),
		slog.Int("connected", connected),
		slog.Int("disconnected", disconnected))

	c.JSON(http.StatusOK, gin.H{
		"total_servers": len(servers),
		"connected":     connected,
		"disconnected":  disconnected,
		"servers":       serverStatuses,
	})
}

// GetSystemInfo returns system statistics including total servers, jobs, etc.
func (api *API) GetSystemInfo(c *gin.Context) {
	var totalServers int64
	var totalJobs int64
	var completedJobs int64
	var runningJobs int64
	var failedJobs int64

	// Count total servers
	if err := api.db.Model(&models.Server{}).Count(&totalServers).Error; err != nil {
		api.logger.Error("Failed to count servers", slog.String("error", err.Error()))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get server count"})
		return
	}

	// Count total jobs
	if err := api.db.Model(&models.Job{}).Count(&totalJobs).Error; err != nil {
		api.logger.Error("Failed to count jobs", slog.String("error", err.Error()))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get job count"})
		return
	}

	// Count completed jobs
	if err := api.db.Model(&models.Job{}).Where("status = ?", models.StatusCompleted).Count(&completedJobs).Error; err != nil {
		api.logger.Error("Failed to count completed jobs", slog.String("error", err.Error()))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get completed job count"})
		return
	}

	// Count running jobs
	if err := api.db.Model(&models.Job{}).Where("status = ?", models.StatusRunning).Count(&runningJobs).Error; err != nil {
		api.logger.Error("Failed to count running jobs", slog.String("error", err.Error()))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get running job count"})
		return
	}

	// Count failed jobs
	if err := api.db.Model(&models.Job{}).Where("status = ?", models.StatusFailed).Count(&failedJobs).Error; err != nil {
		api.logger.Error("Failed to count failed jobs", slog.String("error", err.Error()))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get failed job count"})
		return
	}

	// Calculate queued jobs
	queuedJobs := totalJobs - completedJobs - runningJobs - failedJobs

	api.logger.Info("System info requested",
		slog.Int64("total_servers", totalServers),
		slog.Int64("total_jobs", totalJobs),
		slog.Int64("completed_jobs", completedJobs),
		slog.Int64("running_jobs", runningJobs),
		slog.Int64("failed_jobs", failedJobs))

	c.JSON(http.StatusOK, gin.H{
		"total_servers":  totalServers,
		"total_jobs":     totalJobs,
		"completed_jobs": completedJobs,
		"running_jobs":   runningJobs,
		"failed_jobs":    failedJobs,
		"queued_jobs":    queuedJobs,
		"success_rate":   float64(completedJobs) / float64(totalJobs) * 100,
		"timestamp":      time.Now().UTC().Format(time.RFC3339),
	})
}
