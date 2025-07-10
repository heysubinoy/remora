package queue

import (
	"context"
	"job-executor/internal/models"
	netqueue "job-executor/internal/netqueue"
)
type CancelMessage struct {
	JobID string `json:"job_id"`
}

type OutputEvent struct {
	JobID     string `json:"job_id"`
	Output    string `json:"output"`
	IsStderr  bool   `json:"is_stderr"`
	LineCount int    `json:"line_count"`
	Timestamp string `json:"timestamp"`
}
type NetQueue struct {
	   client *netqueue.NetQueueClient
}

func NewNetQueue(addr string) (*NetQueue, error) {
	   client, err := netqueue.NewNetQueueClient(addr)
	   if err != nil {
			   return nil, err
	   }
	   return &NetQueue{client: client}, nil
}

func (q *NetQueue) Push(job *models.Job) error {
	   return q.client.Push(job)
}

func (q *NetQueue) StartConsumer(ctx context.Context, handler func(*models.Job)) error {
	   return q.client.StartConsumer(ctx, handler)
}

func (q *NetQueue) PublishCancelMessage(jobID string) error {
	   return q.client.PublishCancelMessage(jobID)
}

func (q *NetQueue) StartCancelConsumer(ctx context.Context, handler func(string)) error {
	   // Not implemented in NetQueueClient, so just return nil
	   return nil
}

func (q *NetQueue) PublishOutputEvent(jobID, output string, isStderr bool, lineCount int) error {
	   // Not implemented in NetQueueClient, so just return nil
	   return nil
}

func (q *NetQueue) StartOutputConsumer(ctx context.Context, jobID string, handler func(OutputEvent)) error {
	   // Not implemented in NetQueueClient, so just return nil
	   return nil
}

func (q *NetQueue) Close() error {
	   return q.client.Close()
}

type ErrQueueFullType struct{}

func (e ErrQueueFullType) Error() string {
	return "job queue is full"
}

var ErrQueueFull = ErrQueueFullType{}
