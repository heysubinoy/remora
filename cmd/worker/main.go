package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"job-executor/internal/config"
	"job-executor/internal/database"
	"job-executor/internal/queue"
	"job-executor/internal/storage"
	"job-executor/internal/worker"

	"gorm.io/gorm"
)

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// Helper function to mask passwords in URLs for logging
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

func main() {
	// Initialize structured logger with debug level for better diagnostics
	logLevel := slog.LevelInfo
	if os.Getenv("LOG_LEVEL") == "debug" {
		logLevel = slog.LevelDebug
	}

	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: logLevel,
	}))
	slog.SetDefault(logger)

	slog.Info("Starting Job Executor Worker",
		"version", "1.0.0",
		"log_level", logLevel.String(),
		"environment", getEnvOrDefault("ENV", "development"))

	// Load configuration
	cfg := config.Load()
	slog.Info("Configuration loaded",
		"database_url", maskPassword(cfg.DatabaseURL),
		"rabbitmq_url", maskPassword(cfg.RabbitMQURL),
		"worker_pool_size", cfg.WorkerPoolSize)

	// Initialize database with retry logic
	slog.Info("Initializing database connection...")
	var db *gorm.DB
	var err error

	maxDBRetries := 5
	for attempt := 1; attempt <= maxDBRetries; attempt++ {
		slog.Info("Database connection attempt", "attempt", attempt, "max_retries", maxDBRetries)
		db, err = database.Initialize(cfg.DatabaseURL)
		if err == nil {
			slog.Info("Database connected successfully", "attempt", attempt)
			break
		}

		slog.Error("Database connection failed", "error", err, "attempt", attempt)
		if attempt < maxDBRetries {
			time.Sleep(time.Duration(attempt) * 2 * time.Second)
		}
	}

	if err != nil {
		slog.Error("Failed to initialize database after all retries", "error", err, "max_retries", maxDBRetries)
		os.Exit(1)
	}


	   // Initialize job queue (NetQueue polyfill)
	   netqueueAddr := getEnvOrDefault("NETQUEUE_ADDR", "localhost:9000")
	   jobQueue, err := queue.NewNetQueue(netqueueAddr)
	   if err != nil {
			   slog.Error("Failed to connect to NetQueue server", "error", err, "addr", netqueueAddr)
			   os.Exit(1)
	   }
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

	// Initialize worker
	   jobWorker := worker.New(db, *jobQueue, storageService)

	// Configure worker pool size based on configuration
	jobWorker.SetWorkerPoolSize(cfg.WorkerPoolSize)

	slog.Info("Worker configured", "worker_pool_size", cfg.WorkerPoolSize)

	// Start worker in background
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	slog.Info("Starting job worker process")
	go jobWorker.Start(ctx)

	// Wait for interrupt signal to gracefully shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	slog.Info("Shutting down worker...")

	// Cancel worker context
	cancel()

	slog.Info("Worker exited")
}
