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

	addr := ":9002" // Use a different port for this test
	server := netqueue.NewNetQueueServer()
	go func() {
		err := server.Start(addr)
		if err != nil {
			slog.Error("Server failed", "error", err)
		}
	}()

	time.Sleep(500 * time.Millisecond) // Wait for server to start

	// Push jobs with different priorities
	jobs := []*models.Job{
		{ID: "job-low", Command: "echo", Args: "low", Priority: 5},
		{ID: "job-high1", Command: "echo", Args: "high1", Priority: 10},
		{ID: "job-high2", Command: "echo", Args: "high2", Priority: 10},
		{ID: "job-mid", Command: "echo", Args: "mid", Priority: 7},
	}

	client, err := netqueue.NewNetQueueClient(addr)
	if err != nil {
		panic(err)
	}
	defer client.Close()

	for _, job := range jobs {
		err := client.Push(job)
		if err != nil {
			panic(err)
		}
	}

	// Start multiple clients to pop jobs concurrently
	popCount := len(jobs)
	clientCount := 3
	var wg sync.WaitGroup
	wg.Add(popCount)
	results := make(chan string, popCount)
	seen := sync.Map{}

	for i := 0; i < clientCount; i++ {
		go func(cid int) {
			c, err := netqueue.NewNetQueueClient(addr)
			if err != nil {
				panic(err)
			}
			defer c.Close()
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			err := c.StartConsumer(ctx, func(j *models.Job) {
				if _, loaded := seen.LoadOrStore(j.ID, true); loaded {
					fmt.Printf("ERROR: Job %s popped by multiple clients!\n", j.ID)
				} else {
					fmt.Printf("Client %d got job: %s (priority %d)\n", cid, j.ID, j.Priority)
					results <- j.ID
					wg.Done()
				}
			})
			if err != nil {
				panic(err)
			}
			<-ctx.Done()
		}(i)
	}

	wg.Wait()
	close(results)

	// Collect and check order
	order := []string{}
	for id := range results {
		order = append(order, id)
	}

	fmt.Println("Order jobs were popped:", order)
	// Check that high priority jobs come first
	priorityMap := map[string]int{}
	for _, job := range jobs {
		priorityMap[job.ID] = job.Priority
	}
	lastPriority := 1000
	for _, id := range order {
		if priorityMap[id] > lastPriority {
			fmt.Printf("ERROR: Job %s (priority %d) popped after lower priority job!\n", id, priorityMap[id])
		} else {
			lastPriority = priorityMap[id]
		}
	}

	fmt.Println("Comprehensive concurrency test complete.")
}
