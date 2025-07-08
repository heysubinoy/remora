package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"job-executor/internal/config"
	"job-executor/internal/database"
	"job-executor/internal/queue"
	"job-executor/internal/storage"
	"job-executor/internal/worker"
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

	// Initialize job queue (RabbitMQ) - for consuming jobs
	var jobQueue queue.Queue
	
	// Try to connect to RabbitMQ with retries
	maxRetries := 10
	retryDelay := 5 * time.Second
	
	slog.Info("Attempting to connect to RabbitMQ", "url", cfg.RabbitMQURL, "max_retries", maxRetries)
	
	var rabbitQueue *queue.RabbitMQQueue
	for attempt := 1; attempt <= maxRetries; attempt++ {
		slog.Info("RabbitMQ connection attempt", "attempt", attempt, "max_retries", maxRetries)
		
		var connErr error
		rabbitQueue, connErr = queue.NewRabbitMQQueue(cfg.RabbitMQURL)
		if connErr == nil {
			slog.Info("Connected to RabbitMQ successfully", "url", cfg.RabbitMQURL, "attempt", attempt)
			jobQueue = rabbitQueue
			break
		}
		
		slog.Warn("Failed to connect to RabbitMQ", "error", connErr, "attempt", attempt, "max_retries", maxRetries)
		
		if attempt < maxRetries {
			slog.Info("Retrying RabbitMQ connection", "retry_delay", retryDelay, "next_attempt", attempt+1)
			time.Sleep(retryDelay)
		}
	}
	
	if jobQueue == nil {
		slog.Error("Failed to connect to RabbitMQ after all retries", "max_retries", maxRetries)
		slog.Error("Worker requires RabbitMQ to function properly")
		os.Exit(1)
	}

	// Ensure graceful cleanup of RabbitMQ connection
	defer func() {
		if rabbitQueue != nil {
			if closeErr := rabbitQueue.Close(); closeErr != nil {
				slog.Error("Failed to close RabbitMQ connection", "error", closeErr)
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
	jobWorker := worker.New(db, jobQueue, storageService)
	
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
