package main

import (
	"context"
	"fmt"
	"job-executor/internal/netqueue"
	"job-executor/internal/models"
	"log/slog"
	"os"
	"sync"
	"time"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	addr := ":9001" // Use a different port for testing
	server := netqueue.NewNetQueueServer()
	go func() {
		err := server.Start(addr)
		if err != nil {
			slog.Error("Server failed", "error", err)
		}
	}()

	time.Sleep(500 * time.Millisecond) // Wait for server to start

	client, err := netqueue.NewNetQueueClient(addr)
	if err != nil {
		panic(err)
	}
	defer client.Close()

	job := &models.Job{
		ID:       "job-1",
		Command:  "echo",
		Args:     "hello world",
		Priority: 5,
	}

	slog.Info("Pushing job", "job_id", job.ID)
	err = client.Push(job)
	if err != nil {
		panic(err)
	}

	var wg sync.WaitGroup
	wg.Add(1)
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	err = client.StartConsumer(ctx, func(j *models.Job) {
		slog.Info("Job received by consumer", "job_id", j.ID, "command", j.Command, "args", j.Args)
		if j.ID != job.ID {
			fmt.Println("Job ID mismatch!")
		} else {
			fmt.Println("Job received and matches!")
		}
		wg.Done()
	})
	if err != nil {
		panic(err)
	}

	wg.Wait()
	fmt.Println("Test complete.")
}
