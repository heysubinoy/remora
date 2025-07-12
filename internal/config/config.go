package config

import (
	"os"
	"runtime"
	"strconv"
)

type Config struct {
	ServerAddr     string
	DatabaseURL    string
	NetQueueAddr   string
	WorkerPoolSize int
	SSH            SSHConfig
}

type SSHConfig struct {
	Host       string
	Port       string
	User       string
	Password   string
	PrivateKey string
	PemFileURL string
}

func Load() *Config {
	// Default worker pool size - goroutines are lightweight, especially for I/O-bound SSH tasks
	// Use multiple workers per CPU core since most time is spent waiting for SSH responses
	cpuCores := runtime.NumCPU()
	defaultWorkerPoolSize := cpuCores * 4 // 4 workers per CPU core for I/O-bound tasks

	// Set reasonable bounds
	if defaultWorkerPoolSize > 50 {
		defaultWorkerPoolSize = 50 // Cap at 50 workers to avoid excessive resource usage
	}
	if defaultWorkerPoolSize < 4 {
		defaultWorkerPoolSize = 4 // Minimum 4 workers even on single-core systems
	}

	workerPoolSize := defaultWorkerPoolSize
	if poolSizeStr := os.Getenv("WORKER_POOL_SIZE"); poolSizeStr != "" {
		if parsed, err := strconv.Atoi(poolSizeStr); err == nil && parsed > 0 {
			workerPoolSize = parsed
		}
	}

	return &Config{
		ServerAddr:     getEnv("SERVER_ADDR", ":8080"),
		DatabaseURL:    getEnv("DATABASE_URL", "./jobs.db"),
		NetQueueAddr:   getEnv("NETQUEUE_ADDR", "localhost:9000"),
		WorkerPoolSize: workerPoolSize,
		SSH: SSHConfig{
			Host:       getEnv("SSH_HOST", "localhost"),
			Port:       getEnv("SSH_PORT", "22"),
			User:       getEnv("SSH_USER", ""),
			Password:   getEnv("SSH_PASSWORD", ""),
			PrivateKey: getEnv("SSH_PRIVATE_KEY", ""),
		},
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
