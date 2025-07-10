package main

import (
	"job-executor/internal/netqueue"
	"log/slog"
	"os"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	addr := ":9000" // or from env/config
	slog.Info("Starting NetQueue server", "addr", addr)
	server := netqueue.NewNetQueueServer()
	if err := server.Start(addr); err != nil {
		slog.Error("NetQueue server failed", "error", err)
		os.Exit(1)
	}
}
