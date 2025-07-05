package queue

import (
	"job-executor/internal/models"
	"sync"
)

type Queue struct {
	jobs chan *models.Job
	mu   sync.RWMutex
}

func New() *Queue {
	return &Queue{
		jobs: make(chan *models.Job, 100), // buffered channel for 100 jobs
	}
}

func (q *Queue) Push(job *models.Job) error {
	q.mu.Lock()
	defer q.mu.Unlock()
	
	select {
	case q.jobs <- job:
		return nil
	default:
		return ErrQueueFull
	}
}

func (q *Queue) Pop() <-chan *models.Job {
	return q.jobs
}

func (q *Queue) Size() int {
	q.mu.RLock()
	defer q.mu.RUnlock()
	return len(q.jobs)
}

type ErrQueueFullType struct{}

func (e ErrQueueFullType) Error() string {
	return "job queue is full"
}

var ErrQueueFull = ErrQueueFullType{}
