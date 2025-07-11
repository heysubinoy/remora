package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"job-executor/internal/api"
	"job-executor/internal/config"
	"job-executor/internal/database"
	"job-executor/internal/queue"
	"job-executor/internal/storage"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func main() {
	// Initialize structured logger
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)

	// Load configuration
	cfg := config.Load()

	// Initialize database
	db, err := database.Initialize(cfg.DatabaseURL)
	if err != nil {
		slog.Error("Failed to initialize database", "error", err)
		os.Exit(1)
	}

	// Initialize job queue (NetQueue polyfill)
	var jobQueue *queue.NetQueue
	netqueueAddr := getEnvOrDefault("NETQUEUE_ADDR", "localhost:9000")
	q, err := queue.NewNetQueue(netqueueAddr)
	if err != nil {
		slog.Error("Failed to connect to NetQueue server", "error", err, "addr", netqueueAddr)
		os.Exit(1)
	}
	jobQueue = q
	defer func() {
		if jobQueue != nil {
			if closeErr := jobQueue.Close(); closeErr != nil {
				slog.Error("Failed to close NetQueue connection", "error", closeErr)
			}
		}
	}()

	// Initialize storage service
	storageConfig := &storage.StorageConfig{
		AWSRegion:    getEnvOrDefault("AWS_REGION", "ap-south-1"),
		S3Bucket:     getEnvOrDefault("S3_BUCKET", "remora-files"),
		S3KeyPrefix:  getEnvOrDefault("S3_KEY_PREFIX", "pem-files/"),
		AWSAccessKey: os.Getenv("AWS_ACCESS_KEY_ID"),
		AWSSecretKey: os.Getenv("AWS_SECRET_ACCESS_KEY"),
	}

	var storageService storage.StorageService
	s3Service, err := storage.NewS3StorageService(storageConfig, logger)
	if err != nil {
		slog.Error("Failed to initialize S3 storage service", "error", err)
		// Fallback to local storage for development (will return errors)
		storageService = storage.NewLocalStorageService("./pem-files", logger)
		slog.Warn("Using local storage service (limited functionality)")
	} else {
		storageService = s3Service
	}

	// Initialize HTTP server
	router := gin.New()
	router.Use(gin.Logger(), gin.Recovery())

	// Configure CORS middleware
	corsConfig := cors.Config{
		AllowOrigins: []string{
			"http://localhost:3000", // Next.js dev server
			"http://127.0.0.1:3000",
			"http://localhost:8080", // Backend server (for web interface)
			"http://127.0.0.1:8080",
			"https://remora-six.vercel.app",
		},
		AllowMethods: []string{
			"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS",
		},
		AllowHeaders: []string{
			"Origin", "Content-Length", "Content-Type", "Authorization",
			"Accept", "X-Requested-With", "Cache-Control",
		},
		ExposeHeaders: []string{
			"Content-Length", "Content-Type",
		},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}
	router.Use(cors.New(corsConfig))

	// Setup API routes - no worker dependency
	api.SetupAPIRoutes(router, db, *jobQueue, storageService, logger)

	server := &http.Server{
		Addr:    cfg.ServerAddr,
		Handler: router,
	}

	// Start server in goroutine
	go func() {
		slog.Info("Starting API server", "addr", cfg.ServerAddr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("Server failed to start", "error", err)
			os.Exit(1)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	slog.Info("Shutting down API server...")

	// Shutdown server with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		slog.Error("Server forced to shutdown", "error", err)
	}

	slog.Info("API server exited")
}
