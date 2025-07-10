package netqueue

import (
	"context"
	"job-executor/internal/models"
	"log/slog"
	"os"
	"sync"
	"testing"
	"time"
)

func TestNetQueue_PriorityAndConcurrency(t *testing.T) {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	addr := ":9100"
	server := NewNetQueueServer()
	go func() {
		err := server.Start(addr)
		if err != nil {
			t.Errorf("Server failed: %v", err)
		}
	}()
	time.Sleep(500 * time.Millisecond)

	jobs := []*models.Job{
		{ID: "job-low", Command: "echo", Args: "low", Priority: 5},
		{ID: "job-high1", Command: "echo", Args: "high1", Priority: 10},
		{ID: "job-high2", Command: "echo", Args: "high2", Priority: 10},
		{ID: "job-mid", Command: "echo", Args: "mid", Priority: 7},
	}

	client, err := NewNetQueueClient(addr)
	if err != nil {
		t.Fatalf("Failed to create client: %v", err)
	}
	defer client.Close()

	for _, job := range jobs {
		err := client.Push(job)
		if err != nil {
			t.Fatalf("Failed to push job %s: %v", job.ID, err)
		}
	}

	popCount := len(jobs)
	clientCount := 3
	var wg sync.WaitGroup
	wg.Add(popCount)
	results := make(chan *models.Job, popCount)
	seen := sync.Map{}

	for i := 0; i < clientCount; i++ {
		go func(cid int) {
			c, err := NewNetQueueClient(addr)
			if err != nil {
				t.Errorf("Client %d failed: %v", cid, err)
				return
			}
			defer c.Close()
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			err = c.StartConsumer(ctx, func(j *models.Job) {
				if _, loaded := seen.LoadOrStore(j.ID, true); loaded {
					t.Errorf("Job %s popped by multiple clients!", j.ID)
				} else {
					results <- j
					wg.Done()
				}
			})
			if err != nil {
				t.Errorf("Client %d StartConsumer error: %v", cid, err)
			}
			<-ctx.Done()
		}(i)
	}

	wg.Wait()
	close(results)

	// Collect and check order
	order := []*models.Job{}
	for job := range results {
		order = append(order, job)
	}

	priorityMap := map[string]int{}
	for _, job := range jobs {
		priorityMap[job.ID] = job.Priority
	}
	lastPriority := 1000
	for _, job := range order {
		if priorityMap[job.ID] > lastPriority {
			t.Errorf("Job %s (priority %d) popped after lower priority job!", job.ID, priorityMap[job.ID])
		} else {
			lastPriority = priorityMap[job.ID]
		}
	}

	if len(order) != len(jobs) {
		t.Errorf("Expected %d jobs popped, got %d", len(jobs), len(order))
	}
}
