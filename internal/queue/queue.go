package queue

import (
	"context"
	"encoding/json"
	"fmt"
	"job-executor/internal/models"
	"log/slog"
	"sync"
	"time"

	"github.com/rabbitmq/amqp091-go"
)

const (
	QueueName    = "job_queue"
	ExchangeName = "job_exchange"
)

type Queue interface {
	Push(job *models.Job) error
	StartConsumer(ctx context.Context, handler func(*models.Job)) error
	Close() error
}

type RabbitMQQueue struct {
	conn    *amqp091.Connection
	channel *amqp091.Channel
	mu      sync.RWMutex
}

func NewRabbitMQQueue(rabbitmqURL string) (*RabbitMQQueue, error) {
	conn, err := amqp091.Dial(rabbitmqURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to RabbitMQ: %w", err)
	}

	channel, err := conn.Channel()
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("failed to open channel: %w", err)
	}

	q := &RabbitMQQueue{
		conn:    conn,
		channel: channel,
	}

	// Setup exchange and queue
	if err := q.setupExchangeAndQueue(); err != nil {
		q.Close()
		return nil, fmt.Errorf("failed to setup exchange and queue: %w", err)
	}

	return q, nil
}

func (q *RabbitMQQueue) setupExchangeAndQueue() error {
	// Declare exchange
	if err := q.channel.ExchangeDeclare(
		ExchangeName, // name
		"direct",     // type
		true,         // durable
		false,        // auto-deleted
		false,        // internal
		false,        // no-wait
		nil,          // arguments
	); err != nil {
		return fmt.Errorf("failed to declare exchange: %w", err)
	}

	// Declare queue
	_, err := q.channel.QueueDeclare(
		QueueName, // name
		true,      // durable
		false,     // delete when unused
		false,     // exclusive
		false,     // no-wait
		nil,       // arguments
	)
	if err != nil {
		return fmt.Errorf("failed to declare queue: %w", err)
	}

	// Bind queue to exchange
	if err := q.channel.QueueBind(
		QueueName,    // queue name
		QueueName,    // routing key
		ExchangeName, // exchange
		false,
		nil,
	); err != nil {
		return fmt.Errorf("failed to bind queue: %w", err)
	}

	return nil
}

func (q *RabbitMQQueue) Push(job *models.Job) error {
	q.mu.RLock()
	defer q.mu.RUnlock()

	if q.channel == nil {
		return fmt.Errorf("queue is closed")
	}

	// Serialize job to JSON
	jobBytes, err := json.Marshal(job)
	if err != nil {
		return fmt.Errorf("failed to marshal job: %w", err)
	}

	// Publish to RabbitMQ
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	err = q.channel.PublishWithContext(
		ctx,
		ExchangeName, // exchange
		QueueName,    // routing key
		false,        // mandatory
		false,        // immediate
		amqp091.Publishing{
			DeliveryMode: amqp091.Persistent, // make message persistent
			ContentType:  "application/json",
			Body:         jobBytes,
			Timestamp:    time.Now(),
		},
	)
	if err != nil {
		return fmt.Errorf("failed to publish job: %w", err)
	}

	slog.Info("Job published to RabbitMQ", "job_id", job.ID)
	return nil
}

func (q *RabbitMQQueue) StartConsumer(ctx context.Context, handler func(*models.Job)) error {
	q.mu.RLock()
	defer q.mu.RUnlock()

	if q.channel == nil {
		return fmt.Errorf("queue is closed")
	}

	// Set QoS to process one message at a time
	if err := q.channel.Qos(1, 0, false); err != nil {
		return fmt.Errorf("failed to set QoS: %w", err)
	}

	// Start consuming
	msgs, err := q.channel.Consume(
		QueueName, // queue
		"",        // consumer
		false,     // auto-ack (we'll ack manually)
		false,     // exclusive
		false,     // no-local
		false,     // no-wait
		nil,       // args
	)
	if err != nil {
		return fmt.Errorf("failed to register consumer: %w", err)
	}

	slog.Info("Starting RabbitMQ consumer", "queue", QueueName)

	go func() {
		for {
			select {
			case <-ctx.Done():
				slog.Info("Consumer shutting down")
				return
			case msg, ok := <-msgs:
				if !ok {
					slog.Warn("Message channel closed")
					return
				}

				// Parse job from message
				var job models.Job
				if err := json.Unmarshal(msg.Body, &job); err != nil {
					slog.Error("Failed to unmarshal job", "error", err)
					msg.Nack(false, false) // reject and don't requeue
					continue
				}

				slog.Info("Received job from RabbitMQ", "job_id", job.ID)

				// Process job
				handler(&job)

				// Acknowledge message
				if err := msg.Ack(false); err != nil {
					slog.Error("Failed to ack message", "job_id", job.ID, "error", err)
				}
			}
		}
	}()

	return nil
}

func (q *RabbitMQQueue) Close() error {
	q.mu.Lock()
	defer q.mu.Unlock()

	var err error
	if q.channel != nil {
		if closeErr := q.channel.Close(); closeErr != nil {
			err = closeErr
		}
		q.channel = nil
	}

	if q.conn != nil {
		if closeErr := q.conn.Close(); closeErr != nil {
			err = closeErr
		}
		q.conn = nil
	}

	return err
}

// Legacy in-memory queue for backward compatibility
type InMemoryQueue struct {
	jobs chan *models.Job
	mu   sync.RWMutex
}

func NewInMemoryQueue() *InMemoryQueue {
	return &InMemoryQueue{
		jobs: make(chan *models.Job, 100), // buffered channel for 100 jobs
	}
}

func (q *InMemoryQueue) Push(job *models.Job) error {
	q.mu.Lock()
	defer q.mu.Unlock()
	
	select {
	case q.jobs <- job:
		return nil
	default:
		return ErrQueueFull
	}
}

func (q *InMemoryQueue) StartConsumer(ctx context.Context, handler func(*models.Job)) error {
	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case job := <-q.jobs:
				handler(job)
			}
		}
	}()
	return nil
}

func (q *InMemoryQueue) Close() error {
	q.mu.Lock()
	defer q.mu.Unlock()
	close(q.jobs)
	return nil
}

type ErrQueueFullType struct{}

func (e ErrQueueFullType) Error() string {
	return "job queue is full"
}

var ErrQueueFull = ErrQueueFullType{}
