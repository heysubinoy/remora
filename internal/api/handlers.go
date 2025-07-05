package api

import (
	"job-executor/internal/queue"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type API struct {
	db    *gorm.DB
	queue *queue.Queue
}

func SetupRoutes(router *gin.Engine, db *gorm.DB, queue *queue.Queue) {
	api := &API{db: db, queue: queue}

	v1 := router.Group("/api/v1")
	{
		// Job routes
		v1.POST("/jobs", api.SubmitJob)
		v1.GET("/jobs/:id", api.GetJob)
		v1.POST("/jobs/:id/cancel", api.CancelJob)
		v1.GET("/jobs/:id/logs", api.GetJobLogs)
		v1.GET("/jobs", api.ListJobs)

		// Server configuration routes
		v1.POST("/servers", api.CreateServer)
		v1.GET("/servers/:id", api.GetServer)
		v1.PUT("/servers/:id", api.UpdateServer)
		v1.DELETE("/servers/:id", api.DeleteServer)
		v1.GET("/servers", api.ListServers)
		v1.POST("/servers/:id/test", api.TestServerConnection)
	}

	// Health check endpoint
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy"})
	})
}
