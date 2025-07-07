package config

import (
	"os"
)

type Config struct {
	ServerAddr  string
	DatabaseURL string
	RabbitMQURL string
	SSH         SSHConfig
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
	return &Config{
		ServerAddr:  getEnv("SERVER_ADDR", ":8080"),
		DatabaseURL: getEnv("DATABASE_URL", "./jobs.db"),
		RabbitMQURL: getEnv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/"),
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
