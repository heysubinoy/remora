package api

import (
	"job-executor/internal/queue"
	"job-executor/internal/storage"
	"job-executor/internal/worker"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type API struct {
	db      *gorm.DB
	queue   queue.Queue
	worker  *worker.Worker
	storage storage.StorageService
	logger  *slog.Logger
}

// SetupRoutes is the legacy setup function that includes worker dependency
func SetupRoutes(router *gin.Engine, db *gorm.DB, queue queue.Queue, worker *worker.Worker, storage storage.StorageService, logger *slog.Logger) {
	api := &API{db: db, queue: queue, worker: worker, storage: storage, logger: logger}
	setupCommonRoutes(router, api)
}

// SetupAPIRoutes is the new setup function without worker dependency (for API server)
func SetupAPIRoutes(router *gin.Engine, db *gorm.DB, queue queue.Queue, storage storage.StorageService, logger *slog.Logger) {
	api := &API{db: db, queue: queue, worker: nil, storage: storage, logger: logger}
	setupCommonRoutes(router, api)
}

func setupCommonRoutes(router *gin.Engine, api *API) {

	v1 := router.Group("/api/v1")
	{
		// Job routes
		v1.POST("/jobs", api.SubmitJob)
		v1.POST("/jobs/script", api.SubmitScriptJob)
		v1.POST("/jobs/:id/duplicate", api.DuplicateJob)
		v1.GET("/jobs/:id", api.GetJob)
		v1.POST("/jobs/:id/cancel", api.CancelJob)
		v1.GET("/jobs/:id/logs", api.GetJobLogs)
		v1.GET("/jobs/:id/stdout", api.GetJobStdout)
		v1.GET("/jobs/:id/stderr", api.GetJobStderr)
		v1.GET("/jobs/:id/stream", api.StreamJob)
		v1.GET("/jobs", api.ListJobs)

		// Server configuration routes
		v1.POST("/servers", api.CreateServer)
		v1.GET("/servers/:id", api.GetServer)
		v1.PUT("/servers/:id", api.UpdateServer)
		v1.DELETE("/servers/:id", api.DeleteServer)
		v1.GET("/servers", api.ListServers)
		v1.POST("/servers/:id/test", api.TestServerConnection)
		
		// PEM file upload route
		v1.POST("/pem-files/upload", api.UploadPemFile)
	}

	// Health check endpoint
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy"})
	})

	// Serve the web interface
	router.Static("/web", "./web")
	router.GET("/", func(c *gin.Context) {
		c.File("./web/index.html")
	})
}
