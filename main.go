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
	"job-executor/internal/worker"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

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

	// Initialize job queue
	jobQueue := queue.New()

	// Initialize worker
	jobWorker := worker.New(db, jobQueue, cfg.SSH)

	// Start worker in background
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go jobWorker.Start(ctx)

	// Initialize HTTP server
	router := gin.New()
	router.Use(gin.Logger(), gin.Recovery())

	// Configure CORS middleware
	corsConfig := cors.Config{
		AllowOrigins: []string{
			"http://localhost:3000",  // Next.js dev server
			"http://127.0.0.1:3000",
			"http://localhost:8080",  // Backend server (for web interface)
			"http://127.0.0.1:8080",
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

	// Setup API routes
	api.SetupRoutes(router, db, jobQueue, jobWorker)

	server := &http.Server{
		Addr:    cfg.ServerAddr,
		Handler: router,
	}

	// Start server in goroutine
	go func() {
		slog.Info("Starting server", "addr", cfg.ServerAddr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("Server failed to start", "error", err)
			os.Exit(1)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	slog.Info("Shutting down server...")

	// Cancel worker context
	cancel()

	// Shutdown server with timeout
	ctx, cancel = context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		slog.Error("Server forced to shutdown", "error", err)
	}

	slog.Info("Server exited")
}
